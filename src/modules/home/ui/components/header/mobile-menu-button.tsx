"use client";

import React, { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import MobileMenu from "./mobile-menu";

const MobileMenuButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  if (isDesktop) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        className="hamburger-btn fixed right-3 z-40 bg-black/30 backdrop-blur-md rounded-full size-10 flex items-center justify-center cursor-pointer select-none"
        aria-label="Open menu"
      >
        <Menu size={20} color="white" />
      </button>

      <MobileMenu isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export default MobileMenuButton;
