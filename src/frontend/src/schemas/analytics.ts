import { z } from 'zod';
import { isValid, parseISO, addDays, subDays } from 'date-fns';

// Date range schema
export const dateRangeSchema = z.object({
  start: z
    .string()
    .refine((date) => isValid(parseISO(date)), 'Invalid start date'),
  end: z
    .string()
    .refine((date) => isValid(parseISO(date)), 'Invalid end date'),
}).refine((data) => {
  const start = parseISO(data.start);
  const end = parseISO(data.end);
  return end >= start;
}, {
  message: 'End date must be after start date',
  path: ['end'],
}).refine((data) => {
  const start = parseISO(data.start);
  const end = parseISO(data.end);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 365;
}, {
  message: 'Date range cannot exceed 365 days',
  path: ['end'],
});

// Analytics query schema
export const analyticsQuerySchema = z.object({
  locticianId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  groupBy: z
    .enum(['day', 'week', 'month', 'quarter', 'year'])
    .default('day'),
  metrics: z
    .array(z.enum([
      'appointments',
      'revenue',
      'customers',
      'services',
      'completion_rate',
      'cancellation_rate',
      'no_show_rate',
      'average_service_duration',
      'customer_satisfaction',
      'booking_lead_time',
    ]))
    .min(1, 'At least one metric must be selected'),
  includeComparison: z.boolean().default(false),
  comparisonPeriod: z
    .enum(['previous_period', 'same_period_last_year'])
    .optional(),
}).merge(dateRangeSchema);

// Predefined date range schema
export const predefinedDateRangeSchema = z.object({
  period: z.enum([
    'today',
    'yesterday',
    'this_week',
    'last_week',
    'this_month',
    'last_month',
    'this_quarter',
    'last_quarter',
    'this_year',
    'last_year',
    'last_7_days',
    'last_30_days',
    'last_90_days',
    'custom'
  ]),
  customRange: dateRangeSchema.optional(),
}).refine((data) => {
  if (data.period === 'custom') {
    return data.customRange !== undefined;
  }
  return true;
}, {
  message: 'Custom date range is required when period is "custom"',
  path: ['customRange'],
});

// Revenue analytics schema
export const revenueAnalyticsSchema = z.object({
  includeRefunds: z.boolean().default(false),
  includePending: z.boolean().default(false),
  currency: z.enum(['DKK', 'EUR', 'USD']).default('DKK'),
  breakdown: z.array(z.enum([
    'service',
    'category',
    'loctician',
    'day_of_week',
    'hour_of_day',
    'customer_type'
  ])).optional(),
}).merge(analyticsQuerySchema);

// Customer analytics schema
export const customerAnalyticsSchema = z.object({
  segmentation: z.array(z.enum([
    'new_vs_returning',
    'appointment_frequency',
    'total_spent',
    'preferred_services',
    'booking_patterns',
    'cancellation_rate'
  ])).optional(),
  cohortAnalysis: z.boolean().default(false),
}).merge(analyticsQuerySchema);

// Service performance schema
export const servicePerformanceSchema = z.object({
  includeInactive: z.boolean().default(false),
  performanceMetrics: z.array(z.enum([
    'booking_count',
    'revenue',
    'average_rating',
    'completion_rate',
    'rebooking_rate',
    'duration_accuracy'
  ])).min(1, 'At least one performance metric must be selected'),
}).merge(analyticsQuerySchema);

// Staff performance schema
export const staffPerformanceSchema = z.object({
  includeInactive: z.boolean().default(false),
  performanceMetrics: z.array(z.enum([
    'appointments_completed',
    'revenue_generated',
    'customer_satisfaction',
    'punctuality',
    'cancellation_rate',
    'utilization_rate',
    'upselling_rate'
  ])).min(1, 'At least one performance metric must be selected'),
  anonymize: z.boolean().default(false),
}).merge(analyticsQuerySchema);

// Business insights schema
export const businessInsightsSchema = z.object({
  insights: z.array(z.enum([
    'peak_hours',
    'popular_services',
    'seasonal_trends',
    'customer_retention',
    'pricing_optimization',
    'capacity_utilization',
    'marketing_effectiveness'
  ])).min(1, 'At least one insight must be selected'),
  confidence_threshold: z.number().min(0).max(1).default(0.8),
  include_predictions: z.boolean().default(false),
}).merge(analyticsQuerySchema);

