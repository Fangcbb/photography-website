import { fetchViaProxy } from "./utils";
import { isMetadataLine } from "./lyrics/types";

const NETEASE_API_PUBLIC = "https://netease-api.fangc.cc";
const METING_API = "https://api.qijieya.cn/meting/";
const NETEASE_SEARCH_API = "https://netease-api.fangc.cc/cloudsearch";

const NETEASECLOUD_API_BASE = "https://netease-api.fangc.cc";
const TTML_DB_BASE = "https://amll-ttml-db.stevexmh.net";
// QQ音乐搜索 API
const QQ_SEARCH_API = "https://api.uomg.com/api/song.search";

// 酷狗音乐 API (自建代理)
const KUGOU_API_BASE = "https://kugou-api.fangc.cc";

const TIMESTAMP_REGEX = /^\[(\d{2}):(\d{2})(?:[\.:](\d{2,3}))?\](.*)$/;

interface NeteaseApiArtist {
  name?: string;
}

interface NeteaseApiAlbum {
  name?: string;
  picUrl?: string;
}

interface NeteaseApiSong {
  id: number;
  name?: string;
  ar?: NeteaseApiArtist[];
  al?: NeteaseApiAlbum;
  dt?: number;
}

interface NeteaseSearchResponse {
  result?: {
    songs?: NeteaseApiSong[];
  };
}

interface NeteasePlaylistResponse {
  songs?: NeteaseApiSong[];
}

interface NeteaseSongDetailResponse {
  code?: number;
  songs?: NeteaseApiSong[];
}

export interface MatchedLyricsResult {
  lrc?: string;
  yrc?: string;
  tLrc?: string;
  ttml?: string;
  metadata: string[];
}

export interface NeteaseTrackInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl?: string;
  duration?: number;
  isNetease: boolean;
  neteaseId: string;
}

type SearchOptions = {
  limit?: number;
  offset?: number;
};

const formatArtists = (artists?: NeteaseApiArtist[]) =>
  (artists ?? [])
    .map((artist) => artist.name?.trim())
    .filter(Boolean)
    .join("/") || "";

const mapNeteaseSongToTrack = (song: NeteaseApiSong): NeteaseTrackInfo => ({
  id: song.id.toString(),
  title: song.name?.trim() ?? "",
  artist: formatArtists(song.ar),
  album: song.al?.name?.trim() ?? "",
  coverUrl: song.al?.picUrl?.replaceAll("http:", "https:"),
  duration: song.dt,
  isNetease: true,
  neteaseId: song.id.toString(),
});

const isMetadataTimestampLine = (line: string): boolean => {
  const trimmed = line.trim();
  const match = trimmed.match(TIMESTAMP_REGEX);
  if (!match) return false;
  const content = match[4].trim();
  return isMetadataLine(content);
};

const parseTimestampMetadata = (line: string) => {
  const match = line.trim().match(TIMESTAMP_REGEX);
  return match ? match[4].trim() : line.trim();
};

const isMetadataJsonLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return false;
  try {
    const json = JSON.parse(trimmed);
    // In NetEase lyric payloads, JSON lines are credit metadata entries.
    return Boolean(json.c && Array.isArray(json.c));
  } catch {
    // ignore invalid json
  }
  return false;
};

const parseJsonMetadata = (line: string) => {
  try {
    const json = JSON.parse(line.trim());
    if (json.c && Array.isArray(json.c)) {
      return json.c
        .map((item: any) => item.tx || "")
        .join("")
        .trim();
    }
  } catch {
    // ignore
  }
  return line.trim();
};

const extractMetadataLines = (content: string) => {
  const metadataSet = new Set<string>();
  const bodyLines: string[] = [];

  content.split("\n").forEach((line) => {
    if (!line.trim()) return;
    if (isMetadataTimestampLine(line)) {
      metadataSet.add(parseTimestampMetadata(line));
    } else if (isMetadataJsonLine(line)) {
      metadataSet.add(parseJsonMetadata(line));
    } else {
      bodyLines.push(line);
    }
  });

  return {
    clean: bodyLines.join("\n").trim(),
    metadata: Array.from(metadataSet),
  };
};

const TTML_META_LABELS: Record<string, string> = {
  musicName: "歌曲名",
  artists: "艺术家",
  album: "专辑",
  ttmlAuthorGithubLogin: "TTML 歌词贡献者",
};

