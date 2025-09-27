import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enTranslations from './locales/en.json';
import daTranslations from './locales/da.json';

const resources = {
  en: {
    translation: enTranslations,
  },
  da: {
    translation: daTranslations,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'da', // Default to Danish
    debug: process.env.NODE_ENV === 'development',

    // Language detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'jli_language',
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // Namespace configuration
    defaultNS: 'translation',
    ns: ['translation'],

    // Format options for dates, numbers, etc.
    react: {
      useSuspense: false,
    },
  });

export default i18n;

// Helper function to format currency in DKK
export const formatCurrency = (amount: number, locale: string = 'da-DK'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Helper function to format date
export const formatDate = (date: string | Date, locale: string = 'da-DK'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dateObj);
};

// Helper function to format time
export const formatTime = (time: string, locale: string = 'da-DK'): string => {
  const [hours, minutes] = time.split(':');
  const timeObj = new Date();
  timeObj.setHours(parseInt(hours), parseInt(minutes));

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(timeObj);
};

// Helper function to format phone numbers for Denmark
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');

  // Danish phone number format: +45 XX XX XX XX
  if (cleaned.length === 8) {
    return `+45 ${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)}`;
  }

  // If it starts with 45, format as international
  if (cleaned.length === 10 && cleaned.startsWith('45')) {
    const number = cleaned.slice(2);
    return `+45 ${number.slice(0, 2)} ${number.slice(2, 4)} ${number.slice(4, 6)} ${number.slice(6, 8)}`;
  }

  return phone; // Return original if can't format
};