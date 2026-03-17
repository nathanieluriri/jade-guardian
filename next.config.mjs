/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
