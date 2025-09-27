import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Appointment, Service, User, Availability, TimeSlot, DaySchedule } from '../../types';

interface StaffState {
  // Personal Dashboard
  dashboard: {
    todayAppointments: Appointment[];
    upcomingAppointments: Appointment[];
    stats: {
      todayBookings: number;
      weeklyBookings: number;
      monthlyRevenue: number;
      completionRate: number;
    };
    loading: boolean;
    error: string | null;
  };

  // Calendar Management
  calendar: {
    view: 'month' | 'week' | 'day';
    selectedDate: string;
    appointments: Appointment[];
    availability: Availability[];
    schedule: DaySchedule[];
    loading: boolean;
    error: string | null;
    filters: {
      status?: string[];
      serviceId?: string;
      dateRange?: { start: string; end: string };
    };
  };

  // Appointment Management
  appointments: {
    items: Appointment[];
    selectedAppointment: Appointment | null;
    loading: boolean;
    error: string | null;
    creating: boolean;
    updating: boolean;
  };

  // Customer Management
  customers: {
    items: User[];
    selectedCustomer: User | null;
    loading: boolean;
    error: string | null;
    searchQuery: string;
    filters: {
      status?: 'active' | 'inactive';
      bookingHistory?: 'recent' | 'frequent' | 'first-time';
    };
  };

  // Service Management
  services: {
    myServices: Service[];
    selectedService: Service | null;
    loading: boolean;
    error: string | null;
    creating: boolean;
    updating: boolean;
  };

  // Availability Management
  availability: {
    patterns: Availability[];
    overrides: Availability[];
    selectedPattern: Availability | null;
    loading: boolean;
    error: string | null;
    creating: boolean;
    updating: boolean;
  };

  // Communication
  communication: {
    notifications: {
      id: string;
      type: 'booking_request' | 'booking_cancelled' | 'reminder' | 'message';
      title: string;
      message: string;
      read: boolean;
      timestamp: string;
      relatedId?: string;
    }[];
    messages: {
      id: string;
      customerId: string;
      customerName: string;
      lastMessage: string;
      timestamp: string;
      unread: boolean;
    }[];
    loading: boolean;
  };

  // Analytics
  analytics: {
    period: 'week' | 'month' | 'quarter' | 'year';
    data: {
      bookings: {
        total: number;
        completed: number;
        cancelled: number;
        noShows: number;
        trend: { date: string; value: number }[];
      };
      revenue: {
        total: number;
        trend: { date: string; value: number }[];
        byService: { serviceId: string; serviceName: string; revenue: number }[];
      };
      customers: {
        new: number;
        returning: number;
        satisfaction: number;
      };
      timeSlots: {
        busiest: string[];
        availability: number;
      };
    } | null;
    loading: boolean;
    error: string | null;
  };

  // UI State
  ui: {
    activeTab: 'dashboard' | 'calendar' | 'appointments' | 'customers' | 'services' | 'availability' | 'analytics';
    showAppointmentModal: boolean;
    showServiceModal: boolean;
    showAvailabilityModal: boolean;
    showCustomerDetails: boolean;
    sidebarCollapsed: boolean;
  };
}

const initialState: StaffState = {
  dashboard: {
    todayAppointments: [],
    upcomingAppointments: [],
    stats: {
      todayBookings: 0,
      weeklyBookings: 0,
      monthlyRevenue: 0,
      completionRate: 0
    },
    loading: false,
    error: null
  },
  calendar: {
    view: 'week',
    selectedDate: new Date().toISOString().split('T')[0],
    appointments: [],
    availability: [],
    schedule: [],
    loading: false,
    error: null,
    filters: {}
  },
  appointments: {
    items: [],
    selectedAppointment: null,
    loading: false,
    error: null,
    creating: false,
    updating: false
  },
  customers: {
    items: [],
    selectedCustomer: null,
    loading: false,
    error: null,
    searchQuery: '',
    filters: {}
  },
  services: {
    myServices: [],
    selectedService: null,
    loading: false,
    error: null,
    creating: false,
    updating: false
  },
  availability: {
    patterns: [],
    overrides: [],
    selectedPattern: null,
    loading: false,
    error: null,
    creating: false,
    updating: false
  },
  communication: {
    notifications: [],
    messages: [],
    loading: false
  },
  analytics: {
    period: 'month',
    data: null,
    loading: false,
    error: null
  },
  ui: {
    activeTab: 'dashboard',
    showAppointmentModal: false,
    showServiceModal: false,
    showAvailabilityModal: false,
    showCustomerDetails: false,
    sidebarCollapsed: false
  }
};

