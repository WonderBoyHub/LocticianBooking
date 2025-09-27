import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated, selectAuthLoading } from '../../store/slices/authSlice';
import { useRoleAccess, type UserRole } from '../../hooks/useRoleAccess';
import { LoadingSpinner } from '../ui';
import type { User } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireAuth?: boolean;
  fallbackPath?: string;
  allowSelf?: boolean; // Allow if user is accessing their own resource
  resourceUserId?: string; // ID of the user who owns the resource
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles = [],
  requireAuth = true,
  fallbackPath = '/auth/login',
  allowSelf = false,
  resourceUserId,
}) => {
  const location = useLocation();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectAuthLoading);
  const user = useSelector(selectUser);
  const { canAccessRoute, canViewUser } = useRoleAccess();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Redirect to login if authentication is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // If no specific roles are required, allow access for authenticated users
  if (allowedRoles.length === 0 && isAuthenticated) {
    return <>{children}</>;
  }

  // Check if user has required role
  if (user && allowedRoles.length > 0) {
    const hasRequiredRole = canAccessRoute(allowedRoles);

    // If user doesn't have required role, check if they can access their own resource
    if (!hasRequiredRole && allowSelf && resourceUserId && user.id === resourceUserId) {
      return <>{children}</>;
    }

    // If user has required role or can access own resource, allow access
    if (hasRequiredRole) {
      return <>{children}</>;
    }

    // Redirect to appropriate dashboard based on user role
    const roleDashboards: Record<UserRole, string> = {
      admin: '/admin/dashboard',
      loctician: '/staff/dashboard',
      customer: '/customer/dashboard',
    };

    return <Navigate to={roleDashboards[user.role]} replace />;
  }

  // Default redirect if none of the above conditions are met
  return <Navigate to={fallbackPath} replace />;
};

// Higher-order component for role-based access control
export const withRoleProtection = (
  Component: React.ComponentType<any>,
  allowedRoles: UserRole[]
) => {
  return (props: any) => (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <Component {...props} />
    </ProtectedRoute>
  );
};

// Component-level role guard
interface RoleGuardProps {
  roles: UserRole[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
  allowSelf?: boolean;
  targetUser?: User;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  roles,
  fallback = null,
  children,
  allowSelf = false,
  targetUser,
}) => {
  const user = useSelector(selectUser);
  const { canAccessRoute, canViewUser } = useRoleAccess();

  if (!user) {
    return <>{fallback}</>;
  }

  const hasAccess = canAccessRoute(roles);

  // Check if user can access their own resource
  const canAccessSelf = allowSelf && targetUser && canViewUser(targetUser);

  if (hasAccess || canAccessSelf) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

// Hook for conditional rendering based on roles
export const useRoleGuard = (roles: UserRole[], allowSelf = false, targetUser?: User) => {
  const user = useSelector(selectUser);
  const { canAccessRoute, canViewUser } = useRoleAccess();

  if (!user) return false;

  const hasAccess = canAccessRoute(roles);
  const canAccessSelf = allowSelf && targetUser && canViewUser(targetUser);

  return hasAccess || canAccessSelf;
};