import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard', '/projects', '/tasks', '/time', '/reports', '/settings', '/integrations', '/admin'] },
    ],
    sitemap: 'https://taskcraft.aakasa.dev/sitemap.xml',
  };
}
