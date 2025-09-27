import React, { useMemo } from 'react';
import { clsx } from 'clsx';
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
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, addMinutes, differenceInMinutes } from 'date-fns';
import { da, enUS } from 'date-fns/locale';
import type { CalendarEvent } from '../../types';

interface TimeSlotProps {
  time: string;
  date: Date;
  events: CalendarEvent[];
  onEventDrop: (eventId: string, newDate: string, newTime: string) => void;
}

const TimeSlot: React.FC<TimeSlotProps> = ({ time, date, events, onEventDrop }) => {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'appointment',
    drop: (item: { id: string; event: CalendarEvent }) => {
      const newDate = format(date, 'yyyy-MM-dd');
      onEventDrop(item.id, newDate, time);
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

  return (
    <div
      ref={drop}
      className={clsx(
        'min-h-[60px] border-r border-b border-gray-200 p-1 relative',
        isOver && canDrop && 'bg-green-50 border-green-300'
      )}
    >
      {slotEvents.map((event) => (
        <AppointmentCard
          key={event.id}
          event={event}
          compact
          draggable
          className="mb-1"
        />
      ))}

      {/* Drop indicator */}
      {isOver && canDrop && (
        <div className="absolute inset-0 border-2 border-dashed border-green-400 bg-green-50 bg-opacity-50 rounded pointer-events-none" />
      )}
    </div>
  );
};

interface DayColumnProps {
  date: Date;
  events: CalendarEvent[];
  timeSlots: string[];
  onDateClick: (date: Date) => void;
  onEventDrop: (eventId: string, newDate: string, newTime: string) => void;
}

const DayColumn: React.FC<DayColumnProps> = ({
  date,
  events,
  timeSlots,
  onDateClick,
  onEventDrop,
}) => {
  const selectedDate = useAppSelector(selectSelectedDate);
  const isSelected = selectedDate === format(date, 'yyyy-MM-dd');
  const isTodayDate = isToday(date);

  return (
    <div className="flex flex-col">
      {/* Day header */}
      <div
        className={clsx(
          'p-3 text-center border-r border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors',
          isSelected && 'bg-brand-accent',
          isTodayDate && 'bg-blue-50'
        )}
        onClick={() => onDateClick(date)}
      >
        <div className="text-xs text-gray-500 uppercase tracking-wide">
          {format(date, 'EEE')}
        </div>
        <div
          className={clsx(
            'text-lg font-medium mt-1 w-8 h-8 flex items-center justify-center rounded-full mx-auto',
            isTodayDate && 'bg-brand-primary text-white'
          )}
        >
          {format(date, 'd')}
        </div>
      </div>

      {/* Time slots */}
      <div className="flex-1">
        {timeSlots.map((time) => (
          <TimeSlot
            key={`${format(date, 'yyyy-MM-dd')}-${time}`}
            time={time}
            date={date}
            events={events}
            onEventDrop={onEventDrop}
          />
        ))}
      </div>
    </div>
  );
};

export const WeekView: React.FC = () => {
  const { i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const currentDate = useAppSelector(selectCurrentDate);
  const events = useAppSelector(selectCalendarEvents);

  const locale = i18n.language === 'da' ? da : enUS;
  const date = new Date(currentDate);

  // Generate week days (Monday to Sunday)
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Generate time slots (8:00 to 20:00)
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

  const handleDateClick = (clickedDate: Date) => {
    const dateString = format(clickedDate, 'yyyy-MM-dd');
    dispatch(setSelectedDate(dateString));
  };

  const handleEventDrop = (eventId: string, newDate: string, newTime: string) => {
    // TODO: Implement event rescheduling through API
    console.log(`Moving event ${eventId} to ${newDate} at ${newTime}`);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Week header with navigation info */}
      <div className="flex border-b border-gray-200">
        {/* Time column header */}
        <div className="w-20 p-3 border-r border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500 text-center">
            {format(weekStart, 'd MMM', { locale })} - {format(weekEnd, 'd MMM', { locale })}
          </div>
        </div>

        {/* Day headers */}
        <div className="flex-1 grid grid-cols-7">
          {weekDays.map((day) => (
            <DayColumn
              key={format(day, 'yyyy-MM-dd')}
              date={day}
              events={events}
              timeSlots={timeSlots}
              onDateClick={handleDateClick}
              onEventDrop={handleEventDrop}
            />
          ))}
        </div>
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-auto">
        <div className="flex">
          {/* Time labels */}
          <div className="w-20 border-r border-gray-200 bg-gray-50">
            {timeSlots.map((time) => (
              <div
                key={time}
                className="h-[60px] border-b border-gray-200 flex items-center justify-center text-xs text-gray-500"
              >
                {time}
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex-1 grid grid-cols-7">
            {weekDays.map((day) => (
              <div key={format(day, 'yyyy-MM-dd')} className="flex flex-col">
                {timeSlots.map((time) => (
                  <TimeSlot
                    key={`${format(day, 'yyyy-MM-dd')}-${time}`}
                    time={time}
                    date={day}
                    events={events}
                    onEventDrop={handleEventDrop}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};