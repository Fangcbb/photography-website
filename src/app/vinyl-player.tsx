"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Music } from "@/db/schema";

interface VinylPlayerProps {
  music: Music | null;
}

export default function VinylPlayer({ music }: VinylPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 播放/暂停
  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  // 更新当前时间
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // 音频加载完成
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  // 音频结束
  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // 格式化时间
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // 封面 URL
  const coverUrl = music?.coverUrl || "/avatar.jpg";
  const musicTitle = music?.title || "暂无音乐";
  const artist = music?.artist || "Fang Bing";

  return (
    <div className="vinyl-wrapper">
      {/* 音频元素 */}
      {music?.musicUrl && (
        <audio
          ref={audioRef}
          src={music.musicUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          preload="metadata"
        />
      )}

      {/* 黑胶播放器 */}
      <div id="album">
        {/* 唱片封面 */}
        <div id="cover" style={{ backgroundImage: `url(${coverUrl})` }}>
          <div id="cover-print">
            <Image
              src={coverUrl}
              alt={musicTitle}
              fill
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>
        
        {/* 黑胶唱片 */}
        <div id="vinyl" className={isPlaying ? "playing" : ""}>
          <div id="print" style={{ backgroundImage: `url(${coverUrl})` }} />
        </div>
      </div>

      {/* 歌曲信息和控制 */}
      <div className="music-controls">
        <div className="song-info">
          <div className="song-title">{musicTitle}</div>
          <div className="song-artist">{artist}</div>
          {duration > 0 && (
            <div className="song-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          )}
        </div>
        
        {music?.musicUrl && (
          <button className="play-btn" onClick={togglePlay}>
            {isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        )}
      </div>

      <style jsx>{`
        .vinyl-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }

        #album {
          position: relative;
          width: 280px;
          height: 280px;
          cursor: pointer;
        }

        #cover {
          position: absolute;
          top: 0;
          left: 0;
          z-index: 1;
          width: 100%;
          height: 100%;
          background-size: 100% 100%;
          background-position: center;
          box-shadow: 
            5px 0 20px 0 rgba(0, 0, 0, 0.6),
            inset 0 0 10px 5px rgba(255, 255, 255, 0.1),
            inset 0 0 4px 2px rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }

        #cover::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          z-index: 10;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.1) 0%,
            transparent 50%,
            rgba(0, 0, 0, 0.1) 100%
          );
          border-radius: 4px;
          mix-blend-mode: overlay;
        }

        #cover::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          z-index: 20;
          width: 100%;
          height: 100%;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          border-radius: 4px;
          mix-blend-mode: screen;
          opacity: 0.15;
        }

        #cover-print {
          display: none;
        }

        #vinyl {
          position: absolute;
          top: 2.5%;
          left: 2.5%;
          z-index: 0;
          width: 95%;
          height: 95%;
          background: radial-gradient(
            circle at center,
            #1a1a1a 0%,
            #0d0d0d 30%,
            #1a1a1a 31%,
            #0d0d0d 60%,
            #1a1a1a 61%,
            #0d0d0d 80%,
            #1a1a1a 81%,
            #0d0d0d 100%
          );
          background-size: 106% 106%;
          background-position: center;
          box-shadow: 0 0 20px 4px rgba(0, 0, 0, 0.6);
          border-radius: 50%;
          transition: left 1s ease-out;
          left: 50%;
        }

        #vinyl::before {
          content: "";
          position: absolute;
          top: 2.5%;
          left: 2.5%;
          z-index: 10;
          width: 95%;
          height: 95%;
          background: radial-gradient(
            circle at center,
            transparent 0%,
            rgba(50, 50, 50, 0.3) 100%
          );
          border-radius: 50%;
          mix-blend-mode: screen;
          opacity: 0.3;
        }

        #print {
          position: absolute;
          top: 33%;
          left: 33%;
          height: 34%;
          width: 34%;
          box-shadow: inset 0 0 0 5px rgba(150, 150, 150, 0.5);
          background-size: cover;
          background-position: center;
          border-radius: 50%;
        }

        #vinyl.playing {
          animation: spinThat 3s linear infinite;
        }

        @keyframes spinThat {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .music-controls {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .song-info {
          text-align: center;
          color: white;
        }

        .song-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 0.25rem;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .song-artist {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.6);
        }

        .song-time {
          font-size: 0.625rem;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 0.25rem;
        }

        .play-btn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
        }

        .play-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 30px rgba(102, 126, 234, 0.6);
        }

        @media (max-width: 640px) {
          #album {
            width: 200px;
            height: 200px;
          }

          .song-title {
            font-size: 0.75rem;
            max-width: 150px;
          }

          .play-btn {
            width: 40px;
            height: 40px;
          }
        }
      `}</style>
    </div>
  );
}
