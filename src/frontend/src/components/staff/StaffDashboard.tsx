import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  DollarSign,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { format, startOfDay, endOfDay, addDays } from 'date-fns';

import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Chart } from '../ui/Chart';
import { LoadingSpinner } from '../ui/LoadingSpinner';

import { useGetAppointmentsQuery } from '../../store/api';
import type { Appointment } from '../../types';

interface QuickStatProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const QuickStat: React.FC<QuickStatProps> = ({ title, value, icon: Icon, color = 'blue', trend }) => (
  <Card className="p-6 hover:shadow-lg transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
        {trend && (
          <div className="flex items-center mt-2">
            <TrendingUp className={`w-4 h-4 ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`} />
            <span className={`text-sm font-medium ml-1 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.value}% vs last week
            </span>
          </div>
        )}
      </div>
      <div className={`w-12 h-12 bg-${color}-100 rounded-full flex items-center justify-center`}>
        <Icon className={`w-6 h-6 text-${color}-600`} />
      </div>
    </div>
  </Card>
);

const AppointmentCard: React.FC<{ appointment: Appointment }> = ({ appointment }) => {
  const { t } = useTranslation();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'pending': return 'warning';
      case 'completed': return 'info';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
          <span className="text-sm font-medium text-gray-600">
            {appointment.customer?.name?.charAt(0)?.toUpperCase() || 'C'}
          </span>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-900">
            {appointment.customer?.name || 'Customer'}
          </h4>
          <p className="text-sm text-gray-500">{appointment.service?.name}</p>
          <div className="flex items-center mt-1 text-xs text-gray-400">
            <Clock className="w-3 h-3 mr-1" />
            <span>{appointment.startTime} - {appointment.endTime}</span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <Badge variant={getStatusColor(appointment.status) as any}>
          {t(`appointment.status.${appointment.status}`)}
        </Badge>
        <p className="text-sm font-medium text-gray-900 mt-1">
          {appointment.totalPrice.toLocaleString('da-DK')} DKK
        </p>
      </div>
    </div>
  );
};

const UpcomingAppointments: React.FC = () => {
  const { t } = useTranslation();
  const today = new Date();

  const { data: appointmentsData, isLoading } = useGetAppointmentsQuery({
    dateRange: {
      start: format(startOfDay(today), 'yyyy-MM-dd'),
      end: format(endOfDay(addDays(today, 7)), 'yyyy-MM-dd'),
    },
    limit: 5,
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <LoadingSpinner size="sm" />
        </div>
      </Card>
    );
  }

  const appointments = appointmentsData?.data || [];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('staff.dashboard.upcomingAppointments')}
        </h3>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/calendar">{t('common.viewAll')}</Link>
        </Button>
      </div>

      <div className="space-y-3">
        {appointments.length > 0 ? (
          appointments.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>{t('staff.dashboard.noUpcomingAppointments')}</p>
          </div>
        )}
      </div>
    </Card>
  );
};

const RecentCustomers: React.FC = () => {
  const { t } = useTranslation();

  // Mock recent customers - replace with real data
  const recentCustomers = [
    {
      id: '1',
      name: 'Anna Jensen',
      email: 'anna@example.com',
      phone: '+45 12 34 56 78',
      lastVisit: '2024-01-15',
      totalSpent: 2500,
      appointmentCount: 3,
    },
    {
      id: '2',
      name: 'Michael Nielsen',
      email: 'michael@example.com',
      phone: '+45 98 76 54 32',
      lastVisit: '2024-01-12',
      totalSpent: 1800,
      appointmentCount: 2,
    },
    {
      id: '3',
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      phone: '+45 55 66 77 88',
      lastVisit: '2024-01-10',
      totalSpent: 3200,
      appointmentCount: 4,
    },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('staff.dashboard.recentCustomers')}
        </h3>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/customers">{t('common.viewAll')}</Link>
        </Button>
      </div>

      <div className="space-y-4">
        {recentCustomers.map((customer) => (
          <div key={customer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border">
                <span className="text-sm font-medium text-gray-600">
                  {customer.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900">{customer.name}</h4>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>{customer.appointmentCount} visits</span>
                  <span>•</span>
                  <span>{format(new Date(customer.lastVisit), 'MMM dd')}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {customer.totalSpent.toLocaleString('da-DK')} DKK
              </p>
              <div className="flex items-center space-x-1 mt-1">
                <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
                  <Phone className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
                  <Mail className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export const StaffDashboard: React.FC = () => {
  const { t } = useTranslation();

  // Mock performance data
  const performanceData = React.useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return {
        date: format(date, 'MMM dd'),
        appointments: Math.floor(Math.random() * 8) + 3,
        revenue: Math.floor(Math.random() * 2000) + 1000,
      };
    });
    return last7Days;
  }, []);

  const quickStats = [
    {
      title: t('staff.dashboard.stats.todayAppointments'),
      value: '8',
      icon: Calendar,
      color: 'blue',
      trend: { value: 12, isPositive: true },
    },
    {
      title: t('staff.dashboard.stats.weekRevenue'),
      value: '12,500 DKK',
      icon: DollarSign,
      color: 'green',
      trend: { value: 8, isPositive: true },
    },
    {
      title: t('staff.dashboard.stats.totalCustomers'),
      value: '47',
      icon: Users,
      color: 'purple',
      trend: { value: 15, isPositive: true },
    },
    {
      title: t('staff.dashboard.stats.avgRating'),
      value: '4.8',
      icon: TrendingUp,
      color: 'orange',
      trend: { value: 3, isPositive: true },
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('staff.dashboard.title')}
          </h1>
          <p className="text-gray-600 mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" asChild>
            <Link to="/calendar">
              <Calendar className="w-4 h-4 mr-2" />
              {t('staff.dashboard.viewCalendar')}
            </Link>
          </Button>
          <Button asChild>
            <Link to="/calendar?action=create">
              {t('staff.dashboard.newAppointment')}
            </Link>
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
            <QuickStat {...stat} />
          </motion.div>
        ))}
      </div>

      {/* Performance Chart */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('staff.dashboard.weeklyPerformance')}
          </h3>
          <Badge variant="success">+8.2%</Badge>
        </div>
        <Chart
          type="line"
          data={performanceData}
          xDataKey="date"
          lines={[
            {
              dataKey: 'revenue',
              stroke: '#3B82F6',
              strokeWidth: 2,
              name: 'Revenue',
            },
          ]}
          height={250}
        />
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingAppointments />
        <RecentCustomers />
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('staff.dashboard.quickActions')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button variant="outline" asChild className="h-auto py-4 flex flex-col">
            <Link to="/calendar?action=create">
              <Calendar className="w-6 h-6 mb-2" />
              <span>{t('staff.dashboard.actions.newAppointment')}</span>
            </Link>
          </Button>
          <Button variant="outline" asChild className="h-auto py-4 flex flex-col">
            <Link to="/customers?action=create">
              <Users className="w-6 h-6 mb-2" />
              <span>{t('staff.dashboard.actions.addCustomer')}</span>
            </Link>
          </Button>
          <Button variant="outline" asChild className="h-auto py-4 flex flex-col">
            <Link to="/services">
              <Clock className="w-6 h-6 mb-2" />
              <span>{t('staff.dashboard.actions.manageServices')}</span>
            </Link>
          </Button>
          <Button variant="outline" asChild className="h-auto py-4 flex flex-col">
            <Link to="/calendar?view=availability">
              <Calendar className="w-6 h-6 mb-2" />
              <span>{t('staff.dashboard.actions.setAvailability')}</span>
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
};