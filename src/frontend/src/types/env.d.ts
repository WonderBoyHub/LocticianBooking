/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_WS_URL: string
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION: string
  readonly VITE_APP_ENVIRONMENT: 'development' | 'staging' | 'production'
  readonly VITE_ENABLE_ANALYTICS: string
  readonly VITE_ENABLE_NOTIFICATIONS: string
  readonly VITE_ENABLE_REAL_TIME: string
  readonly VITE_ENABLE_OFFLINE_MODE: string
  readonly VITE_ENABLE_SERVICE_WORKER: string
  readonly VITE_DEBUG_MODE: string
  readonly VITE_MOCK_API: string
  readonly VITE_DEFAULT_LANGUAGE: string
  readonly VITE_SUPPORTED_LANGUAGES: string
  readonly VITE_MAX_FILE_SIZE: string
  readonly VITE_ALLOWED_FILE_TYPES: string
  readonly VITE_SESSION_TIMEOUT: string
  readonly VITE_CACHE_DURATION: string
  readonly VITE_GOOGLE_ANALYTICS_ID?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
