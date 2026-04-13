/**
 * 酷我音乐适配器 - 将统一 API 格式转换为前端期望的格式
 */
import type { KuGouTrackInfo } from "@/components/AuraMusic/services/lyricsService";

// 从统一 API 返回的轨道格式
export interface UnifiedTrack {
  id: string;
  mid: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  url: string;
  lyric: string;
  source: "kuwo";
  sourceLabel: "酷我";
}

/**
 * 计算搜索相关性分数（越高越相关）
 * 关键词在歌名/歌手中出现的位置越靠前、越完整，分数越高
 */
function calculateRelevanceScore(keyword: string, title: string, artist: string): number {
  const kw = keyword.toLowerCase().trim();
  const t = title.toLowerCase();
  const a = artist.toLowerCase();
  
  let score = 0;
  
  // 1. 歌名完全匹配（包含关键词）
  if (t.includes(kw)) {
    score += 100;
    
    // 歌名开头匹配（最高优先级）
    if (t.startsWith(kw)) {
      score += 50;
    }
    
    // 歌名完整匹配（等号）
    if (t === kw) {
      score += 100;
    }
    
    // 计算关键词在歌名中的位置（越靠前分数越高）
    const index = t.indexOf(kw);
    score += Math.max(0, 20 - Math.floor(index / 5));
  }
  
  // 2. 歌手名包含关键词
  if (a.includes(kw)) {
    score += 30;
    
    // 歌手名开头匹配
    if (a.startsWith(kw)) {
      score += 20;
    }
  }
  
  // 3. 专辑名包含关键词（权重较低）
  // (暂不添加，避免干扰)
  
  return score;
}

/**
 * 对搜索结果进行相关性排序
 */
function sortByRelevance(keyword: string, tracks: UnifiedTrack[]): UnifiedTrack[] {
  return tracks.sort((a, b) => {
    const scoreA = calculateRelevanceScore(keyword, a.title, a.artist);
    const scoreB = calculateRelevanceScore(keyword, b.title, b.artist);
    return scoreB - scoreA; // 降序排列
  });
}

/**
 * 将统一轨道格式转换为酷狗格式（兼容前端）
 */
export function mapUnifiedToKuGou(track: UnifiedTrack): KuGouTrackInfo & { url?: string } {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    coverUrl: track.cover,
    duration: 0,
    isNetease: false,
    neteaseId: track.id,
    source: "kugou" as const,
    hash: track.id,
    bestQuality: "sq" as const,
    url: track.url, // 传递 URL
  };
}

/**
 * 搜索音乐（使用统一 API + 本地相关性排序）
 */
export async function searchKuwo(keyword: string, limit = 20): Promise<(KuGouTrackInfo & { url?: string })[]> {
  try {
    const response = await fetch(`/api/music/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`);
    const data = await response.json();
    
    if (!data.success || !data.data?.tracks) {
      return [];
    }
    
    // 获取原始结果
    const tracks: UnifiedTrack[] = data.data.tracks;
    
    // 本地相关性排序
    const sortedTracks = sortByRelevance(keyword, tracks);
    
    // 转换格式
    return sortedTracks.map(mapUnifiedToKuGou);
  } catch (error) {
    console.error("Kuwo search error:", error);
    return [];
  }
}

/**
 * 获取音频 URL（通过后端代理解决 CORS）
 */
export function getAudioUrl(track: KuGouTrackInfo & { url?: string }): string {
  // 使用后端代理解决 CORS 问题
  return `/api/music/play?id=${track.id}`;
}

/**
 * 获取歌词 URL
 */
export function getLyricUrl(track: KuGouTrackInfo): string {
  return `/api/music/lyric?id=${track.id}`;
}

/**
 * 获取歌词内容（通过后端代理解决 CORS）
 */
export async function fetchKuwoLyrics(trackId: string): Promise<string> {
  try {
    const response = await fetch(`/api/music/lyric?id=${trackId}`);
    const data = await response.json();
    return data.lyric || "";
  } catch (error) {
    console.error("Kuwo lyrics fetch error:", error);
    return "";
  }
}
