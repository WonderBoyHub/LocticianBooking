import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectDate,
  selectTime,
  nextStep,
  previousStep,
  selectSelectedService,
  selectSelectedDate,
  selectSelectedTime,
} from '../../store/slices/bookingSlice';
import { useGetAvailableSlotsQuery } from '../../store/api';
import { Button, LoadingSpinner } from '../ui';
import { formatDate, formatTime } from '../../i18n';
import clsx from 'clsx';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, isBefore, startOfDay } from 'date-fns';
import { da, enUS } from 'date-fns/locale';

interface CalendarDateProps {
  date: Date;
  isSelected: boolean;
  isToday: boolean;
  isDisabled: boolean;
  hasSlots: boolean;
  onClick: (date: Date) => void;
}

const CalendarDate: React.FC<CalendarDateProps> = ({
  date,
  isSelected,
  isToday,
  isDisabled,
  hasSlots,
  onClick,
}) => {
  return (
    <motion.button
      whileHover={!isDisabled ? { scale: 1.05 } : undefined}
      whileTap={!isDisabled ? { scale: 0.95 } : undefined}
      className={clsx(
        'w-12 h-12 rounded-lg text-sm font-medium transition-all duration-200 relative',
        isSelected && 'bg-brand-primary text-white shadow-md',
        !isSelected && isToday && 'bg-blue-100 text-blue-700 border border-blue-300',
        !isSelected && !isToday && hasSlots && !isDisabled && 'bg-white hover:bg-brand-accent border border-gray-200',
        !isSelected && !isToday && !hasSlots && !isDisabled && 'bg-gray-50 text-gray-400 border border-gray-200',
        isDisabled && 'bg-gray-100 text-gray-300 cursor-not-allowed'
      )}
      onClick={() => !isDisabled && onClick(date)}
      disabled={isDisabled}
    >
      {format(date, 'd')}
      {hasSlots && !isSelected && (
        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-brand-primary rounded-full" />
      )}
    </motion.button>
  );
};

interface TimeSlotProps {
  time: string;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: (time: string) => void;
}

const TimeSlot: React.FC<TimeSlotProps> = ({ time, isSelected, isDisabled, onClick }) => {
  return (
    <motion.button
      whileHover={!isDisabled ? { scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      className={clsx(
        'px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 border',
        isSelected && 'bg-brand-primary text-white border-brand-primary shadow-md',
        !isSelected && !isDisabled && 'bg-white hover:bg-brand-accent border-gray-200 hover:border-brand-primary',
        isDisabled && 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
      )}
      onClick={() => !isDisabled && onClick(time)}
      disabled={isDisabled}
    >
      {formatTime(time)}
    </motion.button>
  );
};

export const DateTimeSelection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();

  const selectedService = useAppSelector(selectSelectedService);
  const selectedDate = useAppSelector(selectSelectedDate);
  const selectedTime = useAppSelector(selectSelectedTime);

  const [currentWeek, setCurrentWeek] = useState(new Date());

  const locale = i18n.language === 'da' ? da : enUS;

  // Generate week dates
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDates = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Fetch available slots for the current week
  const {
    data: slotsResponse,
    isLoading: slotsLoading,
    error: slotsError
  } = useGetAvailableSlotsQuery(
    selectedService
      ? {
          locticianId: selectedService.locticianId,
          serviceId: selectedService.id,
          startDate: format(weekStart, 'yyyy-MM-dd'),
          endDate: format(weekEnd, 'yyyy-MM-dd'),
        }
      : { locticianId: '', serviceId: '', startDate: '', endDate: '' },
    { skip: !selectedService }
  );

  const availableSlots = slotsResponse?.data || [];

  // Create a map of dates to available times
  const slotsByDate = useMemo(() => {
    const map: Record<string, string[]> = {};
    availableSlots.forEach(slot => {
      map[slot.date] = slot.slots;
    });
    return map;
  }, [availableSlots]);

  // Get available times for selected date
  const availableTimes = selectedDate ? slotsByDate[selectedDate] || [] : [];

  const handleDateSelect = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    dispatch(selectDate(dateString));
    // Reset time when date changes
    if (selectedTime) {
      dispatch(selectTime(''));
    }
  };

  const handleTimeSelect = (time: string) => {
    dispatch(selectTime(time));
  };

  const handlePreviousWeek = () => {
    setCurrentWeek(prev => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setCurrentWeek(prev => addDays(prev, 7));
  };

  const handleContinue = () => {
    if (selectedDate && selectedTime) {
      dispatch(nextStep());
    }
  };

  const handleBack = () => {
    dispatch(previousStep());
  };

  if (!selectedService) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No service selected</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-dark mb-2">
          {t('booking.datetime.title')}
        </h2>
        <p className="text-gray-600">
          Choose your preferred date and time for <span className="font-medium">{selectedService.name}</span>
        </p>
      </div>

      {/* Calendar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-brand-dark">
            {t('booking.datetime.selectDate')}
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePreviousWeek}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-600 min-w-[120px] text-center">
              {format(weekStart, 'd MMM', { locale })} - {format(weekEnd, 'd MMM yyyy', { locale })}
            </span>
            <button
              onClick={handleNextWeek}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Week days */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
              {format(weekDates[index], 'EEE', { locale })}
            </div>
          ))}
        </div>

        {/* Calendar dates */}
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date) => {
            const dateString = format(date, 'yyyy-MM-dd');
            const hasSlots = slotsByDate[dateString]?.length > 0;
            const isPast = isBefore(date, startOfDay(new Date()));

            return (
              <CalendarDate
                key={dateString}
                date={date}
                isSelected={selectedDate === dateString}
                isToday={isToday(date)}
                isDisabled={isPast || !hasSlots}
                hasSlots={hasSlots}
                onClick={handleDateSelect}
              />
            );
          })}
        </div>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-brand-dark mb-4">
            {t('booking.datetime.selectTime')}
          </h3>

          {slotsLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : availableTimes.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {availableTimes.map((time) => (
                <TimeSlot
                  key={time}
                  time={time}
                  isSelected={selectedTime === time}
                  isDisabled={false}
                  onClick={handleTimeSelect}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">
                {t('booking.datetime.noSlotsAvailable')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {selectedDate && selectedTime && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-accent rounded-lg p-4 mb-6"
        >
          <h4 className="font-medium text-brand-dark mb-2">Booking Summary</h4>
          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex items-center">
              <CalendarIcon className="w-4 h-4 mr-2" />
              <span>{formatDate(selectedDate)}</span>
            </div>
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              <span>{formatTime(selectedTime)}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
        >
          {t('common.back')}
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!selectedDate || !selectedTime}
          size="lg"
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  );
};