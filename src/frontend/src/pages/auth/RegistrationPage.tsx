import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowLeft, UserPlus } from 'lucide-react';
import { RegistrationForm } from '../../components/auth/RegistrationForm';
import { Button, Card, CardContent } from '../../components/ui';
import { useRoleAccess } from '../../hooks/useRoleAccess';
import { loginSuccess } from '../../store/slices/authSlice';
import type { RegistrationInput, AdminRegistrationInput } from '../../schemas/auth';
import type { User } from '../../types';

// This would typically come from your API service
const registerUser = async (userData: RegistrationInput | AdminRegistrationInput) => {
  // Simulate API call
  return new Promise<{ user: User; token: string }>((resolve, reject) => {
    setTimeout(() => {
      if (userData.email === 'test@error.com') {
        reject(new Error('Email already exists'));
        return;
      }

      const user: User = {
        id: Date.now().toString(),
        name: userData.name,
        email: userData.email,
        phone: userData.phone || undefined,
        role: userData.role,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        preferences: {
          language: userData.language,
          notifications: {
            email: userData.marketingConsent || false,
            sms: false,
            push: false,
          },
          timezone: 'Europe/Copenhagen',
        },
      };

      const token = 'mock_jwt_token_' + Date.now();

      resolve({ user, token });
    }, 2000);
  });
};

export const RegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const { isAdmin } = useRoleAccess();

  const [registrationState, setRegistrationState] = useState<'form' | 'success' | 'error'>('form');
  const [registrationError, setRegistrationError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<User | null>(null);

  // Check if this is admin registration
  const isAdminRegistration = searchParams.get('admin') === 'true' && isAdmin();

  const handleRegistration = async (data: RegistrationInput | AdminRegistrationInput) => {
    setIsLoading(true);
    setRegistrationError('');

    try {
      const { user, token } = await registerUser(data);

      // If not admin registration, log the user in immediately
      if (!isAdminRegistration) {
        dispatch(loginSuccess({ user, token }));
        navigate('/customer/dashboard');
      } else {
        // For admin registration, show success state
        setRegisteredUser(user);
        setRegistrationState('success');
      }
    } catch (error) {
      console.error('Registration failed:', error);
      setRegistrationError(error instanceof Error ? error.message : 'Registration failed. Please try again.');
      setRegistrationState('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    navigate('/admin/dashboard');
  };

  const handleCreateAnotherUser = () => {
    setRegistrationState('form');
    setRegisteredUser(null);
    setRegistrationError('');
  };

  if (registrationState === 'success') {
    return (
      <div className="min-h-screen bg-brand-accent flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="w-full max-w-md mx-auto text-center">
            <CardContent className="pt-8 pb-8">
              <div className="mb-6">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-brand-dark mb-2">User Created Successfully!</h2>
                <p className="text-gray-600">
                  {registeredUser?.name} has been registered with the role of{' '}
                  <span className="font-medium">{registeredUser?.role}</span>.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleCreateAnotherUser}
                  variant="primary"
                  fullWidth
                  leftIcon={<UserPlus className="w-4 h-4" />}
                >
                  Create Another User
                </Button>

                <Button
                  onClick={handleBackToDashboard}
                  variant="outline"
                  fullWidth
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (registrationState === 'error') {
    return (
      <div className="min-h-screen bg-brand-accent flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="w-full max-w-md mx-auto text-center">
            <CardContent className="pt-8 pb-8">
              <div className="mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-red-500 text-2xl">✕</span>
                </div>
                <h2 className="text-2xl font-bold text-brand-dark mb-2">Registration Failed</h2>
                <p className="text-red-600 mb-4">{registrationError}</p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => {
                    setRegistrationState('form');
                    setRegistrationError('');
                  }}
                  variant="primary"
                  fullWidth
                >
                  Try Again
                </Button>

                {isAdminRegistration && (
                  <Button
                    onClick={handleBackToDashboard}
                    variant="outline"
                    fullWidth
                    leftIcon={<ArrowLeft className="w-4 h-4" />}
                  >
                    Back to Dashboard
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-accent">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            {isAdminRegistration ? (
              <Button
                onClick={handleBackToDashboard}
                variant="ghost"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back to Dashboard
              </Button>
            ) : (
              <Link
                to="/auth/login"
                className="flex items-center text-brand-primary hover:text-brand-dark transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Link>
            )}
          </div>

          {!isAdminRegistration && (
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-brand-dark mb-2">Join JLI Locs</h1>
              <p className="text-gray-600 text-lg">
                Create your account to start booking appointments with our professional locticians
              </p>
            </div>
          )}
        </motion.div>

        {/* Registration Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <RegistrationForm
            isAdminRegistration={isAdminRegistration}
            onSubmit={handleRegistration}
            isLoading={isLoading}
          />
        </motion.div>

        {/* Footer */}
        {!isAdminRegistration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center mt-8"
          >
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link
                to="/auth/login"
                className="text-brand-primary hover:text-brand-dark font-medium transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};