import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, User, Mail, Phone, Shield, Check, AlertCircle } from 'lucide-react';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardContent } from '../ui';
import { useRoleAccess } from '../../hooks/useRoleAccess';
import { registrationSchema, adminRegistrationSchema, type RegistrationInput, type AdminRegistrationInput } from '../../schemas/auth';

interface RegistrationFormProps {
  isAdminRegistration?: boolean;
  onSubmit: (data: RegistrationInput | AdminRegistrationInput) => Promise<void>;
  isLoading?: boolean;
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({
  isAdminRegistration = false,
  onSubmit,
  isLoading = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { isAdmin, getAccessibleRoles, getRoleDisplayName } = useRoleAccess();

  // Use appropriate schema based on registration type
  const schema = isAdminRegistration && isAdmin() ? adminRegistrationSchema : registrationSchema;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<RegistrationInput | AdminRegistrationInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: 'customer',
      language: 'da',
      marketingConsent: false,
      agreedToTerms: false,
      ...(isAdminRegistration && { sendWelcomeEmail: true }),
    },
  });

  const watchedRole = watch('role');
  const watchedPassword = watch('password');

  const handleFormSubmit = async (data: RegistrationInput | AdminRegistrationInput) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  const roleOptions = getAccessibleRoles().map(role => ({
    value: role,
    label: getRoleDisplayName(role),
  }));

  const languageOptions = [
    { value: 'da', label: 'Dansk' },
    { value: 'en', label: 'English' },
  ];

  const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
    if (!password) return { score: 0, label: 'Enter password', color: 'text-gray-400' };

    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    const levels = [
      { score: 1, label: 'Very Weak', color: 'text-red-500' },
      { score: 2, label: 'Weak', color: 'text-orange-500' },
      { score: 3, label: 'Fair', color: 'text-yellow-500' },
      { score: 4, label: 'Good', color: 'text-blue-500' },
      { score: 5, label: 'Strong', color: 'text-green-500' },
    ];

    return levels.find(level => score <= level.score) || levels[levels.length - 1];
  };

  const passwordStrength = getPasswordStrength(watchedPassword || '');

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold text-brand-dark">
          {isAdminRegistration ? 'Create New User Account' : 'Create Your Account'}
        </CardTitle>
        {isAdminRegistration && (
          <p className="text-center text-gray-600 mt-2">
            Register a new user with specific role permissions
          </p>
        )}
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" noValidate>
          {/* Personal Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-brand-dark flex items-center">
              <User className="w-5 h-5 mr-2" />
              Personal Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                {...register('name')}
                label="Full Name"
                placeholder="Enter your full name"
                error={errors.name?.message}
                leftIcon={<User className="w-4 h-4" />}
                fullWidth
                required
              />

              <Input
                {...register('email')}
                label="Email Address"
                type="email"
                placeholder="Enter your email"
                error={errors.email?.message}
                leftIcon={<Mail className="w-4 h-4" />}
                fullWidth
                required
              />
            </div>

            <Input
              {...register('phone')}
              label="Phone Number"
              type="tel"
              placeholder="+45 12 34 56 78"
              error={errors.phone?.message}
              helperText="Optional - for appointment reminders"
              leftIcon={<Phone className="w-4 h-4" />}
              fullWidth
            />
          </div>

          {/* Role Selection (Admin only) */}
          {isAdminRegistration && isAdmin() && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-brand-dark flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Role & Permissions
              </h3>

              <Select
                {...register('role')}
                label="User Role"
                options={roleOptions}
                error={errors.role?.message}
                helperText="Determines the user's access level and permissions"
                fullWidth
                required
              />
            </div>
          )}

          {/* Security Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-brand-dark">Security</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  {...register('password')}
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  error={errors.password?.message}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  fullWidth
                  required
                />
                {watchedPassword && (
                  <div className="mt-2">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            passwordStrength.score >= 4 ? 'bg-green-500' :
                            passwordStrength.score >= 3 ? 'bg-blue-500' :
                            passwordStrength.score >= 2 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs ${passwordStrength.color}`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <Input
                {...register('confirmPassword')}
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                error={errors.confirmPassword?.message}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                fullWidth
                required
              />
            </div>
          </div>

          {/* Preferences Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-brand-dark">Preferences</h3>

            <Select
              {...register('language')}
              label="Preferred Language"
              options={languageOptions}
              error={errors.language?.message}
              fullWidth
              required
            />
          </div>

          {/* Consent Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-brand-dark">Consent & Agreements</h3>

            <div className="space-y-3">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  {...register('agreedToTerms')}
                  type="checkbox"
                  className="mt-1 h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                />
                <div className="flex-1">
                  <span className="text-sm text-brand-dark">
                    I agree to the{' '}
                    <a href="/terms" className="text-brand-primary hover:underline" target="_blank">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="/privacy" className="text-brand-primary hover:underline" target="_blank">
                      Privacy Policy
                    </a>
                    <span className="text-red-500 ml-1">*</span>
                  </span>
                  {errors.agreedToTerms && (
                    <p className="text-sm text-red-600 mt-1">{errors.agreedToTerms.message}</p>
                  )}
                </div>
              </label>

              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  {...register('marketingConsent')}
                  type="checkbox"
                  className="mt-1 h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                />
                <span className="text-sm text-gray-600">
                  I would like to receive promotional emails and updates about new services
                </span>
              </label>

              {isAdminRegistration && 'sendWelcomeEmail' in schema.shape && (
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    {...register('sendWelcomeEmail' as keyof (RegistrationInput | AdminRegistrationInput))}
                    type="checkbox"
                    className="mt-1 h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-600">
                    Send welcome email to the user with login instructions
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Role Information Display */}
          {watchedRole && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-blue-50 border border-blue-200 rounded-lg p-4"
            >
              <h4 className="font-medium text-blue-900 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Role: {getRoleDisplayName(watchedRole)}
              </h4>
              <p className="text-sm text-blue-700 mt-1">
                {watchedRole === 'admin' && 'Full system access including user management and analytics.'}
                {watchedRole === 'loctician' && 'Can manage appointments, services, and client interactions.'}
                {watchedRole === 'customer' && 'Can book appointments and manage personal profile.'}
              </p>
            </motion.div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading || isSubmitting}
            disabled={isLoading || isSubmitting}
          >
            {isAdminRegistration ? 'Create User Account' : 'Create Account'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};