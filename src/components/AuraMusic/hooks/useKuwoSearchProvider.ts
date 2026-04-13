/**
 * 酷我搜索 Provider - 使用新的统一 API
 */
import { useState, useCallback } from "react";
import { SearchProvider, SearchResultItem } from "./useSearchProvider";
import { useI18n } from "./useI18n";
import { Song } from "../types";
import { searchKuwo, getAudioUrl, getLyricUrl } from "@/lib/music/adapters/kuwo-adapter";
import type { KuGouTrackInfo } from "../services/lyricsService";

const LIMIT = 30;

export interface KuwoTrackInfo extends KuGouTrackInfo {
  url?: string;
  lyricUrl?: string;
}

export interface KuwoSearchProviderExtended extends SearchProvider {
  performSearch: (query: string) => Promise<void>;
  hasSearched: boolean;
  results: KuwoTrackInfo[];
}

export const useKuwoSearchProvider = (): KuwoSearchProviderExtended => {
  const { dict } = useI18n();
  const [results, setResults] = useState<KuwoTrackInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

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
      const searchResults = await searchKuwo(query, LIMIT);
      
      // 添加 url 和 lyricUrl
      const tracksWithUrl: KuwoTrackInfo[] = searchResults.map(track => ({
        ...track,
        url: getAudioUrl(track as any),
        lyricUrl: getLyricUrl(track as any),
      }));
      
      setResults(tracksWithUrl);
      setHasMore(tracksWithUrl.length >= LIMIT);
    } catch (e) {
      console.error("Search failed:", e);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(
    async (query: string, offset: number, limit: number): Promise<SearchResultItem[]> => {
      if (isLoading || !hasMore) return [];

      setIsLoading(true);
      try {
        const searchResults = await searchKuwo(query, limit);
        
        if (searchResults.length === 0) {
          setHasMore(false);
          return [];
        } else {
          const tracksWithUrl: KuwoTrackInfo[] = searchResults.map(track => ({
            ...track,
            url: getAudioUrl(track as any),
            lyricUrl: getLyricUrl(track as any),
          }));
          setResults((prev) => [...prev, ...tracksWithUrl]);
          return tracksWithUrl;
        }
      } catch (e) {
        console.error("Load more failed:", e);
        setHasMore(false);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, hasMore]
  );

  const provider: KuwoSearchProviderExtended = {
    id: "kuwo",
    label: dict.search.cloudLabel || "🎵 酷我音乐",
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
