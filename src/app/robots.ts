import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/sign-in/', '/api/'],
      },
    ],
    sitemap: 'https://www.fangc.cc/sitemap.xml',
  };
}
