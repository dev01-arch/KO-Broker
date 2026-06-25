import type { NextConfig } from 'next';

const LEGACY_DASHBOARD_SECTIONS =
  'clients|cases|messages|compliance|ai-reports|calculators';

const nextConfig: NextConfig = {
  // Enable server-side external packages for Prisma
  serverExternalPackages: ['@prisma/client'],
  transpilePackages: ['@ko/db', '@ko/types', '@ko/utils'],

  async redirects() {
    return [
      {
        source: '/dashboard/settings',
        destination: '/dashboard?tab=settings',
        permanent: false,
      },
      {
        source: `/dashboard/:section(${LEGACY_DASHBOARD_SECTIONS})`,
        destination: '/dashboard',
        permanent: false,
      },
      {
        source: `/dashboard/:section(${LEGACY_DASHBOARD_SECTIONS})/:path*`,
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },

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
