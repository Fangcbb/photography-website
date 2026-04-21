import type { Metadata } from "next";
import "./globals.css";

import { TRPCReactProvider } from "@/trpc/client";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import MouseFollowerProvider from "@/components/mouse-follower-provider";
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?4faa27b9b7ecd733e221e3749511cb5d";
  var s = document.getElementsByTagName("script")[0]; 
  s.parentNode.insertBefore(hm, s);
})();
            `,
          }}
        />
        
        {/* 百度自动推送 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  var bp = document.createElement('script');
  var curProtocol = window.location.protocol.split(':')[0];
  if (curProtocol === 'https') {
    bp.src = 'https://zz.bdstatic.com/linksubmit/push.js';
  } else {
    bp.src = 'http://push.zhanzhang.baidu.com/push.js';
  }
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(bp, s);
})();
            `,
          }}
        />
        
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  // 禁止右键菜单
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
  });
  
  // 禁止选中文字和图片
  document.addEventListener('selectstart', function(e) {
    e.preventDefault();
    return false;
  });
  
  // 禁止拖拽图片
  document.addEventListener('dragstart', function(e) {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
      e.preventDefault();
      return false;
    }
  });
  
  // 禁止开发者工具快捷键
  document.addEventListener('keydown', function(e) {
    // F12
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+I (Windows) 或 Cmd+Opt+I (Mac)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+J (Windows) 或 Cmd+Opt+J (Mac)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
      e.preventDefault();
      return false;
    }
    // Ctrl+U (查看源代码)
    if ((e.ctrlKey || e.metaKey) && e.key === 'U') {
      e.preventDefault();
      return false;
    }
    // Ctrl+S (保存页面)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      return false;
    }
  });
  
  // 禁止触摸设备长按保存（但不阻止链接内的图片/视频点击）
  document.addEventListener('touchstart', function(e) {
    // 检查点击目标是否在可点击元素内（如链接、按钮）
    const clickable = e.target.closest('a, button, [role="button"]');
    if ((e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') && !clickable) {
      e.preventDefault();
    }
  }, { passive: false });
  
  // 禁止图片拖拽属性
  window.addEventListener('DOMContentLoaded', function() {
    var images = document.getElementsByTagName('img');
    for (var i = 0; i < images.length; i++) {
      images[i].setAttribute('draggable', 'false');
      images[i].setAttribute('oncontextmenu', 'return false');
    }
    var videos = document.getElementsByTagName('video');
    for (var i = 0; i < videos.length; i++) {
      videos[i].setAttribute('draggable', 'false');
      videos[i].setAttribute('oncontextmenu', 'return false');
    }
  });
  
  // 动态添加的图片也禁止拖拽
  window.addEventListener('DOMContentLoaded', function() {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) {
            if (node.tagName === 'IMG' || node.tagName === 'VIDEO') {
              node.setAttribute('draggable', 'false');
              node.setAttribute('oncontextmenu', 'return false');
            }
            var images = node.querySelectorAll ? node.querySelectorAll('img, video') : [];
            images.forEach(function(img) {
              img.setAttribute('draggable', 'false');
              img.setAttribute('oncontextmenu', 'return false');
            });
          }
        });
      });
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });
})();
            `,
          }}
        />
      </head>
      <body className="antialiased system-font" style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none', WebkitTouchCallout: 'none' }}>
        <NuqsAdapter>
          <TRPCReactProvider>
            <ThemeProvider attribute="class">
              <Toaster />
              {children}
              <MouseFollowerProvider />
            </ThemeProvider>
          </TRPCReactProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
