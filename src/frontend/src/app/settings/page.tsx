'use client'

import { Suspense, lazy } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

const SettingsPage = lazy(() => import('@/pages/loctician/SettingsPage').then(m => ({ default: m.SettingsPage })))

export default function Settings() {
  return (
    <ProtectedRoute requiredRole="loctician">
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }>
        <SettingsPage />
      </Suspense>
    </ProtectedRoute>
  )
}
