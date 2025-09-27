import { z } from 'zod';
import { isValid, parseISO, format } from 'date-fns';

// Time validation helper
const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

// Base availability schema
export const availabilitySlotSchema = z.object({
  startTime: z
    .string()
    .regex(timeRegex, 'Invalid time format (HH:MM)'),
  endTime: z
    .string()
    .regex(timeRegex, 'Invalid time format (HH:MM)'),
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

// Recurring availability schema
export const recurringAvailabilitySchema = z.object({
  locticianId: z.string().uuid('Please select a valid loctician'),
  dayOfWeek: z
    .number()
    .int()
    .min(0, 'Day of week must be between 0-6')
    .max(6, 'Day of week must be between 0-6'), // 0 = Sunday
  isActive: z.boolean().default(true),
  slots: z
    .array(availabilitySlotSchema)
    .min(1, 'At least one time slot is required')
    .max(20, 'Maximum 20 time slots allowed'),
});

// Date override schema (specific date availability)
export const dateOverrideSchema = z.object({
  locticianId: z.string().uuid('Please select a valid loctician'),
  date: z
    .string()
    .refine((date) => {
      const parsed = parseISO(date);
      return isValid(parsed) && parsed >= new Date(new Date().toDateString());
    }, 'Date must be today or in the future'),
  type: z.enum(['available', 'blocked']),
  slots: z
    .array(availabilitySlotSchema)
    .max(20, 'Maximum 20 time slots allowed')
    .optional(),
  reason: z
    .string()
    .max(500, 'Reason must be less than 500 characters')
    .optional(),
  isActive: z.boolean().default(true),
});

// Blocked time schema
export const blockedTimeSchema = z.object({
  locticianId: z.string().uuid('Please select a valid loctician'),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  startDateTime: z
    .string()
    .refine((date) => {
      const parsed = parseISO(date);
      return isValid(parsed) && parsed >= new Date();
    }, 'Start date/time must be in the future'),
  endDateTime: z
    .string()
    .refine((date) => {
      const parsed = parseISO(date);
      return isValid(parsed);
    }, 'Invalid end date/time'),
  type: z.enum([
    'break',
    'lunch',
    'meeting',
    'training',
    'personal',
    'maintenance',
    'other'
  ]).default('other'),
  isRecurring: z.boolean().default(false),
  recurringPattern: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    interval: z.number().int().min(1).max(52).default(1),
    endDate: z.string().refine((date) => isValid(parseISO(date))).optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
  }).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Invalid color format (must be hex)')
    .default('#FF6B6B'),
}).refine((data) => {
  const start = parseISO(data.startDateTime);
  const end = parseISO(data.endDateTime);
  return end > start;
}, {
  message: 'End date/time must be after start date/time',
  path: ['endDateTime'],
});

// Batch availability update schema
export const batchAvailabilitySchema = z.object({
  locticianId: z.string().uuid('Please select a valid loctician'),
  updates: z.array(z.object({
    date: z.string().refine((date) => isValid(parseISO(date))),
    type: z.enum(['set_available', 'set_blocked', 'copy_from_template']),
    slots: z.array(availabilitySlotSchema).optional(),
    templateDayOfWeek: z.number().int().min(0).max(6).optional(),
    reason: z.string().max(500).optional(),
  })).min(1, 'At least one update is required').max(31, 'Maximum 31 updates allowed'),
  applyToFuture: z.boolean().default(false),
});

