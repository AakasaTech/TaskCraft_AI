import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',  value: 'on' },
  { key: 'X-Frame-Options',         value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  {
    key:   'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
  },
  {
    key:   'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key:   'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.paypal.com https://www.paypalobjects.com https://fonts.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.googleusercontent.com https://*.s3.amazonaws.com https://*.r2.dev https://www.paypal.com https://www.paypalobjects.com",
      "connect-src 'self' https://api-m.paypal.com https://api.openai.com https://fonts.googleapis.com https://*.s3.amazonaws.com",
      "frame-src https://www.paypal.com https://www.sandbox.paypal.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
      { protocol: 'https', hostname: '*.r2.dev' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  logging: {
    fetches: { fullUrl: false },
  },
};

export default nextConfig;
