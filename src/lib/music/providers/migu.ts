/**
 * 咪咕音乐 Provider - 带正确的请求头
 */
import { MusicProvider, UnifiedTrack, SearchResult } from "../types";

const MIGU_SEARCH_API = "https://m.music.migu.cn/migumusic/h5/search/all";
const MIGU_PLAY_API = "https://music.migu.cn/v3/api/music/audioPlayer/getPlayInfo";
const MIGU_LYRICS_API = "https://music.migu.cn/v3/api/music/audioPlayer/getLyric";

const HEADERS = {
  "Referer": "https://music.migu.cn/",
  "Origin": "https://music.migu.cn",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export class MiguProvider implements MusicProvider {
  name = "migu";

  async search(keyword: string, limit = 20): Promise<SearchResult> {
    try {
      const response = await fetch(
        `${MIGU_SEARCH_API}?keyword=${encodeURIComponent(keyword)}&pageNo=1&pageSize=${limit}`,
        { headers: HEADERS }
      );
      
      const contentType = response.headers.get("content-type");
      
      // 如果返回 HTML（需要 JavaScript 渲染），尝试 JSON API
      if (contentType?.includes("text/html")) {
        return this.searchJsonApi(keyword, limit);
      }
      
      const data = await response.json();
      return this.parseSearchResult(data);
    } catch (error) {
      console.error("Migu search error:", error);
      return this.searchJsonApi(keyword, limit);
    }
  }
  
  // 尝试 JSON API
  private async searchJsonApi(keyword: string, limit: number): Promise<SearchResult> {
    try {
      // 尝试 PC 版 API
      const response = await fetch(
        `https://music.migu.cn/v3/api/search/searchAll?keyword=${encodeURIComponent(keyword)}&pageSize=${limit}`,
        { headers: HEADERS }
      );
      
      const data = await response.json();
      return this.parseSearchResult(data);
    } catch {
      return { tracks: [], source: "migu" };
    }
  }
  
  private parseSearchResult(data: any): SearchResult {
    // 咪咕可能有多种返回格式
    let songs: any[] = [];
    
    // 格式1: data.result.songs
    if (data?.result?.songs) {
      songs = data.result.songs;
    }
    // 格式2: data.data.song.data
    else if (data?.data?.song?.data) {
      songs = data.data.song.data;
    }
    // 格式3: data.songs
    else if (data?.songs) {
      songs = data.songs;
    }
    
    const tracks: UnifiedTrack[] = songs.map((item: any) => ({
      id: item.id?.toString() || item.songId?.toString() || "",
      mid: item.copyrightId?.toString() || item.id?.toString() || "",
      title: item.name || item.songName || "",
      artist: item.artist || item.singers?.[0]?.name || "",
      album: item.album || item.albumName || "",
      cover: item.cover || item.albumImg || "",
      url: "",
      lyric: "",
      source: "migu" as const,
      sourceLabel: "咪咕",
    }));

    return { tracks, source: "migu" };
  }

  async getPlayUrl(track: UnifiedTrack): Promise<string> {
    try {
      const response = await fetch(
        `${MIGU_PLAY_API}?dataType=2&songId=${track.id}`,
        { headers: HEADERS }
      );
      const data = await response.json();
      return data?.data?.playUrl || data?.data?.url || "";
    } catch (error) {
      console.error("Migu play url error:", error);
      return "";
    }
  }

  async getLyric(track: UnifiedTrack): Promise<string> {
    try {
      const response = await fetch(
        `${MIGU_LYRICS_API}?dataType=2&songId=${track.id}`,
        { headers: HEADERS }
      );
      const data = await response.json();
      return data?.data?.lyric || data?.data?.lrc || "";
    } catch (error) {
      console.error("Migu lyric error:", error);
      return "";
    }
  }
}

export const miguProvider = new MiguProvider();
