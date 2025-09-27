import { z } from 'zod';
import { addDays, isValid, parseISO } from 'date-fns';

// Base appointment schemas
export const appointmentTimeSchema = z.object({
  date: z
    .string()
    .refine((date) => {
      const parsed = parseISO(date);
      return isValid(parsed) && parsed >= new Date(new Date().toDateString());
    }, 'Date must be today or in the future'),
  startTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  endTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
}).refine((data) => {
  const [startHour, startMin] = data.startTime.split(':').map(Number);
  const [endHour, endMin] = data.endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return endMinutes > startMinutes;
}, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export const customerInfoSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-ZæøåÆØÅ\s-']+$/, 'Name contains invalid characters'),
  email: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase()
    .transform(email => email.trim()),
  phone: z
    .string()
    .regex(/^[+]?[0-9\s-()]+$/, 'Please enter a valid phone number')
    .min(8, 'Phone number must be at least 8 characters'),
  notes: z
    .string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional(),
  isNewCustomer: z.boolean().default(false),
});

// Booking form schema (customer-facing)
export const bookingFormSchema = z.object({
  serviceId: z.string().uuid('Please select a valid service'),
  locticianId: z.string().uuid('Please select a valid loctician'),
}).merge(appointmentTimeSchema).merge(customerInfoSchema);

// Guest booking schema
export const guestBookingSchema = bookingFormSchema.extend({
  agreedToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms and conditions'),
  marketingConsent: z.boolean().default(false),
  preferredLanguage: z.enum(['da', 'en']).default('da'),
});

// Authenticated customer booking schema
export const customerBookingSchema = z.object({
  serviceId: z.string().uuid('Please select a valid service'),
  locticianId: z.string().uuid('Please select a valid loctician'),
  notes: z
    .string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional(),
}).merge(appointmentTimeSchema);

// Staff appointment creation schema
export const staffAppointmentSchema = z.object({
  customerId: z.string().uuid('Please select a valid customer'),
  serviceId: z.string().uuid('Please select a valid service'),
  totalPrice: z
    .number()
    .min(0, 'Price cannot be negative')
    .optional(),
  locticianNotes: z
    .string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional(),
  status: z
    .enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])
    .default('confirmed'),
  sendConfirmation: z.boolean().default(true),
}).merge(appointmentTimeSchema);

// Admin appointment schema (full control)
export const adminAppointmentSchema = staffAppointmentSchema.extend({
  locticianId: z.string().uuid('Please select a valid loctician'),
  adminNotes: z
    .string()
    .max(1000, 'Admin notes must be less than 1000 characters')
    .optional(),
  overrideValidation: z.boolean().default(false),
});

// Appointment update schemas
export const appointmentUpdateSchema = z.object({
  id: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  status: z
    .enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])
    .optional(),
  notes: z
    .string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional(),
  customerNotes: z
    .string()
    .max(1000, 'Customer notes must be less than 1000 characters')
    .optional(),
  locticianNotes: z
    .string()
    .max(1000, 'Loctician notes must be less than 1000 characters')
    .optional(),
  totalPrice: z
    .number()
    .min(0, 'Price cannot be negative')
    .optional(),
}).merge(appointmentTimeSchema.partial());

// Appointment cancellation schema
export const appointmentCancellationSchema = z.object({
  id: z.string().uuid(),
  reason: z
    .enum([
      'customer_request',
      'loctician_unavailable',
      'emergency',
      'no_show',
      'weather',
      'illness',
      'other'
    ]),
  customReason: z
    .string()
    .max(500, 'Reason must be less than 500 characters')
    .optional(),
  refundAmount: z
    .number()
    .min(0, 'Refund amount cannot be negative')
    .optional(),
  notifyCustomer: z.boolean().default(true),
  rescheduleOffer: z.boolean().default(false),
});

// Reschedule appointment schema
export const rescheduleAppointmentSchema = z.object({
  id: z.string().uuid(),
  reason: z
    .string()
    .max(500, 'Reason must be less than 500 characters')
    .optional(),
  notifyCustomer: z.boolean().default(true),
}).merge(appointmentTimeSchema);

// Appointment filter schema
export const appointmentFilterSchema = z.object({
  status: z
    .array(z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']))
    .optional(),
  customerId: z.string().uuid().optional(),
  locticianId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  dateRange: z.object({
    start: z.string().refine((date) => isValid(parseISO(date)), 'Invalid start date'),
    end: z.string().refine((date) => isValid(parseISO(date)), 'Invalid end date'),
  }).refine((data) => {
    const start = parseISO(data.start);
    const end = parseISO(data.end);
    return end >= start;
  }, {
    message: 'End date must be after start date',
    path: ['end'],
  }).optional(),
  timeRange: z.object({
    start: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    end: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  }).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  search: z.string().max(100).optional(),
  sortBy: z
    .enum(['date', 'customerName', 'serviceName', 'status', 'price'])
    .default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// Bulk operations schema
export const bulkAppointmentActionSchema = z.object({
  appointmentIds: z
    .array(z.string().uuid())
    .min(1, 'At least one appointment must be selected'),
  action: z.enum(['confirm', 'cancel', 'complete', 'send_reminder', 'bulk_reschedule']),
  reason: z
    .string()
    .max(500, 'Reason must be less than 500 characters')
    .optional(),
  newDate: z
    .string()
    .refine((date) => isValid(parseISO(date)), 'Invalid date')
    .optional(),
  notifyCustomers: z.boolean().default(true),
});

// Reminder settings schema
export const reminderSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  methods: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(false),
    push: z.boolean().default(true),
  }),
  timing: z.object({
    days: z.number().int().min(0).max(30).default(1),
    hours: z.number().int().min(0).max(23).default(24),
  }),
  customMessage: z
    .string()
    .max(500, 'Custom message must be less than 500 characters')
    .optional(),
});

// Quick reschedule options
export const quickRescheduleSchema = z.object({
  originalAppointmentId: z.string().uuid(),
  suggestedSlots: z.array(z.object({
    date: z.string().refine((date) => isValid(parseISO(date)), 'Invalid date'),
    startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    available: z.boolean(),
    conflictReason: z.string().optional(),
  })).min(1, 'At least one time slot must be provided'),
  reason: z.string().max(500).optional(),
  offerDiscount: z.boolean().default(false),
  discountAmount: z.number().min(0).optional(),
});

// Type exports
export type AppointmentTimeInput = z.infer<typeof appointmentTimeSchema>;
export type CustomerInfoInput = z.infer<typeof customerInfoSchema>;
export type BookingFormInput = z.infer<typeof bookingFormSchema>;
export type GuestBookingInput = z.infer<typeof guestBookingSchema>;
export type CustomerBookingInput = z.infer<typeof customerBookingSchema>;
export type StaffAppointmentInput = z.infer<typeof staffAppointmentSchema>;
export type AdminAppointmentInput = z.infer<typeof adminAppointmentSchema>;
export type AppointmentUpdateInput = z.infer<typeof appointmentUpdateSchema>;
export type AppointmentCancellationInput = z.infer<typeof appointmentCancellationSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
export type AppointmentFilterInput = z.infer<typeof appointmentFilterSchema>;
export type BulkAppointmentActionInput = z.infer<typeof bulkAppointmentActionSchema>;
export type ReminderSettingsInput = z.infer<typeof reminderSettingsSchema>;
export type QuickRescheduleInput = z.infer<typeof quickRescheduleSchema>;