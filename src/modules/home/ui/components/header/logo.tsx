import Link from "next/link";
import WordRotate from "../word-rotate";
import { Camera } from "lucide-react";
import { siteConfig } from "@/site.config";

interface LogoProps {
  onMobileMenuToggle?: () => void;
}

const Logo = ({ onMobileMenuToggle }: LogoProps) => {
  return (
    <Link
      href="/"
      className="flex gap-2 items-center"
      onClick={onMobileMenuToggle}
    >
      <Camera size={18} />
      <WordRotate
        label={siteConfig.name}
        label2={siteConfig.tagline}
        style="font-medium uppercase"
      />
    </Link>
  );
};

export default Logo;
