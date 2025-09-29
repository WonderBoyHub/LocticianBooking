import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button, Card, CardContent, Input } from '../../components/ui';
import { useRequestPasswordResetMutation } from '../../store/api';

const forgotPasswordSchema = z.object({
  email: z.string().email('Indtast en gyldig e-mail'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const [requestReset, { isLoading }] = useRequestPasswordResetMutation();
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setError(null);
    try {
      await requestReset({ email: data.email }).unwrap();
      setSubmitted(true);
      reset();
    } catch (submissionError: any) {
      setError(
        submissionError?.data?.detail ||
          submissionError?.data?.message ||
          t('auth.forgotPassword.error')
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
            {t('auth.forgotPassword.title')}
          </h1>
          <p className="text-gray-600">
            {t('auth.forgotPassword.subtitle')}
          </p>
        </div>

        <Card>
          <CardContent className="p-8 space-y-6">
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-green-200 bg-green-50 p-4"
              >
                <p className="text-green-700 text-sm">
                  {t('auth.forgotPassword.successMessage')}
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
                label={t('auth.login.email')}
                type="email"
                placeholder="din.email@example.com"
                leftIcon={<Mail className="w-4 h-4" />}
                error={errors.email?.message}
                fullWidth
                {...register('email')}
              />

              <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
                {t('auth.forgotPassword.submit')}
              </Button>
            </form>

            <div className="text-center text-sm text-gray-600">
              <Link
                to="/login"
                className="text-brand-primary hover:text-brand-dark font-medium"
              >
                {t('auth.forgotPassword.backToLogin')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
