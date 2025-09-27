# JLI Loctician Booking System - React Frontend

A modern, responsive React frontend for the loctician booking system with brand-consistent design and real-time capabilities.

## 🚀 Features

### Core Functionality
- **Customer Booking Flow**: Multi-step wizard for seamless appointment booking
- **Calendar Management**: Drag-and-drop calendar with multiple views (month, week, day, agenda)
- **Real-time Updates**: Socket.io integration for live appointment updates
- **Danish Localization**: Full i18n support with Danish as primary language
- **Responsive Design**: Mobile-first approach with touch-friendly interfaces

### Technical Highlights
- **React 18+**: Concurrent rendering and modern React patterns
- **TypeScript**: Full type safety throughout the application
- **Redux Toolkit**: Centralized state management with RTK Query
- **Framer Motion**: Smooth animations and transitions
- **Tailwind CSS**: Utility-first styling with custom brand theme

## 🏗️ Architecture

### Project Structure
```
src/frontend/
├── public/                 # Static assets
├── src/
│   ├── components/        # Reusable components
│   │   ├── ui/           # Base UI components
│   │   ├── forms/        # Form components
│   │   ├── calendar/     # Calendar components
│   │   ├── booking/      # Booking flow components
│   │   └── layout/       # Layout components
│   ├── pages/            # Page components
│   │   ├── customer/     # Customer-facing pages
│   │   ├── loctician/    # Loctician dashboard
│   │   ├── admin/        # Admin interface
│   │   └── auth/         # Authentication pages
│   ├── hooks/            # Custom React hooks
│   ├── services/         # External services (API, Socket.io)
│   ├── store/            # Redux store and slices
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Helper functions
│   ├── styles/           # Global styles and CSS
│   ├── i18n/             # Internationalization
│   ├── config/           # Configuration files
│   └── locales/          # Translation files
```

### State Management
- **Redux Toolkit**: Global state management
- **RTK Query**: API data fetching and caching
- **Socket.io**: Real-time updates
- **React Hook Form**: Form state management

### Component Architecture
- **Atomic Design**: Organized component hierarchy
- **Compound Components**: Flexible component composition
- **Custom Hooks**: Reusable logic extraction
- **TypeScript**: Complete type safety

## 🎨 Design System

### Brand Colors
- **Primary**: `#8B6B47` (Warm brown)
- **Secondary**: `#D2B48C` (Light brown/tan)
- **Accent**: `#F5F5DC` (Beige/cream)
- **Dark**: `#6B4E32` (Darker brown for text)
- **Light**: `#FAF7F0` (Very light cream)

### Typography
- **Sans-serif**: Inter (primary font)
- **Serif**: Playfair Display (headings)

### Components
- **Buttons**: Multiple variants (primary, secondary, outline, ghost)
- **Cards**: Flexible card system with hover effects
- **Forms**: Accessible form components with validation
- **Modals**: Animated modal system
- **Notifications**: Toast notification system
- **Badges**: Status indicators with color coding

## 📱 Responsive Design

### Breakpoints
- **Mobile**: < 768px
- **Tablet**: 768px - 1023px
- **Desktop**: ≥ 1024px

### Mobile Features
- Touch-friendly interface (44px minimum touch targets)
- Optimized typography scaling
- Mobile-specific navigation
- Swipe gestures for calendar navigation
- Responsive modal behavior

### Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Focus management
- Color contrast compliance
- Reduced motion support

## 🌐 Internationalization

### Languages
- **Danish (da)**: Primary language
- **English (en)**: Secondary language

### Features
- Dynamic language switching
- Currency formatting (DKK)
- Date/time formatting for Denmark
- Danish phone number formatting
- Locale-aware sorting and validation

## 🔄 Real-time Features

### Socket.io Integration
- **Connection Management**: Automatic reconnection with exponential backoff
- **Room Management**: User-specific and role-based rooms
- **Event Handling**: Comprehensive event system for live updates

### Real-time Updates
- New appointment notifications
- Calendar synchronization
- Availability updates
- User notifications
- Chat/messaging support

## 📦 Key Dependencies

### Core
- `react` ^18.2.0
- `react-dom` ^18.2.0
- `typescript` ^5.0.2
- `vite` ^4.4.5

