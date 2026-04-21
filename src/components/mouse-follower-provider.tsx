"use client";

import { useEffect } from "react";
import MouseFollower from "mouse-follower";
import gsap from "gsap";
import "mouse-follower/dist/mouse-follower.min.css";

export default function MouseFollowerProvider() {
  useEffect(() => {
    // Register GSAP with MouseFollower
    MouseFollower.registerGSAP(gsap);

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
      cursor.destroy();
    };
  }, []);

  return null;
}
