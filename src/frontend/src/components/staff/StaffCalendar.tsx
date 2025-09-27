import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Filter,
  Download,
  Settings,
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, isToday } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Calendar } from '../calendar/Calendar';

import { useGetAppointmentsQuery, useCreateAppointmentMutation, useUpdateAppointmentMutation } from '../../store/api';
import { staffAppointmentSchema, type StaffAppointmentInput } from '../../schemas';
import type { Appointment, SelectOption } from '../../types';

type CalendarView = 'month' | 'week' | 'day' | 'agenda';

interface AppointmentModalProps {
  appointment?: Appointment;
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: Date;
}

const AppointmentModal: React.FC<AppointmentModalProps> = ({ appointment, isOpen, onClose, selectedDate }) => {
  const { t } = useTranslation();
  const [createAppointment, { isLoading: isCreating }] = useCreateAppointmentMutation();
  const [updateAppointment, { isLoading: isUpdating }] = useUpdateAppointmentMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<StaffAppointmentInput>({
    resolver: zodResolver(staffAppointmentSchema),
    defaultValues: appointment ? {
      customerId: appointment.customerId,
      serviceId: appointment.serviceId,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      totalPrice: appointment.totalPrice,
      locticianNotes: appointment.locticianNotes,
      status: appointment.status,
      sendConfirmation: true,
    } : selectedDate ? {
      date: format(selectedDate, 'yyyy-MM-dd'),
      startTime: '10:00',
      endTime: '11:00',
      status: 'confirmed',
      sendConfirmation: true,
    } : undefined,
  });

  // Mock options - replace with real data
  const customerOptions: SelectOption[] = [
    { value: '1', label: 'Anna Jensen' },
    { value: '2', label: 'Michael Nielsen' },
    { value: '3', label: 'Sarah Johnson' },
  ];

  const serviceOptions: SelectOption[] = [
    { value: '1', label: 'Locs Maintenance - 120 min - 500 DKK' },
    { value: '2', label: 'New Installation - 240 min - 1500 DKK' },
    { value: '3', label: 'Styling - 90 min - 400 DKK' },
  ];

  const statusOptions: SelectOption[] = [
    { value: 'pending', label: t('appointment.status.pending') },
    { value: 'confirmed', label: t('appointment.status.confirmed') },
    { value: 'completed', label: t('appointment.status.completed') },
    { value: 'cancelled', label: t('appointment.status.cancelled') },
  ];

  React.useEffect(() => {
    if (appointment && isOpen) {
      reset({
        customerId: appointment.customerId,
        serviceId: appointment.serviceId,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        totalPrice: appointment.totalPrice,
        locticianNotes: appointment.locticianNotes,
        status: appointment.status,
        sendConfirmation: true,
      });
    } else if (!appointment && isOpen && selectedDate) {
      reset({
        date: format(selectedDate, 'yyyy-MM-dd'),
        startTime: '10:00',
        endTime: '11:00',
        status: 'confirmed',
        sendConfirmation: true,
      });
    }
  }, [appointment, isOpen, selectedDate, reset]);

  const onSubmit = async (data: StaffAppointmentInput) => {
    try {
      if (appointment) {
        await updateAppointment({ id: appointment.id, data }).unwrap();
      } else {
        await createAppointment(data).unwrap();
      }
      onClose();
    } catch (error) {
      console.error('Failed to save appointment:', error);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={appointment ? t('staff.calendar.editAppointment') : t('staff.calendar.createAppointment')}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Select
              label={t('staff.appointment.customer')}
              options={customerOptions}
              {...register('customerId')}
              error={errors.customerId?.message}
              disabled={isSubmitting || isCreating || isUpdating}
            />
          </div>
          <div>
            <Select
              label={t('staff.appointment.service')}
              options={serviceOptions}
              {...register('serviceId')}
              error={errors.serviceId?.message}
              disabled={isSubmitting || isCreating || isUpdating}
            />
          </div>
          <div>
            <Input
              label={t('staff.appointment.date')}
              type="date"
              {...register('date')}
              error={errors.date?.message}
              disabled={isSubmitting || isCreating || isUpdating}
            />
          </div>
          <div>
            <Select
              label={t('staff.appointment.status')}
              options={statusOptions}
              {...register('status')}
              error={errors.status?.message}
              disabled={isSubmitting || isCreating || isUpdating}
            />
          </div>
          <div>
            <Input
              label={t('staff.appointment.startTime')}
              type="time"
              {...register('startTime')}
              error={errors.startTime?.message}
              disabled={isSubmitting || isCreating || isUpdating}
            />
          </div>
          <div>
            <Input
              label={t('staff.appointment.endTime')}
              type="time"
              {...register('endTime')}
              error={errors.endTime?.message}
              disabled={isSubmitting || isCreating || isUpdating}
            />
          </div>
        </div>

        <div>
          <Input
            label={t('staff.appointment.totalPrice')}
            type="number"
            min="0"
            step="50"
            {...register('totalPrice', { valueAsNumber: true })}
            error={errors.totalPrice?.message}
            disabled={isSubmitting || isCreating || isUpdating}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('staff.appointment.notes')}
          </label>
          <textarea
            {...register('locticianNotes')}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder={t('staff.appointment.notesPlaceholder')}
            disabled={isSubmitting || isCreating || isUpdating}
          />
          {errors.locticianNotes && (
            <p className="mt-1 text-sm text-red-600">{errors.locticianNotes.message}</p>
          )}
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            {...register('sendConfirmation')}
            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            disabled={isSubmitting || isCreating || isUpdating}
          />
          <label className="ml-2 text-sm text-gray-700">
            {t('staff.appointment.sendConfirmation')}
          </label>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting || isCreating || isUpdating}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isCreating || isUpdating}
          >
            {isSubmitting || isCreating || isUpdating ? (
              <LoadingSpinner size="sm" />
            ) : (
              t('common.save')
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const AppointmentDetailsModal: React.FC<{
  appointment: Appointment | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ appointment, isOpen, onClose, onEdit, onDelete }) => {
  const { t } = useTranslation();

  if (!appointment) return null;

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('staff.calendar.appointmentDetails')}
    >
      <div className="space-y-6">
        {/* Appointment Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{appointment.service?.name}</h3>
            <Badge variant={getStatusColor(appointment.status) as any}>
              {t(`appointment.status.${appointment.status}`)}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center text-gray-600">
              <CalendarIcon className="w-4 h-4 mr-2" />
              <span>{format(new Date(appointment.date), 'EEEE, MMMM d, yyyy')}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <Clock className="w-4 h-4 mr-2" />
              <span>{appointment.startTime} - {appointment.endTime}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <span className="font-medium">Duration:</span>
              <span className="ml-2">{appointment.service?.duration} minutes</span>
            </div>
            <div className="flex items-center text-gray-600">
              <span className="font-medium">Price:</span>
              <span className="ml-2 font-semibold text-gray-900">
                {appointment.totalPrice.toLocaleString('da-DK')} DKK
              </span>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Customer Information</h4>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-lg font-medium text-gray-600">
                  {appointment.customer?.name?.charAt(0)?.toUpperCase() || 'C'}
                </span>
              </div>
              <div className="flex-1">
                <h5 className="font-medium text-gray-900">{appointment.customer?.name}</h5>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 mr-2" />
                    <span>{appointment.customer?.email}</span>
                  </div>
                  {appointment.customer?.phone && (
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 mr-2" />
                      <span>{appointment.customer.phone}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <Button variant="ghost" size="sm" className="p-2">
                  <Phone className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="p-2">
                  <Mail className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {(appointment.customerNotes || appointment.locticianNotes) && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Notes</h4>
            <div className="space-y-3">
              {appointment.customerNotes && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-blue-800 mb-1">Customer Notes:</p>
                  <p className="text-sm text-blue-700">{appointment.customerNotes}</p>
                </div>
              )}
              {appointment.locticianNotes && (
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-purple-800 mb-1">Loctician Notes:</p>
                  <p className="text-sm text-purple-700">{appointment.locticianNotes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-6 border-t">
          <Button
            variant="outline"
            onClick={onDelete}
            className="text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t('common.delete')}
          </Button>
          <Button
            variant="outline"
            onClick={onEdit}
          >
            <Edit2 className="w-4 h-4 mr-2" />
            {t('common.edit')}
          </Button>
          <Button onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export const StaffCalendar: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [view, setView] = React.useState<CalendarView>('week');
  const [selectedAppointment, setSelectedAppointment] = React.useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = React.useState(false);

  // Get appointments for the current view period
  const dateRange = React.useMemo(() => {
    switch (view) {
      case 'day':
        return {
          start: format(currentDate, 'yyyy-MM-dd'),
          end: format(currentDate, 'yyyy-MM-dd'),
        };
      case 'week':
        return {
          start: format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          end: format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        };
      case 'month':
        return {
          start: format(startOfMonth(currentDate), 'yyyy-MM-dd'),
          end: format(endOfMonth(currentDate), 'yyyy-MM-dd'),
        };
      default:
        return {
          start: format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          end: format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        };
    }
  }, [view, currentDate]);

  const { data: appointmentsData, isLoading } = useGetAppointmentsQuery({
    dateRange,
  });

  // Handle URL params
  React.useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create') {
      setIsCreateModalOpen(true);
      setSearchParams(new URLSearchParams()); // Clear the param
    }
  }, [searchParams, setSearchParams]);

  const appointments = appointmentsData?.data || [];

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setIsCreateModalOpen(true);
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsDetailsModalOpen(true);
  };

  const handleEditAppointment = () => {
    setIsDetailsModalOpen(false);
    setIsEditModalOpen(true);
  };

  const handleDeleteAppointment = () => {
    // TODO: Implement delete functionality
    console.log('Delete appointment:', selectedAppointment);
    setIsDetailsModalOpen(false);
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);

    switch (view) {
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
    }

    setCurrentDate(newDate);
  };

  const viewOptions: SelectOption[] = [
    { value: 'month', label: t('calendar.view.month') },
    { value: 'week', label: t('calendar.view.week') },
    { value: 'day', label: t('calendar.view.day') },
    { value: 'agenda', label: t('calendar.view.agenda') },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('staff.calendar.title')}
          </h1>
          <p className="text-gray-600 mt-1">
            {t('staff.calendar.subtitle', { count: appointments.length })}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
            {t('calendar.today')}
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('staff.calendar.newAppointment')}
          </Button>
        </div>
      </div>

      {/* Calendar Controls */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateDate('prev')}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-xl font-semibold text-gray-900 min-w-[200px] text-center">
                {view === 'month' && format(currentDate, 'MMMM yyyy')}
                {view === 'week' && `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM dd')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM dd, yyyy')}`}
                {view === 'day' && format(currentDate, 'EEEE, MMMM dd, yyyy')}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateDate('next')}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Select
              options={viewOptions}
              value={view}
              onChange={(value) => setView(value as CalendarView)}
            />
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              {t('common.filter')}
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              {t('calendar.settings')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Calendar */}
      <Card className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <Calendar
            view={view}
            currentDate={currentDate}
            appointments={appointments}
            onDateSelect={handleDateSelect}
            onAppointmentClick={handleAppointmentClick}
            onDateChange={setCurrentDate}
          />
        )}
      </Card>

      {/* Modals */}
      <AppointmentModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSelectedDate(null);
        }}
        selectedDate={selectedDate}
      />

      <AppointmentModal
        appointment={selectedAppointment}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedAppointment(null);
        }}
      />

      <AppointmentDetailsModal
        appointment={selectedAppointment}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedAppointment(null);
        }}
        onEdit={handleEditAppointment}
        onDelete={handleDeleteAppointment}
      />
    </div>
  );
};