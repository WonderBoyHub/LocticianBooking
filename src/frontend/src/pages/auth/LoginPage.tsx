import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { loginStart, loginSuccess, loginFailure, selectIsAuthenticated, selectAuthLoading, selectAuthError } from '../../store/slices/authSlice';
import { useLoginMutation } from '../../store/api';
import { Button, Input, Card, CardContent } from '../../components/ui';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const location = useLocation();

  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectAuthLoading);
  const error = useAppSelector(selectAuthError);

  const [showPassword, setShowPassword] = React.useState(false);
  const [login] = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  // Redirect if already authenticated
  if (isAuthenticated) {
    const from = (location.state as any)?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (data: LoginForm) => {
    try {
      dispatch(loginStart());
      const result = await login(data).unwrap();

      if (result.success) {
        dispatch(loginSuccess(result.data));
      } else {
        dispatch(loginFailure(result.message || 'Login failed'));
      }
    } catch (error: any) {
      dispatch(loginFailure(error.data?.message || 'Login failed'));
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
            {t('auth.login.title')}
          </h1>
          <p className="text-gray-600">
            {t('auth.login.subtitle')}
          </p>
        </div>

        <Card>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Error message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 rounded-lg p-4"
                >
                  <p className="text-red-700 text-sm">{error}</p>
                </motion.div>
              )}

              {/* Email */}
              <Input
                label={t('auth.login.email')}
                type="email"
                placeholder="your.email@example.com"
                leftIcon={<Mail className="w-4 h-4" />}
                error={errors.email?.message}
                fullWidth
                {...register('email')}
              />

              {/* Password */}
              <div className="relative">
                <Input
                  label={t('auth.login.password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
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
                  {...register('password')}
                />
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                fullWidth
                size="lg"
                isLoading={isSubmitting || isLoading}
              >
                {t('auth.login.title')}
              </Button>

              {/* Links */}
              <div className="text-center space-y-2">
                <Link
                  to="/forgot-password"
                  className="text-sm text-brand-primary hover:text-brand-dark"
                >
                  {t('auth.login.forgotPassword')}
                </Link>
                <div className="text-sm text-gray-600">
                  {t('auth.login.noAccount')}{' '}
                  <Link
                    to="/register"
                    className="text-brand-primary hover:text-brand-dark font-medium"
                  >
                    {t('auth.login.signUp')}
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