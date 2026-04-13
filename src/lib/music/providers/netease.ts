/**
 * 网易云音乐 Provider
 */
import { MusicProvider, UnifiedTrack, SearchResult } from "../types";

const NETEASE_SEARCH_API = process.env.NETEASE_SEARCH_API || "https://api.vkeys.cn/v2/music/netease";
const NETEASE_LYRIC_API = process.env.NETEASE_LYRIC_API || "https://api.vkeys.cn/v2/music/netease/lyric";
const NETEASE_PLAY_API = process.env.NETEASE_PLAY_API || "https://api.qijieya.cn/meting/";

export class NeteaseProvider implements MusicProvider {
  name = "netease";

  async search(keyword: string, limit = 20): Promise<SearchResult> {
    try {
      const response = await fetch(`${NETEASE_SEARCH_API}?word=${encodeURIComponent(keyword)}&limit=${limit}`);
      const data = await response.json();
      
      const tracks: UnifiedTrack[] = (data.data || []).map((item: any) => ({
        id: item.id?.toString() || "",
        mid: item.id?.toString() || "",
        title: item.song || item.name || "",
        artist: item.singer || item.artist || "",
        album: item.album || "",
        cover: item.cover || "",
        url: item.url || "",
        lyric: "",
        source: "netease" as const,
        sourceLabel: "网易",
      }));

      return { tracks, source: "netease" };
    } catch (error) {
      console.error("Netease search error:", error);
      return { tracks: [], source: "netease" };
    }
  }

  async getPlayUrl(track: UnifiedTrack): Promise<string> {
    try {
      const response = await fetch(`${NETEASE_PLAY_API}?id=${track.id}&source=netease`);
      const data = await response.json();
      return data.url || data.music_url || "";
    } catch (error) {
      console.error("Netease play url error:", error);
      return "";
    }
  }

  async getLyric(track: UnifiedTrack): Promise<string> {
    try {
      const response = await fetch(`${NETEASE_LYRIC_API}?id=${track.id}`);
      const data = await response.json();
      return data.lrc || data.lyric || "";
    } catch (error) {
      console.error("Netease lyric error:", error);
      return "";
    }
  }
}

export const neteaseProvider = new NeteaseProvider();
