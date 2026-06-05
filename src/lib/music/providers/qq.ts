/**
 * QQ音乐 Provider - 带正确的请求头
 */
import { MusicProvider, UnifiedTrack, SearchResult } from "../types";

const QQ_SEARCH_API = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const QQ_LYRICS_API = "https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg";

const HEADERS = {
  "Referer": "https://y.qq.com/",
  "Origin": "https://y.qq.com",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export class QQProvider implements MusicProvider {
  name = "qq";

  async search(keyword: string, limit = 20): Promise<SearchResult> {
    try {
      const response = await fetch(QQ_SEARCH_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...HEADERS,
        },
        body: JSON.stringify({
          comm: { ct: 24, cv: 0 },
          req: {
            module: "music.search.SearchCgiService",
            method: "DoSearchForQQMusicDesktop",
            param: {
              query: keyword,
              page_num: 1,
              num_per_page: limit,
            },
          },
        }),
      });
      
      const data = await response.json();
      
      // 尝试多个可能的数据路径
      let list: any[] = [];
      
      // 路径1: data.body.song.list
      if (data.req?.data?.body?.song?.list) {
        list = data.req.data.body.song.list;
      }
      // 路径2: data.body.songlist.list
      else if (data.req?.data?.body?.songlist?.list) {
        list = data.req.data.body.songlist.list;
      }
      
      const tracks: UnifiedTrack[] = list.map((item: any) => ({
        id: item.songmid?.toString() || item.songId?.toString() || "",
        mid: item.songmid?.toString() || "",
        title: item.songname || item.title || "",
        artist: item.singer?.[0]?.name || item.artist || "",
        album: item.albumname || "",
        cover: item.albumpic || item.albumUrl || "",
        url: "",
        lyric: "",
        source: "qq" as const,
        sourceLabel: "QQ",
      }));

      return { tracks, source: "qq" };
    } catch (error) {
      console.error("QQ search error:", error);
      return { tracks: [], source: "qq" };
    }
  }

  async getPlayUrl(track: UnifiedTrack): Promise<string> {
    try {
      const response = await fetch(QQ_SEARCH_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...HEADERS,
        },
        body: JSON.stringify({
          req_0: {
            module: "vkey.GetVkeyServer",
            method: "CgiGetVkey",
            param: {
              guid: Math.floor(Math.random() * 1000000000).toString(),
              songmid: [track.mid],
              songtype: [0],
              uin: "0",
              loginflag: 1,
              platform: "20",
            },
          },
        }),
      });
      
      const data = await response.json();
      const midurlinfo = data.req_0?.data?.midurlinfo?.[0];
      return midurlinfo?.purl || "";
    } catch (error) {
      console.error("QQ play url error:", error);
      return "";
    }
  }

  async getLyric(track: UnifiedTrack): Promise<string> {
    try {
      const response = await fetch(`${QQ_LYRICS_API}?songmid=${track.mid}&format=json`, {
        headers: HEADERS,
      });
      const data = await response.json();
      return data.lyric || data.response?.lyric || "";
    } catch (error) {
      console.error("QQ lyric error:", error);
      return "";
    }
  }
}

export const qqProvider = new QQProvider();