const TTML_AUTHOR_KEY = "ttmlAuthorGithubLogin";
const TTML_SOURCE_TEXT = "TTML 歌词来源: AMLL TTML Database";
const TTML_META_KEYS = Object.keys(TTML_META_LABELS);
const TTML_DISPLAY_KEYS = TTML_META_KEYS.filter((key) => key !== TTML_AUTHOR_KEY);
const HAN_REGEX = /\p{Script=Han}/u;
const KANA_REGEX = /\p{Script=Hiragana}|\p{Script=Katakana}/u;
const HANGUL_REGEX = /\p{Script=Hangul}/u;
const LATIN_REGEX = /[A-Za-z]/;
const NETEASE_CONTRIBUTOR_REGEX = /^(歌词贡献者|翻译贡献者)\s*[:：]/;
const TTML_CONTRIBUTOR_REGEX = /^TTML 歌词贡献者\s*[:：]/;

const BAD_META_HINTS = [
  "instrumental",
  "伴奏",
  "和声伴奏",
  "和聲伴奏",
  "harmonic accompaniment",
  "オフボーカル",
  "화음 반주",
  "single",
  "单曲",
  "單曲",
];

const chineseRankOf = (lang?: string): number | null => {
  const value = lang?.trim().toLowerCase();
  if (!value) return null;
  if (!/^zh(?:-|$)/.test(value)) return null;
  if (/^zh(?:-hans|-cn|-sg)/.test(value)) return 0;
  if (value === "zh") return 1;
  if (/^zh(?:-hant|-tw|-hk|-mo)/.test(value)) return 2;
  return 1;
};

const hasHan = (value: string): boolean => {
  return HAN_REGEX.test(value);
};

const looksChinese = (value: string): boolean => {
  if (!hasHan(value)) return false;
  if (KANA_REGEX.test(value)) return false;
  if (HANGUL_REGEX.test(value)) return false;
  return true;
};

const scoreMeta = (value: string): number => {
  const text = value.trim();
  if (!text) return Number.POSITIVE_INFINITY;

  let score = text.length;

  if (!looksChinese(text)) score += 100;
  if (LATIN_REGEX.test(text)) score += 20;

  const lower = text.toLowerCase();
  BAD_META_HINTS.forEach((hint) => {
    if (lower.includes(hint)) {
      score += 30;
    }
  });

  return score;
};

const pickMeta = (key: string, list: string[]): string | undefined => {
  const uniq = list.filter((value, idx, arr) => arr.indexOf(value) === idx);
  if (uniq.length === 0) return undefined;

  if (key === "ttmlAuthorGithubLogin") {
    return uniq[0];
  }

  const best = uniq
    .map((value) => ({ value, score: scoreMeta(value) }))
    .sort((a, b) => a.score - b.score)[0];

  if (!best || !Number.isFinite(best.score) || best.score >= 100) {
    return undefined;
  }

  return best.value;
};

const parseXmlAttrs = (value: string): Record<string, string> => {
  const attrs: Record<string, string> = {};
  const regex = /([:\w-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(value)) !== null) {
    attrs[match[1]] = match[2]
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }

  return attrs;
};

export const extractTtmlMetadata = (content?: string): string[] => {
  if (!content) return [];

  const groups = new Map<string, string[]>();
  const regex = /<amll:meta\b([^>]*)\/>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const attrs = parseXmlAttrs(match[1]);
    const key = attrs.key?.trim();
    const value = attrs.value?.trim();
    if (!key || !value || !TTML_META_KEYS.includes(key)) continue;

    const list = groups.get(key) ?? [];
    list.push(value);
    groups.set(key, list);
  }

  const meta: string[] = [];

  TTML_DISPLAY_KEYS.forEach((key) => {
    const list = groups.get(key);
    if (!list?.length) return;

    const value = pickMeta(key, list);
    if (!value) return;
    meta.push(`${TTML_META_LABELS[key]}: ${value}`);
  });

  const author = groups.get(TTML_AUTHOR_KEY);
  const contributor = author?.length
    ? pickMeta(TTML_AUTHOR_KEY, author)
    : undefined;

  if (meta.length > 0 || contributor) meta.push(TTML_SOURCE_TEXT);
  if (contributor) {
    meta.push(`${TTML_META_LABELS[TTML_AUTHOR_KEY]}: ${contributor}`);
  }

  return meta;
};

