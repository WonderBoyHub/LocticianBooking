import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Service, ServiceCategory, Appointment, User, TimeSlot } from '../../types';

interface CustomerState {
  // Service Discovery
  services: {
    items: Service[];
    categories: ServiceCategory[];
    featuredServices: Service[];
    selectedService: Service | null;
    selectedCategory: ServiceCategory | null;
    loading: boolean;
    error: string | null;
    filters: {
      categoryId?: string;
      priceRange?: { min: number; max: number };
      duration?: { min: number; max: number };
      search?: string;
      locticianId?: string;
    };
    sortBy: 'name' | 'price' | 'duration' | 'popularity' | 'newest';
    sortOrder: 'asc' | 'desc';
  };

  // Booking Process
  booking: {
    step: 'service' | 'datetime' | 'details' | 'payment' | 'confirmation';
    selectedService: Service | null;
    selectedDate: string | null;
    selectedTime: string | null;
    customerInfo: {
      isGuest: boolean;
      name: string;
      email: string;
      phone: string;
      notes: string;
    };
    availableTimeSlots: TimeSlot[];
    blockedDates: string[];
    loading: boolean;
    submitting: boolean;
    error: string | null;
    confirmationData: {
      appointmentId: string;
      bookingReference: string;
    } | null;
  };

  // My Bookings
  myBookings: {
    upcoming: Appointment[];
    past: Appointment[];
    selectedBooking: Appointment | null;
    loading: boolean;
    error: string | null;
    filters: {
      status?: string[];
      dateRange?: { start: string; end: string };
      serviceId?: string;
    };
  };

  // Profile Management
  profile: {
    personalInfo: {
      name: string;
      email: string;
      phone: string;
      dateOfBirth?: string;
      address?: {
        street: string;
        city: string;
        postalCode: string;
        country: string;
      };
    };
    preferences: {
      language: 'da' | 'en';
      notifications: {
        email: boolean;
        sms: boolean;
        push: boolean;
      };
      timezone: string;
      favoriteServices: string[];
      preferredLocticians: string[];
    };
    bookingHistory: {
      totalBookings: number;
      completedBookings: number;
      memberSince: string;
      favoriteService?: string;
      loyaltyPoints: number;
    };
    loading: boolean;
    updating: boolean;
    error: string | null;
  };

  // Subscription Management (Molly Payment Integration)
  subscription: {
    active: boolean;
    plan: {
      id: string;
      name: string;
      price: number;
      currency: string;
      interval: 'monthly' | 'quarterly' | 'yearly';
      benefits: string[];
    } | null;
    nextPayment?: {
      amount: number;
      date: string;
    };
    paymentMethod: {
      type: 'card' | 'mobilepay' | 'bank';
      lastFour?: string;
      brand?: string;
    } | null;
    invoices: {
      id: string;
      date: string;
      amount: number;
      status: 'paid' | 'pending' | 'failed';
      downloadUrl: string;
    }[];
    loading: boolean;
    error: string | null;
  };

  // Reviews & Ratings
  reviews: {
    myReviews: {
      id: string;
      appointmentId: string;
      serviceId: string;
      serviceName: string;
      locticianName: string;
      rating: number;
      comment: string;
      date: string;
      response?: {
        comment: string;
        date: string;
      };
    }[];
    pendingReviews: {
      appointmentId: string;
      serviceId: string;
      serviceName: string;
      locticianName: string;
      appointmentDate: string;
    }[];
    loading: boolean;
    submitting: boolean;
    error: string | null;
  };

  // Support & Communication
  support: {
    tickets: {
      id: string;
      subject: string;
      status: 'open' | 'in_progress' | 'resolved' | 'closed';
      priority: 'low' | 'medium' | 'high' | 'urgent';
      createdDate: string;
      lastUpdate: string;
      messages: {
        id: string;
        sender: 'customer' | 'staff';
        message: string;
        timestamp: string;
        attachments?: string[];
      }[];
    }[];
    selectedTicket: string | null;
    faq: {
      id: string;
      question: string;
      answer: string;
      category: string;
      helpful: boolean | null;
    }[];
    loading: boolean;
    submitting: boolean;
  };

  // UI State
  ui: {
    showBookingModal: boolean;
    showProfileModal: boolean;
    showReviewModal: boolean;
    showSupportModal: boolean;
    activeProfileTab: 'personal' | 'preferences' | 'subscription' | 'history';
    mobileMenuOpen: boolean;
    selectedAppointmentForReview: string | null;
  };
}

