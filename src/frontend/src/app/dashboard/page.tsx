'use client'

import { Suspense, lazy } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

const DashboardPage = lazy(() => import('@/pages/loctician/DashboardPage').then(m => ({ default: m.DashboardPage })))

export default function Dashboard() {
  return (
    <ProtectedRoute requiredRole="loctician">
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }>
        <DashboardPage />
      </Suspense>
    </ProtectedRoute>
  )
}
