import React, { useMemo } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useDrop } from 'react-dnd';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import {
  selectCurrentDate,
  selectCalendarEvents,
  selectSelectedDate,
  setSelectedDate,
} from '../../store/slices/calendarSlice';
import { AppointmentCard } from './AppointmentCard';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { da, enUS } from 'date-fns/locale';
import type { CalendarEvent } from '../../types';

interface DayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
  onEventDrop: (eventId: string, newDate: string) => void;
}

const DayCell: React.FC<DayCellProps> = ({
  date,
  isCurrentMonth,
  isSelected,
  isToday,
  events,
  onDateClick,
  onEventDrop,
}) => {
  const { t } = useTranslation();

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'appointment',
    drop: (item: { id: string; event: CalendarEvent }) => {
      const newDate = format(date, 'yyyy-MM-dd');
      onEventDrop(item.id, newDate);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const dayEvents = events.filter(event =>
    isSameDay(new Date(event.start), date)
  );

  // Sort events by start time
  const sortedEvents = useMemo(() => {
    return dayEvents.sort((a, b) => {
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });
  }, [dayEvents]);

  const maxVisibleEvents = 3;
  const visibleEvents = sortedEvents.slice(0, maxVisibleEvents);
  const hiddenEventCount = sortedEvents.length - maxVisibleEvents;

  return (
    <div
      ref={drop}
      className={clsx(
        'min-h-[120px] p-1 border-r border-b border-gray-200 cursor-pointer transition-all duration-200',
        isCurrentMonth ? 'bg-white' : 'bg-gray-50',
        isSelected && 'bg-brand-accent',
        isToday && 'bg-blue-50 border-blue-200',
        isOver && canDrop && 'bg-green-50 border-green-300',
        'hover:bg-gray-50'
      )}
      onClick={() => onDateClick(date)}
    >
      {/* Date number */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={clsx(
            'text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full',
            isToday && 'bg-brand-primary text-white',
            !isToday && isCurrentMonth && 'text-gray-900',
            !isToday && !isCurrentMonth && 'text-gray-400'
          )}
        >
          {format(date, 'd')}
        </span>
      </div>

      {/* Events */}
      <div className="space-y-1">
        {visibleEvents.map((event) => (
          <AppointmentCard
            key={event.id}
            event={event}
            compact
            draggable
            className="text-xs"
          />
        ))}

        {hiddenEventCount > 0 && (
          <motion.div
            className="text-xs text-gray-500 text-center py-1 bg-gray-100 rounded"
            whilehover={{ scale: 1.05 }}
          >
            +{hiddenEventCount} {t('common.more')}
          </motion.div>
        )}
      </div>

      {/* Drop indicator */}
      {isOver && canDrop && (
        <div className="absolute inset-0 border-2 border-dashed border-green-400 bg-green-50 bg-opacity-50 rounded pointer-events-none" />
      )}
    </div>
  );
};

export const MonthView: React.FC = () => {
  const { i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const currentDate = useAppSelector(selectCurrentDate);
  const events = useAppSelector(selectCalendarEvents);
  const selectedDate = useAppSelector(selectSelectedDate);

  const locale = i18n.language === 'da' ? da : enUS;
  const date = new Date(currentDate);

  // Generate calendar grid
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  // Group days into weeks
  const weeks = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  const weekDays = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
  ];

  const handleDateClick = (clickedDate: Date) => {
    const dateString = format(clickedDate, 'yyyy-MM-dd');
    dispatch(setSelectedDate(dateString));
  };

  const handleEventDrop = (eventId: string, newDate: string) => {
    // TODO: Implement event rescheduling through API
    console.log(`Moving event ${eventId} to ${newDate}`);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Week days header */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-3 text-center text-sm font-medium text-gray-700 bg-gray-50 border-r border-gray-200 last:border-r-0"
          >
            {format(new Date(2023, 0, 2 + weekDays.indexOf(day)), 'EEE', { locale })}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-200 last:border-b-0">
            {week.map((day) => (
              <DayCell
                key={format(day, 'yyyy-MM-dd')}
                date={day}
                isCurrentMonth={isSameMonth(day, date)}
                isSelected={selectedDate === format(day, 'yyyy-MM-dd')}
                isToday={isToday(day)}
                events={events}
                onDateClick={handleDateClick}
                onEventDrop={handleEventDrop}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};