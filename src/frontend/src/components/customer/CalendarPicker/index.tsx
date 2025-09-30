import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  startOfToday,
  parseISO,
  isAfter,
} from 'date-fns';
import { da } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  User,
  MapPin,
  Loader2,
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { LoadingSpinner } from '../../ui/LoadingSpinner';

interface TimeSlot {
  time: string;
  available: boolean;
  appointmentId?: string;
  locticianName?: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  hasAvailableSlots: boolean;
  appointmentCount: number;
}

interface CalendarPickerProps {
  selectedDate: Date | null;
  selectedTime: string | null;
  onDateSelect: (date: Date) => void;
  onTimeSelect: (time: string) => void;
  serviceId?: string;
  locticianId?: string;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  isLoading?: boolean;
  error?: string | null;
  showTimeSlots?: boolean;
}

// Mock data generator
const generateTimeSlots = (date: Date): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const dayOfWeek = date.getDay();

  // Skip Sundays
  if (dayOfWeek === 0) return slots;

  const startHour = 9;
  const endHour = dayOfWeek === 6 ? 15 : 17; // Saturdays end earlier

  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      // Random availability for demo
      const available = Math.random() > 0.4;

      slots.push({
        time: timeString,
        available,
        locticianName: available ? 'Sarah Jensen' : undefined,
      });
    }
  }

  return slots;
};

