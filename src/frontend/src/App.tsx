import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { store } from './store';
import i18n from './i18n';
import { socketService } from './services/socket';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { selectIsAuthenticated, selectUser, setLoading } from './store/slices/authSlice';
import { setIsMobile, setIsOnline } from './store/slices/uiSlice';
import { useGetCurrentUserQuery } from './store/api';

// Layout components
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { NotificationContainer } from './components/ui';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

// Lazy load page components for code splitting
// Public pages - load immediately
import { LandingPage } from './pages/customer/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { TermsPage } from './pages/legal/TermsPage';
import { ServicesCatalogPage } from './pages/customer/ServicesCatalogPage';

// Customer pages - lazy load
const BookingPage = lazy(() => import('./pages/customer/BookingPage').then(m => ({ default: m.BookingPage })));
const ServiceDetailsPage = lazy(() => import('./pages/customer/ServiceDetailsPage').then(m => ({ default: m.ServiceDetailsPage })));

// Loctician pages - lazy load (these are likely the heaviest pages)
const DashboardPage = lazy(() => import('./pages/loctician/DashboardPage').then(m => ({ default: m.DashboardPage })));
const CalendarPage = lazy(() => import('./pages/loctician/CalendarPage').then(m => ({ default: m.CalendarPage })));
const CustomersPage = lazy(() => import('./pages/loctician/CustomersPage').then(m => ({ default: m.CustomersPage })));
const ServicesPage = lazy(() => import('./pages/loctician/ServicesPage').then(m => ({ default: m.ServicesPage })));
const AnalyticsPage = lazy(() => import('./pages/loctician/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const SettingsPage = lazy(() => import('./pages/loctician/SettingsPage').then(m => ({ default: m.SettingsPage })));

// Admin pages - lazy load
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));

// Error pages
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

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
});

// Suspense fallback component
const PageLoadingFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-brand-light">
    <div className="text-center">
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-brand-brown font-medium">Loading...</p>
    </div>
  </div>
);

// Lazy route wrapper with Suspense
const LazyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<PageLoadingFallback />}>
    {children}
  </Suspense>
);

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'customer' | 'loctician' | 'admin';
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  redirectTo = '/login'
}) => {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectUser);

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

// Auth Handler Component
const AuthHandler: React.FC = () => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectUser);

  // Fetch current user if token exists but user is not loaded
  const { isLoading } = useGetCurrentUserQuery(undefined, {
    skip: !localStorage.getItem('jli_token') || isAuthenticated,
  });

  useEffect(() => {
    dispatch(setLoading(false));
  }, [dispatch]);

  // Connect to socket when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      socketService.connect();

      // Join appropriate rooms based on user role
      if (user.role === 'loctician') {
        socketService.joinLocticianRoom(user.id);
      } else if (user.role === 'customer') {
        socketService.joinCustomerRoom(user.id);
      }

      return () => {
        socketService.disconnect();
      };
    }
  }, [isAuthenticated, user]);

  return null;
};

// Global Event Handlers Component
const GlobalEventHandlers: React.FC = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Handle window resize
    const handleResize = () => {
      dispatch(setIsMobile(window.innerWidth < 768));
    };

    // Handle online/offline status
    const handleOnline = () => dispatch(setIsOnline(true));
    const handleOffline = () => dispatch(setIsOnline(false));

    // Initial checks
    handleResize();
    dispatch(setIsOnline(navigator.onLine));

    // Add event listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [dispatch]);

  return null;
};

// Main App Component
const AppContent: React.FC = () => {
  return (
    <div className="min-h-screen bg-brand-light flex flex-col">
      <AuthHandler />
      <GlobalEventHandlers />

      <Header />

      <main className="flex-1">
        <Routes>
          {/* Public Routes - No lazy loading for critical pages */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/tjenester" element={<ServicesCatalogPage />} />
          <Route path="/services/catalog" element={<ServicesCatalogPage />} />

          {/* Customer Routes - Lazy loaded */}
          <Route
            path="/book"
            element={
              <LazyRoute>
                <BookingPage />
              </LazyRoute>
            }
          />
          <Route
            path="/services/:id"
            element={
              <LazyRoute>
                <ServiceDetailsPage />
              </LazyRoute>
            }
          />

          {/* Loctician Routes - Lazy loaded */}
          <Route
            path="/dashboard"
            element={
              <LazyRoute>
                <ProtectedRoute requiredRole="loctician">
                  <DashboardPage />
                </ProtectedRoute>
              </LazyRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <LazyRoute>
                <ProtectedRoute requiredRole="loctician">
                  <CalendarPage />
                </ProtectedRoute>
              </LazyRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <LazyRoute>
                <ProtectedRoute requiredRole="loctician">
                  <CustomersPage />
                </ProtectedRoute>
              </LazyRoute>
            }
          />
          <Route
            path="/services"
            element={
              <LazyRoute>
                <ProtectedRoute requiredRole="loctician">
                  <ServicesPage />
                </ProtectedRoute>
              </LazyRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <LazyRoute>
                <ProtectedRoute requiredRole="loctician">
                  <AnalyticsPage />
                </ProtectedRoute>
              </LazyRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <LazyRoute>
                <ProtectedRoute requiredRole="loctician">
                  <SettingsPage />
                </ProtectedRoute>
              </LazyRoute>
            }
          />

          {/* Admin Routes - Lazy loaded */}
          <Route
            path="/admin/*"
            element={
              <LazyRoute>
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              </LazyRoute>
            }
          />

          {/* Error Routes */}
          <Route path="/unauthorized" element={<div className="min-h-screen flex items-center justify-center"><div className="text-center"><h1 className="text-2xl font-bold text-red-600">Unauthorized</h1><p className="mt-2 text-gray-600">You don't have permission to access this page.</p></div></div>} />
          <Route
            path="/404"
            element={
              <LazyRoute>
                <NotFoundPage />
              </LazyRoute>
            }
          />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </main>

      <Footer />
      <NotificationContainer />
    </div>
  );
};

// Root App Component with Providers
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18n}>
            <Router>
              <AppContent />
            </Router>
          </I18nextProvider>

          {/* Development tools */}
          {import.meta.env.DEV && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  );
};

export default App;