import React, { useState, useCallback, useMemo } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  User,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, isSameDay, addWeeks, subWeeks, startOfDay, endOfDay } from 'date-fns';
import { clsx } from 'clsx';
import { CalendarEvent, Appointment } from '../../types';

export interface AdvancedCalendarProps {
  events: CalendarEvent[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onEventDrop?: (eventId: string, newStart: Date, newEnd: Date) => void;
  onEventResize?: (eventId: string, newStart: Date, newEnd: Date) => void;
  onTimeSlotClick?: (date: Date, time: string) => void;
  onEventCreate?: (start: Date, end: Date) => void;
  onEventEdit?: (eventId: string) => void;
  onEventDelete?: (eventId: string) => void;
  onEventDuplicate?: (eventId: string) => void;
  view: 'week' | 'day';
  timeSlots?: string[];
  workingHours?: { start: string; end: string };
  className?: string;
  disabled?: boolean;
  allowEventCreation?: boolean;
  allowEventEditing?: boolean;
  allowEventDragging?: boolean;
  showTimeSlots?: boolean;
  slotDuration?: number; // minutes
}

interface DragItem {
  type: string;
  id: string;
  event: CalendarEvent;
}

const ITEM_TYPES = {
  EVENT: 'event',
};

const DEFAULT_TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
];

const EventComponent: React.FC<{
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
  onEdit?: (eventId: string) => void;
  onDelete?: (eventId: string) => void;
  onDuplicate?: (eventId: string) => void;
  allowEditing?: boolean;
  allowDragging?: boolean;
}> = ({ event, onClick, onEdit, onDelete, onDuplicate, allowEditing, allowDragging }) => {
  const [showMenu, setShowMenu] = useState(false);

  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPES.EVENT,
    item: { type: ITEM_TYPES.EVENT, id: event.id, event },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: allowDragging,
  });

  const appointment = event.extendedProps?.appointment as Appointment;
  const eventType = event.extendedProps?.type || 'appointment';

  const getEventStyles = () => {
    const baseStyles = 'absolute left-1 right-1 rounded px-2 py-1 text-xs font-medium cursor-pointer transition-all hover:shadow-md';

    switch (eventType) {
      case 'appointment':
        return `${baseStyles} bg-brand-primary text-white`;
      case 'blocked':
        return `${baseStyles} bg-gray-500 text-white`;
      case 'available':
        return `${baseStyles} bg-green-500 text-white`;
      default:
        return `${baseStyles} bg-blue-500 text-white`;
    }
  };

  const calculatePosition = () => {
    const startHour = event.start.getHours();
    const startMinute = event.start.getMinutes();
    const endHour = event.end.getHours();
    const endMinute = event.end.getMinutes();

    const startTime = startHour + startMinute / 60;
    const endTime = endHour + endMinute / 60;

    // Assuming 8 AM to 8 PM (12 hours) view
    const viewStartHour = 8;
    const viewHours = 12;

    const top = ((startTime - viewStartHour) / viewHours) * 100;
    const height = ((endTime - startTime) / viewHours) * 100;

    return {
      top: `${Math.max(0, top)}%`,
      height: `${Math.max(4, height)}%`,
    };
  };

  const position = calculatePosition();

  return (
    <div
      ref={allowDragging ? drag : undefined}
      className={clsx(
        getEventStyles(),
        {
          'opacity-50': isDragging,
          'z-10': showMenu,
        }
      )}
      style={position}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick(event);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (allowEditing) setShowMenu(!showMenu);
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium">{event.title}</p>
          {appointment?.customer && (
            <p className="truncate text-xs opacity-75">
              {appointment.customer.name}
            </p>
          )}
          <p className="text-xs opacity-75">
            {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
          </p>
        </div>

        {allowEditing && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <MoreHorizontal className="w-3 h-3" />
            </button>

            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[120px]"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  {onEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(event.id);
                        setShowMenu(false);
                      }}
                      className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </button>
                  )}
                  {onDuplicate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate(event.id);
                        setShowMenu(false);
                      }}
                      className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Duplicate
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(event.id);
                        setShowMenu(false);
                      }}
                      className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

