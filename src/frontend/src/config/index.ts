// Export all configuration
export { default as config, isDevelopment, isProduction, isStaging, validateConfig } from './env';

// Constants that might be used throughout the app
export const APP_CONSTANTS = {
  // Date/time formats
  DATE_FORMAT: 'yyyy-MM-dd',
  TIME_FORMAT: 'HH:mm',
  DATETIME_FORMAT: 'yyyy-MM-dd HH:mm',
  DISPLAY_DATE_FORMAT: 'd MMMM yyyy',
  DISPLAY_TIME_FORMAT: 'HH:mm',

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // File upload
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks

  // Debounce delays
  SEARCH_DEBOUNCE: 300,
  RESIZE_DEBOUNCE: 100,

  // Cache keys
  CACHE_KEYS: {
    USER: 'user',
    SERVICES: 'services',
    APPOINTMENTS: 'appointments',
    AVAILABILITY: 'availability',
  },

  // Local storage keys
  STORAGE_KEYS: {
    TOKEN: 'jli_token',
    LANGUAGE: 'jli_language',
    THEME: 'jli_theme',
    SIDEBAR_COLLAPSED: 'jli_sidebar_collapsed',
  },

  // API endpoints
  API_ENDPOINTS: {
    AUTH: '/auth',
    USERS: '/users',
    SERVICES: '/services',
    APPOINTMENTS: '/appointments',
    AVAILABILITY: '/availability',
    ANALYTICS: '/analytics',
    UPLOAD: '/upload',
    CMS: '/cms',
  },

  // Socket events
  SOCKET_EVENTS: {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    APPOINTMENT_CREATED: 'appointment_created',
    APPOINTMENT_UPDATED: 'appointment_updated',
    APPOINTMENT_CANCELLED: 'appointment_cancelled',
    AVAILABILITY_UPDATED: 'availability_updated',
    USER_NOTIFICATION: 'user_notification',
    JOIN_ROOM: 'join_room',
    LEAVE_ROOM: 'leave_room',
  },

  // Notification types
  NOTIFICATION_TYPES: {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
  },

  // User roles
  USER_ROLES: {
    CUSTOMER: 'customer',
    LOCTICIAN: 'loctician',
    ADMIN: 'admin',
  },

  // Appointment statuses
  APPOINTMENT_STATUSES: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    NO_SHOW: 'no_show',
  },

  // Calendar views
  CALENDAR_VIEWS: {
    MONTH: 'month',
    WEEK: 'week',
    DAY: 'day',
    AGENDA: 'agenda',
  },

  // Validation rules
  VALIDATION: {
    MIN_PASSWORD_LENGTH: 6,
    MAX_NAME_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 1000,
    MIN_PHONE_LENGTH: 8,
    MAX_PHONE_LENGTH: 15,
  },
} as const;

// Type helpers
export type AppointmentStatus = typeof APP_CONSTANTS.APPOINTMENT_STATUSES[keyof typeof APP_CONSTANTS.APPOINTMENT_STATUSES];
export type UserRole = typeof APP_CONSTANTS.USER_ROLES[keyof typeof APP_CONSTANTS.USER_ROLES];
export type CalendarView = typeof APP_CONSTANTS.CALENDAR_VIEWS[keyof typeof APP_CONSTANTS.CALENDAR_VIEWS];
export type NotificationType = typeof APP_CONSTANTS.NOTIFICATION_TYPES[keyof typeof APP_CONSTANTS.NOTIFICATION_TYPES];