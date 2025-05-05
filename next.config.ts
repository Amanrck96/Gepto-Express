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
      // Keep this only if you still use example.com placeholders elsewhere
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
  env: {
    // Expose the Cashfree App ID for the client-side SDK
    NEXT_PUBLIC_CASHFREE_APP_ID: process.env.CF_APP_ID, // Read from CF_APP_ID set in .env.local
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002', // Ensure this is set correctly for return URLs
  },
};

export default nextConfig;
