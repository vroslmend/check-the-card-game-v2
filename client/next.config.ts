import type { NextConfig } from "next";
import path from 'path'; // Import the 'path' module

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ['shared-types'],

  turbopack: {
    resolveAlias: {
      '@': './',
      'shared-types': '../shared-types/dist',
    },
  },

  // Fallback Webpack alias configuration
  // This is useful if you switch off Turbopack or for parts of the build that might still use Webpack.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
      'shared-types': path.resolve(__dirname, '../shared-types/dist'),
    };
    return config;
  },
};

export default nextConfig;
