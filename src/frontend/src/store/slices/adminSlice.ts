import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User, Service, ServiceCategory, AnalyticsData } from '../../types';

interface AdminState {
  // User Management
  users: {
    items: User[];
    loading: boolean;
    error: string | null;
    selectedUser: User | null;
    filters: {
      role?: 'customer' | 'loctician' | 'admin';
      status?: 'active' | 'inactive';
      search?: string;
    };
  };

  // Service Management
  services: {
    items: Service[];
    categories: ServiceCategory[];
    loading: boolean;
    error: string | null;
    selectedService: Service | null;
    selectedCategory: ServiceCategory | null;
  };

  // System Analytics
  analytics: {
    data: AnalyticsData | null;
    loading: boolean;
    error: string | null;
    dateRange: {
      start: string;
      end: string;
    };
  };

  // System Settings
  settings: {
    businessInfo: {
      name: string;
      description: string;
      address: string;
      phone: string;
      email: string;
      website?: string;
      socialMedia?: {
        instagram?: string;
        facebook?: string;
        tiktok?: string;
      };
    };
    workingHours: {
      [key: string]: {
        isOpen: boolean;
        openTime: string;
        closeTime: string;
        breaks?: { start: string; end: string }[];
      };
    };
    bookingSettings: {
      allowGuestBooking: boolean;
      advanceBookingDays: number;
      cancelationPolicy: string;
      reminderSettings: {
        email: boolean;
        sms: boolean;
        beforeHours: number[];
      };
    };
    paymentSettings: {
      enableOnlinePayment: boolean;
      depositRequired: boolean;
      depositPercentage: number;
      acceptedMethods: string[];
    };
    loading: boolean;
    error: string | null;
  };

  // Dashboard
  dashboard: {
    stats: {
      totalUsers: number;
      totalBookings: number;
      totalRevenue: number;
      activeServices: number;
    };
    recentActivity: {
      id: string;
      type: 'user_registered' | 'booking_created' | 'service_updated' | 'payment_received';
      description: string;
      timestamp: string;
      userId?: string;
      metadata?: Record<string, any>;
    }[];
    loading: boolean;
    error: string | null;
  };
}

