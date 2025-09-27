import React from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  DollarSign,
  MapPin,
  CheckCircle,
  Download,
  MessageCircle,
  Share2,
} from 'lucide-react';
import { Service } from '../../../types';
import { CustomerDetailsFormData } from './CustomerDetailsStep';
import { Button } from '../../ui/Button';

interface ServiceAddOn {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface BookingConfirmationStepProps {
  service: Service;
  addOns: ServiceAddOn[];
  selectedDate: Date;
  selectedTime: string;
  customerDetails: CustomerDetailsFormData;
  bookingId?: string;
  onBack: () => void;
  onNewBooking: () => void;
  onDownloadConfirmation?: () => void;
  onShareBooking?: () => void;
  totalPrice: number;
  totalDuration: number;
}

export const BookingConfirmationStep: React.FC<BookingConfirmationStepProps> = ({
  service,
  addOns,
  selectedDate,
  selectedTime,
  customerDetails,
  bookingId = 'JLI-' + Date.now(),
  onBack,
  onNewBooking,
  onDownloadConfirmation,
  onShareBooking,
  totalPrice,
  totalDuration,
}) => {
  const formatPrice = (price: number): string => {
    return `${price.toLocaleString('da-DK')} DKK`;
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}t ${remainingMinutes}min` : `${hours}t`;
  };

  const formatDateTime = (date: Date, time: string): string => {
    return `${format(date, 'EEEE d. MMMM yyyy', { locale: da })} kl. ${time}`;
  };

  // Calculate end time
  const [hours, minutes] = selectedTime.split(':').map(Number);
  const startDateTime = new Date(selectedDate);
  startDateTime.setHours(hours, minutes);
  const endDateTime = new Date(startDateTime.getTime() + totalDuration * 60000);
  const endTime = `${endDateTime.getHours().toString().padStart(2, '0')}:${endDateTime.getMinutes().toString().padStart(2, '0')}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      {/* Success Header */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-center"
      >
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>
        <h2 className="text-3xl font-serif font-bold text-brand-dark mb-4">
          Booking bekræftet!
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Din behandling er nu booket. Du modtager en bekræftelse på email inden for få minutter.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 bg-brand-accent/50 px-4 py-2 rounded-full">
          <span className="text-sm font-medium text-brand-dark">
            Booking ID: {bookingId}
          </span>
        </div>
      </motion.div>

      {/* Booking Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="bg-white rounded-2xl p-8 border border-brown-200 shadow-soft"
      >
        <h3 className="text-2xl font-serif font-semibold text-brand-dark mb-6 text-center">
          Din booking
        </h3>

        <div className="space-y-6">
          {/* Service Details */}
          <div className="flex items-start gap-6 p-6 bg-brand-accent/20 rounded-xl">
            <div className="flex-shrink-0">
              {service.images && service.images.length > 0 ? (
                <img
                  src={service.images[0]}
                  alt={service.name}
                  className="w-20 h-20 object-cover rounded-xl"
                />
              ) : (
                <div className="w-20 h-20 bg-gradient-to-br from-brand-accent to-brand-secondary rounded-xl flex items-center justify-center">
                  <span className="text-2xl">✨</span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-serif font-semibold text-brand-dark mb-2">
                {service.name}
              </h4>
              <p className="text-gray-600 text-sm mb-3">
                {service.description}
              </p>

              {addOns.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-brand-dark mb-2">Tilvalg:</h5>
                  <ul className="space-y-1">
                    {addOns.map((addOn, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-center gap-2">
                        <span>+ {addOn.name}</span>
                        <span className="text-brand-primary font-medium">
                          (+{formatPrice(addOn.price)})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Appointment Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-brand-primary" />
                <div>
                  <p className="text-sm text-gray-600">Dato og tid</p>
                  <p className="font-semibold text-brand-dark">
                    {formatDateTime(selectedDate, selectedTime)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-brand-primary" />
                <div>
                  <p className="text-sm text-gray-600">Varighed</p>
                  <p className="font-semibold text-brand-dark">
                    {formatDuration(totalDuration)} ({selectedTime} - {endTime})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-brand-primary" />
                <div>
                  <p className="text-sm text-gray-600">Lokation</p>
                  <p className="font-semibold text-brand-dark">
                    JLI Studio
                  </p>
                  <p className="text-sm text-gray-600">
                    Eksempel Gade 123, 2000 Frederiksberg
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-brand-primary" />
                <div>
                  <p className="text-sm text-gray-600">Kunde</p>
                  <p className="font-semibold text-brand-dark">
                    {customerDetails.firstName} {customerDetails.lastName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-brand-primary" />
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-semibold text-brand-dark">
                    {customerDetails.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-brand-primary" />
                <div>
                  <p className="text-sm text-gray-600">Telefon</p>
                  <p className="font-semibold text-brand-dark">
                    {customerDetails.phone}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {customerDetails.notes && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-medium text-brand-dark mb-2">Dine bemærkninger:</h4>
              <p className="text-sm text-gray-600">{customerDetails.notes}</p>
            </div>
          )}

          {/* Total Price */}
          <div className="border-t border-brown-200 pt-4">
            <div className="flex items-center justify-between text-2xl font-serif font-bold">
              <span className="text-brand-dark">Total at betale:</span>
              <div className="flex items-center gap-2 text-brand-primary">
                <DollarSign className="h-6 w-6" />
                <span>{formatPrice(totalPrice)}</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-1 text-right">
              Betaling sker ved fremmøde
            </p>
          </div>
        </div>
      </motion.div>

      {/* Next Steps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="bg-blue-50 rounded-2xl p-6 border border-blue-200"
      >
        <h3 className="text-lg font-semibold text-blue-900 mb-4">
          Hvad sker der nu?
        </h3>
        <ul className="space-y-3 text-sm text-blue-800">
          <li className="flex items-start gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
            Du modtager en bekræftelses-email med alle detaljer
          </li>
          <li className="flex items-start gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
            Vi sender en påmindelse 24 timer før din tid
          </li>
          <li className="flex items-start gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
            Du kan til enhver tid ændre eller aflyse din booking ved at kontakte os
          </li>
          <li className="flex items-start gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
            Husk at medbringe gyldig ID til din behandling
          </li>
        </ul>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <Button
          onClick={onDownloadConfirmation}
          variant="outline"
          className="flex-1 flex items-center justify-center gap-2 py-3 border-brown-300 text-brand-dark hover:bg-brand-accent"
        >
          <Download className="h-4 w-4" />
          Download bekræftelse
        </Button>

        <Button
          onClick={onShareBooking}
          variant="outline"
          className="flex-1 flex items-center justify-center gap-2 py-3 border-brown-300 text-brand-dark hover:bg-brand-accent"
        >
          <Share2 className="h-4 w-4" />
          Del booking
        </Button>

        <Button
          onClick={() => window.open('https://wa.me/4512345678', '_blank')}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white"
        >
          <MessageCircle className="h-4 w-4" />
          Kontakt på WhatsApp
        </Button>

        <Button
          onClick={onNewBooking}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand-primary hover:bg-brand-dark text-white"
        >
          Book ny behandling
        </Button>
      </motion.div>

      {/* Contact Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="text-center bg-brand-accent/30 rounded-2xl p-6 border border-brand-secondary"
      >
        <h3 className="text-lg font-semibold text-brand-dark mb-3">
          Spørgsmål til din booking?
        </h3>
        <p className="text-gray-600 mb-4">
          Kontakt os gerne, hvis du har spørgsmål eller ønsker at ændre din booking.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
          <a
            href="tel:+4512345678"
            className="flex items-center gap-2 text-brand-primary hover:underline"
          >
            <Phone className="h-4 w-4" />
            +45 12 34 56 78
          </a>
          <a
            href="mailto:booking@jli.dk"
            className="flex items-center gap-2 text-brand-primary hover:underline"
          >
            <Mail className="h-4 w-4" />
            booking@jli.dk
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
};