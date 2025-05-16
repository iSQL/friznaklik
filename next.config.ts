// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  //output: 'standalone', // Uncomment if you want to build a docker image
  eslint: {
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;
