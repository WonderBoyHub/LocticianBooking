import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Calendar,
  Users,
  BarChart3,
  Settings,
  Home,
  ChevronRight,
  Menu,
  X,
  Bell,
  LogOut,
  Scissors,
  Clock,
} from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import { selectUser } from '../../store/slices/authSlice';
import { useLogoutMutation } from '../../store/api';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Badge } from '../ui/Badge';

interface StaffLayoutProps {
  children: React.ReactNode;
}

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const StaffLayout: React.FC<StaffLayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useAppSelector(selectUser);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [notifications] = React.useState(3); // TODO: Connect to real notifications

  const navigation: NavigationItem[] = [
    {
      label: t('staff.navigation.dashboard'),
      href: '/dashboard',
      icon: Home,
    },
    {
      label: t('staff.navigation.calendar'),
      href: '/calendar',
      icon: Calendar,
      badge: 5, // TODO: Connect to real pending appointments
    },
    {
      label: t('staff.navigation.customers'),
      href: '/customers',
      icon: Users,
    },
    {
      label: t('staff.navigation.services'),
      href: '/services',
      icon: Scissors,
    },
    {
      label: t('staff.navigation.analytics'),
      href: '/analytics',
      icon: BarChart3,
    },
    {
      label: t('staff.navigation.settings'),
      href: '/settings',
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

  const isActivePath = (href: string) =>
    location.pathname === href || location.pathname.startsWith(`${href}/`);

  const renderNavigationItem = (item: NavigationItem) => {
    const isActive = isActivePath(item.href);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        to={item.href}
        className={`
          group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 relative
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
        <span className="flex-1">{item.label}</span>
        {item.badge && item.badge > 0 && (
          <Badge variant="error" className="ml-2 text-xs">
            {item.badge}
          </Badge>
        )}
        {isActive && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute right-0 w-1 h-full bg-blue-500 rounded-l"
            initial={false}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
      </Link>
    );
  };

  const Sidebar = ({ className = '' }: { className?: string }) => (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Scissors className="w-5 h-5 text-white" />
          </div>
          <div className="ml-3">
            <h2 className="text-lg font-semibold text-gray-900">JLI Staff</h2>
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

      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navigation.map((item) => renderNavigationItem(item))}
      </nav>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {t('staff.quickStats.title')}
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{t('staff.quickStats.todayAppointments')}</span>
            <span className="font-medium text-gray-900">8</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{t('staff.quickStats.nextAppointment')}</span>
            <div className="flex items-center text-blue-600">
              <Clock className="w-3 h-3 mr-1" />
              <span className="font-medium">10:30</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{t('staff.quickStats.weekRevenue')}</span>
            <span className="font-medium text-green-600">12.5k DKK</span>
          </div>
        </div>
      </div>

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
              <p className="text-xs text-gray-500">{t('user.role.loctician')}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="p-2"
          >
            {isLoggingOut ? <LoadingSpinner size="sm" /> : <LogOut className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex bg-gray-50">
      <div className="hidden lg:flex lg:flex-shrink-0 lg:w-64">
        <div className="flex flex-col w-full bg-white border-r border-gray-200">
          <Sidebar />
        </div>
      </div>

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

      <div className="flex-1 flex flex-col overflow-hidden">
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

              <nav className="flex items-center text-sm text-gray-500">
                <Link to="/dashboard" className="hover:text-gray-700">
                  {t('staff.navigation.dashboard')}
                </Link>
                {location.pathname !== '/dashboard' && (
                  <>
                    <ChevronRight className="w-4 h-4 mx-2" />
                    <span className="text-gray-900">
                      {navigation.find((item) =>
                        location.pathname.startsWith(item.href) && item.href !== '/dashboard'
                      )?.label}
                    </span>
                  </>
                )}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" className="relative p-2">
                <Bell className="w-5 h-5" />
                {notifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {notifications}
                  </span>
                )}
              </Button>

              <div className="text-sm text-gray-600 hidden md:block">
                {new Date().toLocaleTimeString('da-DK', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        </header>

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
