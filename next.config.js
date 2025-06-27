/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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