import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Menu, Bell, Search, ChevronDown } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { selectUser } from '../../store/slices/authSlice';
import { selectIsSidebarOpen, toggleSidebar } from '../../store/slices/uiSlice';
import { Sidebar } from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
  subtitle,
  actions,
  className
}) => {
  const user = useAppSelector(selectUser);
  const isOpen = useAppSelector(selectIsSidebarOpen);
  const dispatch = useAppDispatch();

  return (
    <div className="min-h-screen bg-brown-50 flex">
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Top Navigation */}
        <header className="bg-white border-b border-brown-200 px-4 lg:px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left side */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => dispatch(toggleSidebar())}
                className="lg:hidden p-2 rounded-lg text-brown-600 hover:bg-brown-100 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                aria-label="Toggle sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>

              {title && (
                <div>
                  <h1 className="text-xl lg:text-2xl font-serif font-bold text-brand-dark">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="text-sm text-brown-600 mt-1">{subtitle}</p>
                  )}
                </div>
              )}
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-3">
              {/* Search */}
              <div className="hidden md:block relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-brown-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 w-64 text-sm bg-brown-50 border border-brown-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                />
              </div>

              {/* Notifications */}
              <button className="relative p-2 rounded-lg text-brown-600 hover:bg-brown-100 focus:outline-none focus:ring-2 focus:ring-brand-primary/20">
                <Bell className="w-5 h-5" />
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* User Menu */}
              <div className="relative">
                <button className="flex items-center space-x-2 p-2 rounded-lg hover:bg-brown-100 focus:outline-none focus:ring-2 focus:ring-brand-primary/20">
                  <div className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {user?.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-brand-dark">
                      {user?.name}
                    </p>
                    <p className="text-xs text-brown-600 capitalize">
                      {user?.role}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-brown-400" />
                </button>
              </div>

              {/* Actions */}
              {actions && <div className="flex items-center space-x-2">{actions}</div>}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className={clsx('flex-1 p-4 lg:p-6', className)}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-7xl mx-auto"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};