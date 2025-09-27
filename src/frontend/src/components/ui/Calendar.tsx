import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  isAfter,
  isBefore
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Calendar as CalendarIcon,
  Plus,
  Edit,
  Trash2
} from 'lucide-react';
import { Appointment, AppointmentStatus, User as UserType } from '../../types';
import { useAppSelector } from '../../store/hooks';
import { selectUser } from '../../store/slices/authSlice';

// Calendar Event Types
interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color?: string;
  appointment?: Appointment;
  type: 'appointment' | 'blocked' | 'available';
  canEdit?: boolean;
  canDelete?: boolean;
}

interface CalendarProps {
  events?: CalendarEvent[];
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onEventCreate?: (date: Date, time?: string) => void;
  onEventEdit?: (event: CalendarEvent) => void;
  onEventDelete?: (event: CalendarEvent) => void;
  view?: 'month' | 'week' | 'day';
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  availableTimeSlots?: string[];
  workingHours?: { start: string; end: string };
  className?: string;
  readOnly?: boolean;
}

export const Calendar: React.FC<CalendarProps> = ({
  events = [],
  selectedDate = new Date(),
  onDateSelect,
  onEventClick,
  onEventCreate,
  onEventEdit,
  onEventDelete,
  view = 'month',
  minDate,
  maxDate,
  disabledDates = [],
  availableTimeSlots = [],
  workingHours = { start: '09:00', end: '17:00' },
  className,
  readOnly = false
}) => {
  const user = useAppSelector(selectUser);
  const [currentDate, setCurrentDate] = React.useState(selectedDate);
  const [hoveredDate, setHoveredDate] = React.useState<Date | null>(null);

  // Navigation handlers
  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Date utilities
  const isDateDisabled = (date: Date) => {
    if (minDate && isBefore(date, minDate)) return true;
    if (maxDate && isAfter(date, maxDate)) return true;
    return disabledDates.some(disabled => isSameDay(date, disabled));
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event =>
      isSameDay(parseISO(event.start.toISOString()), date)
    );
  };

  const getStatusColor = (status: AppointmentStatus) => {
    const colors = {
      pending: 'bg-status-pending',
      confirmed: 'bg-status-confirmed',
      in_progress: 'bg-status-progress',
      completed: 'bg-status-completed',
      cancelled: 'bg-status-cancelled',
      no_show: 'bg-red-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const canUserEdit = (event: CalendarEvent) => {
    if (readOnly) return false;
    if (!user) return false;

    if (user.role === 'admin') return true;
    if (user.role === 'loctician' && event.appointment?.locticianId === user.id) return true;
    if (user.role === 'customer' && event.appointment?.customerId === user.id) return true;

    return false;
  };

  // Render month view
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const dateFormat = 'd';
    const rows = [];

    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const dayEvents = getEventsForDate(day);
        const isSelected = isSameDay(day, selectedDate);
        const isCurrentMonth = isSameMonth(day, monthStart);
        const isDisabled = isDateDisabled(day);
        const isTodayDate = isToday(day);

        days.push(
          <motion.div
            key={day.toString()}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: i * 0.02 }}
            className={clsx(
              'min-h-[120px] p-2 border border-brown-100 cursor-pointer transition-all duration-200',
              isCurrentMonth ? 'bg-white' : 'bg-brown-50',
              isSelected && 'ring-2 ring-brand-primary bg-brand-accent',
              isDisabled && 'opacity-50 cursor-not-allowed',
              isTodayDate && 'bg-blue-50 border-blue-200',
              !isDisabled && 'hover:bg-brand-light hover:shadow-md'
            )}
            onClick={() => {
              if (!isDisabled && onDateSelect) {
                onDateSelect(cloneDay);
              }
            }}
            onMouseEnter={() => setHoveredDate(cloneDay)}
            onMouseLeave={() => setHoveredDate(null)}
          >
            {/* Date number */}
            <div className="flex items-center justify-between mb-2">
              <span
                className={clsx(
                  'text-sm font-medium',
                  isCurrentMonth ? 'text-brand-dark' : 'text-brown-400',
                  isTodayDate && 'text-blue-600 font-bold',
                  isSelected && 'text-brand-primary'
                )}
              >
                {format(day, dateFormat)}
              </span>

              {/* Add event button */}
              {!readOnly && !isDisabled && hoveredDate && isSameDay(hoveredDate, cloneDay) && (
                <motion.button
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventCreate?.(cloneDay);
                  }}
                  className="w-6 h-6 bg-brand-primary text-white rounded-full flex items-center justify-center hover:bg-brand-dark transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </motion.button>
              )}
            </div>

            {/* Events */}
            <div className="space-y-1">
              {dayEvents.slice(0, 3).map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick?.(event);
                  }}
                  className={clsx(
                    'text-xs p-1 rounded text-white cursor-pointer hover:shadow-md transition-shadow',
                    event.color || getStatusColor(event.appointment?.status || 'pending')
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate flex-1">{event.title}</span>
                    {canUserEdit(event) && (
                      <div className="flex space-x-1 ml-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventEdit?.(event);
                          }}
                          className="hover:bg-white/20 rounded p-0.5"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventDelete?.(event);
                          }}
                          className="hover:bg-white/20 rounded p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {event.appointment && (
                    <div className="flex items-center space-x-1 mt-1 opacity-80">
                      <Clock className="w-2 h-2" />
                      <span>{event.appointment.startTime}</span>
                    </div>
                  )}
                </motion.div>
              ))}

              {dayEvents.length > 3 && (
                <div className="text-xs text-brown-600 font-medium">
                  +{dayEvents.length - 3} more
                </div>
              )}
            </div>
          </motion.div>
        );

        day = addDays(day, 1);
      }

      rows.push(
        <div key={day.toString()} className="grid grid-cols-7 gap-0">
          {days}
        </div>
      );
      days = [];
    }

    return <div className="space-y-0">{rows}</div>;
  };

  // Render week view
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate);
    const weekDays = [];

    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      weekDays.push(day);
    }

    const timeSlots = availableTimeSlots.length > 0 ? availableTimeSlots : [
      '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
    ];

    return (
      <div className="flex flex-col h-full">
        {/* Week header */}
        <div className="grid grid-cols-8 border-b border-brown-200 bg-brown-50">
          <div className="p-4 text-sm font-medium text-brown-600">Time</div>
          {weekDays.map((day) => (
            <div
              key={day.toString()}
              className={clsx(
                'p-4 text-center border-l border-brown-200',
                isSameDay(day, selectedDate) && 'bg-brand-accent',
                isToday(day) && 'bg-blue-50'
              )}
            >
              <div className="text-sm font-medium text-brand-dark">
                {format(day, 'EEE')}
              </div>
              <div className={clsx(
                'text-lg font-bold',
                isToday(day) ? 'text-blue-600' : 'text-brown-600'
              )}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div className="flex-1 overflow-y-auto">
          {timeSlots.map((time) => (
            <div key={time} className="grid grid-cols-8 border-b border-brown-100 min-h-[60px]">
              <div className="p-2 text-sm text-brown-600 border-r border-brown-200 bg-brown-50">
                {time}
              </div>
              {weekDays.map((day) => {
                const dayEvents = getEventsForDate(day).filter(event =>
                  event.appointment?.startTime === time
                );

                return (
                  <div
                    key={`${day}-${time}`}
                    className="border-l border-brown-100 p-1 relative hover:bg-brand-light cursor-pointer"
                    onClick={() => onEventCreate?.(day, time)}
                  >
                    {dayEvents.map((event) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={clsx(
                          'absolute inset-1 p-1 rounded text-xs text-white cursor-pointer',
                          event.color || getStatusColor(event.appointment?.status || 'pending')
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event);
                        }}
                      >
                        <div className="font-medium truncate">{event.title}</div>
                        {event.appointment?.customer && (
                          <div className="flex items-center space-x-1 opacity-80">
                            <User className="w-2 h-2" />
                            <span>{event.appointment.customer.name}</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={clsx('bg-white rounded-lg shadow-soft border border-brown-200', className)}>
      {/* Calendar Header */}
      <div className="p-4 border-b border-brown-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-serif font-bold text-brand-dark">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <div className="flex items-center space-x-1">
              <button
                onClick={goToPreviousMonth}
                className="p-2 rounded-lg hover:bg-brown-100 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              >
                <ChevronLeft className="w-5 h-5 text-brown-600" />
              </button>
              <button
                onClick={goToNextMonth}
                className="p-2 rounded-lg hover:bg-brown-100 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              >
                <ChevronRight className="w-5 h-5 text-brown-600" />
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm font-medium text-brand-primary border border-brand-primary rounded-lg hover:bg-brand-primary hover:text-white transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {/* Days of week header */}
      {view === 'month' && (
        <div className="grid grid-cols-7 border-b border-brown-200 bg-brown-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="p-3 text-center text-sm font-medium text-brown-600">
              {day}
            </div>
          ))}
        </div>
      )}

      {/* Calendar Body */}
      <div className="h-full">
        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
      </div>
    </div>
  );
};