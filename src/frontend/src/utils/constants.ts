// Brand colors from the design images
export const BRAND_COLORS = {
  primary: '#8B6B47',
  secondary: '#D2B48C',
  accent: '#F5F5DC',
  dark: '#6B4E32',
  light: '#FAF7F0',
} as const;

// Service categories
export const SERVICE_CATEGORIES = {
  STARTER: 'starter_locs',
  RETWIST: 'loc_retwists',
  WASH: 'wash_services',
  COLOR: 'color_services',
  MAINTENANCE: 'maintenance',
  STYLING: 'styling',
} as const;

// Appointment statuses
export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const;

// User roles
export const USER_ROLES = {
  CUSTOMER: 'customer',
  LOCTICIAN: 'loctician',
  ADMIN: 'admin',
} as const;

// Time slots (15-minute intervals)
export const TIME_SLOTS = [
  '08:00', '08:15', '08:30', '08:45',
  '09:00', '09:15', '09:30', '09:45',
  '10:00', '10:15', '10:30', '10:45',
  '11:00', '11:15', '11:30', '11:45',
  '12:00', '12:15', '12:30', '12:45',
  '13:00', '13:15', '13:30', '13:45',
  '14:00', '14:15', '14:30', '14:45',
  '15:00', '15:15', '15:30', '15:45',
  '16:00', '16:15', '16:30', '16:45',
  '17:00', '17:15', '17:30', '17:45',
  '18:00', '18:15', '18:30', '18:45',
  '19:00', '19:15', '19:30', '19:45',
  '20:00'
] as const;

// Days of the week
export const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
] as const;

// Languages
export const LANGUAGES = {
  DA: 'da',
  EN: 'en',
} as const;

// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    PROFILE: '/auth/profile',
  },
  USERS: '/users',
  SERVICES: '/services',
  APPOINTMENTS: '/appointments',
  AVAILABILITY: '/availability',
  ANALYTICS: '/analytics',
  CMS: '/cms',
  UPLOAD: '/upload',
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'jli_access_token',
  REFRESH_TOKEN: 'jli_refresh_token',
  USER: 'jli_user',
  LANGUAGE: 'jli_language',
  THEME: 'jli_theme',
  CART: 'jli_cart',
} as const;

// WebSocket events
export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  APPOINTMENT_UPDATE: 'appointment_update',
  NEW_BOOKING: 'new_booking',
  AVAILABILITY_CHANGE: 'availability_change',
  USER_UPDATE: 'user_update',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
} as const;

// Form validation patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
  PHONE: /^(\+45\s?)?(\d{2}\s?\d{2}\s?\d{2}\s?\d{2})$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

// File upload constraints
export const UPLOAD_CONSTRAINTS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  MAX_FILES: 10,
} as const;

// Date and time formats
export const DATE_FORMATS = {
  DISPLAY: 'dd/MM/yyyy',
  API: 'yyyy-MM-dd',
  LONG: 'EEEE, MMMM do, yyyy',
  SHORT: 'MMM dd',
  TIME: 'HH:mm',
  DATETIME: 'dd/MM/yyyy HH:mm',
} as const;

// Animation durations (in milliseconds)
export const ANIMATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
} as const;

// Breakpoints (matches Tailwind CSS)
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const;

// Toast notification types
export const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;

// Calendar view types
export const CALENDAR_VIEWS = {
  MONTH: 'month',
  WEEK: 'week',
  DAY: 'day',
  LIST: 'list',
} as const;

// Status colors
export const STATUS_COLORS = {
  [APPOINTMENT_STATUS.PENDING]: '#F59E0B',
  [APPOINTMENT_STATUS.CONFIRMED]: '#10B981',
  [APPOINTMENT_STATUS.IN_PROGRESS]: '#3B82F6',
  [APPOINTMENT_STATUS.COMPLETED]: '#6B7280',
  [APPOINTMENT_STATUS.CANCELLED]: '#EF4444',
  [APPOINTMENT_STATUS.NO_SHOW]: '#8B5CF6',
} as const;

// Default images and placeholders
export const PLACEHOLDERS = {
  USER_AVATAR: '/images/default-avatar.svg',
  SERVICE_IMAGE: '/images/default-service.jpg',
  GALLERY_IMAGE: '/images/default-gallery.jpg',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  BOOKING_CONFLICT: 'This time slot is no longer available.',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  BOOKING_CREATED: 'Your appointment has been booked successfully!',
  BOOKING_UPDATED: 'Your appointment has been updated.',
  BOOKING_CANCELLED: 'Your appointment has been cancelled.',
  PROFILE_UPDATED: 'Your profile has been updated.',
  PASSWORD_CHANGED: 'Your password has been changed.',
} as const;