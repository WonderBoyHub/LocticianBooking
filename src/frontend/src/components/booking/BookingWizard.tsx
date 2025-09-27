import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import { selectBookingStep, selectCurrentBooking } from '../../store/slices/bookingSlice';
import { ServiceSelection } from './ServiceSelection';
import { DateTimeSelection } from './DateTimeSelection';
import { CustomerDetails } from './CustomerDetails';
import { BookingConfirmation } from './BookingConfirmation';
import { Card } from '../ui';
import { clsx } from 'clsx';

const steps = [
  { key: 'service', label: 'booking.steps.service' },
  { key: 'datetime', label: 'booking.steps.datetime' },
  { key: 'details', label: 'booking.steps.details' },
  { key: 'confirmation', label: 'booking.steps.confirmation' },
] as const;

interface StepIndicatorProps {
  currentStep: string;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const { t } = useTranslation();

  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.key === currentStep);
  };

  const currentIndex = getCurrentStepIndex();

  return (
    <div className="flex items-center justify-center space-x-2 md:space-x-4 mb-8">
      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;
        const isAccessible = index <= currentIndex;

        return (
          <div key={step.key} className="flex items-center">
            {/* Step circle */}
            <div
              className={clsx(
                'relative flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium transition-all duration-200',
                isCompleted && 'bg-green-600 text-white',
                isActive && !isCompleted && 'bg-brand-primary text-white',
                !isActive && !isCompleted && !isAccessible && 'bg-gray-200 text-gray-400',
                !isActive && !isCompleted && isAccessible && 'bg-gray-300 text-gray-600'
              )}
            >
              {isCompleted ? (
                <Check className="w-5 h-5" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>

            {/* Step label */}
            <div className="ml-3 hidden md:block">
              <p
                className={clsx(
                  'text-sm font-medium transition-colors',
                  (isActive || isCompleted) && 'text-brand-dark',
                  !isActive && !isCompleted && 'text-gray-500'
                )}
              >
                {t(step.label)}
              </p>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={clsx(
                  'w-8 md:w-16 h-0.5 mx-2 md:mx-4 transition-colors',
                  index < currentIndex ? 'bg-green-600' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

interface BookingContentProps {
  step: string;
}

const BookingContent: React.FC<BookingContentProps> = ({ step }) => {
  const contentVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  const renderStep = () => {
    switch (step) {
      case 'service':
        return <ServiceSelection />;
      case 'datetime':
        return <DateTimeSelection />;
      case 'details':
        return <CustomerDetails />;
      case 'confirmation':
        return <BookingConfirmation />;
      default:
        return <ServiceSelection />;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={{ duration: 0.3 }}
      >
        {renderStep()}
      </motion.div>
    </AnimatePresence>
  );
};

export const BookingWizard: React.FC = () => {
  const { t } = useTranslation();
  const currentStep = useAppSelector(selectBookingStep);
  const booking = useAppSelector(selectCurrentBooking);

  return (
    <div className="min-h-screen bg-brand-light py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-dark mb-2">
            {t('booking.title')}
          </h1>
          <p className="text-gray-600">
            Book your appointment in just a few simple steps
          </p>
        </div>

        {/* Progress indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Main content */}
        <Card className="max-w-2xl mx-auto" padding="lg">
          <BookingContent step={currentStep} />
        </Card>

        {/* Debug info (development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-100 rounded-lg text-xs text-gray-600">
            <details>
              <summary className="cursor-pointer font-medium">Debug Info</summary>
              <pre className="mt-2 overflow-auto">
                {JSON.stringify(booking, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
};