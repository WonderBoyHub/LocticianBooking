import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Users,
  Calendar,
  TrendingUp,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  User,
  Scissors,
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useGetAnalyticsQuery, useGetAppointmentsQuery, useGetServicesQuery } from '../../store/api';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Chart } from '../ui/Chart';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Link } from 'react-router-dom';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onClick?: () => void;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, trend, onClick }) => (
  <Card
    className={`p-6 hover:shadow-lg transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
        {trend && (
          <div className="flex items-center mt-2">
            {trend.isPositive ? (
              <ArrowUpRight className="w-4 h-4 text-green-500" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-red-500" />
            )}
            <span
              className={`text-sm font-medium ${
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {Math.abs(trend.value)}%
            </span>
            <span className="text-sm text-gray-500 ml-1">vs last period</span>
          </div>
        )}
      </div>
      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
    </div>
  </Card>
);

const RecentActivity: React.FC = () => {
  const { t } = useTranslation();
  const [activities] = React.useState([
    {
      id: '1',
      type: 'appointment',
      user: 'Anna Jensen',
      action: 'booked an appointment',
      service: 'Locs Maintenance',
      time: '2 minutes ago',
    },
    {
      id: '2',
      type: 'cancellation',
      user: 'Michael Nielsen',
      action: 'cancelled appointment',
      service: 'New Locs Installation',
      time: '15 minutes ago',
    },
    {
      id: '3',
      type: 'registration',
      user: 'Sarah Johnson',
      action: 'registered as new customer',
      service: null,
      time: '1 hour ago',
    },
  ]);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('admin.overview.recentActivity')}
        </h3>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/activity">View All</Link>
        </Button>
      </div>

      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                <User className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {activity.user} {activity.action}
                  {activity.service && (
                    <span className="text-blue-600"> {activity.service}</span>
                  )}
                </p>
                <p className="text-xs text-gray-500">{activity.time}</p>
              </div>
            </div>
            <Badge
              variant={
                activity.type === 'appointment' ? 'success' :
                activity.type === 'cancellation' ? 'warning' : 'default'
              }
            >
              {activity.type}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
};

const TopServices: React.FC = () => {
  const { t } = useTranslation();
  const [topServices] = React.useState([
    { name: 'Locs Maintenance', bookings: 45, revenue: 22500 },
    { name: 'New Locs Installation', bookings: 23, revenue: 34500 },
    { name: 'Locs Styling', bookings: 38, revenue: 19000 },
    { name: 'Consultation', bookings: 12, revenue: 3600 },
  ]);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('admin.overview.topServices')}
        </h3>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/analytics">View Details</Link>
        </Button>
      </div>

      <div className="space-y-4">
        {topServices.map((service, index) => (
          <div key={service.name} className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-sm font-semibold text-blue-600">#{index + 1}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{service.name}</p>
                <p className="text-xs text-gray-500">{service.bookings} bookings</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">
                {service.revenue.toLocaleString('da-DK')} DKK
              </p>
              <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${(service.bookings / 45) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export const AdminOverview: React.FC = () => {
  const { t } = useTranslation();

  // Get analytics data
  const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useGetAnalyticsQuery({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });

  // Get today's appointments
  const { data: appointmentsData, isLoading: appointmentsLoading } = useGetAppointmentsQuery({
    dateRange: {
      start: format(startOfDay(new Date()), 'yyyy-MM-dd'),
      end: format(endOfDay(new Date()), 'yyyy-MM-dd'),
    },
  });

  // Mock quick stats
  const quickStats = [
    {
      title: t('admin.overview.stats.totalUsers'),
      value: '1,247',
      icon: Users,
      trend: { value: 12, isPositive: true },
    },
    {
      title: t('admin.overview.stats.todayAppointments'),
      value: appointmentsData?.data?.length || 0,
      icon: Calendar,
      trend: { value: 8, isPositive: true },
    },
    {
      title: t('admin.overview.stats.monthlyRevenue'),
      value: analyticsData?.data?.revenue?.thisMonth?.toLocaleString('da-DK') + ' DKK' || '0 DKK',
      icon: DollarSign,
      trend: { value: 15, isPositive: true },
    },
    {
      title: t('admin.overview.stats.totalServices'),
      value: '24',
      icon: Scissors,
      trend: { value: 2, isPositive: true },
    },
  ];

  // Revenue chart data
  const revenueChartData = React.useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return {
        date: format(date, 'MMM dd'),
        revenue: Math.floor(Math.random() * 5000) + 1000,
      };
    });
    return last7Days;
  }, []);

  // Appointment status distribution
  const appointmentStatusData = React.useMemo(() => [
    { name: 'Completed', value: 65, color: '#10B981' },
    { name: 'Confirmed', value: 25, color: '#3B82F6' },
    { name: 'Pending', value: 8, color: '#F59E0B' },
    { name: 'Cancelled', value: 2, color: '#EF4444' },
  ], []);

  if (analyticsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('admin.overview.title')}
          </h1>
          <p className="text-gray-600 mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm">
            Export Report
          </Button>
          <Button>
            View Analytics
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <StatsCard {...stat} />
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('admin.overview.charts.revenue7Days')}
            </h3>
            <Badge variant="success">+15.3%</Badge>
          </div>
          <Chart
            type="line"
            data={revenueChartData}
            config={{
              xAxis: { dataKey: 'date' },
              yAxis: { tickFormatter: (value: number) => `${value.toLocaleString()} DKK` },
              series: [
                {
                  dataKey: 'revenue',
                  stroke: '#3B82F6',
                  strokeWidth: 2,
                  fill: 'url(#gradient)',
                },
              ],
            }}
            height={300}
          />
        </Card>

        {/* Appointment Status Distribution */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('admin.overview.charts.appointmentStatus')}
            </h3>
          </div>
          <Chart
            type="pie"
            data={appointmentStatusData}
            config={{
              dataKey: 'value',
              nameKey: 'name',
              colors: appointmentStatusData.map(item => item.color),
            }}
            height={300}
          />
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity />
        <TopServices />
      </div>

      {/* System Alerts (if any) */}
      <Card className="p-6 border-l-4 border-yellow-500">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-yellow-500 mr-3" />
          <div>
            <h4 className="text-sm font-semibold text-gray-900">System Notice</h4>
            <p className="text-sm text-gray-600 mt-1">
              All systems are running normally. Last backup completed 2 hours ago.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};