/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_ORIGIN ?? "https://marcus-cleaning-backend.vercel.app"}/api/:path*`,
      },
    ];
  },
  webpack: (config, { dev }) => {
    // Windows/WSL mixed filesystems can intermittently fail on webpack FS cache renames.
    // Keep dev cache in-memory to prevent missing `.next` artifacts during requests.
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
