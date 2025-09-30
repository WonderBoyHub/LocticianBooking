'use client'

import { Suspense, lazy } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

const AnalyticsPage = lazy(() => import('@/pages/loctician/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })))

export default function Analytics() {
  return (
    <ProtectedRoute requiredRole="loctician">
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }>
        <AnalyticsPage />
      </Suspense>
    </ProtectedRoute>
  )
}