const initialState: CustomerState = {
  services: {
    items: [],
    categories: [],
    featuredServices: [],
    selectedService: null,
    selectedCategory: null,
    loading: false,
    error: null,
    filters: {},
    sortBy: 'name',
    sortOrder: 'asc'
  },
  booking: {
    step: 'service',
    selectedService: null,
    selectedDate: null,
    selectedTime: null,
    customerInfo: {
      isGuest: true,
      name: '',
      email: '',
      phone: '',
      notes: ''
    },
    availableTimeSlots: [],
    blockedDates: [],
    loading: false,
    submitting: false,
    error: null,
    confirmationData: null
  },
  myBookings: {
    upcoming: [],
    past: [],
    selectedBooking: null,
    loading: false,
    error: null,
    filters: {}
  },
  profile: {
    personalInfo: {
      name: '',
      email: '',
      phone: ''
    },
    preferences: {
      language: 'da',
      notifications: {
        email: true,
        sms: true,
        push: true
      },
      timezone: 'Europe/Copenhagen',
      favoriteServices: [],
      preferredLocticians: []
    },
    bookingHistory: {
      totalBookings: 0,
      completedBookings: 0,
      memberSince: '',
      loyaltyPoints: 0
    },
    loading: false,
    updating: false,
    error: null
  },
  subscription: {
    active: false,
    plan: null,
    paymentMethod: null,
    invoices: [],
    loading: false,
    error: null
  },
  reviews: {
    myReviews: [],
    pendingReviews: [],
    loading: false,
    submitting: false,
    error: null
  },
  support: {
    tickets: [],
    selectedTicket: null,
    faq: [],
    loading: false,
    submitting: false
  },
  ui: {
    showBookingModal: false,
    showProfileModal: false,
    showReviewModal: false,
    showSupportModal: false,
    activeProfileTab: 'personal',
    mobileMenuOpen: false,
    selectedAppointmentForReview: null
  }
};

