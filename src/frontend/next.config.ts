import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Output as standalone for easier deployment
  output: 'standalone',

  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Configure rewrites to proxy API requests to FastAPI backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/:path*',
      },
    ]
  },

  // Image optimization configuration
  images: {
    domains: ['localhost'],
    formats: ['image/webp'],
  },

  // Note: i18n in App Router is handled differently
  // See: https://nextjs.org/docs/app/building-your-application/routing/internationalization

  // Experimental features
  experimental: {
    // Enable Server Actions
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },

  // Webpack configuration for path aliases
  webpack: (config, { isServer }) => {
    // Maintain existing path aliases from Vite config
    const path = require('path')

    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@pages': path.resolve(__dirname, 'src/app'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@store': path.resolve(__dirname, 'src/store'),
      '@styles': path.resolve(__dirname, 'src/styles'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      'react-router-dom': path.resolve(__dirname, 'src/lib/react-router-dom.tsx'),
    }
    return config
  },
}

export default nextConfig
