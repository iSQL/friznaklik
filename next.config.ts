// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  //output: 'standalone', // Uncomment if you want to build a docker image
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        port: '',
        pathname: '/**', // Allows any path under this hostname
      },
      {
        protocol: 'https',
        hostname: 'images.clerk.dev', // It's good to add this too, as Clerk might use it
        port: '',
        pathname: '/**',
      },
      // Add other hostnames if needed
      // Example for placeholder images if you use them:
      // {
      //   protocol: 'https',
      //   hostname: 'placehold.co',
      //   port: '',
      //   pathname: '/**',
      // },
    ],
  },
};

export default nextConfig;
