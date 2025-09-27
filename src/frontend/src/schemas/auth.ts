import { z } from 'zod';

// Base user validation schema
export const userSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-ZæøåÆØÅ\s-']+$/, 'Name contains invalid characters'),
  email: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase()
    .transform(email => email.trim()),
  phone: z
    .string()
    .regex(/^[+]?[0-9\s-()]+$/, 'Please enter a valid phone number')
    .min(8, 'Phone number must be at least 8 characters')
    .optional()
    .or(z.literal('')),
});

// Registration schema with role selection
export const registrationSchema = userSchema.extend({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  confirmPassword: z.string(),
  role: z.enum(['customer', 'loctician', 'admin']).default('customer'),
  agreedToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms and conditions'),
  marketingConsent: z.boolean().default(false),
  language: z.enum(['da', 'en']).default('da'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Admin registration schema (can assign any role)
export const adminRegistrationSchema = registrationSchema.extend({
  role: z.enum(['customer', 'loctician', 'admin']),
  sendWelcomeEmail: z.boolean().default(true),
});

// Login schema
export const loginSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase()
    .transform(email => email.trim()),
  password: z
    .string()
    .min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

// User update schema
export const userUpdateSchema = userSchema.extend({
  avatar: z.string().url().optional(),
  preferences: z.object({
    language: z.enum(['da', 'en']),
    notifications: z.object({
      email: z.boolean(),
      sms: z.boolean(),
      push: z.boolean(),
    }),
    timezone: z.string(),
  }).optional(),
}).partial().required({
  email: true,
});

// Admin user management schema
export const adminUserUpdateSchema = userUpdateSchema.extend({
  role: z.enum(['customer', 'loctician', 'admin']),
  isActive: z.boolean(),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
});

// Password change schema
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: 'Passwords do not match',
  path: ['confirmNewPassword'],
});

// Password reset schema
export const passwordResetSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase()
    .transform(email => email.trim()),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Type exports
export type UserInput = z.infer<typeof userSchema>;
export type RegistrationInput = z.infer<typeof registrationSchema>;
export type AdminRegistrationInput = z.infer<typeof adminRegistrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;