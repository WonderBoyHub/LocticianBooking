# Next.js Migration Guide

## Overview

This document describes the migration of the JLI Loctician frontend from Vite + React Router to Next.js with App Router, while keeping FastAPI as the backend.

## Migration Status

✅ **Completed:**
- Next.js installation and configuration
- App Router structure setup
- SSR/SSG configuration with FastAPI backend integration
- SEO optimization (metadata, sitemap, robots.txt, manifest)
- All page routes migrated to Next.js App Router
- API client for server and client-side data fetching
- Protected route middleware
- Build configuration updated

## Key Changes

### 1. Project Structure

```
src/frontend/
├── src/
│   ├── app/                    # Next.js App Router (NEW)
│   │   ├── layout.tsx         # Root layout with metadata
│   │   ├── page.tsx           # Home page
│   │   ├── template.tsx       # Template with Header/Footer
│   │   ├── providers.tsx      # Client-side providers
│   │   ├── sitemap.ts         # Dynamic sitemap
│   │   ├── robots.ts          # Robots.txt
│   │   ├── manifest.ts        # PWA manifest
│   │   ├── login/             # Auth routes
│   │   ├── register/
│   │   ├── book/              # Customer routes
│   │   ├── tjenester/
│   │   ├── dashboard/         # Protected loctician routes
│   │   ├── calendar/
│   │   └── ...
│   ├── components/            # React components (REUSED)
│   ├── pages/                 # Page components (REUSED)
│   ├── lib/                   # Utilities (NEW)
│   │   └── api-client.ts     # SSR-compatible API client
│   ├── middleware.ts          # Next.js middleware
│   └── ...
├── next.config.ts             # Next.js configuration
├── tsconfig.next.json         # TypeScript config for Next.js
└── .env.nextjs                # Environment variables template
```

### 2. Routing Migration

**Before (React Router):**
```tsx
<Route path="/tjenester" element={<ServicesCatalogPage />} />
```

**After (Next.js App Router):**
```tsx
// src/app/tjenester/page.tsx
export const metadata = {
  title: 'Tjenester',
  description: '...'
}

export default function Services() {
  return <ServicesCatalogPage />
}
```

### 3. Data Fetching Patterns

#### Client-Side (CSR)
```tsx
'use client'
import { useGetServicesQuery } from '@/store/api'

export default function ServicesPage() {
  const { data } = useGetServicesQuery()
  return <div>{data?.map(...)}</div>
}
```

#### Server-Side Rendering (SSR)
```tsx
import { fetchServerData } from '@/lib/api-client'

export default async function ServicesPage() {
  const services = await fetchServerData('/services', {
    revalidate: 60 // Revalidate every 60 seconds
  })
  return <div>{services.map(...)}</div>
}
```

#### Static Generation (SSG)
```tsx
import { fetchStaticData } from '@/lib/api-client'

export default async function ServicesPage() {
  const services = await fetchStaticData('/services')
  return <div>{services.map(...)}</div>
}

export async function generateStaticParams() {
  const services = await fetchStaticData('/services')
  return services.map((service) => ({ id: service.id }))
}
```

### 4. API Integration

The API client (`src/lib/api-client.ts`) handles both server and client-side requests:

```typescript
import { apiClient, fetchServerData } from '@/lib/api-client'

// Client-side
const data = await apiClient.get('/endpoint')

// Server-side with revalidation
const data = await fetchServerData('/endpoint', { revalidate: 60 })

// Static (build-time)
const data = await fetchStaticData('/endpoint')
```

### 5. Environment Variables

**Vite (.env):**
```
VITE_API_URL=...
```

**Next.js (.env.local):**
```
NEXT_PUBLIC_API_URL=...
```

All client-side env vars must be prefixed with `NEXT_PUBLIC_`.

### 6. Protected Routes

**Before (Component-based):**
```tsx
<Route path="/dashboard" element={
  <ProtectedRoute requiredRole="loctician">
    <DashboardPage />
  </ProtectedRoute>
} />
```

**After (Middleware + Component):**
```tsx
// src/middleware.ts handles initial redirect
// Component still uses ProtectedRoute for client-side checks
'use client'
export default function Dashboard() {
  return (
    <ProtectedRoute requiredRole="loctician">
      <DashboardPage />
    </ProtectedRoute>
  )
}
```

