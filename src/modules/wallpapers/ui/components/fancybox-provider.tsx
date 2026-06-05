"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Fancybox } from "@fancyapps/ui";
import "@fancyapps/ui/dist/fancybox/fancybox.css";

interface FancyboxProviderProps {
  children: ReactNode;
  options?: Record<string, unknown>;
}

/**
 * Wraps children with Fancybox lightbox.
 * Any <a> with data-fancybox="wallpapers" inside will open in a lightbox.
 */
export function FancyboxProvider({ children, options }: FancyboxProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const delegate = Fancybox.bind(container, "[data-fancybox]", {
      ...options,
    });

    return () => {
      Fancybox.unbind(container);
      Fancybox.close();
    };
  }, [options]);

  return <div ref={containerRef}>{children}</div>;
}
