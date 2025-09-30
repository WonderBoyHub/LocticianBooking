'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Clock,
  User,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  Settings,
  MapPin,
  Phone,
  Mail,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Copy,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addMonths,
  subWeeks,
  subMonths,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  addMinutes,
  getDay,
} from 'date-fns';
import { da } from 'date-fns/locale';

import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { StatusBadge } from '../../components/ui/StatusBadge';

import {
  useGetCurrentUserQuery,
  useGetAppointmentsQuery,
  useUpdateAppointmentMutation,
  useCancelAppointmentMutation,
  useGetAvailabilityQuery,
} from '../../store/api';
import type { Appointment, AppointmentStatus } from '../../types';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  appointment?: Appointment;
  type: 'appointment' | 'blocked' | 'available';
  color: string;
}

interface DragState {
  isDragging: boolean;
  draggedEvent: CalendarEvent | null;
  dragOffset: { x: number; y: number };
  originalPosition: { date: Date; time: string };
}

interface TimeSlot {
  time: string;
  hour: number;
  minute: number;
}

const VIEW_TYPES = ['day', 'week', 'month'] as const;
type ViewType = typeof VIEW_TYPES[number];

// Generate time slots from 8:00 to 20:00
const generateTimeSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  for (let hour = 8; hour <= 20; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      slots.push({
        time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        hour,
        minute,
      });
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

const AppointmentCard: React.FC<{
  event: CalendarEvent;
  onEdit: (id: string) => void;
  onCancel: (id: string) => void;
  onViewDetails: (id: string) => void;
  isDraggable?: boolean;
  onDragStart?: (event: CalendarEvent, mouseEvent: React.MouseEvent) => void;
}> = ({ event, onEdit, onCancel, onViewDetails, isDraggable = true, onDragStart }) => {
  const [showActions, setShowActions] = useState(false);
  const appointment = event.appointment;

  if (!appointment) return null;

  const getStatusColor = (status: AppointmentStatus) => {
    switch (status) {
      case 'confirmed': return 'border-l-green-500 bg-green-50';
      case 'pending': return 'border-l-yellow-500 bg-yellow-50';
      case 'completed': return 'border-l-blue-500 bg-blue-50';
      case 'cancelled': return 'border-l-red-500 bg-red-50';
      case 'in_progress': return 'border-l-purple-500 bg-purple-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  const duration = appointment.service?.duration || 60;
  const height = Math.max(40, (duration / 30) * 20); // 20px per 30min slot

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`
        relative rounded-lg border-l-4 p-3 shadow-sm cursor-pointer transition-all hover:shadow-md
        ${getStatusColor(appointment.status)}
        ${isDraggable ? 'hover:scale-105' : ''}
      `}
      style={{ minHeight: `${height}px` }}
      onMouseDown={isDraggable ? (e) => onDragStart?.(event, e) : undefined}
      onClick={() => setShowActions(!showActions)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {appointment.service?.name}
          </p>
          <p className="text-xs text-gray-600 truncate">
            {appointment.customer?.name}
          </p>
          <div className="flex items-center space-x-1 mt-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500">
              {appointment.startTime} - {appointment.endTime}
            </span>
          </div>
          {duration > 60 && (
            <p className="text-xs text-gray-500 mt-1">
              {duration} min
            </p>
          )}
        </div>
        <StatusBadge
          variant={appointment.status === 'confirmed' ? 'success' : 'warning'}
          className="text-xs"
        >
          {appointment.status}
        </StatusBadge>
      </div>

      {/* Actions menu */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-0 right-0 z-10 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                onViewDetails(appointment.id);
                setShowActions(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <Eye className="w-4 h-4" />
              <span>Se detaljer</span>
            </button>
            <button
              onClick={() => {
                onEdit(appointment.id);
                setShowActions(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <Edit className="w-4 h-4" />
              <span>Rediger</span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${appointment.service?.name} - ${appointment.customer?.name} - ${appointment.startTime}`);
                setShowActions(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <Copy className="w-4 h-4" />
              <span>Kopier</span>
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => {
                onCancel(appointment.id);
                setShowActions(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Aflys</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const CalendarGrid: React.FC<{
  viewType: ViewType;
  currentDate: Date;
  events: CalendarEvent[];
  onEventEdit: (id: string) => void;
  onEventCancel: (id: string) => void;
  onEventView: (id: string) => void;
  onTimeSlotClick: (date: Date, time: string) => void;
  dragState: DragState;
  onDragStart: (event: CalendarEvent, mouseEvent: React.MouseEvent) => void;
}> = ({
  viewType,
  currentDate,
  events,
  onEventEdit,
  onEventCancel,
  onEventView,
  onTimeSlotClick,
  dragState,
  onDragStart,
}) => {
  const getDaysToShow = () => {
    switch (viewType) {
      case 'day':
        return [currentDate];
      case 'week':
        return eachDayOfInterval({
          start: startOfWeek(currentDate, { weekStartsOn: 1 }),
          end: endOfWeek(currentDate, { weekStartsOn: 1 }),
        });
      case 'month':
        return eachDayOfInterval({
          start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
          end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
        });
      default:
        return [currentDate];
    }
  };

  const days = getDaysToShow();

  const getEventsForDay = (date: Date) => {
    return events.filter(event => isSameDay(event.start, date));
  };

  const getEventsForTimeSlot = (date: Date, time: string) => {
    return events.filter(event => {
      if (!isSameDay(event.start, date)) return false;
      const eventTime = format(event.start, 'HH:mm');
      return eventTime === time;
    });
  };

  if (viewType === 'month') {
    return (
      <div className="grid grid-cols-7 gap-1 h-full">
        {/* Day headers */}
        {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-700 bg-gray-50">
            {day}
          </div>
        ))}
        {/* Calendar days */}
        {days.map((day) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isDayToday = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={`
                min-h-[120px] p-2 border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors
                ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'}
                ${isDayToday ? 'bg-amber-50 border-amber-300' : ''}
              `}
              onClick={() => onTimeSlotClick(day, '09:00')}
            >
              <div className={`text-sm font-medium mb-2 ${isDayToday ? 'text-amber-900' : ''}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className="text-xs p-1 rounded bg-blue-100 text-blue-800 truncate"
                  >
                    {event.appointment?.service?.name}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500">
                    +{dayEvents.length - 3} mere
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Week or Day view
  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="flex border-b border-gray-200">
        <div className="w-20 p-2 border-r border-gray-200" /> {/* Time column header */}
        {days.map((day) => {
          const isDayToday = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={`flex-1 p-2 text-center border-r border-gray-200 ${
                isDayToday ? 'bg-amber-50 text-amber-900' : ''
              }`}
            >
              <div className="text-sm font-medium">
                {format(day, 'EEE', { locale: da })}
              </div>
              <div className={`text-lg font-bold ${isDayToday ? 'text-amber-900' : ''}`}>
                {format(day, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time slots */}
      <div className="flex-1 overflow-auto">
        <div className="flex">
          {/* Time column */}
          <div className="w-20 border-r border-gray-200">
            {TIME_SLOTS.map((slot) => (
              <div
                key={slot.time}
                className="h-10 p-2 border-b border-gray-100 text-xs text-gray-600 flex items-center"
              >
                {slot.time}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => (
            <div key={day.toISOString()} className="flex-1 border-r border-gray-200">
              {TIME_SLOTS.map((slot) => {
                const slotEvents = getEventsForTimeSlot(day, slot.time);
                return (
                  <div
                    key={`${day.toISOString()}-${slot.time}`}
                    className="h-10 border-b border-gray-100 relative group hover:bg-gray-50 cursor-pointer"
                    onClick={() => onTimeSlotClick(day, slot.time)}
                  >
                    {/* Add appointment button (shown on hover) */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-4 h-4 text-gray-400" />
                    </div>

                    {/* Events for this time slot */}
                    <div className="absolute inset-0 p-1">
                      {slotEvents.map((event) => (
                        <AppointmentCard
                          key={event.id}
                          event={event}
                          onEdit={onEventEdit}
                          onCancel={onEventCancel}
                          onViewDetails={onEventView}
                          onDragStart={onDragStart}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const EnhancedCalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewType, setViewType] = useState<ViewType>(
    (searchParams.get('view') as ViewType) || 'week'
  );
  const [currentDate, setCurrentDate] = useState(
    searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date()
  );
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<AppointmentStatus[]>([
    'confirmed',
    'pending',
    'in_progress',
  ]);

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedEvent: null,
    dragOffset: { x: 0, y: 0 },
    originalPosition: { date: new Date(), time: '09:00' },
  });

  // API queries
  const { data: userData } = useGetCurrentUserQuery();
  const user = userData?.data;

  const {
    data: appointmentsData,
    isLoading: appointmentsLoading,
    refetch: refetchAppointments,
  } = useGetAppointmentsQuery({
    locticianId: user?.id,
    dateRange: {
      start: format(
        viewType === 'month'
          ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
          : startOfWeek(currentDate, { weekStartsOn: 1 }),
        'yyyy-MM-dd'
      ),
      end: format(
        viewType === 'month'
          ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
          : endOfWeek(currentDate, { weekStartsOn: 1 }),
        'yyyy-MM-dd'
      ),
    },
    status: selectedStatuses,
  });

  const [updateAppointment] = useUpdateAppointmentMutation();
  const [cancelAppointment] = useCancelAppointmentMutation();

  const appointments = appointmentsData?.data || [];

  // Convert appointments to calendar events
  const events = useMemo((): CalendarEvent[] => {
    return appointments.map((appointment) => ({
      id: appointment.id,
      title: `${appointment.service?.name} - ${appointment.customer?.name}`,
      start: new Date(`${appointment.date}T${appointment.startTime}`),
      end: new Date(`${appointment.date}T${appointment.endTime}`),
      appointment,
      type: 'appointment' as const,
      color: appointment.status === 'confirmed' ? 'green' : 'yellow',
    }));
  }, [appointments]);

  // Navigation handlers
  const navigateDate = (direction: 'prev' | 'next') => {
    let newDate: Date;
    switch (viewType) {
      case 'day':
        newDate = direction === 'next'
          ? addMinutes(currentDate, 24 * 60)
          : addMinutes(currentDate, -24 * 60);
        break;
      case 'week':
        newDate = direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1);
        break;
      case 'month':
        newDate = direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1);
        break;
    }
    setCurrentDate(newDate);
    updateURL(viewType, newDate);
  };

  const updateURL = (view: ViewType, date: Date) => {
    const params = new URLSearchParams();
    params.set('view', view);
    params.set('date', format(date, 'yyyy-MM-dd'));
    setSearchParams(params);
  };

  const handleViewChange = (view: ViewType) => {
    setViewType(view);
    updateURL(view, currentDate);
  };

  // Drag and drop handlers
  const handleDragStart = useCallback((event: CalendarEvent, mouseEvent: React.MouseEvent) => {
    if (!event.appointment) return;

    setDragState({
      isDragging: true,
      draggedEvent: event,
      dragOffset: {
        x: mouseEvent.clientX,
        y: mouseEvent.clientY,
      },
      originalPosition: {
        date: event.start,
        time: format(event.start, 'HH:mm'),
      },
    });

    // Prevent text selection during drag
    mouseEvent.preventDefault();
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!dragState.isDragging || !dragState.draggedEvent) return;

    // Update drag position logic here
    // This would involve calculating new time slot based on mouse position
  }, [dragState]);

  const handleMouseUp = useCallback(async () => {
    if (!dragState.isDragging || !dragState.draggedEvent?.appointment) return;

    // Calculate new date/time based on drop position
    // This is a simplified example - in reality you'd calculate based on mouse position
    const newDate = dragState.originalPosition.date;
    const newTime = dragState.originalPosition.time;

    try {
      await updateAppointment({
        id: dragState.draggedEvent.appointment.id,
        data: {
          date: format(newDate, 'yyyy-MM-dd'),
          startTime: newTime,
          // Calculate new end time based on service duration
          endTime: format(
            addMinutes(
              new Date(`${format(newDate, 'yyyy-MM-dd')}T${newTime}`),
              dragState.draggedEvent.appointment.service?.duration || 60
            ),
            'HH:mm'
          ),
        },
      }).unwrap();

      refetchAppointments();
    } catch (error) {
      console.error('Failed to update appointment:', error);
    }

    setDragState({
      isDragging: false,
      draggedEvent: null,
      dragOffset: { x: 0, y: 0 },
      originalPosition: { date: new Date(), time: '09:00' },
    });
  }, [dragState, updateAppointment, refetchAppointments]);

  // Event handlers
  const handleTimeSlotClick = (date: Date, time: string) => {
    navigate(`/appointments/new?date=${format(date, 'yyyy-MM-dd')}&time=${time}`);
  };

  const handleEventEdit = (appointmentId: string) => {
    navigate(`/appointments/${appointmentId}/edit`);
  };

  const handleEventView = (appointmentId: string) => {
    navigate(`/appointments/${appointmentId}`);
  };

  const handleEventCancel = async (appointmentId: string) => {
    if (window.confirm('Er du sikker på, at du vil aflyse denne aftale?')) {
      try {
        await cancelAppointment({ id: appointmentId }).unwrap();
        refetchAppointments();
      } catch (error) {
        console.error('Failed to cancel appointment:', error);
      }
    }
  };

  const getDateRangeText = () => {
    switch (viewType) {
      case 'day':
        return format(currentDate, 'EEEE d. MMMM yyyy', { locale: da });
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(weekStart, 'd. MMM', { locale: da })} - ${format(weekEnd, 'd. MMM yyyy', { locale: da })}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy', { locale: da });
    }
  };

  // Set up mouse event listeners for drag and drop
  useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Kalender
                </h1>
                <p className="text-gray-600">
                  Administrer dine aftaler og tilgængelighed
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="w-4 h-4 mr-2" />
                  Filtre
                </Button>
                <Button asChild>
                  <Link to="/appointments/new">
                    <Plus className="w-4 h-4 mr-2" />
                    Ny aftale
                  </Link>
                </Button>
              </div>
            </div>

            {/* Calendar controls */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateDate('prev')}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentDate(new Date())}
                    >
                      I dag
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateDate('next')}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {getDateRangeText()}
                  </h2>
                </div>

                <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                  {VIEW_TYPES.map((view) => (
                    <button
                      key={view}
                      onClick={() => handleViewChange(view)}
                      className={`px-3 py-1 text-sm font-medium rounded transition-all ${
                        viewType === view
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {view === 'day' ? 'Dag' : view === 'week' ? 'Uge' : 'Måned'}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Filters panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6"
              >
                <Card className="p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Filtre</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as AppointmentStatus[]).map((status) => (
                          <label key={status} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedStatuses.includes(status)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStatuses([...selectedStatuses, status]);
                                } else {
                                  setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                                }
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700 capitalize">
                              {status}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Calendar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="h-[calc(100vh-300px)]"
          >
            <Card className="h-full">
              {appointmentsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <LoadingSpinner size="lg" />
                </div>
              ) : (
                <CalendarGrid
                  viewType={viewType}
                  currentDate={currentDate}
                  events={events}
                  onEventEdit={handleEventEdit}
                  onEventCancel={handleEventCancel}
                  onEventView={handleEventView}
                  onTimeSlotClick={handleTimeSlotClick}
                  dragState={dragState}
                  onDragStart={handleDragStart}
                />
              )}
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Drag preview */}
      {dragState.isDragging && dragState.draggedEvent && (
        <div
          className="fixed pointer-events-none z-50 opacity-75"
          style={{
            left: dragState.dragOffset.x,
            top: dragState.dragOffset.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="bg-white border border-gray-300 rounded-lg p-2 shadow-lg">
            <p className="text-sm font-medium">
              {dragState.draggedEvent.appointment?.service?.name}
            </p>
            <p className="text-xs text-gray-600">
              {dragState.draggedEvent.appointment?.customer?.name}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedCalendarPage;
