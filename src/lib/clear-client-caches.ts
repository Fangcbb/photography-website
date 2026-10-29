"use client";

// 登出时清理 Service Worker 缓存，避免后台/私有数据在离线或弱网下继续命中旧缓存
export async function clearClientCaches(): Promise<void> {
  try {
    if (typeof window !== "undefined" && "caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
  } catch {
    // 清理失败不影响登出流程
  }
}