const staffSlice = createSlice({
  name: 'staff',
  initialState,
  reducers: {
    // Dashboard
    setDashboardLoading: (state, action: PayloadAction<boolean>) => {
      state.dashboard.loading = action.payload;
    },
    setTodayAppointments: (state, action: PayloadAction<Appointment[]>) => {
      state.dashboard.todayAppointments = action.payload;
    },
    setUpcomingAppointments: (state, action: PayloadAction<Appointment[]>) => {
      state.dashboard.upcomingAppointments = action.payload;
    },
    setDashboardStats: (state, action: PayloadAction<StaffState['dashboard']['stats']>) => {
      state.dashboard.stats = action.payload;
    },
    setDashboardError: (state, action: PayloadAction<string>) => {
      state.dashboard.error = action.payload;
      state.dashboard.loading = false;
    },

    // Calendar
    setCalendarView: (state, action: PayloadAction<'month' | 'week' | 'day'>) => {
      state.calendar.view = action.payload;
    },
    setSelectedDate: (state, action: PayloadAction<string>) => {
      state.calendar.selectedDate = action.payload;
    },
    setCalendarLoading: (state, action: PayloadAction<boolean>) => {
      state.calendar.loading = action.payload;
    },
    setCalendarAppointments: (state, action: PayloadAction<Appointment[]>) => {
      state.calendar.appointments = action.payload;
      state.calendar.loading = false;
      state.calendar.error = null;
    },
    setCalendarAvailability: (state, action: PayloadAction<Availability[]>) => {
      state.calendar.availability = action.payload;
    },
    setCalendarSchedule: (state, action: PayloadAction<DaySchedule[]>) => {
      state.calendar.schedule = action.payload;
    },
    setCalendarFilters: (state, action: PayloadAction<StaffState['calendar']['filters']>) => {
      state.calendar.filters = { ...state.calendar.filters, ...action.payload };
    },
    setCalendarError: (state, action: PayloadAction<string>) => {
      state.calendar.error = action.payload;
      state.calendar.loading = false;
    },

    // Appointments
    setAppointmentsLoading: (state, action: PayloadAction<boolean>) => {
      state.appointments.loading = action.payload;
    },
    setAppointments: (state, action: PayloadAction<Appointment[]>) => {
      state.appointments.items = action.payload;
      state.appointments.loading = false;
      state.appointments.error = null;
    },
    setSelectedAppointment: (state, action: PayloadAction<Appointment | null>) => {
      state.appointments.selectedAppointment = action.payload;
    },
    addAppointment: (state, action: PayloadAction<Appointment>) => {
      state.appointments.items.unshift(action.payload);
      state.appointments.creating = false;
    },
    updateAppointment: (state, action: PayloadAction<Appointment>) => {
      const index = state.appointments.items.findIndex(apt => apt.id === action.payload.id);
      if (index !== -1) {
        state.appointments.items[index] = action.payload;
      }
      state.appointments.updating = false;
    },
    removeAppointment: (state, action: PayloadAction<string>) => {
      state.appointments.items = state.appointments.items.filter(apt => apt.id !== action.payload);
    },
    setAppointmentCreating: (state, action: PayloadAction<boolean>) => {
      state.appointments.creating = action.payload;
    },
    setAppointmentUpdating: (state, action: PayloadAction<boolean>) => {
      state.appointments.updating = action.payload;
    },
    setAppointmentsError: (state, action: PayloadAction<string>) => {
      state.appointments.error = action.payload;
      state.appointments.loading = false;
      state.appointments.creating = false;
      state.appointments.updating = false;
    },

    // Customers
    setCustomersLoading: (state, action: PayloadAction<boolean>) => {
      state.customers.loading = action.payload;
    },
    setCustomers: (state, action: PayloadAction<User[]>) => {
      state.customers.items = action.payload;
      state.customers.loading = false;
      state.customers.error = null;
    },
    setSelectedCustomer: (state, action: PayloadAction<User | null>) => {
      state.customers.selectedCustomer = action.payload;
    },
    setCustomerSearchQuery: (state, action: PayloadAction<string>) => {
      state.customers.searchQuery = action.payload;
    },
    setCustomerFilters: (state, action: PayloadAction<StaffState['customers']['filters']>) => {
      state.customers.filters = { ...state.customers.filters, ...action.payload };
    },
    setCustomersError: (state, action: PayloadAction<string>) => {
      state.customers.error = action.payload;
      state.customers.loading = false;
    },

    // Services
    setServicesLoading: (state, action: PayloadAction<boolean>) => {
      state.services.loading = action.payload;
    },
    setMyServices: (state, action: PayloadAction<Service[]>) => {
      state.services.myServices = action.payload;
      state.services.loading = false;
      state.services.error = null;
    },
    setSelectedService: (state, action: PayloadAction<Service | null>) => {
      state.services.selectedService = action.payload;
    },
    addService: (state, action: PayloadAction<Service>) => {
      state.services.myServices.unshift(action.payload);
      state.services.creating = false;
    },
    updateService: (state, action: PayloadAction<Service>) => {
      const index = state.services.myServices.findIndex(service => service.id === action.payload.id);
      if (index !== -1) {
        state.services.myServices[index] = action.payload;
      }
      state.services.updating = false;
    },
    removeService: (state, action: PayloadAction<string>) => {
      state.services.myServices = state.services.myServices.filter(service => service.id !== action.payload);
    },
    setServiceCreating: (state, action: PayloadAction<boolean>) => {
      state.services.creating = action.payload;
    },
    setServiceUpdating: (state, action: PayloadAction<boolean>) => {
      state.services.updating = action.payload;
    },
    setServicesError: (state, action: PayloadAction<string>) => {
      state.services.error = action.payload;
      state.services.loading = false;
      state.services.creating = false;
      state.services.updating = false;
    },

    // Availability
    setAvailabilityLoading: (state, action: PayloadAction<boolean>) => {
      state.availability.loading = action.payload;
    },
    setAvailabilityPatterns: (state, action: PayloadAction<Availability[]>) => {
      state.availability.patterns = action.payload;
    },
    setAvailabilityOverrides: (state, action: PayloadAction<Availability[]>) => {
      state.availability.overrides = action.payload;
    },
    setSelectedPattern: (state, action: PayloadAction<Availability | null>) => {
      state.availability.selectedPattern = action.payload;
    },
    addAvailabilityPattern: (state, action: PayloadAction<Availability>) => {
      state.availability.patterns.push(action.payload);
      state.availability.creating = false;
    },
    updateAvailabilityPattern: (state, action: PayloadAction<Availability>) => {
      const index = state.availability.patterns.findIndex(pattern => pattern.id === action.payload.id);
      if (index !== -1) {
        state.availability.patterns[index] = action.payload;
      }
      state.availability.updating = false;
    },
    removeAvailabilityPattern: (state, action: PayloadAction<string>) => {
      state.availability.patterns = state.availability.patterns.filter(pattern => pattern.id !== action.payload);
    },
    setAvailabilityCreating: (state, action: PayloadAction<boolean>) => {
      state.availability.creating = action.payload;
    },
    setAvailabilityUpdating: (state, action: PayloadAction<boolean>) => {
      state.availability.updating = action.payload;
    },
    setAvailabilityError: (state, action: PayloadAction<string>) => {
      state.availability.error = action.payload;
      state.availability.loading = false;
      state.availability.creating = false;
      state.availability.updating = false;
    },

    // Communication
    setCommunicationLoading: (state, action: PayloadAction<boolean>) => {
      state.communication.loading = action.payload;
    },
    setNotifications: (state, action: PayloadAction<StaffState['communication']['notifications']>) => {
      state.communication.notifications = action.payload;
    },
    addNotification: (state, action: PayloadAction<StaffState['communication']['notifications'][0]>) => {
      state.communication.notifications.unshift(action.payload);
    },
    markNotificationRead: (state, action: PayloadAction<string>) => {
      const notification = state.communication.notifications.find(n => n.id === action.payload);
      if (notification) {
        notification.read = true;
      }
    },
    setMessages: (state, action: PayloadAction<StaffState['communication']['messages']>) => {
      state.communication.messages = action.payload;
    },

    // Analytics
    setAnalyticsPeriod: (state, action: PayloadAction<'week' | 'month' | 'quarter' | 'year'>) => {
      state.analytics.period = action.payload;
    },
    setAnalyticsLoading: (state, action: PayloadAction<boolean>) => {
      state.analytics.loading = action.payload;
    },
    setAnalyticsData: (state, action: PayloadAction<StaffState['analytics']['data']>) => {
      state.analytics.data = action.payload;
      state.analytics.loading = false;
      state.analytics.error = null;
    },
    setAnalyticsError: (state, action: PayloadAction<string>) => {
      state.analytics.error = action.payload;
      state.analytics.loading = false;
    },

    // UI
    setActiveTab: (state, action: PayloadAction<StaffState['ui']['activeTab']>) => {
      state.ui.activeTab = action.payload;
    },
    setShowAppointmentModal: (state, action: PayloadAction<boolean>) => {
      state.ui.showAppointmentModal = action.payload;
    },
    setShowServiceModal: (state, action: PayloadAction<boolean>) => {
      state.ui.showServiceModal = action.payload;
    },
    setShowAvailabilityModal: (state, action: PayloadAction<boolean>) => {
      state.ui.showAvailabilityModal = action.payload;
    },
    setShowCustomerDetails: (state, action: PayloadAction<boolean>) => {
      state.ui.showCustomerDetails = action.payload;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.ui.sidebarCollapsed = action.payload;
    },

    // Utility
    clearErrors: (state) => {
      state.dashboard.error = null;
      state.calendar.error = null;
      state.appointments.error = null;
      state.customers.error = null;
      state.services.error = null;
      state.availability.error = null;
      state.analytics.error = null;
    },
    resetSelections: (state) => {
      state.appointments.selectedAppointment = null;
      state.customers.selectedCustomer = null;
      state.services.selectedService = null;
      state.availability.selectedPattern = null;
    }
  }
});

