"use client";

import Logo from "./logo";
import FlipLink from "@/components/flip-link";
import { ThemeSwitch } from "@/components/theme-toggle";
import { useState, useEffect } from "react";

const Navbar = () => {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  if (!isDesktop) return null;

  return (
    <nav>
      <div className="flex items-center gap-8 pb-3 px-4 relative">
        <Logo />
        <div className="navbar-links gap-4">
          <FlipLink href="/travel">Travel</FlipLink>
          <FlipLink href="/discover">Discover</FlipLink>
          <FlipLink href="/music">Music</FlipLink>
          <FlipLink href="/blog">Blog</FlipLink>
          <FlipLink href="/about">About</FlipLink>
        </div>
        <ThemeSwitch />
      </div>
    </nav>
  );
};

export default Navbar;
