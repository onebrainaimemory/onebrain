import { join } from 'node:path';
import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: false },
  transpilePackages: ['@onebrain/shared', '@onebrain/i18n'],
  outputFileTracingRoot: join(import.meta.dirname, '..', '..'),
  async headers() {
    // CSP is now handled by middleware.ts with per-request nonces.
    // Only static security headers remain here.
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
