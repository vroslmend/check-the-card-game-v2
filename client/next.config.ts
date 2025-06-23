import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["shared-types"],

  turbopack: {
    resolveAlias: {
      "@": "./",
      "shared-types": "../shared-types/dist",
    },
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname),
      "shared-types": path.resolve(__dirname, "../shared-types/dist"),
    };
    return config;
  },
};

export default nextConfig;
