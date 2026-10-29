import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "../hooks/useI18n";
import { SearchIcon, CloudDownloadIcon, FullscreenIcon, MenuIcon, CloseIcon } from "./Icons";

interface TopBarProps {
  onFilesSelected: (files: FileList) => void;
  onSearchClick: () => void;
  disabled?: boolean;
}

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/travel", label: "Travel" },
  { href: "/discover", label: "Discover" },
  { href: "/music", label: "Music" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
];

const HIDE_DELAY = 5000; // 5 seconds

const TopBar: React.FC<TopBarProps> = ({
  onFilesSelected,
  onSearchClick,
  disabled,
}) => {
  const { dict } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startHideTimer = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      setMobileMenuOpen(false);
    }, HIDE_DELAY);
  };

  const showBar = () => {
    setIsVisible(true);
    startHideTimer();
  };

  // On mount: show for 5s then hide
  useEffect(() => {
    startHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) onFilesSelected(files);
    e.target.value = "";
  };

  // Touch: tap the top area to toggle
  const handlePointerDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    if (!isVisible) {
      event.preventDefault();
      event.stopPropagation();
    }
    showBar();
  };

  const transition = "transition-all duration-500 ease-out";
  const showClass = isVisible
    ? "opacity-100 translate-y-0 pointer-events-auto"
    : "opacity-0 -translate-y-full pointer-events-none";

  return (
    <>
      {/* Invisible trigger zone at the very top — hover shows the bar */}
      <div
        className="fixed top-0 left-0 w-full h-10 z-[60]"
        onMouseEnter={showBar}
        onPointerDownCapture={handlePointerDownCapture}
      />

      {/* ===== The actual TopBar ===== */}
      <div
        className={`fixed top-0 left-0 w-full z-[60] ${transition} ${showClass}`}
        onMouseEnter={showBar}
        onMouseLeave={startHideTimer}
      >
        {/* Desktop (md+) */}
        <div className="hidden md:flex w-full h-12 px-6 justify-between items-center">
          {/* Nav links */}
          <nav className="flex items-center gap-5">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`relative block overflow-hidden whitespace-nowrap font-light text-sm text-white/60 hover:text-white transition-colors ${
                  link.href === "/music" ? "text-white font-medium" : ""
                }`}
              >
                <div className="relative overflow-hidden">
                  <span className="block transition-transform duration-300 ease-in-out hover:-translate-y-full">
                    {link.label}
                  </span>
                  <span className="absolute inset-0 translate-y-full transition-transform duration-300 ease-in-out hover:translate-y-0">
                    {link.label}
                  </span>
                </div>
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button onClick={onSearchClick} className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-all" title={dict.top.search}>
              <SearchIcon className="w-[18px] h-[18px]" />
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={disabled} className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-all disabled:opacity-50" title={dict.top.importLocal}>
              <CloudDownloadIcon className="w-[18px] h-[18px]" />
            </button>
            <button onClick={toggleFullscreen} className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-all" title={isFullscreen ? dict.top.exitFullscreen : dict.top.enterFullscreen}>
              <FullscreenIcon className="w-[18px] h-[18px]" isFullscreen={isFullscreen} />
            </button>
          </div>
        </div>

        {/* Mobile (< md) */}
        <div className="md:hidden flex w-full h-11 items-center justify-between px-4">
          <button onClick={() => { setMobileMenuOpen(!mobileMenuOpen); startHideTimer(); }} className="w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-all">
            {mobileMenuOpen ? <CloseIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onSearchClick} className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-all" title={dict.top.search}>
              <SearchIcon className="w-4 h-4" />
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={disabled} className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-all disabled:opacity-50" title={dict.top.importLocal}>
              <CloudDownloadIcon className="w-4 h-4" />
            </button>
            <button onClick={toggleFullscreen} className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-all" title={isFullscreen ? dict.top.exitFullscreen : dict.top.enterFullscreen}>
              <FullscreenIcon className="w-4 h-4" isFullscreen={isFullscreen} />
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden w-full bg-black/80 backdrop-blur-2xl">
            <nav className="flex flex-col py-2">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => { setMobileMenuOpen(false); startHideTimer(); }}
                  className={`px-6 py-3 text-sm font-light text-white/70 hover:text-white hover:bg-white/5 transition-colors ${
                    link.href === "/music" ? "text-white font-medium" : ""
                  }`}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="audio/*,.lrc,.txt,.json"
        multiple
        className="hidden"
      />
    </>
  );
};

export default TopBar;
