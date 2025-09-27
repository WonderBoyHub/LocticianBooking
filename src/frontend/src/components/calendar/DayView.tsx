import React, { useMemo } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useDrop } from 'react-dnd';
import { useAppSelector } from '../../store/hooks';
import {
  selectCurrentDate,
  selectCalendarEvents,
} from '../../store/slices/calendarSlice';
import { AppointmentCard } from './AppointmentCard';
import { format, isSameDay, isToday } from 'date-fns';
import { da, enUS } from 'date-fns/locale';
import type { CalendarEvent } from '../../types';

interface TimeSlotProps {
  time: string;
  date: Date;
  events: CalendarEvent[];
  onEventDrop: (eventId: string, newTime: string) => void;
}

const TimeSlot: React.FC<TimeSlotProps> = ({ time, date, events, onEventDrop }) => {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'appointment',
    drop: (item: { id: string; event: CalendarEvent }) => {
      onEventDrop(item.id, time);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const slotEvents = events.filter(event => {
    const eventDate = new Date(event.start);
    const eventTime = format(eventDate, 'HH:mm');
    return isSameDay(eventDate, date) && eventTime === time;
  });

  const isCurrentHour = () => {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    return isSameDay(now, date) && currentTime.slice(0, 2) === time.slice(0, 2);
  };

  return (
    <div
      ref={drop}
      className={clsx(
        'min-h-[80px] border-b border-gray-200 p-2 relative transition-colors',
        isCurrentHour() && 'bg-blue-50 border-blue-200',
        isOver && canDrop && 'bg-green-50 border-green-300'
      )}
    >
      {/* Time indicator for current time */}
      {isCurrentHour() && isToday(date) && (
        <div className="absolute left-0 top-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
      )}

      {/* Events */}
      <div className="space-y-2">
        {slotEvents.map((event) => (
          <AppointmentCard
            key={event.id}
            event={event}
            draggable
            className="shadow-sm"
          />
        ))}
      </div>

      {/* Drop indicator */}
      {isOver && canDrop && (
        <div className="absolute inset-0 border-2 border-dashed border-green-400 bg-green-50 bg-opacity-50 rounded pointer-events-none" />
      )}
    </div>
  );
};

export const DayView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentDate = useAppSelector(selectCurrentDate);
  const events = useAppSelector(selectCalendarEvents);

  const locale = i18n.language === 'da' ? da : enUS;
  const date = new Date(currentDate);

  // Generate time slots (8:00 to 20:00 with 30-minute intervals)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 8; hour <= 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 20) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  }, []);

  // Filter events for the current day
  const dayEvents = useMemo(() => {
    return events.filter(event => isSameDay(new Date(event.start), date));
  }, [events, date]);

  const handleEventDrop = (eventId: string, newTime: string) => {
    // TODO: Implement event rescheduling through API
    console.log(`Moving event ${eventId} to ${format(date, 'yyyy-MM-dd')} at ${newTime}`);
  };

  const isTodayDate = isToday(date);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Day header */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-brand-dark">
            {format(date, 'EEEE', { locale })}
          </h2>
          <div
            className={clsx(
              'text-3xl font-light mt-2 inline-flex items-center justify-center w-16 h-16 rounded-full',
              isTodayDate ? 'bg-brand-primary text-white' : 'text-gray-600'
            )}
          >
            {format(date, 'd')}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {format(date, 'MMMM yyyy', { locale })}
          </p>
        </div>

        {/* Day summary */}
        <div className="mt-4 flex justify-center space-x-6 text-sm">
          <div className="text-center">
            <div className="font-medium text-brand-dark">{dayEvents.length}</div>
            <div className="text-gray-500">{t('dashboard.overview.todayAppointments')}</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-brand-dark">
              {dayEvents.filter(e => e.extendedProps?.appointment?.status === 'confirmed').length}
            </div>
            <div className="text-gray-500">{t('calendar.appointment.status.confirmed')}</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-brand-dark">
              {dayEvents.filter(e => e.extendedProps?.appointment?.status === 'pending').length}
            </div>
            <div className="text-gray-500">{t('calendar.appointment.status.pending')}</div>
          </div>
        </div>
      </div>

      {/* Day schedule */}
      <div className="flex-1 overflow-auto">
        <div className="flex">
          {/* Time labels */}
          <div className="w-24 border-r border-gray-200 bg-gray-50">
            {timeSlots.map((time) => (
              <div
                key={time}
                className="h-[80px] border-b border-gray-200 flex items-start justify-end pr-4 pt-2"
              >
                <span className="text-sm text-gray-500 font-medium">
                  {time}
                </span>
              </div>
            ))}
          </div>

          {/* Schedule content */}
          <div className="flex-1">
            {timeSlots.map((time) => (
              <TimeSlot
                key={time}
                time={time}
                date={date}
                events={events}
                onEventDrop={handleEventDrop}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {dayEvents.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('dashboard.recentBookings.noBookings')}
            </h3>
            <p className="text-gray-500">
              {isTodayDate
                ? 'No appointments scheduled for today'
                : `No appointments scheduled for ${format(date, 'MMMM d, yyyy', { locale })}`
              }
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};