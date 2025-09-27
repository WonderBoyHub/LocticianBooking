import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, isSameDay, isToday, isBefore, startOfToday } from 'date-fns';
import { da } from 'date-fns/locale';
import { Button } from '../../ui/Button';
import { LoadingSpinner } from '../../ui/LoadingSpinner';

interface TimeSlot {
  time: string;
  available: boolean;
  appointmentId?: string;
}

interface DaySchedule {
  date: Date;
  slots: TimeSlot[];
  isFullyBooked: boolean;
}

interface DateTimeSelectionStepProps {
  selectedDate: Date | null;
  selectedTime: string | null;
  onDateSelect: (date: Date) => void;
  onTimeSelect: (time: string) => void;
  onNext: () => void;
  onBack: () => void;
  isLoadingAvailability?: boolean;
  serviceId: string;
}

// Mock data - would come from API
const generateMockSchedule = (date: Date): DaySchedule => {
  const slots: TimeSlot[] = [];
  const baseHour = 9; // Start at 9 AM
  const endHour = 17; // End at 5 PM

  for (let hour = baseHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const available = Math.random() > 0.3; // Random availability for demo

      slots.push({
        time: timeString,
        available,
      });
    }
  }

  return {
    date,
    slots,
    isFullyBooked: slots.every(slot => !slot.available),
  };
};

export const DateTimeSelectionStep: React.FC<DateTimeSelectionStepProps> = ({
  selectedDate,
  selectedTime,
  onDateSelect,
  onTimeSelect,
  onNext,
  onBack,
  isLoadingAvailability = false,
  serviceId,
}) => {
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  // Generate week dates
  const weekDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(currentWeek, i));
    }
    return dates;
  }, [currentWeek]);

  // Generate availability for current week
  const weekSchedules = useMemo(() => {
    return weekDates.map(date => generateMockSchedule(date));
  }, [weekDates]);

  const selectedSchedule = useMemo(() => {
    if (!selectedDate) return null;
    return weekSchedules.find(schedule => isSameDay(schedule.date, selectedDate));
  }, [selectedDate, weekSchedules]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const days = direction === 'next' ? 7 : -7;
    setCurrentWeek(addDays(currentWeek, days));
  };

  const isDateDisabled = (date: Date) => {
    return isBefore(date, startOfToday());
  };

  const getDateStatus = (date: Date, schedule: DaySchedule) => {
    if (isDateDisabled(date)) return 'disabled';
    if (schedule.isFullyBooked) return 'fully-booked';
    if (selectedDate && isSameDay(date, selectedDate)) return 'selected';
    if (isToday(date)) return 'today';
    return 'available';
  };

  const formatTimeSlot = (time: string) => {
    return time;
  };

  const canProceed = selectedDate && selectedTime;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-serif font-semibold text-brand-dark mb-2">
          Vælg dato og tid
        </h2>
        <p className="text-gray-600">
          Vælg din foretrukne dag og tidspunkt for behandlingen
        </p>
      </div>

      {/* Calendar Section */}
      <div className="bg-white rounded-2xl p-6 border border-brown-200 shadow-soft">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-brand-dark flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {format(currentWeek, 'MMMM yyyy', { locale: da })}
          </h3>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => navigateWeek('prev')}
              className="p-2 text-brand-primary hover:bg-brand-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigateWeek('next')}
              className="p-2 text-brand-primary hover:bg-brand-accent"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoadingAvailability ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {/* Day headers */}
            {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map((day, index) => (
              <div key={day} className="text-center text-sm font-medium text-gray-600 p-3">
                {day}
              </div>
            ))}

            {/* Date cells */}
            {weekSchedules.map((schedule, index) => {
              const status = getDateStatus(schedule.date, schedule);

              return (
                <motion.button
                  key={index}
                  onClick={() => !isDateDisabled(schedule.date) && onDateSelect(schedule.date)}
                  disabled={isDateDisabled(schedule.date)}
                  className={`relative p-3 rounded-xl text-center transition-all duration-200 ${
                    status === 'disabled'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : status === 'fully-booked'
                      ? 'bg-red-50 text-red-400 cursor-not-allowed'
                      : status === 'selected'
                      ? 'bg-brand-primary text-white shadow-md'
                      : status === 'today'
                      ? 'bg-brand-accent text-brand-primary font-semibold hover:bg-brand-secondary'
                      : 'bg-gray-50 text-gray-700 hover:bg-brand-accent hover:text-brand-primary'
                  }`}
                  whileHover={!isDateDisabled(schedule.date) ? { scale: 1.05 } : {}}
                  whileTap={!isDateDisabled(schedule.date) ? { scale: 0.95 } : {}}
                >
                  <div className="text-lg font-semibold">
                    {format(schedule.date, 'd')}
                  </div>

                  {status === 'fully-booked' && (
                    <div className="text-xs mt-1">Optaget</div>
                  )}

                  {status === 'available' && !schedule.isFullyBooked && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full"></div>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Time Selection */}
      {selectedDate && selectedSchedule && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl p-6 border border-brown-200 shadow-soft"
        >
          <h3 className="text-lg font-semibold text-brand-dark mb-6 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Tilgængelige tidspunkter for {format(selectedDate, 'd. MMMM', { locale: da })}
          </h3>

          {selectedSchedule.slots.filter(slot => slot.available).length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-red-500" />
              </div>
              <h4 className="text-lg font-semibold text-red-700 mb-2">
                Ingen ledige tidspunkter
              </h4>
              <p className="text-red-600">
                Vælg venligst en anden dato.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {selectedSchedule.slots
                .filter(slot => slot.available)
                .map((slot, index) => (
                  <motion.button
                    key={index}
                    onClick={() => onTimeSelect(slot.time)}
                    className={`p-3 rounded-xl text-center font-medium transition-all duration-200 ${
                      selectedTime === slot.time
                        ? 'bg-brand-primary text-white shadow-md'
                        : 'bg-gray-50 text-gray-700 hover:bg-brand-accent hover:text-brand-primary'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {formatTimeSlot(slot.time)}
                  </motion.button>
                ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Selected DateTime Summary */}
      {selectedDate && selectedTime && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-brand-accent/30 rounded-2xl p-6 border border-brand-secondary"
        >
          <h3 className="text-lg font-semibold text-brand-dark mb-3">
            Din valgte tid
          </h3>
          <div className="flex items-center gap-4 text-brand-dark">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-brand-primary" />
              <span className="font-medium">
                {format(selectedDate, 'EEEE d. MMMM yyyy', { locale: da })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-brand-primary" />
              <span className="font-medium">{selectedTime}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6">
        <Button
          onClick={onBack}
          variant="outline"
          className="px-6 py-3 border-brown-300 text-brand-dark hover:bg-brand-accent"
        >
          Tilbage
        </Button>

        <Button
          onClick={onNext}
          disabled={!canProceed}
          className="px-6 py-3 bg-brand-primary hover:bg-brand-dark text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {canProceed ? 'Fortsæt til Oplysninger' : 'Vælg dato og tid'}
        </Button>
      </div>
    </motion.div>
  );
};