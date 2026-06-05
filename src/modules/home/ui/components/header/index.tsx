"use client";

import { useState, useEffect } from "react";
import Graphic from "../../../../../components/graphic";
import Navbar from "./navbar";
import MobileMenu from "./mobile-menu";

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  return (
    <>
      <header
        className="fixed left-3 z-50 bg-background rounded-br-[18px]"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <div className="relative">
          <Navbar onMobileMenuToggle={() => setIsMobileMenuOpen(true)} />

          {/* MOBILE TOP BAR — safe-area background */}
          <div
            className="fixed top-0 left-0 w-full bg-background block lg:hidden"
            style={{ height: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
          ></div>

          <div className="absolute left-0 -bottom-[18px] size-[18px]">
            <Graphic />
          </div>

          <div className="absolute top-0 -right-[18px] size-[18px]">
            <Graphic />
          </div>
        </div>
      </header>

      {/* Only render mobile menu on non-desktop (mobile/tablet) */}
      {!isDesktop && (
        <MobileMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
};

export default Header;
