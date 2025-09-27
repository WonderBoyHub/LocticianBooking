import { z } from 'zod';

// Service Category schemas
export const serviceCategorySchema = z.object({
  name: z
    .string()
    .min(2, 'Category name must be at least 2 characters')
    .max(100, 'Category name must be less than 100 characters'),
  nameEn: z
    .string()
    .min(2, 'English name must be at least 2 characters')
    .max(100, 'English name must be less than 100 characters')
    .optional(),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  descriptionEn: z
    .string()
    .max(500, 'English description must be less than 500 characters')
    .optional(),
  order: z
    .number()
    .int()
    .min(0, 'Order must be a positive number')
    .default(0),
  isActive: z.boolean().default(true),
});

export const serviceCategoryCreateSchema = serviceCategorySchema;

export const serviceCategoryUpdateSchema = serviceCategorySchema.partial().extend({
  id: z.string().uuid(),
});

// Service schemas
export const serviceSchema = z.object({
  name: z
    .string()
    .min(2, 'Service name must be at least 2 characters')
    .max(100, 'Service name must be less than 100 characters'),
  nameEn: z
    .string()
    .min(2, 'English name must be at least 2 characters')
    .max(100, 'English name must be less than 100 characters')
    .optional(),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must be less than 2000 characters'),
  descriptionEn: z
    .string()
    .min(10, 'English description must be at least 10 characters')
    .max(2000, 'English description must be less than 2000 characters')
    .optional(),
  duration: z
    .number()
    .int()
    .min(15, 'Duration must be at least 15 minutes')
    .max(480, 'Duration cannot exceed 8 hours'),
  price: z
    .number()
    .min(0, 'Price cannot be negative')
    .max(10000, 'Price cannot exceed 10,000'),
  categoryId: z.string().uuid('Please select a valid category'),
  locticianId: z.string().uuid('Please select a valid loctician'),
  isActive: z.boolean().default(true),
  images: z
    .array(z.string().url('Invalid image URL'))
    .max(10, 'Maximum 10 images allowed')
    .optional(),
  requirements: z
    .array(z.string().min(1, 'Requirement cannot be empty'))
    .max(20, 'Maximum 20 requirements allowed')
    .optional(),
  aftercare: z
    .array(z.string().min(1, 'Aftercare instruction cannot be empty'))
    .max(20, 'Maximum 20 aftercare instructions allowed')
    .optional(),
});

export const serviceCreateSchema = serviceSchema;

export const serviceUpdateSchema = serviceSchema.partial().extend({
  id: z.string().uuid(),
});

// Service search and filter schemas
export const serviceFilterSchema = z.object({
  categoryId: z.string().uuid().optional(),
  locticianId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  minDuration: z.number().int().min(15).optional(),
  maxDuration: z.number().int().max(480).optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['name', 'price', 'duration', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// Image upload schema
export const imageUploadSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, 'File size must be less than 5MB')
    .refine(
      (file) => ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type),
      'Only JPEG, PNG, and WebP images are allowed'
    ),
  altText: z
    .string()
    .max(200, 'Alt text must be less than 200 characters')
    .optional(),
});

// Service gallery management
export const serviceGallerySchema = z.object({
  images: z
    .array(z.object({
      id: z.string().uuid().optional(),
      url: z.string().url('Invalid image URL'),
      altText: z.string().max(200).optional(),
      order: z.number().int().min(0).default(0),
      isActive: z.boolean().default(true),
    }))
    .max(10, 'Maximum 10 images allowed'),
});

// Type exports
export type ServiceCategoryInput = z.infer<typeof serviceCategorySchema>;
export type ServiceCategoryCreateInput = z.infer<typeof serviceCategoryCreateSchema>;
export type ServiceCategoryUpdateInput = z.infer<typeof serviceCategoryUpdateSchema>;

export type ServiceInput = z.infer<typeof serviceSchema>;
export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;
export type ServiceUpdateInput = z.infer<typeof serviceUpdateSchema>;

export type ServiceFilterInput = z.infer<typeof serviceFilterSchema>;
export type ImageUploadInput = z.infer<typeof imageUploadSchema>;
export type ServiceGalleryInput = z.infer<typeof serviceGallerySchema>;