const customerSlice = createSlice({
  name: 'customer',
  initialState,
  reducers: {
    // Services
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
    setFeaturedServices: (state, action: PayloadAction<Service[]>) => {
      state.services.featuredServices = action.payload;
    },
    setSelectedService: (state, action: PayloadAction<Service | null>) => {
      state.services.selectedService = action.payload;
    },
    setSelectedCategory: (state, action: PayloadAction<ServiceCategory | null>) => {
      state.services.selectedCategory = action.payload;
    },
    setServiceFilters: (state, action: PayloadAction<CustomerState['services']['filters']>) => {
      state.services.filters = { ...state.services.filters, ...action.payload };
    },
    setServiceSort: (state, action: PayloadAction<{ sortBy: CustomerState['services']['sortBy']; sortOrder: CustomerState['services']['sortOrder'] }>) => {
      state.services.sortBy = action.payload.sortBy;
      state.services.sortOrder = action.payload.sortOrder;
    },
    setServicesError: (state, action: PayloadAction<string>) => {
      state.services.error = action.payload;
      state.services.loading = false;
    },

    // Booking
    setBookingStep: (state, action: PayloadAction<CustomerState['booking']['step']>) => {
      state.booking.step = action.payload;
    },
    setBookingService: (state, action: PayloadAction<Service>) => {
      state.booking.selectedService = action.payload;
      state.booking.step = 'datetime';
    },
    setBookingDateTime: (state, action: PayloadAction<{ date: string; time: string }>) => {
      state.booking.selectedDate = action.payload.date;
      state.booking.selectedTime = action.payload.time;
      state.booking.step = 'details';
    },
    setCustomerInfo: (state, action: PayloadAction<Partial<CustomerState['booking']['customerInfo']>>) => {
      state.booking.customerInfo = { ...state.booking.customerInfo, ...action.payload };
    },
    setAvailableTimeSlots: (state, action: PayloadAction<TimeSlot[]>) => {
      state.booking.availableTimeSlots = action.payload;
    },
    setBlockedDates: (state, action: PayloadAction<string[]>) => {
      state.booking.blockedDates = action.payload;
    },
    setBookingLoading: (state, action: PayloadAction<boolean>) => {
      state.booking.loading = action.payload;
    },
    setBookingSubmitting: (state, action: PayloadAction<boolean>) => {
      state.booking.submitting = action.payload;
    },
    setBookingConfirmation: (state, action: PayloadAction<CustomerState['booking']['confirmationData']>) => {
      state.booking.confirmationData = action.payload;
      state.booking.step = 'confirmation';
      state.booking.submitting = false;
    },
    setBookingError: (state, action: PayloadAction<string>) => {
      state.booking.error = action.payload;
      state.booking.loading = false;
      state.booking.submitting = false;
    },
    resetBooking: (state) => {
      state.booking = {
        ...initialState.booking,
        customerInfo: state.booking.customerInfo.isGuest
          ? initialState.booking.customerInfo
          : state.booking.customerInfo
      };
    },

    // My Bookings
    setMyBookingsLoading: (state, action: PayloadAction<boolean>) => {
      state.myBookings.loading = action.payload;
    },
    setUpcomingBookings: (state, action: PayloadAction<Appointment[]>) => {
      state.myBookings.upcoming = action.payload;
    },
    setPastBookings: (state, action: PayloadAction<Appointment[]>) => {
      state.myBookings.past = action.payload;
    },
    setSelectedBooking: (state, action: PayloadAction<Appointment | null>) => {
      state.myBookings.selectedBooking = action.payload;
    },
    setBookingFilters: (state, action: PayloadAction<CustomerState['myBookings']['filters']>) => {
      state.myBookings.filters = { ...state.myBookings.filters, ...action.payload };
    },
    updateBookingStatus: (state, action: PayloadAction<{ id: string; status: string }>) => {
      const { id, status } = action.payload;

      // Update in upcoming bookings
      const upcomingIndex = state.myBookings.upcoming.findIndex(booking => booking.id === id);
      if (upcomingIndex !== -1) {
        state.myBookings.upcoming[upcomingIndex].status = status as any;
      }

      // Update in past bookings
      const pastIndex = state.myBookings.past.findIndex(booking => booking.id === id);
      if (pastIndex !== -1) {
        state.myBookings.past[pastIndex].status = status as any;
      }

      // Update selected booking
      if (state.myBookings.selectedBooking?.id === id) {
        state.myBookings.selectedBooking.status = status as any;
      }
    },
    setMyBookingsError: (state, action: PayloadAction<string>) => {
      state.myBookings.error = action.payload;
      state.myBookings.loading = false;
    },

    // Profile
    setProfileLoading: (state, action: PayloadAction<boolean>) => {
      state.profile.loading = action.payload;
    },
    setProfileUpdating: (state, action: PayloadAction<boolean>) => {
      state.profile.updating = action.payload;
    },
    setPersonalInfo: (state, action: PayloadAction<CustomerState['profile']['personalInfo']>) => {
      state.profile.personalInfo = action.payload;
    },
    updatePersonalInfo: (state, action: PayloadAction<Partial<CustomerState['profile']['personalInfo']>>) => {
      state.profile.personalInfo = { ...state.profile.personalInfo, ...action.payload };
    },
    setPreferences: (state, action: PayloadAction<CustomerState['profile']['preferences']>) => {
      state.profile.preferences = action.payload;
    },
    updatePreferences: (state, action: PayloadAction<Partial<CustomerState['profile']['preferences']>>) => {
      state.profile.preferences = { ...state.profile.preferences, ...action.payload };
    },
    setBookingHistory: (state, action: PayloadAction<CustomerState['profile']['bookingHistory']>) => {
      state.profile.bookingHistory = action.payload;
    },
    setProfileError: (state, action: PayloadAction<string>) => {
      state.profile.error = action.payload;
      state.profile.loading = false;
      state.profile.updating = false;
    },

    // Subscription
    setSubscriptionLoading: (state, action: PayloadAction<boolean>) => {
      state.subscription.loading = action.payload;
    },
    setSubscriptionData: (state, action: PayloadAction<Partial<CustomerState['subscription']>>) => {
      Object.assign(state.subscription, action.payload);
      state.subscription.loading = false;
      state.subscription.error = null;
    },
    setSubscriptionError: (state, action: PayloadAction<string>) => {
      state.subscription.error = action.payload;
      state.subscription.loading = false;
    },

    // Reviews
    setReviewsLoading: (state, action: PayloadAction<boolean>) => {
      state.reviews.loading = action.payload;
    },
    setReviewsSubmitting: (state, action: PayloadAction<boolean>) => {
      state.reviews.submitting = action.payload;
    },
    setMyReviews: (state, action: PayloadAction<CustomerState['reviews']['myReviews']>) => {
      state.reviews.myReviews = action.payload;
    },
    setPendingReviews: (state, action: PayloadAction<CustomerState['reviews']['pendingReviews']>) => {
      state.reviews.pendingReviews = action.payload;
    },
    addReview: (state, action: PayloadAction<CustomerState['reviews']['myReviews'][0]>) => {
      state.reviews.myReviews.unshift(action.payload);
      // Remove from pending reviews
      state.reviews.pendingReviews = state.reviews.pendingReviews.filter(
        pending => pending.appointmentId !== action.payload.appointmentId
      );
      state.reviews.submitting = false;
    },
    setReviewsError: (state, action: PayloadAction<string>) => {
      state.reviews.error = action.payload;
      state.reviews.loading = false;
      state.reviews.submitting = false;
    },

    // Support
    setSupportLoading: (state, action: PayloadAction<boolean>) => {
      state.support.loading = action.payload;
    },
    setSupportSubmitting: (state, action: PayloadAction<boolean>) => {
      state.support.submitting = action.payload;
    },
    setSupportTickets: (state, action: PayloadAction<CustomerState['support']['tickets']>) => {
      state.support.tickets = action.payload;
    },
    setSelectedTicket: (state, action: PayloadAction<string | null>) => {
      state.support.selectedTicket = action.payload;
    },
    addSupportTicket: (state, action: PayloadAction<CustomerState['support']['tickets'][0]>) => {
      state.support.tickets.unshift(action.payload);
      state.support.submitting = false;
    },
    addTicketMessage: (state, action: PayloadAction<{ ticketId: string; message: CustomerState['support']['tickets'][0]['messages'][0] }>) => {
      const ticket = state.support.tickets.find(t => t.id === action.payload.ticketId);
      if (ticket) {
        ticket.messages.push(action.payload.message);
        ticket.lastUpdate = action.payload.message.timestamp;
      }
    },
    setFAQ: (state, action: PayloadAction<CustomerState['support']['faq']>) => {
      state.support.faq = action.payload;
    },

    // UI
    setShowBookingModal: (state, action: PayloadAction<boolean>) => {
      state.ui.showBookingModal = action.payload;
    },
    setShowProfileModal: (state, action: PayloadAction<boolean>) => {
      state.ui.showProfileModal = action.payload;
    },
    setShowReviewModal: (state, action: PayloadAction<boolean>) => {
      state.ui.showReviewModal = action.payload;
    },
    setShowSupportModal: (state, action: PayloadAction<boolean>) => {
      state.ui.showSupportModal = action.payload;
    },
    setActiveProfileTab: (state, action: PayloadAction<CustomerState['ui']['activeProfileTab']>) => {
      state.ui.activeProfileTab = action.payload;
    },
    setMobileMenuOpen: (state, action: PayloadAction<boolean>) => {
      state.ui.mobileMenuOpen = action.payload;
    },
    setSelectedAppointmentForReview: (state, action: PayloadAction<string | null>) => {
      state.ui.selectedAppointmentForReview = action.payload;
    },

    // Utility
    clearErrors: (state) => {
      state.services.error = null;
      state.booking.error = null;
      state.myBookings.error = null;
      state.profile.error = null;
      state.subscription.error = null;
      state.reviews.error = null;
    },
    resetSelections: (state) => {
      state.services.selectedService = null;
      state.services.selectedCategory = null;
      state.myBookings.selectedBooking = null;
      state.support.selectedTicket = null;
    }
  }
});

