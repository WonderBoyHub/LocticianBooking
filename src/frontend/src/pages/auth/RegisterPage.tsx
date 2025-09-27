import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { loginSuccess, selectIsAuthenticated } from '../../store/slices/authSlice';
import { useRegisterMutation } from '../../store/api';
import { Button, Input, Card, CardContent } from '../../components/ui';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(8, 'Please enter a valid phone number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  agreeTerms: z.boolean().refine(val => val === true, 'You must accept the terms and conditions'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [register] = useRegisterMutation();

  const {
    register: registerField,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (data: RegisterForm) => {
    try {
      const { confirmPassword, agreeTerms, ...registerData } = data;
      const result = await register(registerData).unwrap();

      if (result.success) {
        dispatch(loginSuccess(result.data));
      } else {
        setError('root', { message: result.message || 'Registration failed' });
      }
    } catch (error: any) {
      setError('root', { message: error.data?.message || 'Registration failed' });
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
              <Input
                label={t('auth.register.name')}
                placeholder="Enter your full name"
                leftIcon={<User className="w-4 h-4" />}
                error={errors.name?.message}
                fullWidth
                {...registerField('name')}
              />

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

              {/* Terms agreement */}
              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="agreeTerms"
                  className="mt-1 w-4 h-4 text-brand-primary bg-gray-100 border-gray-300 rounded focus:ring-brand-primary focus:ring-2"
                  {...registerField('agreeTerms')}
                />
                <label htmlFor="agreeTerms" className="ml-3 text-sm text-gray-600">
                  {t('auth.register.agreeTerms')}
                  <Link to="/terms" className="text-brand-primary hover:text-brand-dark ml-1">
                    terms and conditions
                  </Link>
                </label>
              </div>
              {errors.agreeTerms && (
                <p className="text-red-600 text-sm">{errors.agreeTerms.message}</p>
              )}

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