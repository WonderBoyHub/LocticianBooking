'use client'

import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import { selectIsAuthenticated } from '../../store/slices/authSlice';
import { useRegisterMutation } from '../../store/api';
import { Button, Input, Card, CardContent } from '../../components/ui';
import type { RegisterApiResponse } from '../../types';

const registerSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, 'First name must be at least 2 characters long'),
  lastName: z
    .string()
    .trim()
    .min(2, 'Last name must be at least 2 characters long'),
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address'),
  phone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine(
      value => !value || value.replace(/\D/g, '').length >= 8,
      'Please enter a valid phone number'
    ),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  marketingConsent: z.boolean(),
  gdprConsent: z.boolean().refine(val => val === true, 'You must accept the GDPR terms'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [register] = useRegisterMutation();
  const [successResponse, setSuccessResponse] = React.useState<RegisterApiResponse | null>(null);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
    reset,
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      marketingConsent: false,
      gdprConsent: false,
    },
  });

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (data: RegisterForm) => {
    try {
      clearErrors('root');
      setSuccessResponse(null);

      const payload = {
        email: data.email,
        password: data.password,
        confirm_password: data.confirmPassword,
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone?.trim() || undefined,
        role: 'customer' as const,
        marketing_consent: data.marketingConsent,
        gdpr_consent: data.gdprConsent,
      };

      const response = await register(payload).unwrap();
      setSuccessResponse(response);
      reset({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        marketingConsent: false,
        gdprConsent: false,
      });
    } catch (error: any) {
      const message =
        error?.data?.detail ||
        error?.data?.message ||
        error?.data?.errors?.[0]?.message ||
        'Registration failed';
      setError('root', { message });
    }
  };

  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-dark mb-2">
            {t('auth.register.title')}
          </h1>
          <p className="text-gray-600">
            {t('auth.register.subtitle')}
          </p>
        </div>

        {successResponse && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6"
          >
            <h2 className="text-lg font-semibold text-green-700 mb-2">
              {t('auth.register.successTitle')}
            </h2>
            <p className="text-sm text-green-800 mb-4">
              {successResponse.message}
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              {t('auth.register.goToLogin')}
            </Link>
          </motion.div>
        )}

        <Card>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Error message */}
              {errors.root && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 rounded-lg p-4"
                >
                  <p className="text-red-700 text-sm">{errors.root.message}</p>
                </motion.div>
              )}

              {/* Name */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label={t('auth.register.firstName')}
                  placeholder="Enter your first name"
                  leftIcon={<User className="w-4 h-4" />}
                  error={errors.firstName?.message}
                  fullWidth
                  {...registerField('firstName')}
                />
                <Input
                  label={t('auth.register.lastName')}
                  placeholder="Enter your last name"
                  leftIcon={<User className="w-4 h-4" />}
                  error={errors.lastName?.message}
                  fullWidth
                  {...registerField('lastName')}
                />
              </div>

              {/* Email */}
              <Input
                label={t('auth.register.email')}
                type="email"
                placeholder="your.email@example.com"
                leftIcon={<Mail className="w-4 h-4" />}
                error={errors.email?.message}
                fullWidth
                {...registerField('email')}
              />

              {/* Phone */}
              <Input
                label={t('auth.register.phone')}
                type="tel"
                placeholder="+45 12 34 56 78"
                leftIcon={<Phone className="w-4 h-4" />}
                error={errors.phone?.message}
                fullWidth
                {...registerField('phone')}
              />

              {/* Password */}
              <Input
                label={t('auth.register.password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a strong password"
                leftIcon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                error={errors.password?.message}
                fullWidth
                {...registerField('password')}
              />

              {/* Confirm Password */}
              <Input
                label={t('auth.register.confirmPassword')}
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                leftIcon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                error={errors.confirmPassword?.message}
                fullWidth
                {...registerField('confirmPassword')}
              />

              {/* Consents */}
              <div className="space-y-3">
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="gdprConsent"
                    className="mt-1 w-4 h-4 text-brand-primary bg-gray-100 border-gray-300 rounded focus:ring-brand-primary focus:ring-2"
                    {...registerField('gdprConsent')}
                  />
                  <label htmlFor="gdprConsent" className="ml-3 text-sm text-gray-600">
                    {t('auth.register.gdprConsent')}{' '}
                    <Link to="/terms" className="text-brand-primary hover:text-brand-dark">
                      {t('auth.register.termsLink')}
                    </Link>
                  </label>
                </div>
                {errors.gdprConsent && (
                  <p className="text-red-600 text-sm">{errors.gdprConsent.message}</p>
                )}

                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="marketingConsent"
                    className="mt-1 w-4 h-4 text-brand-primary bg-gray-100 border-gray-300 rounded focus:ring-brand-primary focus:ring-2"
                    {...registerField('marketingConsent')}
                  />
                  <label htmlFor="marketingConsent" className="ml-3 text-sm text-gray-600">
                    {t('auth.register.marketingConsent')}
                  </label>
                </div>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                fullWidth
                size="lg"
                isLoading={isSubmitting}
              >
                {t('auth.register.title')}
              </Button>

              {/* Links */}
              <div className="text-center">
                <div className="text-sm text-gray-600">
                  {t('auth.register.hasAccount')}{' '}
                  <Link
                    to="/login"
                    className="text-brand-primary hover:text-brand-dark font-medium"
                  >
                    {t('auth.register.signIn')}
                  </Link>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
