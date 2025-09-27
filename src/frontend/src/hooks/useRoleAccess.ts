import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import type { User } from '../types';

export type UserRole = User['role'];
export type Permission = 'read' | 'write' | 'delete' | 'admin';

// Role hierarchy: admin > loctician > customer
const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  loctician: 2,
  customer: 1,
};

// Permission matrix - what each role can do
const PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ['read', 'write', 'delete', 'admin'],
  loctician: ['read', 'write'],
  customer: ['read'],
};

// Specific resource permissions
const RESOURCE_PERMISSIONS: Record<string, Record<UserRole, Permission[]>> = {
  users: {
    admin: ['read', 'write', 'delete', 'admin'],
    loctician: ['read'], // Can only read own profile
    customer: ['read'], // Can only read own profile
  },
  appointments: {
    admin: ['read', 'write', 'delete', 'admin'],
    loctician: ['read', 'write', 'delete'], // Can manage own appointments
    customer: ['read', 'write'], // Can book and view own appointments
  },
  services: {
    admin: ['read', 'write', 'delete', 'admin'],
    loctician: ['read', 'write', 'delete'], // Can manage own services
    customer: ['read'], // Can only view services
  },
  analytics: {
    admin: ['read', 'write', 'delete', 'admin'],
    loctician: ['read'], // Can view own analytics
    customer: [], // No access
  },
  cms: {
    admin: ['read', 'write', 'delete', 'admin'],
    loctician: [], // No access
    customer: [], // No access
  },
  settings: {
    admin: ['read', 'write', 'delete', 'admin'],
    loctician: ['read'], // Can only view settings
    customer: ['read'], // Can only view own settings
  },
};

export const useRoleAccess = () => {
  const user = useSelector(selectUser);

  const hasRole = (requiredRole: UserRole): boolean => {
    if (!user) return false;
    return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[requiredRole];
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    return PERMISSIONS[user.role].includes(permission);
  };

  const hasResourcePermission = (resource: string, permission: Permission): boolean => {
    if (!user) return false;
    const resourcePerms = RESOURCE_PERMISSIONS[resource];
    if (!resourcePerms) return hasPermission(permission);
    return resourcePerms[user.role]?.includes(permission) || false;
  };

  const canAccessRoute = (allowedRoles: UserRole[]): boolean => {
    if (!user) return false;
    return allowedRoles.some(role => hasRole(role));
  };

  const canManageUser = (targetUser: User): boolean => {
    if (!user) return false;

    // Users can always manage themselves
    if (user.id === targetUser.id) return true;

    // Admins can manage everyone
    if (user.role === 'admin') return true;

    // Locticians cannot manage other users
    if (user.role === 'loctician') return false;

    // Customers cannot manage other users
    return false;
  };

  const canViewUser = (targetUser: User): boolean => {
    if (!user) return false;

    // Users can always view themselves
    if (user.id === targetUser.id) return true;

    // Admins can view everyone
    if (user.role === 'admin') return true;

    // Locticians can view their customers
    if (user.role === 'loctician') {
      // This would need to be implemented based on appointment relationships
      return targetUser.role === 'customer';
    }

    // Customers cannot view other users
    return false;
  };

  const getAccessibleRoles = (): UserRole[] => {
    if (!user) return [];

    switch (user.role) {
      case 'admin':
        return ['customer', 'loctician', 'admin'];
      case 'loctician':
        return ['customer'];
      case 'customer':
        return [];
      default:
        return [];
    }
  };

  const getRoleDisplayName = (role: UserRole): string => {
    const roleNames: Record<UserRole, string> = {
      admin: 'Administrator',
      loctician: 'Loctician',
      customer: 'Customer',
    };
    return roleNames[role];
  };

  const getRoleBadgeColor = (role: UserRole): string => {
    const colors: Record<UserRole, string> = {
      admin: 'bg-red-100 text-red-800 border-red-200',
      loctician: 'bg-blue-100 text-blue-800 border-blue-200',
      customer: 'bg-green-100 text-green-800 border-green-200',
    };
    return colors[role];
  };

  const isAdmin = (): boolean => user?.role === 'admin';
  const isLoctician = (): boolean => user?.role === 'loctician';
  const isCustomer = (): boolean => user?.role === 'customer';

  return {
    user,
    hasRole,
    hasPermission,
    hasResourcePermission,
    canAccessRoute,
    canManageUser,
    canViewUser,
    getAccessibleRoles,
    getRoleDisplayName,
    getRoleBadgeColor,
    isAdmin,
    isLoctician,
    isCustomer,
  };
};