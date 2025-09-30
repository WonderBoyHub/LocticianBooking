import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api } from './api';
import authSlice from './slices/authSlice';
import uiSlice from './slices/uiSlice';
import bookingSlice from './slices/bookingSlice';
import calendarSlice from './slices/calendarSlice';
import adminSlice from './slices/adminSlice';
import staffSlice from './slices/staffSlice';
import customerSlice from './slices/customerSlice';

export const store = configureStore({
  reducer: {
    // RTK Query API slice
    api: api.reducer,

    // Feature slices
    auth: authSlice,
    ui: uiSlice,
    booking: bookingSlice,
    calendar: calendarSlice,

    // Role-specific slices
    admin: adminSlice,
    staff: staffSlice,
    customer: customerSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }).concat(api.middleware),
  devTools: process.env.NODE_ENV !== 'production',
});

// Enable listener behavior for the store
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export hooks for use in components
export { useAppDispatch, useAppSelector } from './hooks';
