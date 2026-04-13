/**
 * 酷我音乐 Provider
 */
import { MusicProvider, UnifiedTrack, SearchResult } from "../types";

const KUWO_API = process.env.KUWO_API || "https://kw-api.cenguigui.cn/";

export class KuwoProvider implements MusicProvider {
  name = "kuwo";

  async search(keyword: string, limit = 20): Promise<SearchResult> {
    try {
      const response = await fetch(`${KUWO_API}?name=${encodeURIComponent(keyword)}&count=${limit}`);
      const data = await response.json();
      
      const tracks: UnifiedTrack[] = (data.data || []).map((item: any) => {
        const id = item.rid?.toString() || item.id?.toString() || "";
        return {
          id,
          mid: item.rid?.toString() || "",
          title: item.name || item.title || "",
          artist: item.artist || item.singer || "",
          album: item.album || item.albumName || "",
          cover: item.pic || item.cover || "",
          // 使用代理 URL 解决 CORS 问题
          url: `/api/music/play?id=${id}`,
          lyric: item.lrc || item.lyric || "",
          source: "kuwo" as const,
          sourceLabel: "酷我",
        };
      });

      return { tracks, source: "kuwo" };
    } catch (error) {
      console.error("Kuwo search error:", error);
      return { tracks: [], source: "kuwo" };
    }
  }

  async getPlayUrl(track: UnifiedTrack): Promise<string> {
    try {
      const response = await fetch(`${KUWO_API}?rid=${track.id}`);
      const data = await response.json();
      return data.url || data.musicUrl || "";
    } catch (error) {
      console.error("Kuwo play url error:", error);
      return "";
    }
  }

  async getLyric(track: UnifiedTrack): Promise<string> {
    if (track.lyric) return track.lyric;
    try {
      const response = await fetch(`${KUWO_API}?id=${track.id}&type=lyr&format=all`);
      const data = await response.json();
      const lrclist = data.data?.lrclist;
      // lrclist 可能是字符串（LRC 格式）或数组（JSON 格式）
      if (typeof lrclist === 'string' && lrclist.trim()) {
        return lrclist;
      }
      if (Array.isArray(lrclist) && lrclist.length > 0) {
        // 将 JSON 格式转换为标准 LRC 文本格式
        return lrclist.map((item: any) => {
          const time = item.time || item.lyricTime || 0;
          const minutes = Math.floor(time / 60);
          const seconds = (time % 60).toFixed(3);
          const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.padStart(6, '0')}`;
          return `[${timeStr}]${item.lineLyric || item.lyric || ''}`;
        }).join('\n');
      }
      return data.data?.lrc || data.data || "";
    } catch (error) {
      console.error("Kuwo lyric error:", error);
      return "";
    }
  }
}

export const kuwoProvider = new KuwoProvider();
