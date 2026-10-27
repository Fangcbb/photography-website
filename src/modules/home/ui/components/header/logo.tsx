import Link from "next/link";
import WordRotate from "../word-rotate";
import { siteConfig } from "@/site.config";

interface LogoProps {
  onMobileMenuToggle?: () => void;
}

/**
 * 顶栏品牌标识
 *
 * 图标来自 COS 桶（`logo/favicon.svg`），不在仓库内，替换 COS 上的文件即可全站生效。
 *
 * 两点处理说明：
 * 1. 尺寸 22px —— 该 SVG 是 56 条渐变射线组成的光圈，18px 下细节会糊成一团；
 *    22px 仍小于顶栏行高，不影响排版。
 * 2. `invert dark:invert-0` —— 原图是 #282828→#fff 的渐变，在白底上几乎不可见，
 *    浅色主题反色后变成深色光圈；深色主题保持原样。
 *    若日后换成彩色 logo，需去掉 invert 类。
 */
const LOGO_SRC = "https://cnn.fangc.cc/logo/favicon.svg";

const Logo = ({ onMobileMenuToggle }: LogoProps) => {
  return (
    <Link
      href="/"
      className="flex gap-2 items-center"
      onClick={onMobileMenuToggle}
    >
      <img
        src={LOGO_SRC}
        alt=""
        width={22}
        height={22}
        className="size-[22px] shrink-0 select-none invert dark:invert-0"
        draggable={false}
        decoding="async"
        aria-hidden="true"
      />
      <WordRotate
        label={siteConfig.name}
        label2={siteConfig.tagline}
        style="font-medium uppercase"
      />
    </Link>
  );
};

export default Logo;
