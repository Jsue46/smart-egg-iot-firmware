import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
  allowedDevOrigins: ['172.19.192.1'],
};

export default nextConfig;