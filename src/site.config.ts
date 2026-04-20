/**
 * ============================================================================
 * SITE CONFIGURATION
 * ============================================================================
 * Main brand and site metadata configuration file.
 * Edit this file to customize site name, bio, social links, and contact info.
 *
 * NOTE: Environment variables (.env) must also be configured for production deploy.
 * See .env.example for required variables.
 *
 * After editing this file, restart the dev server to see changes.
 * ============================================================================
 */

import type { ContactCardTitle } from "@/components/contact-card";

export const siteConfig = {
  /** Site name used in metadata, logo, and branding */
  name: "Fang Bing",

  /** Tagline shown alongside name (e.g. "Photo", "Photography") */
  tagline: "Photo",

  /** Your role/title shown in profile cards and footer */
  role: "Photographer",

  /** Short bio shown on the home page profile card */
bio: "我是方斌，一名业余摄影师。在业余时间，我喜欢用镜头记录生活和旅行中的美好瞬间。对我来说，摄影是一种排解孤独的方式。希望你能喜欢我的照片。",

  /** Avatar image path (place your avatar in /public/avatar.jpg) */
  avatar: "/avatar.jpg",

  /** Initials used as avatar fallback */
  initials: "EC",

  /** Site metadata for SEO */
  metadata: {
    title: "Fang Bing Photography | 方斌的摄影作品集",
    description: "探索方斌的旅行与街头摄影作品。发现世界各地美丽的风景、城市景观和迷人的瞬间。",
  },

  /** Social links shown in profile card and footer */
  socialLinks: [
    {
      title: "Instagram",
      href: "https://www.instagram.com/fangcarry/",
    },
    {
      title: "TikTok",
      href: "https://v.douyin.com/RXvLrLVkKF0/",
    },
    {
      title: "Xiaohongshu",
      href: "https://xhslink.com/m/20NisqUaKYT",
    },
    {
      title: "Contact me",
      href: "mailto:fangbing01@alumni.nudt.edu.cn",
      /** If true, this link gets the primary button style */
      primary: true,
    },
  ] as { title: ContactCardTitle; href: string; primary?: boolean }[],

  /** Footer attribution */
  footer: {
    designCredit: {
      name: "Pawel Gola",
      href: "https://templates.gola.io/template/hanssen",
    },
    poweredBy: {
      name: "Fang Bing",
      href: "https://github.com/ecarry",
    },
  },

  /**
   * Mapbox custom style URLs (optional).
   * If not set, Mapbox default styles will be used.
   * Create your own at https://studio.mapbox.com/
   */
  mapbox: {
    lightStyle: "mapbox://styles/ecarry/cldmhu6tr000001n33ujbxf7j",
    darkStyle: "mapbox://styles/ecarry/clp8hcmd300km01qx78rt0xaw",
  },

  /**
   * Image loader configuration.
   * Set to "cloudflare" to use the Cloudflare custom image loader,
   * or "default" to use Next.js built-in image optimization.
   */
  imageLoader: "default" as "cloudflare" | "default",

  /**
   * Gear / equipment shown on the About page.
   * Each item has a brand and model name.
   */
  gear: [
    { brand: "NIKON", model: "Z8 / Z63 / D610" },
    { brand: "LENS", model: "24-120mm f/4 S / 24-70mm f/2.8E ED VR / 70-200mm f/2.8 VR S / 180-600mm f/5.6-6.3 VR" },
    { brand: "DJI", model: "Osmo Pocket 3 / Osmo Action 5 Pro" },
    { brand: "TRIPOD", model: "Leofoto AZ-235C+LH-30R / Marsace MT34SV+MV30" },
    { brand: "OTHER", model: "AD 200 / AD 600 / Cotton Carrier G3" },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
