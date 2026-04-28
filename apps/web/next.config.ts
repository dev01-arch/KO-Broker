import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable server-side external packages for Prisma
  serverExternalPackages: ['@prisma/client'],

  images: {
    // Allow Cloudflare R2 for uploaded documents/images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
    ],
  },
};

export default nextConfig;
