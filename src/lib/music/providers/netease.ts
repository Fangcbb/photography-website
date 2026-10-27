/**
 * 网易云音乐 Provider（替换失效的酷我API）
 * 通过本地 music-api 服务（@suen/music-api 封装 + 网易web搜索直连）
 */
import { MusicProvider, UnifiedTrack, SearchResult } from "../types";

const API = process.env.MUSIC_API_BASE || "http://127.0.0.1:3333/api";

export class NeteaseProvider implements MusicProvider {
  name = "netease";

  async search(keyword: string, limit = 20): Promise<SearchResult> {
    try {
      const response = await fetch(
        `${API}/search?keywords=${encodeURIComponent(keyword)}&limit=${limit}`,
        { signal: AbortSignal.timeout(10000) }
      );
      const data = await response.json();
      const tracks: UnifiedTrack[] = (data.data?.songs || []).map((item: any) => ({
        id: item.id?.toString() || "",
        mid: item.id?.toString() || "",
        title: item.name || "",
        artist: item.artist || "",
        album: item.album || "",
        cover: item.picUrl || "",
        url: `/api/music/play?id=${item.id}`,
        lyric: "",
        source: "netease" as const,
        sourceLabel: "网易云",
      }));
      return { tracks, source: "netease" };
    } catch (error) {
      console.error("Netease search error:", error);
      return { tracks: [], source: "netease" };
    }
  }

  async getPlayUrl(track: UnifiedTrack): Promise<string> {
    try {
      const response = await fetch(`${API}/url?id=${track.id}&br=320000`, {
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      return data.data?.url || "";
    } catch (error) {
      console.error("Netease play url error:", error);
      return "";
    }
  }

  async getLyric(track: UnifiedTrack): Promise<string> {
    try {
      const response = await fetch(`${API}/lyric2?id=${track.id}`, {
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      return data.lrc?.lyric || "";
    } catch (error) {
      console.error("Netease lyric error:", error);
      return "";
    }
  }
}

export const neteaseProvider = new NeteaseProvider();
