import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Appointment, CalendarEvent, Availability } from '../../types';

interface CalendarState {
  view: 'month' | 'week' | 'day' | 'agenda';
  currentDate: string;
  selectedDate: string | null;
  appointments: Appointment[];
  availability: Availability[];
  events: CalendarEvent[];
  selectedEvent: CalendarEvent | null;
  draggedEvent: CalendarEvent | null;
  isLoading: boolean;
  error: string | null;
  filters: {
    status: string[];
    locticianId: string | null;
    serviceId: string | null;
  };
}

const today = new Date().toISOString().split('T')[0];

const initialState: CalendarState = {
  view: 'month',
  currentDate: today,
  selectedDate: null,
  appointments: [],
  availability: [],
  events: [],
  selectedEvent: null,
  draggedEvent: null,
  isLoading: false,
  error: null,
  filters: {
    status: [],
    locticianId: null,
    serviceId: null,
  },
};

const calendarSlice = createSlice({
  name: 'calendar',
  initialState,
  reducers: {
    setView: (state, action: PayloadAction<'month' | 'week' | 'day' | 'agenda'>) => {
      state.view = action.payload;
    },
    setCurrentDate: (state, action: PayloadAction<string>) => {
      state.currentDate = action.payload;
    },
    setSelectedDate: (state, action: PayloadAction<string | null>) => {
      state.selectedDate = action.payload;
    },
    navigateToDate: (state, action: PayloadAction<string>) => {
      state.currentDate = action.payload;
      state.selectedDate = action.payload;
    },
    navigateNext: (state) => {
      const current = new Date(state.currentDate);
      switch (state.view) {
        case 'month':
          current.setMonth(current.getMonth() + 1);
          break;
        case 'week':
          current.setDate(current.getDate() + 7);
          break;
        case 'day':
          current.setDate(current.getDate() + 1);
          break;
      }
      state.currentDate = current.toISOString().split('T')[0];
    },
    navigatePrevious: (state) => {
      const current = new Date(state.currentDate);
      switch (state.view) {
        case 'month':
          current.setMonth(current.getMonth() - 1);
          break;
        case 'week':
          current.setDate(current.getDate() - 7);
          break;
        case 'day':
          current.setDate(current.getDate() - 1);
          break;
      }
      state.currentDate = current.toISOString().split('T')[0];
    },
    navigateToday: (state) => {
      const today = new Date().toISOString().split('T')[0];
      state.currentDate = today;
      state.selectedDate = today;
    },
    setAppointments: (state, action: PayloadAction<Appointment[]>) => {
      state.appointments = action.payload;
      // Convert appointments to calendar events
      state.events = action.payload.map((appointment) => ({
        id: appointment.id,
        title: appointment.service?.name || 'Appointment',
        start: new Date(`${appointment.date}T${appointment.startTime}`),
        end: new Date(`${appointment.date}T${appointment.endTime}`),
        backgroundColor: getStatusColor(appointment.status),
        borderColor: getStatusColor(appointment.status),
        textColor: '#ffffff',
        extendedProps: {
          appointment,
          type: 'appointment' as const,
        },
      }));
    },
    setAvailability: (state, action: PayloadAction<Availability[]>) => {
      state.availability = action.payload;
    },
    setEvents: (state, action: PayloadAction<CalendarEvent[]>) => {
      state.events = action.payload;
    },
    addEvent: (state, action: PayloadAction<CalendarEvent>) => {
      state.events.push(action.payload);
    },
    updateEvent: (state, action: PayloadAction<CalendarEvent>) => {
      const index = state.events.findIndex((event) => event.id === action.payload.id);
      if (index !== -1) {
        state.events[index] = action.payload;
      }
    },
    removeEvent: (state, action: PayloadAction<string>) => {
      state.events = state.events.filter((event) => event.id !== action.payload);
    },
    setSelectedEvent: (state, action: PayloadAction<CalendarEvent | null>) => {
      state.selectedEvent = action.payload;
    },
    setDraggedEvent: (state, action: PayloadAction<CalendarEvent | null>) => {
      state.draggedEvent = action.payload;
    },
    setCalendarLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setCalendarError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setFilters: (
      state,
      action: PayloadAction<Partial<CalendarState['filters']>>
    ) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },
    clearSelectedEvent: (state) => {
      state.selectedEvent = null;
    },
  },
});

// Helper function to get status colors
function getStatusColor(status: string): string {
  const colors = {
    pending: '#F59E0B',
    confirmed: '#10B981',
    in_progress: '#3B82F6',
    completed: '#6B7280',
    cancelled: '#EF4444',
    no_show: '#EF4444',
  };
  return colors[status as keyof typeof colors] || '#6B7280';
}

export const {
  setView,
  setCurrentDate,
  setSelectedDate,
  navigateToDate,
  navigateNext,
  navigatePrevious,
  navigateToday,
  setAppointments,
  setAvailability,
  setEvents,
  addEvent,
  updateEvent,
  removeEvent,
  setSelectedEvent,
  setDraggedEvent,
  setCalendarLoading,
  setCalendarError,
  setFilters,
  resetFilters,
  clearSelectedEvent,
} = calendarSlice.actions;

export default calendarSlice.reducer;

// Selectors
export const selectCalendarView = (state: { calendar: CalendarState }) => state.calendar.view;
export const selectCurrentDate = (state: { calendar: CalendarState }) => state.calendar.currentDate;
export const selectSelectedDate = (state: { calendar: CalendarState }) => state.calendar.selectedDate;
export const selectAppointments = (state: { calendar: CalendarState }) => state.calendar.appointments;
export const selectAvailability = (state: { calendar: CalendarState }) => state.calendar.availability;
export const selectCalendarEvents = (state: { calendar: CalendarState }) => state.calendar.events;
export const selectSelectedEvent = (state: { calendar: CalendarState }) => state.calendar.selectedEvent;
export const selectDraggedEvent = (state: { calendar: CalendarState }) => state.calendar.draggedEvent;
export const selectCalendarLoading = (state: { calendar: CalendarState }) => state.calendar.isLoading;
export const selectCalendarError = (state: { calendar: CalendarState }) => state.calendar.error;
export const selectCalendarFilters = (state: { calendar: CalendarState }) => state.calendar.filters;