const TimeSlot: React.FC<{
  time: string;
  date: Date;
  events: CalendarEvent[];
  onClick?: (date: Date, time: string) => void;
  onDrop?: (eventId: string, newStart: Date, newEnd: Date) => void;
  allowEventCreation?: boolean;
  allowEventDragging?: boolean;
}> = ({ time, date, events, onClick, onDrop, allowEventCreation, allowEventDragging }) => {
  const [{ isOver }, drop] = useDrop({
    accept: ITEM_TYPES.EVENT,
    drop: (item: DragItem) => {
      if (onDrop) {
        const [hours, minutes] = time.split(':').map(Number);
        const newStart = new Date(date);
        newStart.setHours(hours, minutes, 0, 0);

        const duration = item.event.end.getTime() - item.event.start.getTime();
        const newEnd = new Date(newStart.getTime() + duration);

        onDrop(item.id, newStart, newEnd);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
    canDrop: allowEventDragging,
  });

  const slotEvents = events.filter(event => {
    const eventStart = format(event.start, 'HH:mm');
    return eventStart === time && isSameDay(event.start, date);
  });

  return (
    <div
      ref={drop}
      className={clsx(
        'relative border-b border-gray-100 min-h-[60px] transition-colors',
        {
          'bg-brand-accent/20': isOver,
          'hover:bg-gray-50 cursor-pointer': allowEventCreation && onClick,
        }
      )}
      onClick={() => {
        if (allowEventCreation && onClick) {
          onClick(date, time);
        }
      }}
    >
      {slotEvents.map((event) => (
        <EventComponent
          key={event.id}
          event={event}
          allowDragging={allowEventDragging}
        />
      ))}

      {allowEventCreation && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <Plus className="w-4 h-4 text-gray-400" />
        </div>
      )}
    </div>
  );
};

const WeekView: React.FC<{
  currentDate: Date;
  events: CalendarEvent[];
  timeSlots: string[];
  onTimeSlotClick?: (date: Date, time: string) => void;
  onEventDrop?: (eventId: string, newStart: Date, newEnd: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onEventEdit?: (eventId: string) => void;
  onEventDelete?: (eventId: string) => void;
  onEventDuplicate?: (eventId: string) => void;
  allowEventCreation?: boolean;
  allowEventEditing?: boolean;
  allowEventDragging?: boolean;
}> = ({
  currentDate,
  events,
  timeSlots,
  onTimeSlotClick,
  onEventDrop,
  onEventClick,
  onEventEdit,
  onEventDelete,
  onEventDuplicate,
  allowEventCreation,
  allowEventEditing,
  allowEventDragging,
}) => {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex-1 flex flex-col">
      {/* Week Header */}
      <div className="flex border-b border-gray-200">
        <div className="w-20 flex-shrink-0 border-r border-gray-200 p-2">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Time</span>
        </div>
        {weekDays.map((day) => (
          <div key={day.toISOString()} className="flex-1 p-2 text-center border-r border-gray-200 last:border-r-0">
            <p className="text-sm font-medium text-gray-900">
              {format(day, 'EEE')}
            </p>
            <p className={clsx(
              'text-lg font-semibold',
              isSameDay(day, new Date()) ? 'text-brand-primary' : 'text-gray-600'
            )}>
              {format(day, 'd')}
            </p>
          </div>
        ))}
      </div>

      {/* Time Grid */}
      <div className="flex-1 overflow-y-auto">
        {timeSlots.map((time) => (
          <div key={time} className="flex border-b border-gray-100 last:border-b-0">
            <div className="w-20 flex-shrink-0 border-r border-gray-200 p-2 text-xs text-gray-500">
              {time}
            </div>
            {weekDays.map((day) => (
              <div key={`${day.toISOString()}-${time}`} className="flex-1 border-r border-gray-200 last:border-r-0">
                <TimeSlot
                  time={time}
                  date={day}
                  events={events}
                  onClick={onTimeSlotClick}
                  onDrop={onEventDrop}
                  allowEventCreation={allowEventCreation}
                  allowEventDragging={allowEventDragging}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const DayView: React.FC<{
  currentDate: Date;
  events: CalendarEvent[];
  timeSlots: string[];
  onTimeSlotClick?: (date: Date, time: string) => void;
  onEventDrop?: (eventId: string, newStart: Date, newEnd: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onEventEdit?: (eventId: string) => void;
  onEventDelete?: (eventId: string) => void;
  onEventDuplicate?: (eventId: string) => void;
  allowEventCreation?: boolean;
  allowEventEditing?: boolean;
  allowEventDragging?: boolean;
}> = ({
  currentDate,
  events,
  timeSlots,
  onTimeSlotClick,
  onEventDrop,
  onEventClick,
  onEventEdit,
  onEventDelete,
  onEventDuplicate,
  allowEventCreation,
  allowEventEditing,
  allowEventDragging,
}) => {
  const dayEvents = events.filter(event => isSameDay(event.start, currentDate));

  return (
    <div className="flex-1 flex flex-col">
      {/* Day Header */}
      <div className="flex border-b border-gray-200">
        <div className="w-20 flex-shrink-0 border-r border-gray-200 p-2">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Time</span>
        </div>
        <div className="flex-1 p-4 text-center">
          <p className="text-sm font-medium text-gray-900">
            {format(currentDate, 'EEEE')}
          </p>
          <p className="text-2xl font-bold text-brand-primary">
            {format(currentDate, 'MMMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Time Grid */}
      <div className="flex-1 overflow-y-auto">
        {timeSlots.map((time) => (
          <div key={time} className="flex border-b border-gray-100 last:border-b-0">
            <div className="w-20 flex-shrink-0 border-r border-gray-200 p-2 text-xs text-gray-500">
              {time}
            </div>
            <div className="flex-1">
              <TimeSlot
                time={time}
                date={currentDate}
                events={dayEvents}
                onClick={onTimeSlotClick}
                onDrop={onEventDrop}
                allowEventCreation={allowEventCreation}
                allowEventDragging={allowEventDragging}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AdvancedCalendar: React.FC<AdvancedCalendarProps> = ({
  events,
  currentDate,
  onDateChange,
  onEventClick,
  onEventDrop,
  onEventResize,
  onTimeSlotClick,
  onEventCreate,
  onEventEdit,
  onEventDelete,
  onEventDuplicate,
  view,
  timeSlots = DEFAULT_TIME_SLOTS,
  workingHours = { start: '08:00', end: '20:00' },
  className,
  disabled = false,
  allowEventCreation = true,
  allowEventEditing = true,
  allowEventDragging = true,
  showTimeSlots = true,
  slotDuration = 30,
}) => {
  const navigatePrevious = () => {
    if (view === 'week') {
      onDateChange(subWeeks(currentDate, 1));
    } else {
      onDateChange(addDays(currentDate, -1));
    }
  };

  const navigateNext = () => {
    if (view === 'week') {
      onDateChange(addWeeks(currentDate, 1));
    } else {
      onDateChange(addDays(currentDate, 1));
    }
  };

  const navigateToday = () => {
    onDateChange(new Date());
  };

  const getViewTitle = () => {
    if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    } else {
      return format(currentDate, 'MMMM d, yyyy');
    }
  };

  const filteredTimeSlots = useMemo(() => {
    if (!showTimeSlots) return timeSlots;

    const startHour = parseInt(workingHours.start.split(':')[0]);
    const endHour = parseInt(workingHours.end.split(':')[0]);

    return timeSlots.filter(slot => {
      const hour = parseInt(slot.split(':')[0]);
      return hour >= startHour && hour <= endHour;
    });
  }, [timeSlots, workingHours, showTimeSlots]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={clsx('bg-white rounded-lg border border-gray-200 shadow-sm', className)}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <button
                onClick={navigatePrevious}
                disabled={disabled}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Previous"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={navigateNext}
                disabled={disabled}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Next"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <h2 className="text-lg font-semibold text-gray-900">
              {getViewTitle()}
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={navigateToday}
              disabled={disabled}
              className="btn btn-outline btn-sm"
            >
              Today
            </button>
          </div>
        </div>

        {/* Calendar View */}
        <div className="h-[600px] flex flex-col">
          {view === 'week' ? (
            <WeekView
              currentDate={currentDate}
              events={events}
              timeSlots={filteredTimeSlots}
              onTimeSlotClick={onTimeSlotClick}
              onEventDrop={onEventDrop}
              onEventClick={onEventClick}
              onEventEdit={onEventEdit}
              onEventDelete={onEventDelete}
              onEventDuplicate={onEventDuplicate}
              allowEventCreation={allowEventCreation && !disabled}
              allowEventEditing={allowEventEditing && !disabled}
              allowEventDragging={allowEventDragging && !disabled}
            />
          ) : (
            <DayView
              currentDate={currentDate}
              events={events}
              timeSlots={filteredTimeSlots}
              onTimeSlotClick={onTimeSlotClick}
              onEventDrop={onEventDrop}
              onEventClick={onEventClick}
              onEventEdit={onEventEdit}
              onEventDelete={onEventDelete}
              onEventDuplicate={onEventDuplicate}
              allowEventCreation={allowEventCreation && !disabled}
              allowEventEditing={allowEventEditing && !disabled}
              allowEventDragging={allowEventDragging && !disabled}
            />
          )}
        </div>
      </div>
    </DndProvider>
  );
};