### State Management
- `@reduxjs/toolkit` ^1.9.5
- `react-redux` ^8.1.2
- `@tanstack/react-query` ^4.32.6

### UI & Styling
- `tailwindcss` ^3.3.3
- `framer-motion` ^10.16.1
- `lucide-react` ^0.263.1
- `clsx` ^2.0.0

### Forms & Validation
- `react-hook-form` ^7.45.4
- `@hookform/resolvers` ^3.3.0
- `zod` ^3.21.4

### Calendar & Drag-and-Drop
- `react-calendar` ^4.6.0
- `react-dnd` ^16.0.1
- `react-dnd-html5-backend` ^16.0.1
- `date-fns` ^2.30.0

### Internationalization
- `react-i18next` ^13.0.3
- `i18next` ^23.4.4
- `i18next-browser-languagedetector` ^7.1.0

### Real-time & Networking
- `socket.io-client` ^4.7.2

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
cd src/frontend
npm install
```

### Environment Setup
1. Copy `.env.example` to `.env.development`
2. Configure environment variables:
```bash
cp .env.example .env.development
```

### Development
```bash
npm run dev
```

### Building
```bash
npm run build
```

### Testing
```bash
npm run test
npm run test:coverage
```

## 🔧 Configuration

### Environment Variables
- `VITE_API_URL`: Backend API URL
- `VITE_WS_URL`: WebSocket server URL
- `VITE_APP_NAME`: Application name
- `VITE_DEBUG_MODE`: Enable debug mode
- `VITE_ENABLE_ANALYTICS`: Enable analytics
- `VITE_DEFAULT_LANGUAGE`: Default language (da/en)

### Feature Flags
- Real-time updates
- Analytics tracking
- Offline mode
- Service worker
- Debug logging

## 📋 Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build
- `npm run lint`: Run ESLint
- `npm run lint:fix`: Fix ESLint issues
- `npm run test`: Run tests
- `npm run test:ui`: Run tests with UI
- `npm run test:coverage`: Run tests with coverage

## 🎯 Key Features Implementation

### Booking Flow
1. **Service Selection**: Browse and filter services
2. **Date/Time Selection**: Interactive calendar with availability
3. **Customer Details**: Form with validation
4. **Confirmation**: Review and confirm booking

### Calendar Management
- **Multiple Views**: Month, week, day, and agenda views
- **Drag & Drop**: Move appointments between time slots
- **Real-time Sync**: Live updates across all connected clients
- **Responsive Design**: Optimized for all screen sizes

### Dashboard
- **Analytics**: Revenue, bookings, and customer metrics
- **Quick Actions**: Fast access to common tasks
- **Recent Activity**: Latest bookings and updates
- **Notifications**: Real-time alerts and messages

## 🔐 Security

### Authentication
- JWT token-based authentication
- Automatic token refresh
- Role-based access control
- Session timeout handling

### Data Protection
- Input validation and sanitization
- XSS protection
- CSRF protection
- Secure data transmission

## 🚀 Performance

### Optimization Techniques
- Code splitting with React.lazy
- Image optimization and lazy loading
- Bundle size optimization
- Efficient re-rendering with React.memo
- Service worker for caching (production)

### Monitoring
- Performance metrics tracking
- Error boundary implementation
- Real-time performance monitoring
- User experience analytics

## 🤝 Contributing

### Code Style
- ESLint configuration
- Prettier formatting
- TypeScript strict mode
- Consistent naming conventions

### Component Guidelines
- Functional components with hooks
- TypeScript interfaces for props
- Comprehensive prop validation
- Accessibility considerations

## 📈 Future Enhancements

### Planned Features
- Dark mode support
- Advanced analytics dashboard
- Multi-language support expansion
- Progressive Web App (PWA) features
- Offline functionality
- Advanced calendar features
- AI-powered scheduling recommendations

### Technical Improvements
- Performance monitoring
- Advanced error tracking
- A/B testing framework
- Advanced caching strategies
- Micro-frontend architecture

## 📞 Support

For technical support or questions about the frontend implementation, please refer to the project documentation or contact the development team.

---

Built with ❤️ using React, TypeScript, and modern web technologies.