const initialState: AdminState = {
  users: {
    items: [],
    loading: false,
    error: null,
    selectedUser: null,
    filters: {}
  },
  services: {
    items: [],
    categories: [],
    loading: false,
    error: null,
    selectedService: null,
    selectedCategory: null
  },
  analytics: {
    data: null,
    loading: false,
    error: null,
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    }
  },
  settings: {
    businessInfo: {
      name: 'Joli Locs',
      description: 'Professional loctician services',
      address: '',
      phone: '',
      email: '',
    },
    workingHours: {
      monday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      tuesday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      wednesday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      thursday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      friday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      saturday: { isOpen: true, openTime: '10:00', closeTime: '16:00' },
      sunday: { isOpen: false, openTime: '10:00', closeTime: '16:00' }
    },
    bookingSettings: {
      allowGuestBooking: true,
      advanceBookingDays: 30,
      cancelationPolicy: 'Cancellations must be made at least 24 hours in advance.',
      reminderSettings: {
        email: true,
        sms: true,
        beforeHours: [24, 2]
      }
    },
    paymentSettings: {
      enableOnlinePayment: true,
      depositRequired: true,
      depositPercentage: 50,
      acceptedMethods: ['card', 'mobilepay']
    },
    loading: false,
    error: null
  },
  dashboard: {
    stats: {
      totalUsers: 0,
      totalBookings: 0,
      totalRevenue: 0,
      activeServices: 0
    },
    recentActivity: [],
    loading: false,
    error: null
  }
};

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    // User Management
    setUsersLoading: (state, action: PayloadAction<boolean>) => {
      state.users.loading = action.payload;
    },
    setUsers: (state, action: PayloadAction<User[]>) => {
      state.users.items = action.payload;
      state.users.loading = false;
      state.users.error = null;
    },
    setUsersError: (state, action: PayloadAction<string>) => {
      state.users.error = action.payload;
      state.users.loading = false;
    },
    setSelectedUser: (state, action: PayloadAction<User | null>) => {
      state.users.selectedUser = action.payload;
    },
    setUserFilters: (state, action: PayloadAction<AdminState['users']['filters']>) => {
      state.users.filters = { ...state.users.filters, ...action.payload };
    },
    addUser: (state, action: PayloadAction<User>) => {
      state.users.items.unshift(action.payload);
    },
    updateUser: (state, action: PayloadAction<User>) => {
      const index = state.users.items.findIndex(user => user.id === action.payload.id);
      if (index !== -1) {
        state.users.items[index] = action.payload;
      }
    },
    removeUser: (state, action: PayloadAction<string>) => {
      state.users.items = state.users.items.filter(user => user.id !== action.payload);
    },

    // Service Management
    setServicesLoading: (state, action: PayloadAction<boolean>) => {
      state.services.loading = action.payload;
    },
    setServices: (state, action: PayloadAction<Service[]>) => {
      state.services.items = action.payload;
      state.services.loading = false;
      state.services.error = null;
    },
    setServiceCategories: (state, action: PayloadAction<ServiceCategory[]>) => {
      state.services.categories = action.payload;
    },
    setServicesError: (state, action: PayloadAction<string>) => {
      state.services.error = action.payload;
      state.services.loading = false;
    },
    setSelectedService: (state, action: PayloadAction<Service | null>) => {
      state.services.selectedService = action.payload;
    },
    setSelectedCategory: (state, action: PayloadAction<ServiceCategory | null>) => {
      state.services.selectedCategory = action.payload;
    },
    addService: (state, action: PayloadAction<Service>) => {
      state.services.items.unshift(action.payload);
    },
    updateService: (state, action: PayloadAction<Service>) => {
      const index = state.services.items.findIndex(service => service.id === action.payload.id);
      if (index !== -1) {
        state.services.items[index] = action.payload;
      }
    },
    removeService: (state, action: PayloadAction<string>) => {
      state.services.items = state.services.items.filter(service => service.id !== action.payload);
    },

    // Analytics
    setAnalyticsLoading: (state, action: PayloadAction<boolean>) => {
      state.analytics.loading = action.payload;
    },
    setAnalyticsData: (state, action: PayloadAction<AnalyticsData>) => {
      state.analytics.data = action.payload;
      state.analytics.loading = false;
      state.analytics.error = null;
    },
    setAnalyticsError: (state, action: PayloadAction<string>) => {
      state.analytics.error = action.payload;
      state.analytics.loading = false;
    },
    setAnalyticsDateRange: (state, action: PayloadAction<{ start: string; end: string }>) => {
      state.analytics.dateRange = action.payload;
    },

    // Settings
    setSettingsLoading: (state, action: PayloadAction<boolean>) => {
      state.settings.loading = action.payload;
    },
    updateBusinessInfo: (state, action: PayloadAction<Partial<AdminState['settings']['businessInfo']>>) => {
      state.settings.businessInfo = { ...state.settings.businessInfo, ...action.payload };
    },
    updateWorkingHours: (state, action: PayloadAction<AdminState['settings']['workingHours']>) => {
      state.settings.workingHours = action.payload;
    },
    updateBookingSettings: (state, action: PayloadAction<Partial<AdminState['settings']['bookingSettings']>>) => {
      state.settings.bookingSettings = { ...state.settings.bookingSettings, ...action.payload };
    },
    updatePaymentSettings: (state, action: PayloadAction<Partial<AdminState['settings']['paymentSettings']>>) => {
      state.settings.paymentSettings = { ...state.settings.paymentSettings, ...action.payload };
    },
    setSettingsError: (state, action: PayloadAction<string>) => {
      state.settings.error = action.payload;
      state.settings.loading = false;
    },

    // Dashboard
    setDashboardLoading: (state, action: PayloadAction<boolean>) => {
      state.dashboard.loading = action.payload;
    },
    setDashboardStats: (state, action: PayloadAction<AdminState['dashboard']['stats']>) => {
      state.dashboard.stats = action.payload;
    },
    setRecentActivity: (state, action: PayloadAction<AdminState['dashboard']['recentActivity']>) => {
      state.dashboard.recentActivity = action.payload;
    },
    addRecentActivity: (state, action: PayloadAction<AdminState['dashboard']['recentActivity'][0]>) => {
      state.dashboard.recentActivity.unshift(action.payload);
      if (state.dashboard.recentActivity.length > 50) {
        state.dashboard.recentActivity = state.dashboard.recentActivity.slice(0, 50);
      }
    },
    setDashboardError: (state, action: PayloadAction<string>) => {
      state.dashboard.error = action.payload;
      state.dashboard.loading = false;
    },

    // Reset states
    resetUserSelection: (state) => {
      state.users.selectedUser = null;
    },
    resetServiceSelection: (state) => {
      state.services.selectedService = null;
      state.services.selectedCategory = null;
    },
    clearErrors: (state) => {
      state.users.error = null;
      state.services.error = null;
      state.analytics.error = null;
      state.settings.error = null;
      state.dashboard.error = null;
    }
  }
});