// Financial report schema
export const financialReportSchema = z.object({
  report_type: z.enum([
    'profit_loss',
    'cash_flow',
    'revenue_breakdown',
    'expense_analysis',
    'tax_summary'
  ]),
  include_forecasts: z.boolean().default(false),
  export_format: z.enum(['pdf', 'excel', 'csv']).default('pdf'),
  email_to: z.array(z.string().email()).optional(),
}).merge(dateRangeSchema);

// Analytics dashboard configuration
export const dashboardConfigSchema = z.object({
  widgets: z.array(z.object({
    id: z.string(),
    type: z.enum([
      'kpi_card',
      'line_chart',
      'bar_chart',
      'pie_chart',
      'table',
      'heatmap',
      'gauge'
    ]),
    title: z.string().max(100),
    position: z.object({
      x: z.number().int().min(0),
      y: z.number().int().min(0),
      width: z.number().int().min(1).max(12),
      height: z.number().int().min(1).max(12),
    }),
    config: z.record(z.string(), z.any()),
    refresh_interval: z.number().int().min(0).default(300), // seconds
    is_visible: z.boolean().default(true),
  })).max(20, 'Maximum 20 widgets allowed'),
  auto_refresh: z.boolean().default(true),
  theme: z.enum(['light', 'dark', 'auto']).default('light'),
});

// Export settings schema
export const exportSettingsSchema = z.object({
  format: z.enum(['pdf', 'excel', 'csv', 'json']),
  filename: z
    .string()
    .min(1, 'Filename is required')
    .max(100, 'Filename must be less than 100 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Filename can only contain letters, numbers, underscores, and hyphens'),
  include_charts: z.boolean().default(true),
  include_raw_data: z.boolean().default(false),
  email_recipients: z
    .array(z.string().email('Invalid email address'))
    .max(10, 'Maximum 10 email recipients allowed')
    .optional(),
  schedule: z.object({
    enabled: z.boolean().default(false),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
    day_of_week: z.number().int().min(0).max(6).optional(), // For weekly
    day_of_month: z.number().int().min(1).max(31).optional(), // For monthly
    time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).default('09:00'),
  }).optional(),
});

// Alert configuration schema
export const alertConfigSchema = z.object({
  name: z
    .string()
    .min(1, 'Alert name is required')
    .max(100, 'Alert name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  metric: z.enum([
    'daily_revenue',
    'appointment_count',
    'cancellation_rate',
    'no_show_rate',
    'customer_satisfaction',
    'utilization_rate'
  ]),
  threshold: z.object({
    value: z.number(),
    operator: z.enum(['greater_than', 'less_than', 'equals', 'not_equals']),
  }),
  notifications: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(false),
    push: z.boolean().default(true),
    slack: z.boolean().default(false),
  }),
  recipients: z
    .array(z.string().email())
    .min(1, 'At least one recipient is required'),
  cooldown_minutes: z
    .number()
    .int()
    .min(5, 'Cooldown must be at least 5 minutes')
    .max(1440, 'Cooldown cannot exceed 24 hours')
    .default(60),
  is_active: z.boolean().default(true),
});

// Type exports
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;
export type PredefinedDateRangeInput = z.infer<typeof predefinedDateRangeSchema>;
export type RevenueAnalyticsInput = z.infer<typeof revenueAnalyticsSchema>;
export type CustomerAnalyticsInput = z.infer<typeof customerAnalyticsSchema>;
export type ServicePerformanceInput = z.infer<typeof servicePerformanceSchema>;
export type StaffPerformanceInput = z.infer<typeof staffPerformanceSchema>;
export type BusinessInsightsInput = z.infer<typeof businessInsightsSchema>;
export type FinancialReportInput = z.infer<typeof financialReportSchema>;
export type DashboardConfigInput = z.infer<typeof dashboardConfigSchema>;
export type ExportSettingsInput = z.infer<typeof exportSettingsSchema>;
export type AlertConfigInput = z.infer<typeof alertConfigSchema>;