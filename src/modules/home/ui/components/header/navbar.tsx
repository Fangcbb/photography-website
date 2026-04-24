import Logo from "./logo";
import FlipLink from "@/components/flip-link";
import { ThemeSwitch } from "@/components/theme-toggle";

interface NavbarProps {
  onMobileMenuToggle?: () => void;
}

const Navbar = ({ onMobileMenuToggle }: NavbarProps) => {
  return (
    <nav>
      <div className="flex items-center gap-5 pb-3 px-4 relative">
        <Logo onMobileMenuToggle={onMobileMenuToggle} />
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