export const CalendarPicker: React.FC<CalendarPickerProps> = ({
  selectedDate,
  selectedTime,
  onDateSelect,
  onTimeSelect,
  serviceId,
  locticianId,
  className = '',
  minDate = startOfToday(),
  maxDate,
  disabledDates = [],
  isLoading = false,
  error = null,
  showTimeSlots = true,
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => selectedDate || new Date());
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: CalendarDay[] = [];
    let day = startDate;

    while (day <= endDate) {
      const isCurrentMonth = isSameMonth(day, monthStart);
      const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
      const isDisabledByDate = disabledDates.some(disabledDate => isSameDay(day, disabledDate));
      const isBeforeMin = isBefore(day, minDate);
      const isAfterMax = maxDate ? isAfter(day, maxDate) : false;

      // Generate mock availability
      const slots = generateTimeSlots(day);
      const hasAvailableSlots = slots.some(slot => slot.available);

      days.push({
        date: day,
        isCurrentMonth,
        isToday: isToday(day),
        isSelected,
        isDisabled: isDisabledByDate || isBeforeMin || isAfterMax || !hasAvailableSlots,
        hasAvailableSlots,
        appointmentCount: slots.filter(slot => !slot.available).length,
      });

      day = addDays(day, 1);
    }

    return days;
  }, [currentMonth, selectedDate, minDate, maxDate, disabledDates]);

  // Time slots loading
  const loadTimeSlots = useCallback(async (date: Date) => {
    setLoadingTimeSlots(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      const slots = generateTimeSlots(date);
      setTimeSlots(slots);
    } catch (error) {
      console.error('Failed to load time slots:', error);
    } finally {
      setLoadingTimeSlots(false);
    }
  }, []);

  // Date selection handler
  const handleDateSelect = useCallback(async (date: Date) => {
    if (calendarDays.find(day => isSameDay(day.date, date))?.isDisabled) {
      return;
    }

    onDateSelect(date);
    if (showTimeSlots) {
      await loadTimeSlots(date);
    }
  }, [calendarDays, onDateSelect, showTimeSlots, loadTimeSlots]);

  // Load time slots when date changes
  React.useEffect(() => {
    if (selectedDate && showTimeSlots) {
      loadTimeSlots(selectedDate);
    }
  }, [selectedDate, showTimeSlots, loadTimeSlots]);

  // Navigation handlers
  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth(prev => subMonths(prev, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth(prev => addMonths(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentMonth(today);
    handleDateSelect(today);
  }, [handleDateSelect]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-red-700 mb-2">
            Der opstod en fejl
          </h3>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl shadow-soft border border-brown-200 ${className}`}>
      {/* Calendar Header */}
      <div className="p-6 border-b border-brown-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-serif font-semibold text-brand-dark flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Vælg dato
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {format(currentMonth, 'MMMM yyyy', { locale: da })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={goToPreviousMonth}
              className="p-2 text-brand-primary hover:bg-brand-accent"
              disabled={isBefore(subMonths(currentMonth, 1), startOfMonth(minDate))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              onClick={goToToday}
              className="text-xs px-3 py-1 border-brown-300 text-brand-dark hover:bg-brand-accent"
            >
              I dag
            </Button>

            <Button
              variant="ghost"
              onClick={goToNextMonth}
              className="p-2 text-brand-primary hover:bg-brand-accent"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-6">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map((day) => (
            <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const dayKey = format(day.date, 'yyyy-MM-dd');

            return (
              <motion.button
                key={dayKey}
                onClick={() => handleDateSelect(day.date)}
                disabled={day.isDisabled}
                className={`
                  relative p-2 min-h-[48px] text-center rounded-lg transition-all duration-200
                  ${!day.isCurrentMonth
                    ? 'text-gray-300'
                    : day.isDisabled
                    ? 'text-gray-400 cursor-not-allowed bg-gray-50'
                    : day.isSelected
                    ? 'bg-brand-primary text-white shadow-md'
                    : day.isToday
                    ? 'bg-brand-accent text-brand-primary font-semibold'
                    : 'text-gray-700 hover:bg-brand-accent hover:text-brand-primary'
                  }
                `}
                whilehover={!day.isDisabled ? { scale: 1.05 } : {}}
                whiletap={!day.isDisabled ? { scale: 0.95 } : {}}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.01, duration: 0.2 }}
              >
                <div className="text-sm font-medium">
                  {format(day.date, 'd')}
                </div>

                {/* Availability Indicator */}
                {day.isCurrentMonth && !day.isDisabled && (
                  <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
                    {day.hasAvailableSlots ? (
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    ) : (
                      <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                    )}
                  </div>
                )}

                {/* Appointment Count */}
                {day.isCurrentMonth && day.appointmentCount > 0 && (
                  <div className="absolute top-1 right-1 w-4 h-4 bg-gray-400 text-white text-xs rounded-full flex items-center justify-center">
                    {day.appointmentCount}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Time Slots Section */}
      {showTimeSlots && selectedDate && (
        <div className="border-t border-brown-100">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-brand-dark mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Tilgængelige tider for {format(selectedDate, 'd. MMMM', { locale: da })}
            </h3>

            {loadingTimeSlots ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : timeSlots.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-8 w-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-semibold text-gray-700 mb-2">
                  Ingen tilgængelige tider
                </h4>
                <p className="text-gray-600 text-sm">
                  Vælg venligst en anden dato.
                </p>
              </div>
            ) : (
              <AnimatePresence>
                <div className="space-y-4">
                  {/* Available Time Slots */}
                  <div>
                    <h4 className="text-sm font-medium text-brand-dark mb-3">
                      Ledige tider ({timeSlots.filter(slot => slot.available).length} tilgængelige)
                    </h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {timeSlots
                        .filter(slot => slot.available)
                        .map((slot, index) => (
                          <motion.button
                            key={slot.time}
                            onClick={() => onTimeSelect(slot.time)}
                            className={`
                              p-3 rounded-lg text-center font-medium transition-all duration-200
                              ${selectedTime === slot.time
                                ? 'bg-brand-primary text-white shadow-md'
                                : 'bg-gray-50 text-gray-700 hover:bg-brand-accent hover:text-brand-primary'
                              }
                            `}
                            whilehover={{ scale: 1.05 }}
                            whiletap={{ scale: 0.95 }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05, duration: 0.2 }}
                          >
                            <div className="text-sm font-semibold">{slot.time}</div>
                            {slot.locticianName && (
                              <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                                <User className="h-3 w-3" />
                                {slot.locticianName.split(' ')[0]}
                              </div>
                            )}
                          </motion.button>
                        ))}
                    </div>
                  </div>

                  {/* Booked Time Slots (for context) */}
                  {timeSlots.filter(slot => !slot.available).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-3">
                        Optaget ({timeSlots.filter(slot => !slot.available).length} ikke tilgængelige)
                      </h4>
                      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1">
                        {timeSlots
                          .filter(slot => !slot.available)
                          .slice(0, 10) // Show only first 10 for space
                          .map(slot => (
                            <div
                              key={slot.time}
                              className="p-2 bg-red-50 text-red-400 text-center rounded text-xs font-medium cursor-not-allowed"
                            >
                              {slot.time}
                            </div>
                          ))}
                        {timeSlots.filter(slot => !slot.available).length > 10 && (
                          <div className="p-2 bg-gray-50 text-gray-400 text-center rounded text-xs">
                            +{timeSlots.filter(slot => !slot.available).length - 10}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </AnimatePresence>
            )}
          </div>

          {/* Selected Time Summary */}
          {selectedDate && selectedTime && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-brand-accent/30 border-t border-brand-secondary p-6"
            >
              <h4 className="text-sm font-medium text-brand-dark mb-2">Din valgte tid:</h4>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-brand-primary">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">
                      {format(selectedDate, 'EEEE d. MMMM', { locale: da })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-brand-primary">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">{selectedTime}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4" />
                  <span>JLI Studio</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};