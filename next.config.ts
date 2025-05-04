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
      // Add example.com for placeholder images used in services
      {
        protocol: 'https',
        hostname: 'example.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
   // Make environment variables available to the client-side if necessary
   // IMPORTANT: Only expose non-sensitive variables here. API keys should generally
   // remain server-side unless explicitly required by a client-side SDK.
   // Cashfree SDK `load` function might need the mode ('sandbox'/'production')
   // but not necessarily the keys themselves on the client.
  env: {
    // NEXT_PUBLIC_CASHFREE_MODE: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002', // Ensure this is set for return URLs
  },
};

export default nextConfig;
