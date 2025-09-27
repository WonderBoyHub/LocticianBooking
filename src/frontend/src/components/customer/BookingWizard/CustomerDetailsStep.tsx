import React from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Phone, Mail, MessageSquare, Shield, Info } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';

const customerDetailsSchema = z.object({
  firstName: z.string()
    .min(2, 'Fornavn skal være mindst 2 karakterer')
    .max(50, 'Fornavn må ikke overstige 50 karakterer'),
  lastName: z.string()
    .min(2, 'Efternavn skal være mindst 2 karakterer')
    .max(50, 'Efternavn må ikke overstige 50 karakterer'),
  email: z.string()
    .email('Indtast en gyldig email-adresse')
    .max(100, 'Email må ikke overstige 100 karakterer'),
  phone: z.string()
    .min(8, 'Telefonnummer skal være mindst 8 cifre')
    .regex(/^[\d\s\+\-\(\)]+$/, 'Indtast et gyldigt telefonnummer'),
  notes: z.string()
    .max(500, 'Bemærkninger må ikke overstige 500 karakterer')
    .optional(),
  agreedToTerms: z.boolean()
    .refine(val => val === true, 'Du skal acceptere handelsbetingelserne'),
  marketingConsent: z.boolean().optional(),
});

export type CustomerDetailsFormData = z.infer<typeof customerDetailsSchema>;

interface CustomerDetailsStepProps {
  initialData?: Partial<CustomerDetailsFormData>;
  onSubmit: (data: CustomerDetailsFormData) => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

export const CustomerDetailsStep: React.FC<CustomerDetailsStepProps> = ({
  initialData,
  onSubmit,
  onBack,
  isSubmitting = false,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    watch,
  } = useForm<CustomerDetailsFormData>({
    resolver: zodResolver(customerDetailsSchema),
    defaultValues: {
      firstName: initialData?.firstName || '',
      lastName: initialData?.lastName || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      notes: initialData?.notes || '',
      agreedToTerms: initialData?.agreedToTerms || false,
      marketingConsent: initialData?.marketingConsent || false,
    },
    mode: 'onChange',
  });

  const notesValue = watch('notes') || '';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-serif font-semibold text-brand-dark mb-2">
          Dine oplysninger
        </h2>
        <p className="text-gray-600">
          Indtast dine kontaktoplysninger for at gennemføre bookingen
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Personal Information */}
        <div className="bg-white rounded-2xl p-6 border border-brown-200 shadow-soft">
          <h3 className="text-lg font-semibold text-brand-dark mb-6 flex items-center gap-2">
            <User className="h-5 w-5" />
            Personlige oplysninger
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-brand-dark mb-2">
                Fornavn *
              </label>
              <Input
                id="firstName"
                type="text"
                {...register('firstName')}
                className={`w-full ${errors.firstName ? 'border-red-300 focus:border-red-500' : ''}`}
                placeholder="Indtast dit fornavn"
              />
              {errors.firstName && (
                <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-brand-dark mb-2">
                Efternavn *
              </label>
              <Input
                id="lastName"
                type="text"
                {...register('lastName')}
                className={`w-full ${errors.lastName ? 'border-red-300 focus:border-red-500' : ''}`}
                placeholder="Indtast dit efternavn"
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-2xl p-6 border border-brown-200 shadow-soft">
          <h3 className="text-lg font-semibold text-brand-dark mb-6 flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Kontaktoplysninger
          </h3>

          <div className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-brand-dark mb-2">
                Email-adresse *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  className={`w-full pl-10 ${errors.email ? 'border-red-300 focus:border-red-500' : ''}`}
                  placeholder="din@email.dk"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-brand-dark mb-2">
                Telefonnummer *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  {...register('phone')}
                  className={`w-full pl-10 ${errors.phone ? 'border-red-300 focus:border-red-500' : ''}`}
                  placeholder="+45 12 34 56 78"
                />
              </div>
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Additional Notes */}
        <div className="bg-white rounded-2xl p-6 border border-brown-200 shadow-soft">
          <h3 className="text-lg font-semibold text-brand-dark mb-6 flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Bemærkninger{' '}
            <span className="text-sm font-normal text-gray-600">(Valgfrit)</span>
          </h3>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-brand-dark mb-2">
              Specielle ønsker eller bemærkninger
            </label>
            <textarea
              id="notes"
              {...register('notes')}
              rows={4}
              className={`w-full px-4 py-3 rounded-xl border border-brown-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 resize-none ${
                errors.notes ? 'border-red-300 focus:border-red-500' : ''
              }`}
              placeholder="Har du specielle ønsker til behandlingen? Allergier? Andre vigtige oplysninger?"
            />
            <div className="flex justify-between mt-2">
              {errors.notes && (
                <p className="text-sm text-red-600">{errors.notes.message}</p>
              )}
              <div className="ml-auto text-sm text-gray-500">
                {notesValue.length}/500
              </div>
            </div>
          </div>
        </div>

        {/* Terms and Consent */}
        <div className="bg-brand-accent/30 rounded-2xl p-6 border border-brand-secondary">
          <h3 className="text-lg font-semibold text-brand-dark mb-6 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Betingelser og samtykke
          </h3>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <input
                id="agreedToTerms"
                type="checkbox"
                {...register('agreedToTerms')}
                className={`mt-1 h-4 w-4 rounded border-brown-300 text-brand-primary focus:ring-brand-primary/20 ${
                  errors.agreedToTerms ? 'border-red-300' : ''
                }`}
              />
              <div>
                <label htmlFor="agreedToTerms" className="text-sm text-brand-dark cursor-pointer">
                  Jeg accepterer{' '}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-primary hover:underline font-medium"
                  >
                    handelsbetingelserne
                  </a>
                  {' '}og{' '}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-primary hover:underline font-medium"
                  >
                    privatlivspolitikken
                  </a>
                  {' '}*
                </label>
                {errors.agreedToTerms && (
                  <p className="mt-1 text-sm text-red-600">{errors.agreedToTerms.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                id="marketingConsent"
                type="checkbox"
                {...register('marketingConsent')}
                className="mt-1 h-4 w-4 rounded border-brown-300 text-brand-primary focus:ring-brand-primary/20"
              />
              <label htmlFor="marketingConsent" className="text-sm text-brand-dark cursor-pointer">
                Jeg vil gerne modtage markedsføring og tilbud via email og SMS
                <div className="text-xs text-gray-600 mt-1">
                  Du kan til enhver tid afmelde dig igen
                </div>
              </label>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">Beskyttelse af dine data</p>
                <p>
                  Dine oplysninger behandles fortroligt og bruges kun til bookingformål.
                  Du kan til enhver tid anmode om sletning af dine data.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-6">
          <Button
            type="button"
            onClick={onBack}
            variant="outline"
            className="px-6 py-3 border-brown-300 text-brand-dark hover:bg-brand-accent"
          >
            Tilbage
          </Button>

          <Button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="px-6 py-3 bg-brand-primary hover:bg-brand-dark text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                </motion.div>
                Behandler...
              </>
            ) : (
              'Fortsæt til Bekræftelse'
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
};