const isNeteaseContributor = (text: string): boolean => {
  return NETEASE_CONTRIBUTOR_REGEX.test(text.trim());
};

const hasTtmlContributor = (list: string[]): boolean => {
  return list.some((text) => TTML_CONTRIBUTOR_REGEX.test(text.trim()));
};

export const mergeMetadata = (input: {
  lrc?: string[];
  yrc?: string[];
  translation?: string[];
  ttml?: string[];
  lyricUser?: string;
  transUser?: string;
}): string[] => {
  const ttml = input.ttml ?? [];
  const keepNeteaseContributors = !hasTtmlContributor(ttml);
  const filter = keepNeteaseContributors
    ? (text: string) => Boolean(text.trim())
    : (text: string) => Boolean(text.trim()) && !isNeteaseContributor(text);
  const meta = new Set<string>([
    ...(input.lrc ?? []).filter(filter),
    ...(input.yrc ?? []).filter(filter),
    ...(input.translation ?? []).filter(filter),
    ...ttml,
  ]);

  if (keepNeteaseContributors && input.transUser?.trim()) {
    meta.add(`翻译贡献者: ${input.transUser.trim()}`);
  }

  if (keepNeteaseContributors && input.lyricUser?.trim()) {
    meta.add(`歌词贡献者: ${input.lyricUser.trim()}`);
  }

  return Array.from(meta);
};

export const getNeteaseAudioUrl = (id: string) => {
  // Use server-side proxy to get audio (handles JSON response and redirects)
  return `/api/netease-play?id=${id}`;
};

const fetchTtmlByNeteaseId = async (id: string): Promise<string | null> => {
  const url = `${TTML_DB_BASE}/ncm/${encodeURIComponent(id)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status !== 404) {
        console.warn("TTML lyrics fetch failed", res.status, id);
      }
      return null;
    }

    const text = await res.text();
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (err) {
    console.error("TTML lyrics request error", err);
    return null;
  }
};

// Implements the search logic from the user provided code snippet
export const searchNetEase = async (
  keyword: string,
  options: SearchOptions = {},
): Promise<NeteaseTrackInfo[]> => {
  const { limit = 20, offset = 0 } = options;

  try {
    // Direct call to Netease API via ZM proxy (handles CORS)
    const url = `${NETEASE_SEARCH_API}?keywords=${encodeURIComponent(keyword)}&limit=${limit}&offset=${offset}`;
    const response = await fetch(url);
    const data = await response.json();
    const songs = data.result?.songs ?? [];

    if (songs.length === 0) {
      return [];
    }

    return songs.map(mapNeteaseSongToTrack);
  } catch (error) {
    console.error("NetEase search error", error);
    return [];
  }
};

// ===== QQ音乐搜索 =====
interface QQSong {
  songid?: number | string;
  name?: string;
  artistsname?: string;
  albumname?: string;
  picurl?: string;
  duration?: number;
}

interface QQSearchResponse {
  code?: number;
  data?: QQSong[];
}

export interface QQTrackInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl?: string;
  duration?: number;
  isNetease: false;
  neteaseId: string; // 兼容字段，实际存的是QQ音乐ID
  source?: "qq" | "kugou";
}

const mapQQSongToTrack = (song: QQSong): QQTrackInfo => {
  const songid = song.songid?.toString() ?? "";
  return {
    id: songid,
    title: song.name?.trim() ?? "",
    artist: song.artistsname?.trim() ?? "",
    album: song.albumname?.trim() ?? "",
    coverUrl: song.picurl?.replaceAll("http:", "https:"),
    duration: song.duration,
    isNetease: false,
    neteaseId: songid,
    source: "qq",
  };
};

// ===== 酷狗音乐搜索 =====
interface KuGouSong {
  Audioid?: number;
  FileHash?: string;
  SingerName?: string;
  AlbumName?: string;
  AlbumID?: string;
  Image?: string;
  Duration?: number;
  FileName?: string;
  OriSongName?: string;
  HQ?: { Hash?: string; FileSize?: number };
  SQ?: { Hash?: string; FileSize?: number };
  Res?: { Hash?: string; BitRate?: number; TimeLength?: number };
}

interface KuGouSearchResponse {
  error_msg?: string;
  status?: number;
  data?: {
    total?: number;
    lists?: KuGouSong[];
  };
}

export interface KuGouTrackInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl?: string;
  duration?: number;
  isNetease: false;
  neteaseId: string; // 兼容字段，实际存的是酷狗FileHash
  source: "kugou";
  hash: string;
  bestQuality?: "sq" | "hq" | "normal";
}

const mapKuGouSongToTrack = (song: KuGouSong): KuGouTrackInfo => {
  const hash = song.SQ?.Hash || song.HQ?.Hash || song.FileHash || "";
  // Determine best available quality
  let bestQuality: "sq" | "hq" | "normal" = "normal";
  if (song.SQ?.Hash) bestQuality = "sq";
  else if (song.HQ?.Hash) bestQuality = "hq";

  // Parse title from FileName (format: "歌手 - 歌名")
  const fileName = song.FileName || song.OriSongName || "";
  let title = song.OriSongName || "";
  let artist = song.SingerName || "";
  if (fileName && fileName.includes(" - ")) {
    const parts = fileName.split(" - ");
    artist = parts[0]?.trim() || artist;
    title = parts.slice(1).join(" - ").trim() || title;
  }

  return {
    id: hash,
    title: title || fileName,
    artist: artist,
    album: song.AlbumName || "",
    coverUrl: song.Image?.replaceAll("http:", "https:")?.replace("{size}", "150"),
    duration: song.Duration,
    isNetease: false,
    neteaseId: hash,
    source: "kugou",
    hash: hash,
    bestQuality,
  };
};

export const searchKuGou = async (
  keyword: string,
  options: SearchOptions = {},
): Promise<KuGouTrackInfo[]> => {
  const { limit = 20 } = options;
  try {
    // Use kugou-music-api (deployed at kugou-api.fangc.cc) with CORS proxy
    const apiUrl = `https://kugou-api.fangc.cc/search?keyword=${encodeURIComponent(keyword)}&pagesize=${limit}`;
    const response = await fetchViaProxy(apiUrl) as KuGouSearchResponse;
    if (response.status !== 1 || !response.data?.lists?.length) {
      return [];
    }
    return response.data.lists.map(mapKuGouSongToTrack);
  } catch (error) {
    console.error("KuGou search error", error);
    return [];
  }
};