// Availability template schema
export const availabilityTemplateSchema = z.object({
  name: z
    .string()
    .min(1, 'Template name is required')
    .max(100, 'Template name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  locticianId: z.string().uuid('Please select a valid loctician'),
  schedule: z.object({
    monday: z.array(availabilitySlotSchema).optional(),
    tuesday: z.array(availabilitySlotSchema).optional(),
    wednesday: z.array(availabilitySlotSchema).optional(),
    thursday: z.array(availabilitySlotSchema).optional(),
    friday: z.array(availabilitySlotSchema).optional(),
    saturday: z.array(availabilitySlotSchema).optional(),
    sunday: z.array(availabilitySlotSchema).optional(),
  }),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

// Availability query schema
export const availabilityQuerySchema = z.object({
  locticianId: z.string().uuid().optional(),
  startDate: z
    .string()
    .refine((date) => isValid(parseISO(date)), 'Invalid start date'),
  endDate: z
    .string()
    .refine((date) => isValid(parseISO(date)), 'Invalid end date'),
  includeBlocked: z.boolean().default(true),
  includeAppointments: z.boolean().default(false),
  serviceId: z.string().uuid().optional(), // For service-specific availability
  bufferTime: z.number().int().min(0).max(120).default(0), // Minutes
}).refine((data) => {
  const start = parseISO(data.startDate);
  const end = parseISO(data.endDate);
  return end >= start;
}, {
  message: 'End date must be after or equal to start date',
  path: ['endDate'],
});

// Working hours schema
export const workingHoursSchema = z.object({
  locticianId: z.string().uuid('Please select a valid loctician'),
  effectiveFrom: z
    .string()
    .refine((date) => isValid(parseISO(date)), 'Invalid effective date'),
  monday: z.object({
    enabled: z.boolean().default(true),
    slots: z.array(availabilitySlotSchema).optional(),
  }),
  tuesday: z.object({
    enabled: z.boolean().default(true),
    slots: z.array(availabilitySlotSchema).optional(),
  }),
  wednesday: z.object({
    enabled: z.boolean().default(true),
    slots: z.array(availabilitySlotSchema).optional(),
  }),
  thursday: z.object({
    enabled: z.boolean().default(true),
    slots: z.array(availabilitySlotSchema).optional(),
  }),
  friday: z.object({
    enabled: z.boolean().default(true),
    slots: z.array(availabilitySlotSchema).optional(),
  }),
  saturday: z.object({
    enabled: z.boolean().default(false),
    slots: z.array(availabilitySlotSchema).optional(),
  }),
  sunday: z.object({
    enabled: z.boolean().default(false),
    slots: z.array(availabilitySlotSchema).optional(),
  }),
  timezone: z.string().default('Europe/Copenhagen'),
  bufferBetweenAppointments: z
    .number()
    .int()
    .min(0, 'Buffer time cannot be negative')
    .max(120, 'Buffer time cannot exceed 2 hours')
    .default(15),
  maxAdvanceBookingDays: z
    .number()
    .int()
    .min(1, 'Must allow at least 1 day advance booking')
    .max(365, 'Cannot exceed 365 days advance booking')
    .default(90),
  minAdvanceBookingHours: z
    .number()
    .int()
    .min(0, 'Cannot be negative')
    .max(168, 'Cannot exceed 1 week')
    .default(2),
});

// Time off request schema
export const timeOffRequestSchema = z.object({
  locticianId: z.string().uuid('Please select a valid loctician'),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be less than 100 characters'),
  reason: z.enum([
    'vacation',
    'sick_leave',
    'personal',
    'training',
    'conference',
    'family',
    'other'
  ]).default('vacation'),
  customReason: z
    .string()
    .max(500, 'Custom reason must be less than 500 characters')
    .optional(),
  startDate: z
    .string()
    .refine((date) => {
      const parsed = parseISO(date);
      return isValid(parsed) && parsed >= new Date(new Date().toDateString());
    }, 'Start date must be today or in the future'),
  endDate: z
    .string()
    .refine((date) => isValid(parseISO(date)), 'Invalid end date'),
  isFullDay: z.boolean().default(true),
  startTime: z
    .string()
    .regex(timeRegex, 'Invalid start time format')
    .optional(),
  endTime: z
    .string()
    .regex(timeRegex, 'Invalid end time format')
    .optional(),
  notes: z
    .string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional(),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  requestDate: z.string().default(() => new Date().toISOString()),
}).refine((data) => {
  const start = parseISO(data.startDate);
  const end = parseISO(data.endDate);
  return end >= start;
}, {
  message: 'End date must be after or equal to start date',
  path: ['endDate'],
});

// Type exports
export type AvailabilitySlotInput = z.infer<typeof availabilitySlotSchema>;
export type RecurringAvailabilityInput = z.infer<typeof recurringAvailabilitySchema>;
export type DateOverrideInput = z.infer<typeof dateOverrideSchema>;
export type BlockedTimeInput = z.infer<typeof blockedTimeSchema>;
export type BatchAvailabilityInput = z.infer<typeof batchAvailabilitySchema>;
export type AvailabilityTemplateInput = z.infer<typeof availabilityTemplateSchema>;
export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;
export type WorkingHoursInput = z.infer<typeof workingHoursSchema>;
export type TimeOffRequestInput = z.infer<typeof timeOffRequestSchema>;