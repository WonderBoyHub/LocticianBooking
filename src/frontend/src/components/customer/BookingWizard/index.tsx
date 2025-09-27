import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Service } from '../../../types';
import { ProgressIndicator } from './ProgressIndicator';
import { ServiceSelectionStep } from './ServiceSelectionStep';
import { DateTimeSelectionStep } from './DateTimeSelectionStep';
import { CustomerDetailsStep, CustomerDetailsFormData } from './CustomerDetailsStep';
import { BookingConfirmationStep } from './BookingConfirmationStep';

interface ServiceAddOn {
  id: string;
  name: string;
  price: number;
  duration: number;
  description: string;
}

export interface BookingWizardProps {
  selectedService?: Service | null;
  onClose: () => void;
  onComplete?: (bookingData: BookingData) => void;
  className?: string;
}

export interface BookingData {
  service: Service;
  addOns: ServiceAddOn[];
  date: Date;
  time: string;
  customerDetails: CustomerDetailsFormData;
  totalPrice: number;
  totalDuration: number;
}

const BOOKING_STEPS = [
  {
    id: 'service',
    title: 'Behandling',
    description: 'Vælg behandling og tilvalg',
  },
  {
    id: 'datetime',
    title: 'Dato & Tid',
    description: 'Vælg dit ønskede tidspunkt',
  },
  {
    id: 'details',
    title: 'Oplysninger',
    description: 'Indtast dine kontaktoplysninger',
  },
  {
    id: 'confirmation',
    title: 'Bekræftelse',
    description: 'Gennemse og bekræft booking',
  },
];

// Mock add-ons data - would come from API
const AVAILABLE_ADDONS: ServiceAddOn[] = [
  {
    id: '1',
    name: 'Hovedbundsmassage',
    price: 200,
    duration: 15,
    description: 'Afslappende massage af hovedbund med æteriske olier',
  },
  {
    id: '2',
    name: 'Hair Steaming Treatment',
    price: 150,
    duration: 20,
    description: 'Dybdegående behandling med varme damp',
  },
  {
    id: '3',
    name: 'Loc Styling Session',
    price: 300,
    duration: 30,
    description: 'Kreativ styling med accessories og produkter',
  },
  {
    id: '4',
    name: 'Fotografering',
    price: 500,
    duration: 45,
    description: 'Professionelle billeder af din nye frisure',
  },
];

export const BookingWizard: React.FC<BookingWizardProps> = ({
  selectedService = null,
  onClose,
  onComplete,
  className = '',
}) => {
  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data state
  const [service, setService] = useState<Service | null>(selectedService);
  const [selectedAddOns, setSelectedAddOns] = useState<ServiceAddOn[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetailsFormData | null>(null);

  // Calculated values
  const totalPrice = service ? service.price + selectedAddOns.reduce((sum, addon) => sum + addon.price, 0) : 0;
  const totalDuration = service ? service.duration + selectedAddOns.reduce((sum, addon) => sum + addon.duration, 0) : 0;

  // Navigation handlers
  const nextStep = useCallback(() => {
    if (currentStep < BOOKING_STEPS.length - 1) {
      setCompletedSteps(prev => [...prev, currentStep]);
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex <= currentStep || completedSteps.includes(stepIndex)) {
      setCurrentStep(stepIndex);
    }
  }, [currentStep, completedSteps]);

  // Add-on handlers
  const handleAddOnToggle = useCallback((addOn: ServiceAddOn) => {
    setSelectedAddOns(prev => {
      const exists = prev.find(item => item.id === addOn.id);
      if (exists) {
        return prev.filter(item => item.id !== addOn.id);
      } else {
        return [...prev, addOn];
      }
    });
  }, []);

  // Form submission handlers
  const handleCustomerDetailsSubmit = useCallback(async (data: CustomerDetailsFormData) => {
    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      setCustomerDetails(data);
      nextStep();
    } catch (error) {
      console.error('Failed to submit customer details:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [nextStep]);

  // Final booking completion
  const handleBookingComplete = useCallback(() => {
    if (service && selectedDate && selectedTime && customerDetails) {
      const bookingData: BookingData = {
        service,
        addOns: selectedAddOns,
        date: selectedDate,
        time: selectedTime,
        customerDetails,
        totalPrice,
        totalDuration,
      };

      onComplete?.(bookingData);
    }
  }, [service, selectedAddOns, selectedDate, selectedTime, customerDetails, totalPrice, totalDuration, onComplete]);

  const handleNewBooking = useCallback(() => {
    // Reset wizard state
    setCurrentStep(0);
    setCompletedSteps([]);
    setService(null);
    setSelectedAddOns([]);
    setSelectedDate(null);
    setSelectedTime(null);
    setCustomerDetails(null);
  }, []);

  const handleDownloadConfirmation = useCallback(() => {
    // Implement PDF generation or print functionality
    console.log('Download confirmation');
  }, []);

  const handleShareBooking = useCallback(() => {
    // Implement sharing functionality
    if (navigator.share) {
      navigator.share({
        title: 'Min booking hos JLI',
        text: `Jeg har booket ${service?.name} den ${selectedDate?.toLocaleDateString('da-DK')} kl. ${selectedTime}`,
        url: window.location.href,
      });
    }
  }, [service, selectedDate, selectedTime]);

  return (
    <div className={`min-h-screen bg-brand-light ${className}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Progress Indicator */}
          <ProgressIndicator
            steps={BOOKING_STEPS}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={goToStep}
            className="mb-12"
          />

          {/* Step Content */}
          <div className="bg-transparent">
            <AnimatePresence mode="wait" initial={false}>
              {currentStep === 0 && (
                <motion.div
                  key="service-selection"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <ServiceSelectionStep
                    selectedService={service}
                    selectedAddOns={selectedAddOns}
                    availableAddOns={AVAILABLE_ADDONS}
                    onAddOnToggle={handleAddOnToggle}
                    onNext={nextStep}
                    onBack={onClose}
                    isFirstStep={true}
                  />
                </motion.div>
              )}

              {currentStep === 1 && service && (
                <motion.div
                  key="datetime-selection"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <DateTimeSelectionStep
                    selectedDate={selectedDate}
                    selectedTime={selectedTime}
                    onDateSelect={setSelectedDate}
                    onTimeSelect={setSelectedTime}
                    onNext={nextStep}
                    onBack={prevStep}
                    serviceId={service.id}
                  />
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="customer-details"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <CustomerDetailsStep
                    initialData={customerDetails || undefined}
                    onSubmit={handleCustomerDetailsSubmit}
                    onBack={prevStep}
                    isSubmitting={isSubmitting}
                  />
                </motion.div>
              )}

              {currentStep === 3 && service && selectedDate && selectedTime && customerDetails && (
                <motion.div
                  key="booking-confirmation"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <BookingConfirmationStep
                    service={service}
                    addOns={selectedAddOns}
                    selectedDate={selectedDate}
                    selectedTime={selectedTime}
                    customerDetails={customerDetails}
                    totalPrice={totalPrice}
                    totalDuration={totalDuration}
                    onBack={prevStep}
                    onNewBooking={handleNewBooking}
                    onDownloadConfirmation={handleDownloadConfirmation}
                    onShareBooking={handleShareBooking}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};