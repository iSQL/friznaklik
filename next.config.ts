// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Add the headers configuration here
  async headers() {
    return [
      {
        // Apply these headers to all routes in the API directory
        source: "/api/:path*", // Matches `/api/services`, `/api/appointments`, etc.
        headers: [
          // Replace with specific origins in production!
          { key: "Access-Control-Allow-Origin", value: "zabari.net" },
          // Allowed HTTP methods
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          // Allowed headers
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          // Optional: Allow credentials (cookies, authorization headers) if needed by your app
          // { key: "Access-Control-Allow-Credentials", value: "true" },
        ],
      },
      // You can add other header rules here if needed for different paths
    ];
  },
};

export default nextConfig;
