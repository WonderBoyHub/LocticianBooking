import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Users,
  Calendar,
  Settings,
  BarChart3,
  Scissors,
  Home,
  ChevronRight,
  Menu,
  X,
  Bell,
  LogOut,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { selectUser } from '../../store/slices/authSlice';
import { useLogoutMutation } from '../../store/api';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavigationItem[];
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [notifications] = React.useState([]); // TODO: Connect to real notifications

  const navigation: NavigationItem[] = [
    {
      label: t('admin.navigation.overview'),
      href: '/admin',
      icon: Home,
    },
    {
      label: t('admin.navigation.users'),
      href: '/admin/users',
      icon: Users,
    },
    {
      label: t('admin.navigation.services'),
      href: '/admin/services',
      icon: Scissors,
      children: [
        {
          label: t('admin.navigation.serviceList'),
          href: '/admin/services',
          icon: Scissors,
        },
        {
          label: t('admin.navigation.categories'),
          href: '/admin/services/categories',
          icon: Scissors,
        },
      ],
    },
    {
      label: t('admin.navigation.calendar'),
      href: '/admin/calendar',
      icon: Calendar,
    },
    {
      label: t('admin.navigation.analytics'),
      href: '/admin/analytics',
      icon: BarChart3,
    },
    {
      label: t('admin.navigation.settings'),
      href: '/admin/settings',
      icon: Settings,
    },
  ];

  const handleLogout = async () => {
    try {
      await logout().unwrap();
      // Navigation will be handled by the auth slice
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const isActivePath = (href: string) => {
    if (href === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(href);
  };

  const renderNavigationItem = (item: NavigationItem, level = 0) => {
    const isActive = isActivePath(item.href);
    const Icon = item.icon;

    return (
      <div key={item.href}>
        <Link
          to={item.href}
          className={`
            group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200
            ${level > 0 ? 'ml-6' : ''}
            ${isActive
              ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-500'
              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            }
          `}
          onClick={() => setSidebarOpen(false)}
        >
          <Icon
            className={`
              mr-3 h-5 w-5 transition-colors duration-200
              ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}
            `}
          />
          <span>{item.label}</span>
          {isActive && (
            <motion.div
              layoutId="activeIndicator"
              className="absolute right-0 w-1 h-full bg-blue-500 rounded-l"
              initial={false}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
        </Link>
        {item.children && (
          <div className="mt-1 space-y-1">
            {item.children.map((child) => renderNavigationItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const Sidebar = ({ className = '' }: { className?: string }) => (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Logo */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Scissors className="w-5 h-5 text-white" />
          </div>
          <div className="ml-3">
            <h2 className="text-lg font-semibold text-gray-900">JLI Admin</h2>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navigation.map((item) => renderNavigationItem(item))}
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700">
                {user?.name?.charAt(0)?.toUpperCase()}
              </span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{t('user.role.admin')}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="p-2"
          >
            {isLoggingOut ? (
              <LoadingSpinner size="sm" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0 lg:w-64">
        <div className="flex flex-col w-full bg-white border-r border-gray-200">
          <Sidebar />
        </div>
      </div>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed inset-y-0 left-0 z-50 w-64 bg-white lg:hidden"
          >
            <Sidebar />
          </motion.div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-4 lg:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden mr-2"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>

              {/* Breadcrumbs */}
              <nav className="flex items-center text-sm text-gray-500">
                <Link to="/admin" className="hover:text-gray-700">
                  {t('admin.title')}
                </Link>
                {location.pathname !== '/admin' && (
                  <>
                    <ChevronRight className="w-4 h-4 mx-2" />
                    <span className="text-gray-900">
                      {navigation.find(item =>
                        location.pathname.startsWith(item.href) && item.href !== '/admin'
                      )?.label}
                    </span>
                  </>
                )}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <Button
                variant="ghost"
                size="sm"
                className="relative p-2"
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="p-6"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};