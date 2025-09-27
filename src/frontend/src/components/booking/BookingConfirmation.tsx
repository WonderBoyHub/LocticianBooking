import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, Calendar, Clock, User, Mail, Phone, CreditCard, AlertCircle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectCurrentBooking,
  resetBooking,
  previousStep,
} from '../../store/slices/bookingSlice';
import { useCreateAppointmentMutation } from '../../store/api';
import { addNotification } from '../../store/slices/uiSlice';
import { Button, Card, CardContent, LoadingSpinner } from '../ui';
import { formatDate, formatTime, formatCurrency, formatPhoneNumber } from '../../i18n';
import { clsx } from 'clsx';

interface BookingSummaryProps {
  booking: any;
}

const BookingSummary: React.FC<BookingSummaryProps> = ({ booking }) => {
  const { t } = useTranslation();

  if (!booking.selectedService || !booking.selectedDate || !booking.selectedTime) {
    return null;
  }

  const summaryItems = [
    {
      icon: <Calendar className="w-5 h-5" />,
      label: t('booking.confirmation.date'),
      value: formatDate(booking.selectedDate),
    },
    {
      icon: <Clock className="w-5 h-5" />,
      label: t('booking.confirmation.time'),
      value: formatTime(booking.selectedTime),
    },
    {
      icon: <User className="w-5 h-5" />,
      label: t('booking.confirmation.customer'),
      value: booking.customerInfo.name,
    },
    {
      icon: <Mail className="w-5 h-5" />,
      label: 'Email',
      value: booking.customerInfo.email,
    },
    {
      icon: <Phone className="w-5 h-5" />,
      label: 'Phone',
      value: formatPhoneNumber(booking.customerInfo.phone),
    },
  ];

  return (
    <Card className="border-2 border-brand-primary">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-brand-dark mb-4">
          {t('booking.confirmation.summary')}
        </h3>

        {/* Service info */}
        <div className="bg-brand-accent rounded-lg p-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold text-brand-dark text-lg">
                {booking.selectedService.name}
              </h4>
              <p className="text-gray-600 text-sm mt-1">
                {booking.selectedService.description}
              </p>
              <div className="flex items-center mt-2 text-sm text-gray-500">
                <Clock className="w-4 h-4 mr-1" />
                <span>{booking.selectedService.duration} {t('time.minutes')}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-brand-primary">
                {formatCurrency(booking.selectedService.price)}
              </div>
            </div>
          </div>
        </div>

        {/* Booking details */}
        <div className="space-y-4">
          {summaryItems.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center"
            >
              <div className="text-brand-primary mr-3">
                {item.icon}
              </div>
              <div className="flex-1">
                <div className="text-sm text-gray-500">{item.label}</div>
                <div className="font-medium text-gray-900">{item.value}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Notes */}
        {booking.customerInfo.notes && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h5 className="font-medium text-gray-900 mb-2">Additional Notes</h5>
            <p className="text-gray-600 text-sm">{booking.customerInfo.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const BookingConfirmation: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const booking = useAppSelector(selectCurrentBooking);

  const [isConfirmed, setIsConfirmed] = useState(false);
  const [bookingReference, setBookingReference] = useState<string>('');

  const [createAppointment, { isLoading: isSubmitting }] = useCreateAppointmentMutation();

  const handleConfirmBooking = async () => {
    try {
      const bookingData = {
        serviceId: booking.selectedService!.id,
        date: booking.selectedDate!,
        time: booking.selectedTime!,
        customerInfo: booking.customerInfo,
      };

      const result = await createAppointment(bookingData).unwrap();

      if (result.success) {
        setBookingReference(result.data.id);
        setIsConfirmed(true);

        dispatch(addNotification({
          type: 'success',
          title: t('success.bookingConfirmed'),
          message: 'Your appointment has been successfully booked!',
          duration: 0, // Don't auto-dismiss success notification
        }));
      }
    } catch (error: any) {
      dispatch(addNotification({
        type: 'error',
        title: 'Booking Failed',
        message: error.data?.message || 'Unable to book appointment. Please try again.',
      }));
    }
  };

  const handleBack = () => {
    dispatch(previousStep());
  };

  const handleNewBooking = () => {
    dispatch(resetBooking());
  };

  // Success state
  if (isConfirmed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        {/* Success icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <Check className="w-10 h-10 text-green-600" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-3xl font-bold text-green-600 mb-2">
            {t('booking.confirmation.success.title')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('booking.confirmation.success.message')}
          </p>

          {/* Booking reference */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="text-sm text-green-700 font-medium">
              {t('booking.confirmation.success.reference')}
            </div>
            <div className="text-lg font-mono font-bold text-green-800">
              #{bookingReference}
            </div>
          </div>

          {/* Next steps */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <h4 className="font-medium text-blue-800 mb-2">What happens next?</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• You'll receive a confirmation email shortly</li>
              <li>• We'll send you a reminder 24 hours before your appointment</li>
              <li>• If you need to reschedule, please call us at least 24 hours in advance</li>
            </ul>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="outline"
              onClick={handleNewBooking}
            >
              Book Another Appointment
            </Button>
            <Button
              onClick={() => window.location.href = '/'}
            >
              Return to Home
            </Button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // Confirmation form
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-dark mb-2">
          {t('booking.confirmation.title')}
        </h2>
        <p className="text-gray-600">
          Please review your booking details and confirm your appointment
        </p>
      </div>

      {/* Booking summary */}
      <div className="mb-8">
        <BookingSummary booking={booking} />
      </div>

      {/* Important notice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6"
      >
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-yellow-800 mb-1">Important Notice</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Please arrive 10 minutes before your scheduled time</li>
              <li>• Cancellations must be made at least 24 hours in advance</li>
              <li>• A confirmation email will be sent to your provided email address</li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Payment information (if applicable) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8"
      >
        <div className="flex items-center mb-2">
          <CreditCard className="w-5 h-5 text-gray-600 mr-2" />
          <h4 className="font-medium text-gray-900">Payment</h4>
        </div>
        <p className="text-sm text-gray-600">
          Payment will be collected at the time of your appointment. We accept cash, card, and mobile payments.
        </p>
      </motion.div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={isSubmitting}
        >
          {t('common.back')}
        </Button>
        <Button
          onClick={handleConfirmBooking}
          disabled={isSubmitting}
          size="lg"
          className="min-w-[160px]"
        >
          {isSubmitting ? (
            <div className="flex items-center">
              <LoadingSpinner size="sm" className="mr-2" />
              Booking...
            </div>
          ) : (
            t('booking.confirmation.confirmBooking')
          )}
        </Button>
      </div>
    </div>
  );
};