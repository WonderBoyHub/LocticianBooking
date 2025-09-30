// Core entity types
export type UserRole = 'customer' | 'loctician' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  avatar?: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  language: 'da' | 'en';
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  timezone: string;
}

export interface Service {
  id: string;
  name: string;
  nameEn?: string | null;
  description: string;
  descriptionEn?: string | null;
  duration: number; // in minutes
  price: number;
  category?: ServiceCategory | null;
  isActive: boolean;
  images?: string[];
  requirements?: string[];
  aftercare?: string[];
  locticianId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  nameEn?: string | null;
  slug?: string;
  description?: string;
  descriptionEn?: string | null;
  order?: number;
  isActive: boolean;
}

export interface Appointment {
  id: string;
  customerId: string;
  locticianId: string;
  serviceId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes?: string;
  customerNotes?: string;
  locticianNotes?: string;
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
  reminder?: {
    sent: boolean;
    sentAt?: string;
  };
  // Populated fields
  customer?: User;
  loctician?: User;
  service?: Service;
}

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Availability {
  id: string;
  locticianId: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  startTime: string;
  endTime: string;
  isActive: boolean;
  date?: string; // For specific date overrides
  type: 'recurring' | 'override' | 'blocked';
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  appointmentId?: string;
}

export interface DaySchedule {
  date: string;
  slots: TimeSlot[];
  isBlocked?: boolean;
  blockReason?: string;
}

// UI and Form types
export interface BookingFormData {
  serviceId: string;
  date: string;
  time: string;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
    notes?: string;
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps?: {
    appointment?: Appointment;
    type: 'appointment' | 'blocked' | 'available';
  };
}

export interface FilterOptions {
  status?: AppointmentStatus[];
  dateRange?: {
    start: string;
    end: string;
  };
  serviceId?: string;
  customerId?: string;
  locticianId?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  pagination?: PaginationInfo;
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, any>;
}


export interface RegisterRequest {
  email: string;
  password: string;
  confirm_password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role?: UserRole;
  marketing_consent?: boolean;
  gdpr_consent: boolean;
}

export interface RegisterApiResponse {
  user_id: string;
  email: string;
  message: string;
  email_verification_required: boolean;
}

// Instagram content types
export interface InstagramPostDto {
  id: string;
  instagram_id: string;
  post_type: string;
  caption?: string | null;
  media_url: string;
  thumbnail_url?: string | null;
  permalink: string;
  likes_count: number;
  comments_count: number;
  posted_at: string;
  is_featured: boolean;
  display_order: number;
  synced_at?: string | null;
  sync_error?: string | null;
}

export interface InstagramPost {
  id: string;
  instagramId: string;
  postType: string;
  caption?: string | null;
  mediaUrl: string;
  thumbnailUrl?: string | null;
  permalink: string;
  likesCount: number;
  commentsCount: number;
  postedAt: string;
  isFeatured: boolean;
  displayOrder: number;
  syncedAt?: string | null;
  syncError?: string | null;
}

export interface InstagramPostUpdatePayload {
  isFeatured?: boolean;
  displayOrder?: number;
}

// Analytics types
export interface AnalyticsData {
  appointments: {
    total: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noShows: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    growth: number;
  };
  services: {
    id: string;
    name: string;
    bookings: number;
    revenue: number;
  }[];
  customers: {
    total: number;
    new: number;
    returning: number;
  };
  timeRange: {
    start: string;
    end: string;
  };
}

// CMS types
export interface ContentBlock {
  id: string;
  type: 'text' | 'image' | 'gallery' | 'service_grid' | 'testimonials';
  title?: string;
  content?: string;
  images?: string[];
  order: number;
  isActive: boolean;
  settings?: Record<string, any>;
}

export interface PageContent {
  id: string;
  slug: string;
  title: string;
  titleEn?: string;
  metaDescription?: string;
  metaDescriptionEn?: string;
  blocks: ContentBlock[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CmsPageType =
  | 'page'
  | 'blog_post'
  | 'service_page'
  | 'product_page'
  | 'landing_page';

export interface CmsPageSummary {
  id: string;
  title: string;
  slug: string;
  pageType: CmsPageType;
  isPublished: boolean;
  publishedAt?: string | null;
  updatedAt: string;
}

export interface CmsPage extends CmsPageSummary {
  content?: string | null;
  excerpt?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string[] | null;
  gdprVersion?: string | null;
  heroMedia?: MediaAsset | null;
}

export interface MediaAsset {
  id: string;
  url: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  altText?: string | null;
  caption?: string | null;
  isFeatured: boolean;
  displayOrder: number;
  isPublished: boolean;
  publishedAt: string;
}

export interface MediaAssetAdmin extends MediaAsset {
  filename: string;
  filePath: string;
  fileSizeMb: number;
  uploadedBy?: string | null;
  uploadedAt: string;
}

export interface PasswordResetRequestPayload {
  email: string;
}

export interface PasswordResetConfirmPayload {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

// WebSocket types
export interface SocketEvent {
  type: 'appointment_update' | 'new_booking' | 'availability_change' | 'user_update';
  data: any;
  timestamp: string;
}

// Utility types
export interface LoadingState {
  isLoading: boolean;
  error?: string | null;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// Form validation types
export interface ValidationError {
  field: string;
  message: string;
}

export interface FormState<T> {
  data: T;
  errors: ValidationError[];
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
}

// Theme and styling types
export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };
  typography: {
    fontFamily: {
      sans: string;
      serif: string;
    };
    fontSize: Record<string, string>;
    fontWeight: Record<string, string>;
  };
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  shadows: Record<string, string>;
}

// Route types
export interface RouteConfig {
  path: string;
  component: React.ComponentType;
  exact?: boolean;
  protected?: boolean;
  roles?: User['role'][];
  title?: string;
  meta?: {
    description?: string;
    keywords?: string;
  };
}