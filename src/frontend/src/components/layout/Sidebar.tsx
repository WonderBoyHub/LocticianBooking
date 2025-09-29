import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  CalendarDays,
  Users,
  Settings,
  BarChart3,
  Package,
  Home,
  UserCheck,
  Clock,
  Shield,
  ChevronDown,
  LogOut
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { selectUser } from '../../store/slices/authSlice';
import { selectIsSidebarOpen, toggleSidebar } from '../../store/slices/uiSlice';

interface NavigationItem {
  label: string;
  path: string;
  icon: React.ComponentType<any>;
  roles: ('admin' | 'loctician' | 'customer')[];
  badge?: string;
  children?: NavigationItem[];
}

const navigationItems: NavigationItem[] = [
  // Admin Navigation
  {
    label: 'Admin Dashboard',
    path: '/admin',
    icon: Shield,
    roles: ['admin']
  },
  {
    label: 'User Management',
    path: '/admin/users',
    icon: Users,
    roles: ['admin']
  },
  {
    label: 'Service Management',
    path: '/admin/services',
    icon: Package,
    roles: ['admin']
  },
  {
    label: 'System Analytics',
    path: '/admin/analytics',
    icon: BarChart3,
    roles: ['admin']
  },
  {
    label: 'System Settings',
    path: '/admin/settings',
    icon: Settings,
    roles: ['admin']
  },

  // Staff Navigation
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: Home,
    roles: ['loctician']
  },
  {
    label: 'Calendar',
    path: '/calendar',
    icon: CalendarDays,
    roles: ['loctician']
  },
  {
    label: 'Customers',
    path: '/customers',
    icon: Users,
    roles: ['loctician']
  },
  {
    label: 'My Services',
    path: '/services',
    icon: Package,
    roles: ['loctician']
  },
  {
    label: 'Analytics',
    path: '/analytics',
    icon: BarChart3,
    roles: ['loctician']
  },
  {
    label: 'Availability',
    path: '/availability',
    icon: Clock,
    roles: ['loctician']
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    roles: ['loctician']
  },

  // Customer Navigation
  {
    label: 'Browse Services',
    path: '/',
    icon: Package,
    roles: ['customer']
  },
  {
    label: 'My Bookings',
    path: '/my-bookings',
    icon: CalendarDays,
    roles: ['customer']
  },
  {
    label: 'Profile',
    path: '/profile',
    icon: UserCheck,
    roles: ['customer']
  }
];

interface SidebarProps {
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const user = useAppSelector(selectUser);
  const isOpen = useAppSelector(selectIsSidebarOpen);
  const dispatch = useAppDispatch();
  const location = useLocation();

  if (!user) return null;

  const userNavItems = navigationItems.filter(item =>
    item.roles.includes(user.role)
  );

  const handleLogout = () => {
    // This will be implemented with the auth system
    console.log('Logout clicked');
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => dispatch(toggleSidebar())}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: isOpen ? 0 : -300 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={clsx(
          'fixed left-0 top-0 h-full w-64 bg-white border-r border-brown-200 z-50 lg:translate-x-0 lg:static lg:z-auto',
          'flex flex-col shadow-lg lg:shadow-none',
          className
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-brown-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-brand-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">JL</span>
            </div>
            <div>
              <h2 className="font-serif font-bold text-brand-dark">
                Joli Locs
              </h2>
              <p className="text-xs text-brown-600 capitalize">
                {user.role} Portal
              </p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-brown-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-brand-secondary rounded-full flex items-center justify-center">
              <span className="text-brand-dark text-sm font-medium">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-brand-dark truncate">
                {user.name}
              </p>
              <p className="text-xs text-brown-600 truncate">
                {user.email}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {userNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive: navIsActive }) =>
                  clsx(
                    'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    'hover:bg-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-primary/20',
                    (isActive || navIsActive)
                      ? 'bg-brand-primary text-white shadow-md'
                      : 'text-brown-700 hover:text-brand-dark'
                  )
                }
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    dispatch(toggleSidebar());
                  }
                }}
              >
                <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="bg-brand-primary text-white text-xs px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-brown-200">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-brown-700 rounded-lg hover:bg-red-50 hover:text-red-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </button>
        </div>
      </motion.aside>
    </>
  );
};