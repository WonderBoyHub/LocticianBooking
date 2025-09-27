import React from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '../ui';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectCalendarView,
  selectCurrentDate,
  setView,
  navigateNext,
  navigatePrevious,
  navigateToday,
} from '../../store/slices/calendarSlice';
import { format } from 'date-fns';
import { da, enUS } from 'date-fns/locale';

export const CalendarHeader: React.FC = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const view = useAppSelector(selectCalendarView);
  const currentDate = useAppSelector(selectCurrentDate);

  const locale = i18n.language === 'da' ? da : enUS;

  const handleViewChange = (newView: 'month' | 'week' | 'day' | 'agenda') => {
    dispatch(setView(newView));
  };

  const handleNavigateNext = () => {
    dispatch(navigateNext());
  };

  const handleNavigatePrevious = () => {
    dispatch(navigatePrevious());
  };

  const handleNavigateToday = () => {
    dispatch(navigateToday());
  };

  const getFormattedDate = () => {
    const date = new Date(currentDate);

    switch (view) {
      case 'month':
        return format(date, 'MMMM yyyy', { locale });
      case 'week':
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return `${format(startOfWeek, 'd MMM', { locale })} - ${format(endOfWeek, 'd MMM yyyy', { locale })}`;
      case 'day':
        return format(date, 'EEEE, d MMMM yyyy', { locale });
      case 'agenda':
        return format(date, 'MMMM yyyy', { locale });
      default:
        return format(date, 'MMMM yyyy', { locale });
    }
  };

  const viewButtons = [
    { key: 'month', label: t('calendar.views.month') },
    { key: 'week', label: t('calendar.views.week') },
    { key: 'day', label: t('calendar.views.day') },
    { key: 'agenda', label: t('calendar.views.agenda') },
  ] as const;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border-b border-brown-200 space-y-4 sm:space-y-0">
      {/* Left section: Navigation */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleNavigatePrevious}
            className="!p-2"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNavigateNext}
            className="!p-2"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNavigateToday}
            className="ml-2"
          >
            {t('calendar.navigation.today')}
          </Button>
        </div>

        <h1 className="text-xl font-semibold text-brand-dark">
          {getFormattedDate()}
        </h1>
      </div>

      {/* Right section: View selector */}
      <div className="flex items-center space-x-2">
        <div className="flex bg-brand-accent rounded-lg p-1">
          {viewButtons.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleViewChange(key)}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200',
                view === key
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-brand-dark hover:bg-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};