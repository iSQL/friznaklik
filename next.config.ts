import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  eslint: {
    // Warning: This allows production builds to complete even with ESLint errors.
    // It's recommended to fix the errors for code quality and maintainability.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
