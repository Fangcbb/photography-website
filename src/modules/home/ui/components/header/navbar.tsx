import { useState, useEffect } from "react";
import Logo from "./logo";
import FlipLink from "@/components/flip-link";
import { ThemeSwitch } from "@/components/theme-toggle";

interface NavbarProps {
  onMobileMenuToggle?: () => void;
}

const Navbar = ({ onMobileMenuToggle }: NavbarProps) => {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  return (
    <nav>
      <div className="flex items-center gap-5 pb-3 px-4 relative">
        {/* PC (lg+): Logo is always a link, never a button */}
        {/* Mobile (<1024px): Logo also triggers mobile menu */}
        <Logo onMobileMenuToggle={isDesktop ? undefined : onMobileMenuToggle} />
        <div className="hidden lg:flex gap-4">
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
