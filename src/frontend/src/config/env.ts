// Environment configuration with type safety and validation

interface AppConfig {
  api: {
    baseUrl: string;
    wsUrl: string;
    timeout: number;
  };
  app: {
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
  };
  features: {
    analytics: boolean;
    notifications: boolean;
    realTime: boolean;
    offlineMode: boolean;
    serviceWorker: boolean;
  };
  debug: {
    enabled: boolean;
    mockApi: boolean;
  };
  localization: {
    defaultLanguage: string;
    supportedLanguages: string[];
  };
  upload: {
    maxFileSize: number;
    allowedFileTypes: string[];
  };
  security: {
    sessionTimeout: number;
  };
  cache: {
    duration: number;
  };
  external: {
    googleAnalyticsId?: string;
    sentryDsn?: string;
    stripePublishableKey?: string;
  };
}

// Helper function to parse boolean environment variables
const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

// Helper function to parse number environment variables
const parseNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Helper function to parse array environment variables
const parseArray = (value: string | undefined, defaultValue: string[]): string[] => {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim()).filter(Boolean);
};

// Application configuration
export const config: AppConfig = {
  api: {
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
    wsUrl: import.meta.env.VITE_WS_URL || 'http://localhost:8000',
    timeout: parseNumber(import.meta.env.VITE_API_TIMEOUT, 10000),
  },
  app: {
    name: import.meta.env.VITE_APP_NAME || 'JLI Loctician',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    environment: (import.meta.env.VITE_APP_ENVIRONMENT as AppConfig['app']['environment']) || 'development',
  },
  features: {
    analytics: parseBoolean(import.meta.env.VITE_ENABLE_ANALYTICS, false),
    notifications: parseBoolean(import.meta.env.VITE_ENABLE_NOTIFICATIONS, true),
    realTime: parseBoolean(import.meta.env.VITE_ENABLE_REAL_TIME, true),
    offlineMode: parseBoolean(import.meta.env.VITE_ENABLE_OFFLINE_MODE, false),
    serviceWorker: parseBoolean(import.meta.env.VITE_ENABLE_SERVICE_WORKER, false),
  },
  debug: {
    enabled: parseBoolean(import.meta.env.VITE_DEBUG_MODE, false),
    mockApi: parseBoolean(import.meta.env.VITE_MOCK_API, false),
  },
  localization: {
    defaultLanguage: import.meta.env.VITE_DEFAULT_LANGUAGE || 'da',
    supportedLanguages: parseArray(import.meta.env.VITE_SUPPORTED_LANGUAGES, ['da', 'en']),
  },
  upload: {
    maxFileSize: parseNumber(import.meta.env.VITE_MAX_FILE_SIZE, 5 * 1024 * 1024), // 5MB default
    allowedFileTypes: parseArray(import.meta.env.VITE_ALLOWED_FILE_TYPES, [
      'image/jpeg',
      'image/png',
      'image/webp'
    ]),
  },
  security: {
    sessionTimeout: parseNumber(import.meta.env.VITE_SESSION_TIMEOUT, 60 * 60 * 1000), // 1 hour default
  },
  cache: {
    duration: parseNumber(import.meta.env.VITE_CACHE_DURATION, 5 * 60 * 1000), // 5 minutes default
  },
  external: {
    googleAnalyticsId: import.meta.env.VITE_GOOGLE_ANALYTICS_ID,
    sentryDsn: import.meta.env.VITE_SENTRY_DSN,
    stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
  },
};

// Environment checks
export const isDevelopment = config.app.environment === 'development';
export const isProduction = config.app.environment === 'production';
export const isStaging = config.app.environment === 'staging';

// Debug logging in development
if (isDevelopment && config.debug.enabled) {
  console.log('🔧 App Configuration:', config);
}

// Validation function to ensure required environment variables are set
export const validateConfig = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Required environment variables
  if (!config.api.baseUrl) {
    errors.push('VITE_API_URL is required');
  }

  if (!config.api.wsUrl) {
    errors.push('VITE_WS_URL is required');
  }

  if (!config.app.name) {
    errors.push('VITE_APP_NAME is required');
  }

  // Validate supported languages
  if (!config.localization.supportedLanguages.includes(config.localization.defaultLanguage)) {
    errors.push('Default language must be included in supported languages');
  }

  // Validate file size limits
  if (config.upload.maxFileSize <= 0) {
    errors.push('Max file size must be greater than 0');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Initialize validation
const validation = validateConfig();
if (!validation.isValid) {
  console.error('❌ Configuration validation failed:', validation.errors);
  if (isProduction) {
    throw new Error('Invalid configuration in production environment');
  }
}

export default config;