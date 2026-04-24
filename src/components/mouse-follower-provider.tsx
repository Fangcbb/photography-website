"use client";

import { useEffect } from "react";
import MouseFollower from "mouse-follower";
import gsap from "gsap";
import "mouse-follower/dist/mouse-follower.min.css";

export default function MouseFollowerProvider() {
  useEffect(() => {
    // Only enable on desktop with fine pointer (mouse)
    const mediaQuery = window.matchMedia(
      "(min-width: 1024px) and (pointer: fine)"
    );

    if (!mediaQuery.matches) {
      return;
    }

    // Register GSAP with MouseFollower
    MouseFollower.registerGSAP(gsap);

    // Add class to <html> to enable CSS cursor: none
    document.documentElement.classList.add("has-custom-cursor");

    // Initialize cursor
    const cursor = new MouseFollower({
      speed: 0.5,
      skewing: 1.5,
      stateDetection: {
        "-pointer": "a,button,[role=button],input,textarea,select",
        "-hidden": "iframe,video,canvas",
      },
    });

    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
      cursor.destroy();
    };
  }, []);

  return null;
}