export const searchQQMusic = async (
  keyword: string,
  options: SearchOptions = {},
): Promise<QQTrackInfo[]> => {
  const { limit = 20 } = options;

  try {
    // Original: use QQ music API via fetchViaProxy
    const url = `${QQ_SEARCH_API}?name=${encodeURIComponent(keyword)}&pagesize=${limit}`;
    const response = (await fetchViaProxy(url)) as QQSearchResponse;
    if (response.code !== 1 || !response.data || response.data.length === 0) {
      return [];
    }
    return response.data.map(mapQQSongToTrack);
  } catch (error) {
    console.error("QQ music search error", error);
    return [];
  }
};

// ===== 网易云搜索 =====
export type AnySearchTrack = NeteaseTrackInfo;
export type SearchEngine = "netease";
export const SEARCH_ENGINE_LABELS: Record<SearchEngine, string> = {
  netease: "☁️ 网易云",
};

// 搜索指定引擎
export const searchByEngine = async (
  engine: SearchEngine,
  keyword: string,
  options: SearchOptions = {},
): Promise<AnySearchTrack[]> => {
  return await searchNetEase(keyword, options);
};

export const searchWithBackup = async (
  keyword: string,
  options: SearchOptions = {},
): Promise<AnySearchTrack[]> => {
  // 先尝试酷狗
  try {
    const kugouResults = await searchKuGou(keyword, options);
    if (kugouResults.length > 0) {
      console.log("[Search] KuGou found", kugouResults.length, "results");
      return kugouResults;
    }
  } catch (e) {
    console.warn("[Search] KuGou failed, trying NetEase:", e);
  }

  // 酷狗无结果，尝试网易云
  try {
    const results = await searchNetEase(keyword, options);
    if (results.length > 0) {
      console.log("[Search] NetEase found", results.length, "results");
      return results;
    }
  } catch (e) {
    console.warn("[Search] NetEase failed, trying QQ music:", e);
  }

  // 网易云也无结果，尝试QQ音乐
  console.log("[Search] Falling back to QQ music...");
  try {
    const qqResults = await searchQQMusic(keyword, options);
    if (qqResults.length > 0) {
      console.log("[Search] QQ music found", qqResults.length, "results");
      return qqResults;
    }
  } catch (e) {
    console.error("[Search] QQ music also failed:", e);
  }

  return [];
};

