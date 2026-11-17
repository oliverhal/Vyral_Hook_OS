/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        // Creator profile pictures from ViralDeck (Artie dashboard)
        protocol: 'https',
        hostname: 'media.ugc-tracking.com',
      },
    ],
  },
};

export default nextConfig;
