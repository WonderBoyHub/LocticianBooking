import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'JLI Loctician - Professional Dreadlock Services',
    short_name: 'JLI Loctician',
    description: 'Professional loctician booking system for dreadlock services in Denmark',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAF7F3',
    theme_color: '#8B4513',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
