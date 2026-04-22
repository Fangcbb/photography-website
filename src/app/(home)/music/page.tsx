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


export default function MusicPage() {
  return (
    <main className="fixed inset-0 z-[85] w-full h-screen overflow-hidden bg-[#0a0a0a]">
      <AuraMusicApp />
    </main>
  );
}