export const {
  // Dashboard
  setDashboardLoading,
  setTodayAppointments,
  setUpcomingAppointments,
  setDashboardStats,
  setDashboardError,

  // Calendar
  setCalendarView,
  setSelectedDate,
  setCalendarLoading,
  setCalendarAppointments,
  setCalendarAvailability,
  setCalendarSchedule,
  setCalendarFilters,
  setCalendarError,

  // Appointments
  setAppointmentsLoading,
  setAppointments,
  setSelectedAppointment,
  addAppointment,
  updateAppointment,
  removeAppointment,
  setAppointmentCreating,
  setAppointmentUpdating,
  setAppointmentsError,

  // Customers
  setCustomersLoading,
  setCustomers,
  setSelectedCustomer,
  setCustomerSearchQuery,
  setCustomerFilters,
  setCustomersError,

  // Services
  setServicesLoading,
  setMyServices,
  setSelectedService,
  addService,
  updateService,
  removeService,
  setServiceCreating,
  setServiceUpdating,
  setServicesError,

  // Availability
  setAvailabilityLoading,
  setAvailabilityPatterns,
  setAvailabilityOverrides,
  setSelectedPattern,
  addAvailabilityPattern,
  updateAvailabilityPattern,
  removeAvailabilityPattern,
  setAvailabilityCreating,
  setAvailabilityUpdating,
  setAvailabilityError,

  // Communication
  setCommunicationLoading,
  setNotifications,
  addNotification,
  markNotificationRead,
  setMessages,

  // Analytics
  setAnalyticsPeriod,
  setAnalyticsLoading,
  setAnalyticsData,
  setAnalyticsError,

  // UI
  setActiveTab,
  setShowAppointmentModal,
  setShowServiceModal,
  setShowAvailabilityModal,
  setShowCustomerDetails,
  setSidebarCollapsed,

  // Utility
  clearErrors,
  resetSelections
} = staffSlice.actions;

// Selectors
export const selectDashboardData = (state: { staff: StaffState }) => state.staff.dashboard;
export const selectCalendarData = (state: { staff: StaffState }) => state.staff.calendar;
export const selectAppointmentsData = (state: { staff: StaffState }) => state.staff.appointments;
export const selectCustomersData = (state: { staff: StaffState }) => state.staff.customers;
export const selectServicesData = (state: { staff: StaffState }) => state.staff.services;
export const selectAvailabilityData = (state: { staff: StaffState }) => state.staff.availability;
export const selectCommunicationData = (state: { staff: StaffState }) => state.staff.communication;
export const selectAnalyticsData = (state: { staff: StaffState }) => state.staff.analytics;
export const selectStaffUI = (state: { staff: StaffState }) => state.staff.ui;

export default staffSlice.reducer;