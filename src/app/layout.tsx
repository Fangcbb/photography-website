import type { Metadata, Viewport } from "next";
import "./globals.css";

import { TRPCReactProvider } from "@/trpc/client";
import { ThemeProvider } from "@/components/theme-provider";
import { WebVitals } from "@/components/web-vitals";

import { siteConfig } from "@/site.config";

const BASE_URL = "https://www.fangc.cc";

export const metadata: Metadata = {
  // 基本信息
  title: siteConfig.metadata.title,
  description: siteConfig.metadata.description,
  keywords: [
    // 核心关键词
    "方斌",
    "Fang Bing Photography",
    "Photography",
    "摄影师",
    "摄影作品",
    "旅行摄影",
    "风光摄影",
    "街头摄影",
    "照片分享",
    "摄影博客",
    // 地理位置关键词
    "安徽摄影师",
    "中国摄影师",
    "苏州摄影",
    "江南摄影",
    // 主题相关
    "人文摄影",
    "纪实摄影",
    "建筑摄影",
    "城市摄影",
    "水乡摄影",
    "古镇摄影",
    // 服务相关
    "摄影约拍",
    "商业摄影",
    "摄影服务",
    "人像摄影",
    "婚礼摄影",
    // 技巧相关
    "摄影教程",
    "摄影技巧",
    "后期处理",
    "Lightroom教程",
    "Photoshop后期",
    // 长尾关键词
    "中国街头摄影师",
    "旅行摄影作品集",
    "摄影作品在线展览",
    "独立摄影师",
    "自由摄影师",
  ],
  authors: [{ name: siteConfig.name, url: BASE_URL }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  
  // URL 相关
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: BASE_URL,
  },
  
  // Open Graph (Facebook, LinkedIn, 微信等)
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: BASE_URL,
    siteName: siteConfig.name,
    title: siteConfig.metadata.title,
    description: siteConfig.metadata.description,
    images: [
      {
        url: `${BASE_URL}${siteConfig.avatar}`,
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} - ${siteConfig.tagline}`,
      },
    ],
  },
  
  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: siteConfig.metadata.title,
    description: siteConfig.metadata.description,
    images: [`${BASE_URL}${siteConfig.avatar}`],
    creator: "@fangcarry",
  },
  
  // robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  
  // 其他
  category: "photography",
  classification: "Photography Portfolio",

};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: "#ffffff",
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: "#000000",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 百度站长平台验证 */}
        <meta name="baidu-site-verification" content="codeva-eJn3oeosAt" />
        
        {/* 360搜索引擎验证 */}
        <meta name="360-site-verification" content="437a5b0d023cd06a13fff843f6f8c105" />
        
        {/* 百度统计 */}
        <script src="/baidu-hm.js" async />
        
        {/* 百度自动推送 */}
        <script src="/baidu-push.js" async />
        
        {/* 结构化数据 (JSON-LD) - Google SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": `${BASE_URL}/#website`,
                  "url": BASE_URL,
                  "name": siteConfig.name,
                  "description": siteConfig.metadata.description,
                  "publisher": {
                    "@id": `${BASE_URL}/#person`
                  },
                  "potentialAction": {
                    "@type": "SearchAction",
                    "target": `${BASE_URL}/discover`,
                    "query-input": "required name=search_term_string"
                  }
                },
                {
                  "@type": "Person",
                  "@id": `${BASE_URL}/#person`,
                  "name": siteConfig.name,
                  "url": BASE_URL,
                  "image": `${BASE_URL}${siteConfig.avatar}`,
                  "jobTitle": siteConfig.role,
                  "description": siteConfig.bio,
                  "sameAs": [
                    "https://www.instagram.com/fangcarry/",
                    "https://v.douyin.com/RXvLrLVkKF0/",
                    "https://xhslink.com/m/20NisqUaKYT"
                  ]
                },
                {
                  "@type": "ImageGallery",
                  "@id": `${BASE_URL}/#gallery`,
                  "name": `${siteConfig.name} Photography Gallery`,
                  "description": "方斌的旅行与街头摄影作品集",
                  "url": BASE_URL
                }
              ]
            }),
          }}
        />
        
        {/* 全站图片保护 */}
        <script src="/image-protect.js" async />
      </head>
      <body className="antialiased system-font" style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none', WebkitTouchCallout: 'none' }}>
        <TRPCReactProvider>
          <ThemeProvider attribute="class">
            <WebVitals />
            {children}
          </ThemeProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
