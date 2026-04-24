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
      <header className="fixed top-3 left-3 z-50 bg-background rounded-br-[18px]">
        <div className="relative">
          <Navbar onMobileMenuToggle={() => setIsMobileMenuOpen(true)} />

          {/* MOBILE TOP BAR  */}
          <div className="border-t-12 fixed top-0 left-0 w-full border-background block lg:hidden"></div>

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
