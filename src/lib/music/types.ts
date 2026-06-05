/**
 * 统一音乐 API 数据结构
 */
export interface UnifiedTrack {
  id: string;
  mid: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  url: string;
  lyric: string;
  source: "netease" | "qq" | "kuwo" | "migu";
  sourceLabel: string;
}

export interface SearchResult {
  tracks: UnifiedTrack[];
  source: string;
}

export interface MusicProvider {
  name: string;
  
  search(keyword: string, limit?: number): Promise<SearchResult>;
  getPlayUrl(track: UnifiedTrack): Promise<string>;
  getLyric(track: UnifiedTrack): Promise<string>;
}
