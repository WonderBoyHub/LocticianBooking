'use client'

import { Suspense, lazy } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

const ServicesPage = lazy(() => import('@/pages/loctician/ServicesPage').then(m => ({ default: m.ServicesPage })))

export default function Services() {
  return (
    <ProtectedRoute requiredRole="loctician">
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }>
        <ServicesPage />
      </Suspense>
    </ProtectedRoute>
  )
}
