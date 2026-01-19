/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Configuração de imagens
  images: {
    remotePatterns: [],
    unoptimized: false,
  },
  // Manter compatibilidade com API routes do Vercel
  // As rotas /api/* continuam sendo serverless functions
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "/api/:path*",
      },
    ];
  },
  // Suportar arquivos estáticos em /public
  publicRuntimeConfig: {
    apiUrl: process.env.NEXT_PUBLIC_API_URL || "https://bags-shield-api.vercel.app",
  },
};

module.exports = nextConfig;
