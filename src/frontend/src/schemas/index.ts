// Re-export all schema modules
export * from './auth';
export * from './services';
export * from './appointments';
export * from './analytics';
export * from './availability';

// Common utility schemas
import { z } from 'zod';

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// Search schema
export const searchSchema = z.object({
  query: z
    .string()
    .max(100, 'Search query must be less than 100 characters')
    .optional(),
  filters: z.record(z.string(), z.any()).optional(),
}).merge(paginationSchema);

// File upload schema
export const fileUploadSchema = z.object({
  files: z
    .array(z.instanceof(File))
    .min(1, 'At least one file is required')
    .max(10, 'Maximum 10 files allowed'),
  folder: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, 'Folder name can only contain letters, numbers, underscores, and hyphens')
    .optional(),
  maxFileSize: z.number().int().min(1).max(50 * 1024 * 1024).default(5 * 1024 * 1024), // 5MB default
  allowedTypes: z
    .array(z.string())
    .default(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
});

// Contact form schema
export const contactFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  email: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase()
    .transform(email => email.trim()),
  phone: z
    .string()
    .regex(/^[+]?[0-9\s-()]+$/, 'Please enter a valid phone number')
    .optional(),
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(200, 'Subject must be less than 200 characters'),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message must be less than 2000 characters'),
  preferredContact: z.enum(['email', 'phone']).default('email'),
  marketingConsent: z.boolean().default(false),
});

// Newsletter subscription schema
export const newsletterSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase()
    .transform(email => email.trim()),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  preferences: z.object({
    promotions: z.boolean().default(true),
    newServices: z.boolean().default(true),
    tips: z.boolean().default(false),
    events: z.boolean().default(false),
  }).default({
    promotions: true,
    newServices: true,
    tips: false,
    events: false,
  }),
  language: z.enum(['da', 'en']).default('da'),
});

// Notification settings schema
export const notificationSettingsSchema = z.object({
  email: z.object({
    enabled: z.boolean().default(true),
    appointments: z.boolean().default(true),
    reminders: z.boolean().default(true),
    promotions: z.boolean().default(false),
    updates: z.boolean().default(true),
  }),
  sms: z.object({
    enabled: z.boolean().default(false),
    appointments: z.boolean().default(true),
    reminders: z.boolean().default(true),
    urgentOnly: z.boolean().default(true),
  }),
  push: z.object({
    enabled: z.boolean().default(true),
    appointments: z.boolean().default(true),
    reminders: z.boolean().default(true),
    promotions: z.boolean().default(false),
    realTime: z.boolean().default(true),
  }),
});

// System settings schema
export const systemSettingsSchema = z.object({
  business: z.object({
    name: z.string().min(1, 'Business name is required'),
    address: z.string().min(1, 'Address is required'),
    phone: z.string().regex(/^[+]?[0-9\s-()]+$/),
    email: z.string().email(),
    website: z.string().url().optional(),
    timezone: z.string().default('Europe/Copenhagen'),
    currency: z.enum(['DKK', 'EUR', 'USD']).default('DKK'),
    language: z.enum(['da', 'en']).default('da'),
  }),
  booking: z.object({
    minAdvanceHours: z.number().int().min(0).max(168).default(2),
    maxAdvanceDays: z.number().int().min(1).max(365).default(90),
    bufferTime: z.number().int().min(0).max(120).default(15),
    cancellationPolicy: z.number().int().min(0).max(72).default(24),
    requireDeposit: z.boolean().default(false),
    depositPercentage: z.number().min(0).max(100).default(20),
    allowGuestBooking: z.boolean().default(true),
    autoConfirm: z.boolean().default(false),
  }),
  notifications: z.object({
    emailProvider: z.enum(['smtp', 'sendgrid', 'mailgun']).default('smtp'),
    smsProvider: z.enum(['twilio', 'nexmo']).optional(),
    reminderTiming: z.number().int().min(1).max(72).default(24),
    adminNotifications: z.boolean().default(true),
  }),
  integrations: z.object({
    googleCalendar: z.boolean().default(false),
    stripeEnabled: z.boolean().default(false),
    mollyEnabled: z.boolean().default(false),
    analyticsEnabled: z.boolean().default(true),
  }),
});

// Type exports for utility schemas
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type ContactFormInput = z.infer<typeof contactFormSchema>;
export type NewsletterInput = z.infer<typeof newsletterSchema>;
export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;
export type SystemSettingsInput = z.infer<typeof systemSettingsSchema>;