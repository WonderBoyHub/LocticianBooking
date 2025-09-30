'use client'

import { Suspense, lazy } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

const CalendarPage = lazy(() => import('@/pages/loctician/CalendarPage').then(m => ({ default: m.CalendarPage })))

export default function Calendar() {
  return (
    <ProtectedRoute requiredRole="loctician">
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }>
        <CalendarPage />
      </Suspense>
    </ProtectedRoute>
  )
}
