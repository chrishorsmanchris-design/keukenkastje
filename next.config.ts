import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'recipe-images',
        expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: { cacheName: 'static-assets' },
    },
    {
      urlPattern: /\/$/,
      handler: 'NetworkFirst',
      options: { cacheName: 'pages', networkTimeoutSeconds: 5 },
    },
  ],
})

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default withPWA(withNextIntl(nextConfig));