// 获取酷狗音乐播放地址
export const getKuGouAudioUrl = async (
  hash: string,
  quality: "sq" | "hq" | "normal" = "sq",
): Promise<string | null> => {
  try {
    const qualityParam = quality === "sq" ? 320 : quality === "hq" ? 256 : 128;
    const url = `${KUGOU_API_BASE}/song/url?hash=${hash}&quality=${qualityParam}`;
    const response = await fetch(url);
    const data = await response.json() as { status?: number; url?: string[] };
    if (data.status === 1 && data.url && data.url.length > 0) {
      return data.url[0] ?? null;
    }
    // Fallback to normal quality
    if (quality !== "normal") {
      return getKuGouAudioUrl(hash, "normal");
    }
    return null;
  } catch (error) {
    console.error("KuGou audio URL error", error);
    return null;
  }
};

export const fetchNeteasePlaylist = async (
  playlistId: string,
): Promise<NeteaseTrackInfo[]> => {
  try {
    // 使用網易雲音樂 API 獲取歌單所有歌曲
    // 由於接口限制，需要分頁獲取，每次獲取 50 首
    const allTracks: NeteaseTrackInfo[] = [];
    const limit = 50;
    let offset = 0;
    let shouldContinue = true;

    while (shouldContinue) {
      const url = `${NETEASECLOUD_API_BASE}/playlist/track/all?id=${playlistId}&limit=${limit}&offset=${offset}`;
      const data = (await fetchViaProxy(url)) as NeteasePlaylistResponse;
      const songs = data.songs ?? [];
      if (songs.length === 0) {
        break;
      }

      const tracks = songs.map(mapNeteaseSongToTrack);

      allTracks.push(...tracks);

      // Continue fetching if the current page was full
      if (songs.length < limit) {
        shouldContinue = false;
      } else {
        offset += limit;
      }
    }

    return allTracks;
  } catch (e) {
    console.error("Playlist fetch error", e);
    return [];
  }
};

export const fetchNeteaseSong = async (
  songId: string,
): Promise<NeteaseTrackInfo | null> => {
  try {
    const url = `${NETEASECLOUD_API_BASE}/song/detail?ids=${songId}`;
    const data = (await fetchViaProxy(url)) as NeteaseSongDetailResponse;
    const track = data.songs?.[0];
    if (data.code === 200 && track) {
      return mapNeteaseSongToTrack(track);
    }
    return null;
  } catch (e) {
    console.error("Song fetch error", e);
    return null;
  }
};

// Keeps the old search for lyric matching fallbacks
export const searchAndMatchLyrics = async (
  title: string,
  artist: string,
): Promise<MatchedLyricsResult | null> => {
  try {
    const songs = await searchNetEase(`${title} ${artist}`, { limit: 5 });

    if (songs.length === 0) {
      console.warn("No songs found on Cloud");
      return null;
    }

    const songId = songs[0].id;
    console.log(`Found Song ID: ${songId}`);

    const lyricsResult = await fetchLyricsById(songId);
    return lyricsResult;
  } catch (error) {
    console.error("Cloud lyrics match failed:", error);
    return null;
  }
};

