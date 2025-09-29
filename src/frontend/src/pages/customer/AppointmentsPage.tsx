import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Clock,
  User,
  Filter,
  Search,
  Plus,
  ChevronDown,
  Download,
  Share2,
  MapPin,
  Phone,
  Mail,
  Star,
  ArrowLeft,
  MoreHorizontal,
  Edit,
  X,
  CheckCircle,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { format, startOfDay, endOfDay, isToday, isTomorrow, subDays, addDays } from 'date-fns';
import { da } from 'date-fns/locale';

import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { StatusBadge } from '../../components/ui/StatusBadge';

import {
  useGetCurrentUserQuery,
  useGetAppointmentsQuery,
  useCancelAppointmentMutation,
  useUpdateAppointmentMutation,
} from '../../store/api';
import type { Appointment, AppointmentStatus } from '../../types';

interface AppointmentFilters {
  status: AppointmentStatus | 'all';
  dateRange: 'all' | 'upcoming' | 'past' | 'this_week' | 'this_month' | 'custom';
  search: string;
  startDate?: string;
  endDate?: string;
}

interface AppointmentCardProps {
  appointment: Appointment;
  onCancel: (id: string) => void;
  onReschedule: (id: string) => void;
  onViewDetails: (id: string) => void;
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  onCancel,
  onReschedule,
  onViewDetails,
}) => {
  const [showActions, setShowActions] = useState(false);
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
    return format(date, 'EEEE d. MMMM yyyy', { locale: da });
  };

  const isPastAppointment = appointmentDate < new Date();
  const canCancel = ['pending', 'confirmed'].includes(appointment.status) && !isPastAppointment;
  const canReschedule = ['pending', 'confirmed'].includes(appointment.status) && !isPastAppointment;

  const getStatusIcon = (status: AppointmentStatus) => {
    switch (status) {
      case 'confirmed':
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'pending':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'cancelled':
      case 'no_show':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start space-x-4 flex-1">
            <div className="flex-shrink-0">
              {getStatusIcon(appointment.status)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {appointment.service?.name || 'Service'}
                </h3>
                <StatusBadge variant={getStatusColor(appointment.status)}>
                  {getStatusLabel(appointment.status)}
                </StatusBadge>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  <span>{getDateLabel(appointmentDate)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span>{startTime} - {endTime}</span>
                  {appointment.service?.duration && (
                    <span className="text-gray-400">
                      ({appointment.service.duration} min)
                    </span>
                  )}
                </div>
                {appointment.loctician && (
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 flex-shrink-0" />
                    <span>{appointment.loctician.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="text-right">
              <p className="text-lg font-semibold text-gray-900">
                {appointment.totalPrice.toLocaleString('da-DK')} DKK
              </p>
            </div>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActions(!showActions)}
                className="p-2"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
              {showActions && (
                <div className="absolute right-0 top-8 z-10 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                  <button
                    onClick={() => {
                      onViewDetails(appointment.id);
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Search className="w-4 h-4" />
                    <span>Se detaljer</span>
                  </button>
                  {canReschedule && (
                    <button
                      onClick={() => {
                        onReschedule(appointment.id);
                        setShowActions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Flyt tid</span>
                    </button>
                  )}
                  {canCancel && (
                    <button
                      onClick={() => {
                        onCancel(appointment.id);
                        setShowActions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                    >
                      <X className="w-4 h-4" />
                      <span>Aflys</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {appointment.customerNotes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              <strong>Dine noter:</strong> {appointment.customerNotes}
            </p>
          </div>
        )}

        {appointment.service?.description && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              {appointment.service.description}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const FilterDropdown: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(option => option.value === value);

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="justify-between min-w-[140px]"
      >
        <span className="truncate">{selectedOption?.label || label}</span>
        <ChevronDown className="w-4 h-4 ml-2" />
      </Button>
      {isOpen && (
        <div className="absolute top-full left-0 z-10 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 py-1">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                value === option.value ? 'bg-amber-50 text-amber-900' : 'text-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const AppointmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCancelDialog, setShowCancelDialog] = useState<string | null>(null);

  const [filters, setFilters] = useState<AppointmentFilters>({
    status: (searchParams.get('status') as AppointmentStatus) || 'all',
    dateRange: (searchParams.get('dateRange') as 'all' | 'upcoming' | 'past' | 'this_week' | 'this_month' | 'custom') || 'all',
    search: searchParams.get('search') || '',
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
  });

  // API queries
  const { data: userData, isLoading: userLoading } = useGetCurrentUserQuery();
  const {
    data: appointmentsData,
    isLoading: appointmentsLoading,
    refetch: refetchAppointments,
  } = useGetAppointmentsQuery({
    customerId: userData?.data?.id,
    status: filters.status !== 'all' ? [filters.status] : undefined,
    dateRange: filters.startDate && filters.endDate ? {
      start: filters.startDate,
      end: filters.endDate,
    } : undefined,
    limit: 50,
  });

  const [cancelAppointment, { isLoading: isCancelling }] = useCancelAppointmentMutation();

  const user = userData?.data;
  const appointments = appointmentsData?.data || [];

  // Filter appointments based on search and date range
  const filteredAppointments = useMemo(() => {
    let filtered = appointments;

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(appointment =>
        appointment.service?.name?.toLowerCase().includes(searchLower) ||
        appointment.loctician?.name?.toLowerCase().includes(searchLower) ||
        appointment.customerNotes?.toLowerCase().includes(searchLower)
      );
    }

    // Date range filter (if not handled by API)
    if (filters.dateRange !== 'all' && !filters.startDate) {
      const now = new Date();
      filtered = filtered.filter(appointment => {
        const appointmentDate = new Date(appointment.date);

        switch (filters.dateRange) {
          case 'upcoming':
            return appointmentDate >= startOfDay(now);
          case 'past':
            return appointmentDate < startOfDay(now);
          case 'this_week':
            return appointmentDate >= startOfDay(now) &&
                   appointmentDate <= endOfDay(addDays(now, 7));
          case 'this_month':
            return appointmentDate >= startOfDay(now) &&
                   appointmentDate <= endOfDay(addDays(now, 30));
          default:
            return true;
        }
      });
    }

    // Sort by date (newest first for past, oldest first for upcoming)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();

      if (filters.dateRange === 'past') {
        return dateB - dateA; // Newest first for past
      }
      return dateA - dateB; // Oldest first for upcoming
    });
  }, [appointments, filters]);

  // Statistics
  const stats = useMemo(() => {
    const now = new Date();
    const upcoming = appointments.filter(
      apt => new Date(apt.date) >= startOfDay(now) &&
             ['pending', 'confirmed'].includes(apt.status)
    ).length;

    const completed = appointments.filter(apt => apt.status === 'completed').length;
    const cancelled = appointments.filter(apt => apt.status === 'cancelled').length;
    const total = appointments.length;

    return { upcoming, completed, cancelled, total };
  }, [appointments]);

  // Handlers
  const updateFilters = (newFilters: Partial<AppointmentFilters>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);

    // Update URL params
    const params = new URLSearchParams();
    Object.entries(updated).forEach(([key, value]) => {
      if (value && value !== 'all' && value !== '') {
        params.set(key, value);
      }
    });
    setSearchParams(params);
  };

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

  const handleViewDetails = (appointmentId: string) => {
    navigate(`/appointments/${appointmentId}`);
  };

  const statusOptions = [
    { value: 'all', label: 'Alle status' },
    { value: 'pending', label: 'Afventer' },
    { value: 'confirmed', label: 'Bekræftet' },
    { value: 'completed', label: 'Gennemført' },
    { value: 'cancelled', label: 'Aflyst' },
  ];

  const dateRangeOptions = [
    { value: 'all', label: 'Alle datoer' },
    { value: 'upcoming', label: 'Kommende' },
    { value: 'past', label: 'Tidligere' },
    { value: 'this_week', label: 'Denne uge' },
    { value: 'this_month', label: 'Denne måned' },
  ];

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
              <div className="flex items-center space-x-4">
                <Button variant="ghost" asChild>
                  <Link to="/dashboard">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Tilbage
                  </Link>
                </Button>
                <div>
                  <h1 className="text-4xl font-bold text-amber-900 mb-2">
                    Mine aftaler
                  </h1>
                  <p className="text-amber-700 text-lg">
                    Administrer og se alle dine aftaler
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Eksporter
                </Button>
                <Button asChild>
                  <Link to="/services">
                    <Plus className="w-4 h-4 mr-2" />
                    Book ny tid
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-900">{stats.total}</p>
              <p className="text-sm text-gray-600">Total</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.upcoming}</p>
              <p className="text-sm text-gray-600">Kommende</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              <p className="text-sm text-gray-600">Gennemført</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
              <p className="text-sm text-gray-600">Aflyst</p>
            </Card>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <Card className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Søg i aftaler..."
                      value={filters.search}
                      onChange={(e) => updateFilters({ search: e.target.value })}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                  <FilterDropdown
                    label="Status"
                    value={filters.status}
                    options={statusOptions}
                    onChange={(value) => updateFilters({ status: value as AppointmentStatus | 'all' })}
                  />
                  <FilterDropdown
                    label="Periode"
                    value={filters.dateRange}
                    options={dateRangeOptions}
                    onChange={(value) => updateFilters({ dateRange: value as AppointmentFilters['dateRange'] })}
                  />
                </div>
                <div className="text-sm text-gray-600">
                  {filteredAppointments.length} af {appointments.length} aftaler
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Appointments List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
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
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Ingen aftaler fundet
                </h3>
                <p className="text-gray-600 mb-6">
                  Prøv at ændre dine filtre eller book din første aftale.
                </p>
                <Button asChild>
                  <Link to="/services">
                    <Plus className="w-4 h-4 mr-2" />
                    Book din første aftale
                  </Link>
                </Button>
              </Card>
            )}
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

export default AppointmentsPage;