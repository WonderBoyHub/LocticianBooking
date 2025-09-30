'use client'

import React, { useEffect } from 'react'
import { Provider } from 'react-redux'
import { I18nextProvider } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { store } from '@/store'
import i18n from '@/i18n'
import { socketService } from '@/services/socket'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectIsAuthenticated, selectUser } from '@/store/slices/authSlice'
import { setIsMobile, setIsOnline } from '@/store/slices/uiSlice'
import { NotificationContainer } from '@/components/ui'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

// Create React Query client with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnMount: false,
    },
    mutations: {
      retry: 1,
    },
  },
})

// Global Event Handlers Component
const GlobalEventHandlers: React.FC = () => {
  const dispatch = useAppDispatch()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const user = useAppSelector(selectUser)

  useEffect(() => {
    // Handle window resize
    const handleResize = () => {
      dispatch(setIsMobile(window.innerWidth < 768))
    }

    // Handle online/offline status
    const handleOnline = () => dispatch(setIsOnline(true))
    const handleOffline = () => dispatch(setIsOnline(false))

    // Initial checks
    handleResize()
    dispatch(setIsOnline(navigator.onLine))

    // Add event listeners
    window.addEventListener('resize', handleResize)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [dispatch])

  // Connect to socket when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      socketService.connect()

      // Join appropriate rooms based on user role
      if (user.role === 'loctician') {
        socketService.joinLocticianRoom(user.id)
      } else if (user.role === 'customer') {
        socketService.joinCustomerRoom(user.id)
      }

      return () => {
        socketService.disconnect()
      }
    }
  }, [isAuthenticated, user])

  return null
}

// Inner Providers Component (needs Redux store context)
const InnerProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      <GlobalEventHandlers />
      {children}
      <NotificationContainer />
    </>
  )
}

// Main Providers Component
export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18n}>
            <InnerProviders>
              {children}
            </InnerProviders>
          </I18nextProvider>

          {/* Development tools */}
          {process.env.NODE_ENV === 'development' && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  )
}
