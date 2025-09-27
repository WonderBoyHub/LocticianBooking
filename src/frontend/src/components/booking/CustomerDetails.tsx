import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { User, Mail, Phone, MessageSquare } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  updateCustomerInfo,
  nextStep,
  previousStep,
  selectCustomerInfo,
} from '../../store/slices/bookingSlice';
import { Button, Input } from '../ui';

// Validation schema
const customerDetailsSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(8, 'Please enter a valid phone number'),
  notes: z.string().optional(),
});

type CustomerDetailsForm = z.infer<typeof customerDetailsSchema>;

export const CustomerDetails: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const customerInfo = useAppSelector(selectCustomerInfo);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<CustomerDetailsForm>({
    resolver: zodResolver(customerDetailsSchema),
    defaultValues: {
      name: customerInfo.name,
      email: customerInfo.email,
      phone: customerInfo.phone,
      notes: customerInfo.notes,
    },
    mode: 'onChange',
  });

  // Watch form values to update store in real-time
  const formValues = watch();
  React.useEffect(() => {
    dispatch(updateCustomerInfo(formValues));
  }, [formValues, dispatch]);

  const onSubmit = (data: CustomerDetailsForm) => {
    dispatch(updateCustomerInfo(data));
    dispatch(nextStep());
  };

  const handleBack = () => {
    dispatch(previousStep());
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-dark mb-2">
          {t('booking.details.title')}
        </h2>
        <p className="text-gray-600">
          Please provide your contact information so we can confirm your appointment
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Name */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Input
            label={t('booking.details.name')}
            placeholder="Enter your full name"
            leftIcon={<User className="w-4 h-4" />}
            error={errors.name?.message}
            required
            fullWidth
            {...register('name')}
          />
        </motion.div>

        {/* Email */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Input
            label={t('booking.details.email')}
            type="email"
            placeholder="your.email@example.com"
            leftIcon={<Mail className="w-4 h-4" />}
            error={errors.email?.message}
            required
            fullWidth
            {...register('email')}
          />
        </motion.div>

        {/* Phone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Input
            label={t('booking.details.phone')}
            type="tel"
            placeholder="+45 12 34 56 78"
            leftIcon={<Phone className="w-4 h-4" />}
            error={errors.phone?.message}
            helperText="We'll use this to send appointment reminders"
            required
            fullWidth
            {...register('phone')}
          />
        </motion.div>

        {/* Notes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="space-y-2">
            <label className="block text-sm font-medium text-brand-dark">
              {t('booking.details.notes')}
              <span className="text-gray-500 font-normal ml-1">
                ({t('common.optional')})
              </span>
            </label>
            <div className="relative">
              <textarea
                className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all duration-200 resize-none"
                rows={4}
                placeholder={t('booking.details.notesPlaceholder')}
                {...register('notes')}
              />
              <div className="absolute top-3 left-3 pointer-events-none">
                <MessageSquare className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Privacy notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-blue-50 border border-blue-200 rounded-lg p-4"
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-blue-800">Privacy Notice</h4>
              <p className="mt-1 text-sm text-blue-700">
                Your personal information will only be used to manage your appointment and send you relevant updates.
                We never share your data with third parties.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Navigation buttons */}
        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
          >
            {t('common.back')}
          </Button>
          <Button
            type="submit"
            disabled={!isValid}
            size="lg"
          >
            {t('common.next')}
          </Button>
        </div>
      </form>
    </div>
  );
};