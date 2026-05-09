import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.0.0.184"],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'kqbkqyuapwpihqgftncs.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;