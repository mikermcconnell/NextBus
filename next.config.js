/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Skip ESLint checks during `next build` (Vercel). Re-enable after cleanup.
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/gtfs/:path*',
        destination: 'https://www.myridebarrie.ca/gtfs/:path*'
      }
    ]
  }
}

module.exports = nextConfig 