export const fetchLyricsById = async (
  songId: string,
): Promise<MatchedLyricsResult | null> => {
  try {
    // Fetch TTML and NetEase lyrics in parallel
    const [ttmlContent, lyricDataResult] = await Promise.all([
      fetchTtmlByNeteaseId(songId),
      (async () => {
        const lyricUrl = `${NETEASECLOUD_API_BASE}/lyric/new?id=${songId}`;
        try {
          return await fetchViaProxy(lyricUrl);
        } catch (err) {
          console.error("Lyric fetch error", err);
          return null;
        }
      })(),
    ]);

    const lyricData = lyricDataResult as any;

    const rawYrc: string | undefined = lyricData?.yrc?.lyric;
    const rawLrc: string | undefined = lyricData?.lrc?.lyric;
    const rawTLrc: string | undefined = lyricData?.tlyric?.lyric;
    const rawYtl: string | undefined = lyricData?.ytlrc?.lyric;

    const lrcMeta = rawLrc
      ? extractMetadataLines(rawLrc)
      : { clean: undefined, metadata: [] };
    const yrcMeta = rawYrc
      ? extractMetadataLines(rawYrc)
      : { clean: undefined, metadata: [] };

    const rawTranslation = rawTLrc?.trim() ? rawTLrc : rawYtl;

    let cleanTranslation: string | undefined;
    let translationMetadata: string[] = [];
    if (rawTranslation) {
      const result = extractMetadataLines(rawTranslation);
      cleanTranslation = result.clean;
      translationMetadata = result.metadata;
    }

    const ttmlMetadata = extractTtmlMetadata(ttmlContent ?? undefined);

    const metadata = mergeMetadata({
      lrc: lrcMeta.metadata,
      yrc: yrcMeta.metadata,
      translation: translationMetadata,
      ttml: ttmlMetadata,
      lyricUser: lyricData?.lyricUser?.nickname,
      transUser: lyricData?.transUser?.nickname,
    });

    const baseLyrics = lrcMeta.clean || yrcMeta.clean || rawLrc || rawYrc;

    if (!ttmlContent && !baseLyrics) {
      return null;
    }

    const yrcForEnrichment =
      yrcMeta.clean && lrcMeta.clean ? yrcMeta.clean : undefined;

    return {
      lrc: baseLyrics,
      yrc: yrcForEnrichment,
      tLrc: cleanTranslation,
      ttml: ttmlContent ?? undefined,
      metadata,
    };
  } catch (e) {
    console.error("Lyric fetch pipeline error", e);
    return null;
  }
};

// ============================================================================
// 精品歌单 API
// ============================================================================
export interface NeteaseHighQualityPlaylist {
  id: number;
  name: string;
  coverImgUrl: string;
  creator: { nickname: string };
  playCount: number;
  trackCount: number;
  description: string;
  tags: string[];
}

export interface NeteaseHighQualityResponse {
  code: number;
  total: number;
  playlists: NeteaseHighQualityPlaylist[];
}

export const fetchHighQualityPlaylists = async (
  cat: string = "全部",
  limit: number = 20,
  before?: number,
): Promise<{ playlists: NeteaseHighQualityPlaylist[]; lasttime: number | null }> => {
  try {
    const params = new URLSearchParams({
      cat,
      limit: String(limit),
      ...(before ? { before: String(before) } : {}),
    });
    const url = `${NETEASECLOUD_API_BASE}/top/playlist/highquality?${params}`;
    const data = (await fetchViaProxy(url)) as NeteaseHighQualityResponse;
    if (data.code === 200) {
      return {
        playlists: data.playlists ?? [],
        lasttime: data.playlists.length > 0
          ? (data.playlists[data.playlists.length - 1] as unknown as { updateTime: number }).updateTime ?? null
          : null,
      };
    }
    return { playlists: [], lasttime: null };
  } catch (e) {
    console.error("HighQualityPlaylist fetch error", e);
    return { playlists: [], lasttime: null };
  }
};

export const fetchTimelinePlaylists = async (
  limit: number = 20,
  before?: number,
): Promise<{ playlists: NeteaseHighQualityPlaylist[]; lasttime: number | null }> => {
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      ...(before ? { before: String(before) } : {}),
    });
    const url = `${NETEASECLOUD_API_BASE}/top/playlist/timeline?${params}`;
    const data = (await fetchViaProxy(url)) as NeteaseHighQualityResponse;
    if (data.code === 200) {
      return {
        playlists: data.playlists ?? [],
        lasttime: data.playlists.length > 0
          ? (data.playlists[data.playlists.length - 1] as unknown as { updateTime: number }).updateTime ?? null
          : null,
      };
    }
    return { playlists: [], lasttime: null };
  } catch (e) {
    console.error("TimelinePlaylist fetch error", e);
    return { playlists: [], lasttime: null };
  }
};

// Fetch chart playlist (飙升榜/热歌榜) - returns songs directly
export const fetchChartData = async (id: string): Promise<NeteaseTrackInfo[]> => {
  try {
    const url = `${NETEASECLOUD_API_BASE}/top/list?id=${id}&limit=50`;
    const data = await fetchViaProxy(url) as { playlist?: { tracks?: NeteaseApiSong[] }; code: number };
    if (data.code === 200 && Array.isArray(data.playlist?.tracks)) {
      return data.playlist.tracks.map(mapNeteaseSongToTrack);
    }
    return [];
  } catch (e) {
    console.error("ChartData fetch error", e);
    return [];
  }
};
