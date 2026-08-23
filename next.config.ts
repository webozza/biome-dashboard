import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg"],
  experimental: {
    cpus: 2,
    memoryBasedWorkersCount: true,
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
