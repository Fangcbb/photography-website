/**
 * 搜索 Provider - 使用新的统一酷我 API
 */
import { useState, useCallback } from "react";
import { SearchProvider, SearchResultItem } from "./useSearchProvider";
import { useI18n } from "./useI18n";
import type { NeteaseTrackInfo, AnySearchTrack } from "../services/lyricsService";
import type { KuGouTrackInfo } from "../services/lyricsService";

// 导入新的搜索适配器
import { searchKuwo, getLyricUrl } from "@/lib/music/adapters/kuwo-adapter";

const LIMIT = 35;

// 使用 KuGouTrackInfo 作为结果类型（兼容前端）
export type AnyTrackInfo = KuGouTrackInfo & { url?: string; lyricUrl?: string };

export interface NeteaseSearchProviderExtended extends SearchProvider {
  performSearch: (query: string) => Promise<void>;
  hasSearched: boolean;
  results: AnyTrackInfo[];
}

export const useNeteaseSearchProvider = (): NeteaseSearchProviderExtended => {
  const { dict } = useI18n();
  const [results, setResults] = useState<AnyTrackInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  const doSearch = useCallback(async (query: string, offset = 0) => {
    // 使用新的统一 API（酷我）
    const searchResults = await searchKuwo(query, LIMIT);
    
    // 添加歌词 URL
    const tracksWithLyric = searchResults.map(track => ({
      ...track,
      lyricUrl: getLyricUrl(track as any),
    }));
    
    return tracksWithLyric;
  }, []);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    setResults([]);
    setHasMore(true);

    try {
      const searchResults = await doSearch(query, 0);
      setResults(searchResults);
      setHasMore(searchResults.length >= LIMIT);
    } catch (e) {
      console.error("Search failed:", e);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [doSearch]);

  const loadMore = useCallback(
    async (query: string, offset: number, limit: number): Promise<SearchResultItem[]> => {
      if (isLoading || !hasMore) return [];

      setIsLoading(true);
      try {
        const searchResults = await doSearch(query, offset);

        if (searchResults.length === 0) {
          setHasMore(false);
          return [];
        } else {
          setResults((prev) => [...prev, ...searchResults]);
          return searchResults;
        }
      } catch (e) {
        console.error("Load more failed:", e);
        setHasMore(false);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, hasMore, doSearch]
  );

  const provider: NeteaseSearchProviderExtended = {
    id: "kuwo",
    label: "在线搜索",
    requiresExplicitSearch: true,
    isLoading,
    hasMore,
    hasSearched,
    results,

    search: async (query: string): Promise<SearchResultItem[]> => {
      return results;
    },

    loadMore,
    performSearch,
  };

  return provider;
};
