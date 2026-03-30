/** @type {import('next').NextConfig} */
const nextConfig = {
  // Why transpilePackages? Turborepo workspace packages need to be
  // transpiled by Next.js since they're TypeScript source, not pre-built JS.
  transpilePackages: ['@preop-intel/shared'],
};

module.exports = nextConfig;
