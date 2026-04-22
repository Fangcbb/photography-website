"use client";
import React from "react";
import dynamic from 'next/dynamic';

// Import the wrapper with providers - no SSR needed
const AuraMusicApp = dynamic(() => import('@/components/AuraMusic/NextApp'), {
  ssr: true,
  loading: () => (
    <div className="fixed inset-0 z-[85] bg-[#0a0a0a] flex items-center justify-center text-white/50 text-sm tracking-widest">
      加载中 / LOADING FangC MUSIC...
    </div>
  )
});

export const metadata = {
  title: "音乐 - 方斌的摄影作品集",
  description: "聆听方斌精选的音乐作品，精选旅途中的背景音乐和原创配乐。",
};

export default function MusicPage() {
  return (
    <main className="fixed inset-0 z-[85] w-full h-screen overflow-hidden bg-[#0a0a0a]">
      <AuraMusicApp />
    </main>
  );
}