export const {
  // User Management
  setUsersLoading,
  setUsers,
  setUsersError,
  setSelectedUser,
  setUserFilters,
  addUser,
  updateUser,
  removeUser,

  // Service Management
  setServicesLoading,
  setServices,
  setServiceCategories,
  setServicesError,
  setSelectedService,
  setSelectedCategory,
  addService,
  updateService,
  removeService,

  // Analytics
  setAnalyticsLoading,
  setAnalyticsData,
  setAnalyticsError,
  setAnalyticsDateRange,

  // Settings
  setSettingsLoading,
  updateBusinessInfo,
  updateWorkingHours,
  updateBookingSettings,
  updatePaymentSettings,
  setSettingsError,

  // Dashboard
  setDashboardLoading,
  setDashboardStats,
  setRecentActivity,
  addRecentActivity,
  setDashboardError,

  // Utility
  resetUserSelection,
  resetServiceSelection,
  clearErrors
} = adminSlice.actions;

// Selectors
export const selectUsers = (state: { admin: AdminState }) => state.admin.users.items;
export const selectUsersLoading = (state: { admin: AdminState }) => state.admin.users.loading;
export const selectUsersError = (state: { admin: AdminState }) => state.admin.users.error;
export const selectSelectedUser = (state: { admin: AdminState }) => state.admin.users.selectedUser;
export const selectUserFilters = (state: { admin: AdminState }) => state.admin.users.filters;

export const selectServices = (state: { admin: AdminState }) => state.admin.services.items;
export const selectServiceCategories = (state: { admin: AdminState }) => state.admin.services.categories;
export const selectServicesLoading = (state: { admin: AdminState }) => state.admin.services.loading;
export const selectServicesError = (state: { admin: AdminState }) => state.admin.services.error;
export const selectSelectedService = (state: { admin: AdminState }) => state.admin.services.selectedService;
export const selectSelectedCategory = (state: { admin: AdminState }) => state.admin.services.selectedCategory;

export const selectAnalyticsData = (state: { admin: AdminState }) => state.admin.analytics.data;
export const selectAnalyticsLoading = (state: { admin: AdminState }) => state.admin.analytics.loading;
export const selectAnalyticsDateRange = (state: { admin: AdminState }) => state.admin.analytics.dateRange;

export const selectBusinessInfo = (state: { admin: AdminState }) => state.admin.settings.businessInfo;
export const selectWorkingHours = (state: { admin: AdminState }) => state.admin.settings.workingHours;
export const selectBookingSettings = (state: { admin: AdminState }) => state.admin.settings.bookingSettings;
export const selectPaymentSettings = (state: { admin: AdminState }) => state.admin.settings.paymentSettings;
export const selectSettingsLoading = (state: { admin: AdminState }) => state.admin.settings.loading;

export const selectDashboardStats = (state: { admin: AdminState }) => state.admin.dashboard.stats;
export const selectRecentActivity = (state: { admin: AdminState }) => state.admin.dashboard.recentActivity;
export const selectDashboardLoading = (state: { admin: AdminState }) => state.admin.dashboard.loading;

export default adminSlice.reducer;