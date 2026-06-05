"use client";

import { useEffect } from "react";
import { onCLS, onINP, onLCP, onFCP, onTTFB } from "web-vitals";

function sendToAnalytics(metric: { name: string; value: number; id: string }) {
  // 控制台输出（开发环境调试用）
  if (process.env.NODE_ENV === "development") {
    console.log(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(1)} (id: ${metric.id})`);
  }

  // 可以接入 Google Analytics 或其他分析平台
  // if (typeof window !== "undefined" && window.gtag) {
  //   window.gtag("event", metric.name, {
  //     value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
  //     event_label: metric.id,
  //     non_interaction: true,
  //   });
  // }
}

export function WebVitals() {
  useEffect(() => {
    onCLS(sendToAnalytics);
    onINP(sendToAnalytics);
    onLCP(sendToAnalytics);
    onFCP(sendToAnalytics);
    onTTFB(sendToAnalytics);
  }, []);

  return null;
}