export const {
  // Services
  setServicesLoading,
  setServices,
  setServiceCategories,
  setFeaturedServices,
  setSelectedService,
  setSelectedCategory,
  setServiceFilters,
  setServiceSort,
  setServicesError,

  // Booking
  setBookingStep,
  setBookingService,
  setBookingDateTime,
  setCustomerInfo,
  setAvailableTimeSlots,
  setBlockedDates,
  setBookingLoading,
  setBookingSubmitting,
  setBookingConfirmation,
  setBookingError,
  resetBooking,

  // My Bookings
  setMyBookingsLoading,
  setUpcomingBookings,
  setPastBookings,
  setSelectedBooking,
  setBookingFilters,
  updateBookingStatus,
  setMyBookingsError,

  // Profile
  setProfileLoading,
  setProfileUpdating,
  setPersonalInfo,
  updatePersonalInfo,
  setPreferences,
  updatePreferences,
  setBookingHistory,
  setProfileError,

  // Subscription
  setSubscriptionLoading,
  setSubscriptionData,
  setSubscriptionError,

  // Reviews
  setReviewsLoading,
  setReviewsSubmitting,
  setMyReviews,
  setPendingReviews,
  addReview,
  setReviewsError,

  // Support
  setSupportLoading,
  setSupportSubmitting,
  setSupportTickets,
  setSelectedTicket,
  addSupportTicket,
  addTicketMessage,
  setFAQ,

  // UI
  setShowBookingModal,
  setShowProfileModal,
  setShowReviewModal,
  setShowSupportModal,
  setActiveProfileTab,
  setMobileMenuOpen,
  setSelectedAppointmentForReview,

  // Utility
  clearErrors,
  resetSelections
} = customerSlice.actions;

// Selectors
export const selectServicesData = (state: { customer: CustomerState }) => state.customer.services;
export const selectBookingData = (state: { customer: CustomerState }) => state.customer.booking;
export const selectMyBookingsData = (state: { customer: CustomerState }) => state.customer.myBookings;
export const selectProfileData = (state: { customer: CustomerState }) => state.customer.profile;
export const selectSubscriptionData = (state: { customer: CustomerState }) => state.customer.subscription;
export const selectReviewsData = (state: { customer: CustomerState }) => state.customer.reviews;
export const selectSupportData = (state: { customer: CustomerState }) => state.customer.support;
export const selectCustomerUI = (state: { customer: CustomerState }) => state.customer.ui;

export default customerSlice.reducer;