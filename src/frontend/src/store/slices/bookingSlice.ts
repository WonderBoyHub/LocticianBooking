import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Service, BookingFormData, TimeSlot } from '../../types';

interface BookingState {
  currentBooking: {
    step: 'service' | 'datetime' | 'details' | 'confirmation';
    selectedService: Service | null;
    selectedDate: string | null;
    selectedTime: string | null;
    customerInfo: {
      name: string;
      email: string;
      phone: string;
      notes: string;
    };
    locticianId: string | null;
  };
  availableSlots: TimeSlot[];
  isLoading: boolean;
  error: string | null;
  bookingHistory: any[];
}

const initialState: BookingState = {
  currentBooking: {
    step: 'service',
    selectedService: null,
    selectedDate: null,
    selectedTime: null,
    customerInfo: {
      name: '',
      email: '',
      phone: '',
      notes: '',
    },
    locticianId: null,
  },
  availableSlots: [],
  isLoading: false,
  error: null,
  bookingHistory: [],
};

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    setBookingStep: (
      state,
      action: PayloadAction<'service' | 'datetime' | 'details' | 'confirmation'>
    ) => {
      state.currentBooking.step = action.payload;
    },
    selectService: (state, action: PayloadAction<Service>) => {
      state.currentBooking.selectedService = action.payload;
      state.currentBooking.locticianId = action.payload.locticianId;
      // Reset time selection when service changes
      state.currentBooking.selectedTime = null;
      state.availableSlots = [];
    },
    selectDate: (state, action: PayloadAction<string>) => {
      state.currentBooking.selectedDate = action.payload;
      // Reset time selection when date changes
      state.currentBooking.selectedTime = null;
    },
    selectTime: (state, action: PayloadAction<string>) => {
      state.currentBooking.selectedTime = action.payload;
    },
    updateCustomerInfo: (
      state,
      action: PayloadAction<Partial<BookingState['currentBooking']['customerInfo']>>
    ) => {
      state.currentBooking.customerInfo = {
        ...state.currentBooking.customerInfo,
        ...action.payload,
      };
    },
    setAvailableSlots: (state, action: PayloadAction<TimeSlot[]>) => {
      state.availableSlots = action.payload;
    },
    setBookingLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setBookingError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    resetBooking: (state) => {
      state.currentBooking = initialState.currentBooking;
      state.availableSlots = [];
      state.error = null;
    },
    nextStep: (state) => {
      const steps: Array<'service' | 'datetime' | 'details' | 'confirmation'> = [
        'service',
        'datetime',
        'details',
        'confirmation',
      ];
      const currentIndex = steps.indexOf(state.currentBooking.step);
      if (currentIndex < steps.length - 1) {
        state.currentBooking.step = steps[currentIndex + 1];
      }
    },
    previousStep: (state) => {
      const steps: Array<'service' | 'datetime' | 'details' | 'confirmation'> = [
        'service',
        'datetime',
        'details',
        'confirmation',
      ];
      const currentIndex = steps.indexOf(state.currentBooking.step);
      if (currentIndex > 0) {
        state.currentBooking.step = steps[currentIndex - 1];
      }
    },
    setBookingHistory: (state, action: PayloadAction<any[]>) => {
      state.bookingHistory = action.payload;
    },
  },
});

export const {
  setBookingStep,
  selectService,
  selectDate,
  selectTime,
  updateCustomerInfo,
  setAvailableSlots,
  setBookingLoading,
  setBookingError,
  resetBooking,
  nextStep,
  previousStep,
  setBookingHistory,
} = bookingSlice.actions;

export default bookingSlice.reducer;

// Selectors
export const selectCurrentBooking = (state: { booking: BookingState }) =>
  state.booking.currentBooking;
export const selectBookingStep = (state: { booking: BookingState }) =>
  state.booking.currentBooking.step;
export const selectSelectedService = (state: { booking: BookingState }) =>
  state.booking.currentBooking.selectedService;
export const selectSelectedDate = (state: { booking: BookingState }) =>
  state.booking.currentBooking.selectedDate;
export const selectSelectedTime = (state: { booking: BookingState }) =>
  state.booking.currentBooking.selectedTime;
export const selectCustomerInfo = (state: { booking: BookingState }) =>
  state.booking.currentBooking.customerInfo;
export const selectAvailableSlots = (state: { booking: BookingState }) =>
  state.booking.availableSlots;
export const selectBookingLoading = (state: { booking: BookingState }) =>
  state.booking.isLoading;
export const selectBookingError = (state: { booking: BookingState }) => state.booking.error;
export const selectBookingHistory = (state: { booking: BookingState }) =>
  state.booking.bookingHistory;