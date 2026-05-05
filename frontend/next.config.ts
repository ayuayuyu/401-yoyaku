import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  devIndicators: false,
  sassOptions: {
    additionalData: '@use "@/styles/modules" as *;',
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
