import React, { useMemo } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAppSelector } from '../../store/hooks';
import {
  selectCurrentDate,
  selectCalendarEvents,
} from '../../store/slices/calendarSlice';
import { AppointmentCard } from './AppointmentCard';
import { Card, CardHeader, CardTitle, CardContent } from '../ui';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, isAfter } from 'date-fns';
import { da, enUS } from 'date-fns/locale';
import { Calendar, Clock, User } from 'lucide-react';
import type { CalendarEvent } from '../../types';

interface DayGroupProps {
  date: Date;
  events: CalendarEvent[];
}

const DayGroup: React.FC<DayGroupProps> = ({ date, events }) => {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'da' ? da : enUS;

  const sortedEvents = useMemo(() => {
    return events.sort((a, b) => {
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });
  }, [events]);

  const isTodayDate = isToday(date);
  const isPastDate = isBefore(date, new Date()) && !isTodayDate;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'mb-6',
        isPastDate && 'opacity-75'
      )}
    >
      {/* Date header */}
      <div className={clsx(
        'flex items-center space-x-3 mb-3 pb-2 border-b',
        isTodayDate ? 'border-brand-primary' : 'border-gray-200'
      )}>
        <div className={clsx(
          'flex items-center justify-center w-12 h-12 rounded-full text-sm font-medium',
          isTodayDate ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-600'
        )}>
          {format(date, 'd')}
        </div>
        <div>
          <h3 className={clsx(
            'text-lg font-semibold',
            isTodayDate ? 'text-brand-primary' : 'text-gray-900'
          )}>
            {format(date, 'EEEE', { locale })}
          </h3>
          <p className="text-sm text-gray-500">
            {format(date, 'd MMMM yyyy', { locale })}
          </p>
        </div>
        {isTodayDate && (
          <span className="px-2 py-1 text-xs font-medium bg-brand-primary text-white rounded-full">
            Today
          </span>
        )}
      </div>

      {/* Events */}
      <div className="space-y-3">
        {sortedEvents.map((event) => (
          <motion.div
            key={event.id}
            layout
            className="ml-4"
          >
            <AppointmentCard
              event={event}
              className="w-full max-w-none"
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export const AgendaView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentDate = useAppSelector(selectCurrentDate);
  const events = useAppSelector(selectCalendarEvents);

  const locale = i18n.language === 'da' ? da : enUS;
  const date = new Date(currentDate);

  // Get the current month's date range
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};

    events.forEach(event => {
      const eventDate = new Date(event.start);
      const dateKey = format(eventDate, 'yyyy-MM-dd');

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });

    return grouped;
  }, [events]);

  // Filter days that have events or are today
  const relevantDays = useMemo(() => {
    const today = new Date();
    return daysInMonth.filter(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      return eventsByDate[dateKey] || isSameDay(day, today);
    });
  }, [daysInMonth, eventsByDate]);

  // Calculate statistics
  const monthStats = useMemo(() => {
    const monthEvents = events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate >= monthStart && eventDate <= monthEnd;
    });

    const confirmedCount = monthEvents.filter(
      event => event.extendedProps?.appointment?.status === 'confirmed'
    ).length;

    const pendingCount = monthEvents.filter(
      event => event.extendedProps?.appointment?.status === 'pending'
    ).length;

    const completedCount = monthEvents.filter(
      event => event.extendedProps?.appointment?.status === 'completed'
    ).length;

    return {
      total: monthEvents.length,
      confirmed: confirmedCount,
      pending: pendingCount,
      completed: completedCount,
    };
  }, [events, monthStart, monthEnd]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Month overview */}
      <div className="p-6 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-brand-dark">
            {format(date, 'MMMM yyyy', { locale })}
          </h2>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>{relevantDays.length} {t('time.days')} with appointments</span>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card padding="sm" className="text-center">
            <div className="text-2xl font-bold text-brand-primary">{monthStats.total}</div>
            <div className="text-sm text-gray-500">{t('dashboard.overview.todayAppointments')}</div>
          </Card>
          <Card padding="sm" className="text-center">
            <div className="text-2xl font-bold text-green-600">{monthStats.confirmed}</div>
            <div className="text-sm text-gray-500">{t('calendar.appointment.status.confirmed')}</div>
          </Card>
          <Card padding="sm" className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{monthStats.pending}</div>
            <div className="text-sm text-gray-500">{t('calendar.appointment.status.pending')}</div>
          </Card>
          <Card padding="sm" className="text-center">
            <div className="text-2xl font-bold text-gray-600">{monthStats.completed}</div>
            <div className="text-sm text-gray-500">{t('calendar.appointment.status.completed')}</div>
          </Card>
        </div>
      </div>

      {/* Agenda list */}
      <div className="flex-1 overflow-auto p-6">
        {relevantDays.length > 0 ? (
          <div className="max-w-4xl mx-auto">
            {relevantDays.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDate[dateKey] || [];

              return (
                <DayGroup
                  key={dateKey}
                  date={day}
                  events={dayEvents}
                />
              );
            })}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center"
          >
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No appointments this month
            </h3>
            <p className="text-gray-500 max-w-md">
              There are no appointments scheduled for {format(date, 'MMMM yyyy', { locale })}.
              Your calendar is completely free!
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};