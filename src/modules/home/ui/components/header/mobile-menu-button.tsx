"use client";

import React from "react";
import { Menu } from "lucide-react";
import { useState } from "react";
import MobileMenu from "./mobile-menu";

const MobileMenuButton = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-3 right-3 z-40 bg-black/30 backdrop-blur-md rounded-full size-10 flex items-center justify-center xl:hidden cursor-pointer select-none"
        aria-label="Open menu"
      >
        <Menu size={20} color="white" />
      </button>

      <MobileMenu isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export default MobileMenuButton;
