import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Users,
  Calendar,
  Package,
  TrendingUp,
  DollarSign,
  Clock,
  UserCheck,
  AlertTriangle,
  Settings,
  BarChart3,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import {
  selectDashboardStats,
  selectRecentActivity,
  selectDashboardLoading,
  setDashboardLoading
} from '../../store/slices/adminSlice';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<any>;
  color: string;
  href?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon: Icon, color, href }) => {
  const content = (
    <motion.div
      whileHover={{ y: -2, shadow: '0 8px 25px rgba(0,0,0,0.1)' }}
      className="bg-white rounded-xl p-6 shadow-soft border border-brown-200 cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-brown-600 font-medium">{title}</p>
          <p className="text-2xl font-bold text-brand-dark mt-1">{value}</p>
          {change !== undefined && (
            <div className="flex items-center mt-2">
              {change >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(change)}%
              </span>
              <span className="text-sm text-brown-500 ml-1">vs last month</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </motion.div>
  );

  return href ? <Link to={href}>{content}</Link> : content;
};

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  href: string;
}

const QuickAction: React.FC<QuickActionProps> = ({ title, description, icon: Icon, color, href }) => {
  return (
    <Link to={href}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="bg-white rounded-xl p-4 shadow-soft border border-brown-200 hover:shadow-md transition-shadow"
      >
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-brand-dark">{title}</h3>
            <p className="text-sm text-brown-600">{description}</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-brown-400" />
        </div>
      </motion.div>
    </Link>
  );
};

export const AdminOverview: React.FC = () => {
  const dispatch = useAppDispatch();
  const stats = useAppSelector(selectDashboardStats);
  const recentActivity = useAppSelector(selectRecentActivity);
  const loading = useAppSelector(selectDashboardLoading);

  // Mock data - in real app, this would come from API
  React.useEffect(() => {
    dispatch(setDashboardLoading(true));
    // Simulate API call
    setTimeout(() => {
      dispatch(setDashboardLoading(false));
    }, 1000);
  }, [dispatch]);

  const mockStats = {
    totalUsers: 1250,
    totalBookings: 3480,
    totalRevenue: 125000,
    activeServices: 45
  };

  const quickActions = [
    {
      title: 'Add New User',
      description: 'Create customer or staff account',
      icon: Users,
      color: 'bg-blue-500',
      href: '/admin/users/new'
    },
    {
      title: 'Create Service',
      description: 'Add new service or treatment',
      icon: Package,
      color: 'bg-green-500',
      href: '/admin/services/new'
    },
    {
      title: 'Manage Calendar',
      description: 'View and edit appointments',
      icon: Calendar,
      color: 'bg-purple-500',
      href: '/admin/calendar'
    },
    {
      title: 'System Settings',
      description: 'Configure business settings',
      icon: Settings,
      color: 'bg-gray-500',
      href: '/admin/settings'
    }
  ];

  const mockActivity = [
    {
      id: '1',
      type: 'user_registered' as const,
      description: 'New customer Maria Jensen registered',
      timestamp: '2024-01-20T10:30:00Z',
      metadata: { userId: 'user123' }
    },
    {
      id: '2',
      type: 'booking_created' as const,
      description: 'New booking for Dreadlock Maintenance',
      timestamp: '2024-01-20T09:15:00Z',
      metadata: { bookingId: 'booking456' }
    },
    {
      id: '3',
      type: 'service_updated' as const,
      description: 'Service "Loc Extensions" price updated',
      timestamp: '2024-01-20T08:45:00Z',
      metadata: { serviceId: 'service789' }
    },
    {
      id: '4',
      type: 'payment_received' as const,
      description: 'Payment received: 850 DKK',
      timestamp: '2024-01-19T16:20:00Z',
      metadata: { amount: 850 }
    }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_registered':
        return UserCheck;
      case 'booking_created':
        return Calendar;
      case 'service_updated':
        return Package;
      case 'payment_received':
        return DollarSign;
      default:
        return Activity;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'user_registered':
        return 'text-blue-500';
      case 'booking_created':
        return 'text-green-500';
      case 'service_updated':
        return 'text-purple-500';
      case 'payment_received':
        return 'text-brand-primary';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-brand-dark">
            Admin Dashboard
          </h1>
          <p className="text-brown-600 mt-1">
            Welcome back! Here's what's happening with your business.
          </p>
        </div>
        <Link
          to="/admin/analytics"
          className="inline-flex items-center px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-dark transition-colors"
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          View Analytics
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={mockStats.totalUsers.toLocaleString()}
          change={12}
          icon={Users}
          color="bg-blue-500"
          href="/admin/users"
        />
        <StatCard
          title="Total Bookings"
          value={mockStats.totalBookings.toLocaleString()}
          change={8}
          icon={Calendar}
          color="bg-green-500"
          href="/admin/calendar"
        />
        <StatCard
          title="Revenue (DKK)"
          value={`${mockStats.totalRevenue.toLocaleString()}`}
          change={15}
          icon={DollarSign}
          color="bg-brand-primary"
          href="/admin/analytics"
        />
        <StatCard
          title="Active Services"
          value={mockStats.activeServices}
          change={-2}
          icon={Package}
          color="bg-purple-500"
          href="/admin/services"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-soft border border-brown-200 p-6">
            <h2 className="text-lg font-serif font-bold text-brand-dark mb-4">
              Quick Actions
            </h2>
            <div className="space-y-3">
              {quickActions.map((action) => (
                <QuickAction key={action.title} {...action} />
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-soft border border-brown-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-serif font-bold text-brand-dark">
                Recent Activity
              </h2>
              <button className="text-sm text-brand-primary hover:text-brand-dark font-medium">
                View All
              </button>
            </div>

            <div className="space-y-4">
              {mockActivity.map((activity) => {
                const Icon = getActivityIcon(activity.type);
                const colorClass = getActivityColor(activity.type);

                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-brown-50 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-full bg-brown-100 flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${colorClass}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-brand-dark">
                        {activity.description}
                      </p>
                      <p className="text-xs text-brown-600">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-white rounded-xl shadow-soft border border-brown-200 p-6">
        <h2 className="text-lg font-serif font-bold text-brand-dark mb-4">
          System Health
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <div>
              <p className="text-sm font-medium text-green-800">All Systems Operational</p>
              <p className="text-xs text-green-600">Last checked: 2 minutes ago</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div>
              <p className="text-sm font-medium text-yellow-800">2 Pending Updates</p>
              <p className="text-xs text-yellow-600">Non-critical system updates</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <div>
              <p className="text-sm font-medium text-blue-800">Backup Completed</p>
              <p className="text-xs text-blue-600">Last backup: 6 hours ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};