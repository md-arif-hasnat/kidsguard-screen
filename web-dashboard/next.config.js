const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    // Next.js 14 resolves Firebase Storage's Node export while compiling
    // client components. Force its browser build; all calls remain guarded
    // behind browser-only event/effect paths.
    config.resolve.alias['@firebase/storage$'] = path.resolve(
      __dirname,
      'node_modules/@firebase/storage/dist/index.esm2017.js'
    );
    return config;
  }
};

module.exports = nextConfig;
