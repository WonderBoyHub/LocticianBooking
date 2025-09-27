import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  User,
  Settings,
  CreditCard,
  Bell,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  Star,
  ArrowUpRight,
  Plus,
  Filter,
  Search,
  Download,
  Share2,
} from 'lucide-react';
import { format, startOfDay, endOfDay, addDays, isToday, isTomorrow } from 'date-fns';
import { da } from 'date-fns/locale';

import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/ui/StatusBadge';

import {
  useGetCurrentUserQuery,
  useGetAppointmentsQuery,
  useCancelAppointmentMutation,
} from '../store/api';
import type { Appointment, AppointmentStatus } from '../types';

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
  color: string;
  badge?: string;
}

const QuickAction: React.FC<QuickActionProps> = ({
  title,
  description,
  icon: Icon,
  href,
  onClick,
  color,
  badge,
}) => {
  const content = (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer border-l-4 border-l-${color}-500 relative group`}>
      {badge && (
        <div className="absolute -top-2 -right-2">
          <Badge variant="error" className="text-xs">{badge}</Badge>
        </div>
      )}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <div className={`w-10 h-10 bg-${color}-100 rounded-lg flex items-center justify-center`}>
              <Icon className={`w-5 h-5 text-${color}-600`} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <p className="text-gray-600 text-sm">{description}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
      </div>
    </div>
  );

  if (href) {
    return <Link to={href}>{content}</Link>;
  }

  return <div onClick={onClick}>{content}</div>;
};

interface AppointmentCardProps {
  appointment: Appointment;
  onCancel?: (id: string) => void;
  onReschedule?: (id: string) => void;
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  onCancel,
  onReschedule,
}) => {
  const appointmentDate = new Date(appointment.date);
  const startTime = appointment.startTime;
  const endTime = appointment.endTime;

  const getStatusColor = (status: AppointmentStatus) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'pending': return 'warning';
      case 'completed': return 'info';
      case 'cancelled': return 'error';
      case 'in_progress': return 'info';
      case 'no_show': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: AppointmentStatus) => {
    switch (status) {
      case 'confirmed': return 'Bekræftet';
      case 'pending': return 'Afventer';
      case 'completed': return 'Gennemført';
      case 'cancelled': return 'Aflyst';
      case 'in_progress': return 'I gang';
      case 'no_show': return 'Ikke mødt op';
      default: return status;
    }
  };

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'I dag';
    if (isTomorrow(date)) return 'I morgen';
    return format(date, 'EEEE d. MMMM', { locale: da });
  };

  const isPastAppointment = appointmentDate < new Date();
  const canCancel = ['pending', 'confirmed'].includes(appointment.status) && !isPastAppointment;
  const canReschedule = ['pending', 'confirmed'].includes(appointment.status) && !isPastAppointment;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {appointment.service?.name || 'Service'}
            </h3>
            <StatusBadge variant={getStatusColor(appointment.status)}>
              {getStatusLabel(appointment.status)}
            </StatusBadge>
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>{getDateLabel(appointmentDate)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>{startTime} - {endTime}</span>
            </div>
            {appointment.loctician && (
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>{appointment.loctician.name}</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-gray-900">
            {appointment.totalPrice.toLocaleString('da-DK')} DKK
          </p>
          {appointment.service?.duration && (
            <p className="text-sm text-gray-600">
              {appointment.service.duration} min
            </p>
          )}
        </div>
      </div>

      {(canCancel || canReschedule) && (
        <div className="flex items-center space-x-2 pt-4 border-t border-gray-100">
          {canReschedule && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReschedule?.(appointment.id)}
            >
              Flyt tid
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCancel?.(appointment.id)}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Aflys
            </Button>
          )}
        </div>
      )}

      {appointment.customerNotes && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-600">
            <strong>Dine noter:</strong> {appointment.customerNotes}
          </p>
        </div>
      )}
    </motion.div>
  );
};

const CustomerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [appointmentFilter, setAppointmentFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  const [showCancelDialog, setShowCancelDialog] = useState<string | null>(null);

  // API queries
  const { data: userData, isLoading: userLoading } = useGetCurrentUserQuery();
  const {
    data: appointmentsData,
    isLoading: appointmentsLoading,
    refetch: refetchAppointments,
  } = useGetAppointmentsQuery({
    customerId: userData?.data?.id,
    limit: 20,
  });

  const [cancelAppointment, { isLoading: isCancelling }] = useCancelAppointmentMutation();

  const user = userData?.data;
  const appointments = appointmentsData?.data || [];

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    const now = new Date();
    return appointments.filter((appointment) => {
      const appointmentDate = new Date(appointment.date);

      switch (appointmentFilter) {
        case 'upcoming':
          return appointmentDate >= startOfDay(now) &&
                 ['pending', 'confirmed'].includes(appointment.status);
        case 'past':
          return appointmentDate < startOfDay(now) ||
                 ['completed', 'cancelled', 'no_show'].includes(appointment.status);
        default:
          return true;
      }
    });
  }, [appointments, appointmentFilter]);

  // Statistics
  const stats = useMemo(() => {
    const now = new Date();
    const upcomingAppointments = appointments.filter(
      (apt) => new Date(apt.date) >= startOfDay(now) &&
               ['pending', 'confirmed'].includes(apt.status)
    );
    const completedAppointments = appointments.filter(
      (apt) => apt.status === 'completed'
    );
    const totalSpent = completedAppointments.reduce(
      (sum, apt) => sum + apt.totalPrice, 0
    );
    const nextAppointment = upcomingAppointments
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

    return {
      upcoming: upcomingAppointments.length,
      completed: completedAppointments.length,
      totalSpent,
      nextAppointment,
    };
  }, [appointments]);

  // Handlers
  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      await cancelAppointment({ id: appointmentId }).unwrap();
      refetchAppointments();
      setShowCancelDialog(null);
    } catch (error) {
      console.error('Failed to cancel appointment:', error);
    }
  };

  const handleRescheduleAppointment = (appointmentId: string) => {
    navigate(`/booking?reschedule=${appointmentId}`);
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold text-amber-900 mb-2">
                  Velkommen tilbage, {user?.name?.split(' ')[0] || 'Kunde'}!
                </h1>
                <p className="text-amber-700 text-lg">
                  Administrer dine aftaler og profil
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="outline" asChild>
                  <Link to="/profile">
                    <Settings className="w-4 h-4 mr-2" />
                    Indstillinger
                  </Link>
                </Button>
                <Button asChild>
                  <Link to="/services">
                    <Plus className="w-4 h-4 mr-2" />
                    Book tid
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
          >
            <Card className="p-6 border-l-4 border-l-amber-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Kommende aftaler</p>
                  <p className="text-2xl font-bold text-amber-900 mt-1">{stats.upcoming}</p>
                </div>
                <Calendar className="w-8 h-8 text-amber-500" />
              </div>
            </Card>

            <Card className="p-6 border-l-4 border-l-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Gennemførte aftaler</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">{stats.completed}</p>
                </div>
                <Clock className="w-8 h-8 text-green-500" />
              </div>
            </Card>

            <Card className="p-6 border-l-4 border-l-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total brugt</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">
                    {stats.totalSpent.toLocaleString('da-DK')} DKK
                  </p>
                </div>
                <CreditCard className="w-8 h-8 text-blue-500" />
              </div>
            </Card>

            <Card className="p-6 border-l-4 border-l-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Næste aftale</p>
                  <p className="text-sm font-semibold text-purple-700 mt-1">
                    {stats.nextAppointment
                      ? format(new Date(stats.nextAppointment.date), 'dd/MM', { locale: da })
                      : 'Ingen planlagt'
                    }
                  </p>
                </div>
                <Bell className="w-8 h-8 text-purple-500" />
              </div>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-2xl font-semibold text-amber-900 mb-4">Hurtige handlinger</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <QuickAction
                title="Book ny tid"
                description="Find og book din næste behandling"
                icon={Plus}
                href="/services"
                color="amber"
              />
              <QuickAction
                title="Se behandlinger"
                description="Gennemse vores fulde servicekatalog"
                icon={Search}
                href="/services"
                color="blue"
              />
              <QuickAction
                title="Min profil"
                description="Rediger dine oplysninger og præferencer"
                icon={User}
                href="/profile"
                color="green"
              />
              <QuickAction
                title="Abonnementer"
                description="Administrer dine abonnementer"
                icon={CreditCard}
                href="/subscriptions"
                color="purple"
                badge={user?.role === 'customer' ? undefined : 'Ny'}
              />
            </div>
          </motion.div>

          {/* Appointments Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-amber-900">Mine aftaler</h2>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setAppointmentFilter('upcoming')}
                      className={`px-3 py-1 text-sm font-medium rounded transition-all ${
                        appointmentFilter === 'upcoming'
                          ? 'bg-white text-amber-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Kommende
                    </button>
                    <button
                      onClick={() => setAppointmentFilter('past')}
                      className={`px-3 py-1 text-sm font-medium rounded transition-all ${
                        appointmentFilter === 'past'
                          ? 'bg-white text-amber-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Tidligere
                    </button>
                    <button
                      onClick={() => setAppointmentFilter('all')}
                      className={`px-3 py-1 text-sm font-medium rounded transition-all ${
                        appointmentFilter === 'all'
                          ? 'bg-white text-amber-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Alle
                    </button>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {appointmentsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : filteredAppointments.length > 0 ? (
                <div className="space-y-4">
                  <AnimatePresence>
                    {filteredAppointments.map((appointment) => (
                      <AppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        onCancel={setShowCancelDialog}
                        onReschedule={handleRescheduleAppointment}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {appointmentFilter === 'upcoming'
                      ? 'Ingen kommende aftaler'
                      : appointmentFilter === 'past'
                      ? 'Ingen tidligere aftaler'
                      : 'Ingen aftaler endnu'
                    }
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {appointmentFilter === 'upcoming'
                      ? 'Book din første aftale for at komme i gang.'
                      : 'Dine aftaler vil blive vist her.'
                    }
                  </p>
                  <Button asChild>
                    <Link to="/services">
                      <Plus className="w-4 h-4 mr-2" />
                      Book din første aftale
                    </Link>
                  </Button>
                </div>
              )}

              {filteredAppointments.length > 0 && (
                <div className="mt-6 text-center">
                  <Button variant="outline" asChild>
                    <Link to="/appointments">
                      Se alle aftaler
                      <ArrowUpRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              )}
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Aflys aftale
            </h3>
            <p className="text-gray-600 mb-6">
              Er du sikker på, at du vil aflyse denne aftale? Denne handling kan ikke fortrydes.
            </p>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowCancelDialog(null)}
                disabled={isCancelling}
              >
                Annuller
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleCancelAppointment(showCancelDialog)}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Aflyser...
                  </>
                ) : (
                  'Aflys aftale'
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CustomerDashboard;