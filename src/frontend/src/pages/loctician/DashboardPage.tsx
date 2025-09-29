import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Calendar, Users, DollarSign, TrendingUp, Clock, Star } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectUser } from '../../store/slices/authSlice';
import { setBreadcrumbs, setPageTitle } from '../../store/slices/uiSlice';
import { Card, CardContent, CardHeader, CardTitle, Button } from '../../components/ui';
import { formatCurrency } from '../../i18n/index';

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}> = ({ title, value, icon, trend, trendUp }) => (
  <Card hover className="border-l-4 border-l-brand-primary">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p className={`text-xs ${trendUp ? 'text-green-600' : 'text-red-600'} flex items-center mt-1`}>
              <TrendingUp className={`w-3 h-3 mr-1 ${!trendUp && 'rotate-180'}`} />
              {trend}
            </p>
          )}
        </div>
        <div className="text-brand-primary">
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);

  React.useEffect(() => {
    dispatch(setPageTitle(t('navigation.dashboard')));
    dispatch(setBreadcrumbs([
      { label: t('navigation.dashboard') },
    ]));
  }, [dispatch, t]);

  const stats = [
    {
      title: t('dashboard.overview.todayAppointments'),
      value: 8,
      icon: <Calendar className="w-8 h-8" />,
      trend: '+12% from yesterday',
      trendUp: true,
    },
    {
      title: t('dashboard.overview.weekRevenue'),
      value: formatCurrency(15420),
      icon: <DollarSign className="w-8 h-8" />,
      trend: '+8% from last week',
      trendUp: true,
    },
    {
      title: t('dashboard.overview.monthlyBookings'),
      value: 142,
      icon: <Users className="w-8 h-8" />,
      trend: '+23% from last month',
      trendUp: true,
    },
    {
      title: t('dashboard.overview.customerSatisfaction'),
      value: '4.9',
      icon: <Star className="w-8 h-8" />,
      trend: '+0.2 from last month',
      trendUp: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {t('dashboard.welcome')}, {user?.name}
              </h1>
              <p className="text-gray-600 mt-1">
                Here's what's happening with your business today
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600">
                {new Date().toLocaleDateString('da-DK', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </motion.div>
        </div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * (index + 1) }}
            >
              <StatCard {...stat} />
            </motion.div>
          ))}
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Bookings */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.recentBookings.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((_, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center text-white font-medium">
                          JD
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Jane Doe</p>
                          <p className="text-sm text-gray-600">Loc Maintenance - 2 hours</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">{formatCurrency(850)}</p>
                        <p className="text-sm text-gray-600">Today, 2:00 PM</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-center">
                  <Button variant="outline">
                    {t('dashboard.recentBookings.viewAll')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.quickActions.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button fullWidth variant="outline" className="justify-start">
                    <Calendar className="w-4 h-4 mr-2" />
                    {t('dashboard.quickActions.newBooking')}
                  </Button>
                  <Button fullWidth variant="outline" className="justify-start">
                    <Calendar className="w-4 h-4 mr-2" />
                    {t('dashboard.quickActions.viewCalendar')}
                  </Button>
                  <Button fullWidth variant="outline" className="justify-start">
                    <Users className="w-4 h-4 mr-2" />
                    {t('dashboard.quickActions.customerList')}
                  </Button>
                  <Button fullWidth variant="outline" className="justify-start">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    View Analytics
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};