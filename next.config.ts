import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg"],
  experimental: {
    cpus: 2,
    memoryBasedWorkersCount: true,
  },
};

export default nextConfig;
