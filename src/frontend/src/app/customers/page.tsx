'use client'

import { Suspense, lazy } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

const CustomersPage = lazy(() => import('@/pages/loctician/CustomersPage').then(m => ({ default: m.CustomersPage })))

export default function Customers() {
  return (
    <ProtectedRoute requiredRole="loctician">
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }>
        <CustomersPage />
      </Suspense>
    </ProtectedRoute>
  )
}
