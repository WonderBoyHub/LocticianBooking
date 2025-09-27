/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors based on the provided images
        brand: {
          primary: '#8B6B47',    // Warm brown
          secondary: '#D2B48C',  // Light brown/tan
          accent: '#F5F5DC',     // Beige/cream
          dark: '#6B4E32',       // Darker brown for text
          light: '#FAF7F0',      // Very light cream
        },
        brown: {
          50: '#FAF7F0',
          100: '#F5F5DC',
          200: '#E8D5B7',
          300: '#D2B48C',
          400: '#C19A6B',
          500: '#8B6B47',
          600: '#6B4E32',
          700: '#5D4037',
          800: '#4E342E',
          900: '#3E2723',
        },
        status: {
          pending: '#F59E0B',    // Orange
          confirmed: '#10B981',  // Green
          progress: '#3B82F6',   // Blue
          completed: '#6B7280',  // Gray
          cancelled: '#EF4444',  // Red
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(139, 107, 71, 0.1), 0 10px 20px -2px rgba(139, 107, 71, 0.04)',
        'brand': '0 4px 20px -2px rgba(139, 107, 71, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}