"use client";

import { useEffect } from "react";
import { onCLS, onINP, onLCP, onFCP, onTTFB } from "web-vitals/attribution";
import type { Metric } from "web-vitals/attribution";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

function sendToGA4(metric: Metric) {
  // 开发环境仅打印
  if (process.env.NODE_ENV === "development") {
    console.log(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(3)} (id: ${metric.id})`);
    return;
  }

  // GA4 上报: 使用 gtag event
  if (typeof window !== "undefined" && (window as any).gtag) {
    const gtag = (window as any).gtag;

    // GA4 自定义事件: web_vitals
    gtag("event", "web_vitals", {
      // GA4 要求 event 参数
      value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
      metric_name: metric.name,
      metric_id: metric.id,
      metric_rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
      // 附加诊断信息 (attribution)
      debug_target:
        (metric as any).attribution?.largestShiftTarget ??
        (metric as any).attribution?.eventTarget ??
        (metric as any).attribution?.element ??
        undefined,
      debug_timing:
        (metric as any).attribution?.largestShiftTime ??
        (metric as any).attribution?.eventTime ??
        undefined,
      debug_event_type: (metric as any).attribution?.eventType ?? undefined,
      debug_load_state: (metric as any).attribution?.loadState ?? undefined,
      // 非交互事件
      non_interaction: true,
      send_to: GA_ID,
    });
  }
}

export function WebVitals() {
  useEffect(() => {
    onCLS(sendToGA4);
    onINP(sendToGA4);
    onLCP(sendToGA4);
    onFCP(sendToGA4);
    onTTFB(sendToGA4);
  }, []);

  return null;
}
