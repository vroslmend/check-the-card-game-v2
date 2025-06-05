import type { NextConfig } from "next";
import path from 'path'; // Needed for path.resolve
import type { Configuration as WebpackConfiguration } from 'webpack'; // Import Webpack types

const nextConfig: NextConfig = {
  transpilePackages: ['shared-types'],
  experimental: {
    externalDir: true,
    // turbo: { // Deprecated
    //   resolveAlias: {
    //     'server-game': '../server/dist/index.js',
    //   },
    //   // root: '..' 
    // },
  },
  turbopack: {
    resolveAlias: {
      // 'server-game': '../server/dist/index.js', // Old path
      'server-game': '../server/dist/game-definition.js', // Corrected path
    },
    root: path.join(__dirname, '..'), // Align with docs example, use absolute path
  },
  /* config options here */
  // Webpack alias configuration removed as Turbopack is being used
  // and has its own way of resolving tsconfig.json paths.
  webpack: (config: WebpackConfiguration, { webpack }) => { // Simplified signature
    const serverDistPath = path.resolve(__dirname, '../server/dist');

    if (!config.module) config.module = { rules: [] };
    if (!config.module.rules) config.module.rules = [];

    config.module.rules.push({
      test: /\.js$/,
      include: [serverDistPath],
      type: 'javascript/auto', // Or 'javascript/dynamic' for CommonJS
    });

    // Ensure no other loaders are trying to process these files as ESM
    // This might be overly aggressive or unnecessary, but worth trying if the above isn't enough
    config.module.rules.forEach((rule: any) => {
      if (rule.include && Array.isArray(rule.include) && rule.include.some((p: string | RegExp | ((path: string) => boolean) ) => 
        typeof p === 'string' && p.includes(serverDistPath)
      )) {
        if (rule.use && Array.isArray(rule.use)) {
          rule.use = rule.use.filter((loader: any) => { // Keeping 'any' for loader for simplicity, can be refined
            if (typeof loader === 'object' && loader !== null && 'loader' in loader) {
              // Example: filter out babel-loader or next-swc-loader if they are causing issues for this path
              // return !String(loader.loader).includes('next-swc-loader');
            }
            return true;
          });
        }
      }
    });

    return config;
  },
};

export default nextConfig;
