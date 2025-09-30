'use client'

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Button, Card, CardContent, Input } from '../../components/ui';
import { useResetPasswordMutation } from '../../store/api';

const resetSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Din adgangskode skal være mindst 8 tegn'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Adgangskoderne matcher ikke',
    path: ['confirmPassword'],
  });

type ResetForm = z.infer<typeof resetSchema>;

const useQuery = () => new URLSearchParams(useLocation().search);

export const ResetPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useQuery();
  const token = query.get('token') || '';
  const [resetPassword, { isLoading }] = useResetPasswordMutation();
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async (data: ResetForm) => {
    if (!token) {
      setError(t('auth.resetPassword.invalidToken'));
      return;
    }

    setError(null);
    try {
      await resetPassword({
        token,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      }).unwrap();
      setSuccess(true);
      reset();
      setTimeout(() => navigate('/login'), 2500);
    } catch (submissionError: any) {
      setError(
        submissionError?.data?.detail ||
          submissionError?.data?.message ||
          t('auth.resetPassword.error')
      );
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
            {t('auth.resetPassword.title')}
          </h1>
          <p className="text-gray-600">
            {t('auth.resetPassword.subtitle')}
          </p>
        </div>

        <Card>
          <CardContent className="p-8 space-y-6">
            {success ? (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-green-200 bg-green-50 p-4"
              >
                <p className="text-green-700 text-sm">
                  {t('auth.resetPassword.successMessage')}
                </p>
              </motion.div>
            ) : null}

            {error ? (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-red-200 bg-red-50 p-4"
              >
                <p className="text-red-700 text-sm">{error}</p>
              </motion.div>
            ) : null}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <Input
                label={t('auth.resetPassword.newPassword')}
                type="password"
                placeholder="••••••••"
                leftIcon={<Lock className="w-4 h-4" />}
                error={errors.newPassword?.message}
                fullWidth
                {...register('newPassword')}
              />

              <Input
                label={t('auth.resetPassword.confirmPassword')}
                type="password"
                placeholder="••••••••"
                leftIcon={<Lock className="w-4 h-4" />}
                error={errors.confirmPassword?.message}
                fullWidth
                {...register('confirmPassword')}
              />

              <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
                {t('auth.resetPassword.submit')}
              </Button>
            </form>

            <div className="text-center text-sm text-gray-600">
              <Link
                to="/login"
                className="text-brand-primary hover:text-brand-dark font-medium"
              >
                {t('auth.resetPassword.backToLogin')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
