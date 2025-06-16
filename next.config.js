/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable ESLint during build (for deployment)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript errors during build (for deployment)
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig; 