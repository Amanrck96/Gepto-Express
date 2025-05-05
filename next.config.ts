import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      // Remove example.com as it's no longer used
      // {
      //   protocol: 'https',
      //   hostname: 'example.com',
      //   port: '',
      //   pathname: '/**',
      // }
    ],
  },
   // Make environment variables available to the client-side if necessary
   // IMPORTANT: Only expose non-sensitive variables here. API keys should generally
   // remain server-side unless explicitly required by a client-side SDK.
  env: {
    // Expose the Cashfree App ID for the client-side SDK
    // Reads from the value set in .env.local
    NEXT_PUBLIC_CASHFREE_APP_ID: process.env.NEXT_PUBLIC_CASHFREE_APP_ID,
    // Read the App URL from .env.local or default
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002',
  },
};

export default nextConfig;
