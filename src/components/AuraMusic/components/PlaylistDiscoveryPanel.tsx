import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, PlayIcon, QueueMusicIcon } from "./Icons";
import SmartImage from "./SmartImage";
import { fetchHighQualityPlaylists, fetchNeteasePlaylist, getNeteaseAudioUrl } from "../services/lyricsService";
import type { NeteaseHighQualityPlaylist } from "../services/lyricsService";
import { Song } from "../types";
import { useI18n } from "../hooks/useI18n";

interface PlaylistDiscoveryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMultipleAndPlay: (songs: Song[], startIndex?: number) => void;
  currentSong: Song | null;
}

const PANEL_STYLES = `
  @keyframes panel-in {
      0% { opacity: 0; transform: scale(0.96) translateY(-8px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes panel-out {
      0% { opacity: 1; transform: scale(1) translateY(0); }
      100% { opacity: 0; transform: scale(0.98) translateY(4px); }
  }
  .discovery-panel-in { animation: panel-in 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
  .discovery-panel-out { animation: panel-out 0.15s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
`;

const PlaylistDiscoveryPanel: React.FC<PlaylistDiscoveryPanelProps> = ({
  isOpen,
  onClose,
  onAddMultipleAndPlay,
  currentSong,
}) => {
  const { dict } = useI18n();
  const [playlists, setPlaylists] = useState<NeteaseHighQualityPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPlaylistId, setLoadingPlaylistId] = useState<number | null>(null);
  const [lasttime, setLasttime] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch playlists on open
  useEffect(() => {
    if (!isOpen || playlists.length > 0) return;
    setLoading(true);
    fetchHighQualityPlaylists("全部", 20).then((res) => {
      setPlaylists(res.playlists);
      setLasttime(res.lasttime);
      setHasMore(res.playlists.length === 20);
      setLoading(false);
    });
  }, [isOpen]);

  // Infinite scroll
  useEffect(() => {
    if (!isOpen || !hasMore || !loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          setLoading(true);
          fetchHighQualityPlaylists("全部", 20, lasttime ?? undefined).then((res) => {
            setPlaylists((prev) => [...prev, ...res.playlists]);
            setLasttime(res.lasttime);
            setHasMore(res.playlists.length === 20);
            setLoading(false);
          });
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [isOpen, hasMore, loading, lasttime]);

  // Close on Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const handlePlaylistClick = async (playlist: NeteaseHighQualityPlaylist) => {
    setLoadingPlaylistId(playlist.id);
    const tracks = await fetchNeteasePlaylist(String(playlist.id));
    if (tracks.length > 0) {
      const songs: Song[] = tracks.map((t) => {
        const trackOrigin = getNeteaseAudioUrl(t.id);
        return {
          id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          coverUrl: t.coverUrl ?? "",
          fileUrl: trackOrigin,
          source: "remote" as const,
          origin: trackOrigin,
          isNetease: true,
          neteaseId: t.id,
          lyrics: [],
        };
      });
      onAddMultipleAndPlay(songs, 0);
      onClose();
    }
    setLoadingPlaylistId(null);
  };

  const formatCount = (n: number) => {
    if (n >= 100000000) return (n / 100000000).toFixed(1) + "亿";
    if (n >= 10000) return (n / 10000).toFixed(1) + "万";
    return String(n);
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <style>{PANEL_STYLES}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[81] w-[90vw] max-w-2xl max-h-[75vh] rounded-2xl overflow-hidden discovery-panel-in"
        style={{
          background: "rgba(10, 10, 10, 0.92)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <QueueMusicIcon className="w-5 h-5 text-white/60" />
            <span className="text-white/90 font-medium text-sm">精品歌单</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto overscroll-none" style={{ maxHeight: "calc(75vh - 60px)" }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
            {playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => handlePlaylistClick(pl)}
                disabled={loadingPlaylistId === pl.id}
                className="group text-left rounded-xl overflow-hidden transition-all hover:ring-2 hover:ring-white/20 disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <div className="relative aspect-square">
                  <SmartImage
                    src={pl.coverImgUrl}
                    alt={pl.name}
                    containerClassName="w-full h-full"
                    imgClassName="w-full h-full object-cover"
                  />
                  <div
                    className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-white/80 text-xs font-medium flex items-center gap-1"
                    style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
                  >
                    <PlayIcon className="w-3 h-3" />
                    {formatCount(pl.playCount)}
                  </div>
                  {loadingPlaylistId === pl.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-white/90 text-xs font-medium line-clamp-2 leading-snug">{pl.name}</p>
                  <p className="text-white/30 text-xs mt-1">{formatCount(pl.trackCount)} 首</p>
                </div>
              </button>
            ))}
          </div>

          {hasMore && !loading && <div ref={loadMoreRef} className="h-4" />}
          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          )}
          {!hasMore && playlists.length > 0 && (
            <p className="text-center text-white/20 text-xs py-3">— 已加载全部 —</p>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default PlaylistDiscoveryPanel;
