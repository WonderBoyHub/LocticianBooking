import React, { useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import {
  selectCalendarView,
  selectCalendarLoading,
  selectCalendarError,
  setCalendarLoading,
  setCalendarError,
} from '../../store/slices/calendarSlice';
import { CalendarHeader } from './CalendarHeader';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { AgendaView } from './AgendaView';
import { LoadingSpinner } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';

export const Calendar: React.FC = () => {
  const dispatch = useAppDispatch();
  const view = useAppSelector(selectCalendarView);
  const isLoading = useAppSelector(selectCalendarLoading);
  const error = useAppSelector(selectCalendarError);

  // Clear any errors on mount
  useEffect(() => {
    if (error) {
      dispatch(setCalendarError(null));
    }
  }, [dispatch, error]);

  const renderView = () => {
    const viewVariants = {
      hidden: { opacity: 0, x: 20 },
      visible: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -20 },
    };

    switch (view) {
      case 'month':
        return (
          <motion.div
            key="month"
            variants={viewVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            <MonthView />
          </motion.div>
        );
      case 'week':
        return (
          <motion.div
            key="week"
            variants={viewVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            <WeekView />
          </motion.div>
        );
      case 'day':
        return (
          <motion.div
            key="day"
            variants={viewVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            <DayView />
          </motion.div>
        );
      case 'agenda':
        return (
          <motion.div
            key="agenda"
            variants={viewVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            <AgendaView />
          </motion.div>
        );
      default:
        return <MonthView />;
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Calendar Error</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => dispatch(setCalendarError(null))}
            className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-dark transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200">
        <CalendarHeader />

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {renderView()}
          </AnimatePresence>
        )}
      </div>
    </DndProvider>
  );
};