### 7. Build Scripts

**package.json:**
```json
{
  "scripts": {
    "dev": "next dev",              // Start Next.js dev server
    "dev:vite": "vite",             // Fallback to Vite
    "build": "next build",          // Production build
    "start": "next start",          // Start production server
    "type-check": "tsc --project tsconfig.next.json --noEmit"
  }
}
```

## SEO Improvements

### Metadata Configuration
Each page can define its own metadata:

```tsx
export const metadata = {
  title: 'Page Title',
  description: 'Page description',
  keywords: ['keyword1', 'keyword2'],
  openGraph: { ... },
  twitter: { ... }
}
```

### Sitemap
Auto-generated at `/sitemap.xml` from `src/app/sitemap.ts`

### Robots.txt
Auto-generated at `/robots.txt` from `src/app/robots.ts`

### PWA Manifest
Auto-generated at `/manifest.json` from `src/app/manifest.ts`

## Benefits of Migration

1. **SEO**: Server-side rendering for better search engine indexing
2. **Performance**: Automatic code splitting and optimization
3. **DX**: File-based routing, built-in TypeScript support
4. **Flexibility**: Can use SSR, SSG, or CSR per route
5. **Future-proof**: Modern React features (Server Components, Server Actions)

## Migration Steps for Additional Pages

1. Create new route folder in `src/app/[route-name]/`
2. Create `page.tsx` with metadata export
3. Import and render existing page component from `src/pages/`
4. Add 'use client' if page uses hooks or client-side features
5. Test SSR/SSG functionality

## Running the Application

### Development
```bash
npm run dev              # Start Next.js dev server on port 3000
```

### Production
```bash
npm run build           # Build for production
npm start              # Start production server
```

### Type Checking
```bash
npm run type-check     # Check TypeScript types
```

## Backend Configuration

The FastAPI backend remains unchanged. Next.js proxies API requests via:

**next.config.ts:**
```typescript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: process.env.NEXT_PUBLIC_API_URL + '/:path*'
    }
  ]
}
```

## Component Reusability

✅ All existing React components are fully compatible
✅ Redux store continues to work as-is
✅ React Query integration maintained
✅ i18n configuration unchanged
✅ UI components remain the same

## Deployment Considerations

### Vercel (Recommended)
- Native Next.js support
- Automatic preview deployments
- Edge functions support

### Docker
- Use `output: 'standalone'` in next.config.ts
- Smaller Docker images
- Self-hosted option

### Static Export
- For SSG-only sites: `next export`
- Can be served from CDN
- No server-side features

## Gradual Migration Path

The current setup allows running both:
- **Next.js**: `npm run dev` (port 3000)
- **Vite**: `npm run dev:vite` (fallback)

This enables gradual migration and testing before full cutover.

## Testing Checklist

- [ ] Home page renders correctly
- [ ] Auth pages work (login, register)
- [ ] Public pages are server-rendered
- [ ] Protected routes redirect correctly
- [ ] API calls work from server and client
- [ ] SEO metadata appears in page source
- [ ] Sitemap generates correctly
- [ ] Images load properly
- [ ] Styles apply correctly
- [ ] i18n works
- [ ] Redux state persists
- [ ] WebSocket connections work
- [ ] Production build succeeds
- [ ] Production server runs

## Troubleshooting

### "use client" Directive
If components use hooks or browser APIs, add `'use client'` at the top.

### Import Paths
Next.js uses the same path aliases configured in `tsconfig.next.json`.

### Environment Variables
Remember `NEXT_PUBLIC_` prefix for client-side variables.

### Hydration Errors
Ensure server and client render the same HTML. Check for:
- Browser-only APIs in server components
- Date/time formatting differences
- Random values or IDs

## Next Steps

1. Fix existing TypeScript errors in components (unrelated to migration)
2. Convert more pages to use SSR where beneficial
3. Implement ISR (Incremental Static Regeneration) for frequently updated pages
4. Add Server Actions for form handling
5. Optimize images with next/image
6. Implement route prefetching
7. Add loading and error boundaries
8. Set up monitoring and analytics

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [App Router Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)
- [Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Metadata](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
