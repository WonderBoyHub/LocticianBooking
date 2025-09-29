import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Calendar,
  TrendingUp,
  Users,
  DollarSign,
  Scissors,
  Download,
  Filter,
  Calendar as CalendarIcon,
  BarChart3,
  PieChart,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Chart } from '../ui/Chart';
import { LoadingSpinner } from '../ui/LoadingSpinner';

import { useGetAnalyticsQuery } from '../../store/api';
import type { SelectOption } from '../../types';

interface AnalyticsFilters {
  period: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  locticianId?: string;
  serviceId?: string;
  categoryId?: string;
}

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  change?: {
    value: number;
    isPositive: boolean;
    period: string;
  };
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}> = ({ title, value, change, icon: Icon, color = 'blue' }) => (
  <Card className="p-6 hover:shadow-lg transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        {change && (
          <div className="flex items-center mt-2">
            {change.isPositive ? (
              <ArrowUpRight className="w-4 h-4 text-green-500" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-red-500" />
            )}
            <span
              className={`text-sm font-medium ${
                change.isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {Math.abs(change.value)}%
            </span>
            <span className="text-sm text-gray-500 ml-1">{change.period}</span>
          </div>
        )}
      </div>
      <div className={`w-12 h-12 bg-${color}-100 rounded-full flex items-center justify-center`}>
        <Icon className={`w-6 h-6 text-${color}-600`} />
      </div>
    </div>
  </Card>
);

const TopPerformersCard: React.FC<{
  title: string;
  data: Array<{
    name: string;
    value: number;
    change?: number;
    subtitle?: string;
  }>;
}> = ({ title, data }) => (
  <Card className="p-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>
    <div className="space-y-4">
      {data.map((item, index) => (
        <div key={item.name} className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-sm font-semibold text-blue-600">#{index + 1}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{item.name}</p>
              {item.subtitle && (
                <p className="text-xs text-gray-500">{item.subtitle}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">{item.value}</p>
            {item.change && (
              <div className="flex items-center">
                {item.change > 0 ? (
                  <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-500 mr-1" />
                )}
                <span
                  className={`text-xs ${
                    item.change > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {Math.abs(item.change)}%
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  </Card>
);

export const AdminAnalytics: React.FC = () => {
  const { t } = useTranslation();

  const [filters, setFilters] = React.useState<AnalyticsFilters>({
    period: 'month',
  });

  // Calculate date range based on period
  const dateRange = React.useMemo(() => {
    const today = new Date();
    switch (filters.period) {
      case 'today':
        return {
          start: format(today, 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd'),
        };
      case 'week':
        return {
          start: format(subDays(today, 7), 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd'),
        };
      case 'month':
        return {
          start: format(startOfMonth(today), 'yyyy-MM-dd'),
          end: format(endOfMonth(today), 'yyyy-MM-dd'),
        };
      case 'quarter':
        return {
          start: format(subDays(today, 90), 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd'),
        };
      case 'year':
        return {
          start: format(subDays(today, 365), 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd'),
        };
      default:
        return {
          start: format(startOfMonth(today), 'yyyy-MM-dd'),
          end: format(endOfMonth(today), 'yyyy-MM-dd'),
        };
    }
  }, [filters.period]);

  const { data: analyticsData, isLoading, error } = useGetAnalyticsQuery({
    startDate: dateRange.start,
    endDate: dateRange.end,
    locticianId: filters.locticianId,
  });

  const periodOptions: SelectOption[] = [
    { value: 'today', label: t('analytics.period.today') },
    { value: 'week', label: t('analytics.period.week') },
    { value: 'month', label: t('analytics.period.month') },
    { value: 'quarter', label: t('analytics.period.quarter') },
    { value: 'year', label: t('analytics.period.year') },
  ];

  // Mock loctician options - replace with real data
  const locticianOptions: SelectOption[] = [
    { value: '', label: t('common.all') },
    { value: '1', label: 'Michael Nielsen' },
    { value: '2', label: 'Sarah Johnson' },
  ];

  // Revenue trend data
  const revenueData = React.useMemo(() => {
    const days = 30;
    return Array.from({ length: days }, (_, i) => {
      const date = subDays(new Date(), days - 1 - i);
      return {
        date: format(date, 'MMM dd'),
        revenue: Math.floor(Math.random() * 3000) + 1000 + (i * 50),
        appointments: Math.floor(Math.random() * 10) + 5,
      };
    });
  }, []);

  // Appointment status distribution
  const appointmentStatusData = React.useMemo(() => [
    { name: 'Completed', value: 245, color: '#10B981' },
    { name: 'Confirmed', value: 89, color: '#3B82F6' },
    { name: 'Pending', value: 32, color: '#F59E0B' },
    { name: 'Cancelled', value: 18, color: '#EF4444' },
    { name: 'No Show', value: 12, color: '#9CA3AF' },
  ], []);

  // Service performance data
  const servicePerformanceData = React.useMemo(() => [
    { service: 'Locs Maintenance', bookings: 89, revenue: 44500 },
    { service: 'New Installation', bookings: 34, revenue: 51000 },
    { service: 'Styling', bookings: 67, revenue: 33500 },
    { service: 'Consultation', bookings: 23, revenue: 6900 },
    { service: 'Repairs', bookings: 12, revenue: 7200 },
  ], []);

  // Top customers data
  const topCustomersData = React.useMemo(() => [
    { name: 'Anna Jensen', value: 12500, change: 15, subtitle: '8 appointments' },
    { name: 'Michael Nielsen', value: 9800, change: -5, subtitle: '6 appointments' },
    { name: 'Sarah Johnson', value: 8200, change: 25, subtitle: '5 appointments' },
    { name: 'Lars Andersen', value: 7100, change: 8, subtitle: '4 appointments' },
  ], []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load analytics data</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('admin.analytics.title')}
          </h1>
          <p className="text-gray-600 mt-1">
            {t('admin.analytics.subtitle')}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            {t('analytics.exportReport')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label={t('analytics.timePeriod')}
            options={periodOptions}
            value={filters.period}
            onChange={(value) => setFilters({ ...filters, period: value as any })}
          />
          <Select
            label={t('analytics.loctician')}
            options={locticianOptions}
            value={filters.locticianId || ''}
            onChange={(value) => setFilters({ ...filters, locticianId: value || undefined })}
          />
          <div className="flex items-end">
            <Button variant="outline" className="w-full">
              <Filter className="w-4 h-4 mr-2" />
              {t('common.moreFilters')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <MetricCard
            title={t('analytics.metrics.totalRevenue')}
            value={`${analyticsData?.data?.revenue?.total?.toLocaleString('da-DK') || '0'} DKK`}
            change={{ value: 15.3, isPositive: true, period: 'vs last month' }}
            icon={DollarSign}
            color="green"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <MetricCard
            title={t('analytics.metrics.totalAppointments')}
            value={analyticsData?.data?.appointments?.total || '0'}
            change={{ value: 8.7, isPositive: true, period: 'vs last month' }}
            icon={Calendar}
            color="blue"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <MetricCard
            title={t('analytics.metrics.newCustomers')}
            value={analyticsData?.data?.customers?.new || '0'}
            change={{ value: 23.1, isPositive: true, period: 'vs last month' }}
            icon={Users}
            color="purple"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <MetricCard
            title={t('analytics.metrics.avgBookingValue')}
            value="875 DKK"
            change={{ value: 12.4, isPositive: true, period: 'vs last month' }}
            icon={TrendingUp}
            color="orange"
          />
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('analytics.charts.revenueTrend')}
            </h3>
            <Badge variant="success">+15.3%</Badge>
          </div>
          <Chart
            type="line"
            data={revenueData}
            xDataKey="date"
            lines={[
              {
                dataKey: 'revenue',
                stroke: '#3B82F6',
                strokeWidth: 2,
                name: 'Revenue',
              },
            ]}
            height={300}
          />
        </Card>

        {/* Appointment Status */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('analytics.charts.appointmentStatus')}
            </h3>
          </div>
          <Chart
            type="pie"
            data={appointmentStatusData}
            dataKey="value"
            nameKey="name"
            colors={appointmentStatusData.map(item => item.color)}
            height={300}
            innerRadius={50}
          />
        </Card>
      </div>

      {/* Service Performance */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('analytics.charts.servicePerformance')}
          </h3>
          <Button variant="ghost" size="sm">
            View Details
          </Button>
        </div>
        <Chart
          type="bar"
          data={servicePerformanceData}
          xDataKey="service"
          bars={[
            {
              dataKey: 'revenue',
              fill: '#3B82F6',
              name: 'Revenue',
            },
          ]}
          height={300}
        />
      </Card>

      {/* Bottom Row - Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopPerformersCard
          title={t('analytics.topCustomers')}
          data={topCustomersData}
        />

        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('analytics.bookingPatterns')}
            </h3>
          </div>

          {/* Hourly booking pattern */}
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Peak Hours</span>
              <span>10:00 - 14:00</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Busiest Day</span>
              <span>Saturday</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Avg Lead Time</span>
              <span>5.2 days</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Cancellation Rate</span>
              <span className="text-red-600">4.2%</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>No-Show Rate</span>
              <span className="text-red-600">2.1%</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};