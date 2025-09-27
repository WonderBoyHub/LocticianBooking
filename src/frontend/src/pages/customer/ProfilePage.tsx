import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  Bell,
  Shield,
  Camera,
  Edit,
  Save,
  X,
  ArrowLeft,
  Globe,
  Clock,
  Star,
  Download,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';

import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { StatusBadge } from '../../components/ui/StatusBadge';

import {
  useGetCurrentUserQuery,
  useUpdateProfileMutation,
  useGetAppointmentsQuery,
} from '../../store/api';
import type { User as UserType, UserPreferences } from '../../types';

interface ProfileFormData {
  name: string;
  email: string;
  phone?: string;
  preferences: UserPreferences;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: 'monthly' | 'yearly';
  features: string[];
  isActive: boolean;
  nextBilling?: string;
}

const ProfileSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <Card className="p-6">
    <h2 className="text-xl font-semibold text-gray-900 mb-6">{title}</h2>
    {children}
  </Card>
);

const FormField: React.FC<{
  label: string;
  children: React.ReactNode;
  error?: string;
}> = ({ label, children, error }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label}
    </label>
    {children}
    {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
  </div>
);

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'subscriptions' | 'privacy' | 'notifications'>('profile');

  // API queries
  const { data: userData, isLoading: userLoading } = useGetCurrentUserQuery();
  const {
    data: appointmentsData,
    isLoading: appointmentsLoading,
  } = useGetAppointmentsQuery({
    customerId: userData?.data?.id,
    limit: 5,
  });

  const [updateProfile, { isLoading: isUpdating }] = useUpdateProfileMutation();

  const user = userData?.data;
  const recentAppointments = appointmentsData?.data || [];

  // Mock subscription data - replace with real data
  const mockSubscriptions: SubscriptionPlan[] = [
    {
      id: '1',
      name: 'Basic Plan',
      price: 199,
      interval: 'monthly',
      features: [
        'Ubegrænset booking',
        'Email påmindelser',
        'Profil gemmes',
        'Grundlæggende support',
      ],
      isActive: true,
      nextBilling: '2024-02-15',
    },
    {
      id: '2',
      name: 'Premium Plan',
      price: 349,
      interval: 'monthly',
      features: [
        'Alt fra Basic',
        'SMS påmindelser',
        'Prioritet booking',
        'Rabat på behandlinger',
        'Premium support',
        'Personlige anbefalinger',
      ],
      isActive: false,
    },
  ];

  // Initialize form data when user data loads
  useEffect(() => {
    if (user && !formData) {
      setFormData({
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        preferences: user.preferences || {
          language: 'da',
          notifications: {
            email: true,
            sms: false,
            push: true,
          },
          timezone: 'Europe/Copenhagen',
        },
      });
    }
  }, [user, formData]);

  const handleFormChange = (field: keyof ProfileFormData, value: any) => {
    if (!formData) return;

    setFormData({
      ...formData,
      [field]: value,
    });

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handlePreferenceChange = (
    section: keyof UserPreferences,
    field: string,
    value: any
  ) => {
    if (!formData) return;

    setFormData({
      ...formData,
      preferences: {
        ...formData.preferences,
        [section]: {
          ...formData.preferences[section],
          [field]: value,
        },
      },
    });
  };

  const validateForm = (): boolean => {
    if (!formData) return false;

    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Navn er påkrævet';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email er påkrævet';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Ugyldig email adresse';
    }

    if (formData.phone && !/^[+]?[\d\s-()]+$/.test(formData.phone)) {
      newErrors.phone = 'Ugyldigt telefonnummer';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!formData || !validateForm()) return;

    try {
      await updateProfile({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        preferences: formData.preferences,
      }).unwrap();

      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setErrors({});

    // Reset form data to original user data
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        preferences: user.preferences || {
          language: 'da',
          notifications: {
            email: true,
            sms: false,
            push: true,
          },
          timezone: 'Europe/Copenhagen',
        },
      });
    }
  };

  const getSubscriptionStatus = () => {
    const activeSubscription = mockSubscriptions.find(sub => sub.isActive);
    return activeSubscription || null;
  };

  if (userLoading || !formData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const activeSubscription = getSubscriptionStatus();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" asChild>
                  <Link to="/dashboard">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Tilbage
                  </Link>
                </Button>
                <div>
                  <h1 className="text-4xl font-bold text-amber-900 mb-2">
                    Min profil
                  </h1>
                  <p className="text-amber-700 text-lg">
                    Administrer dine oplysninger og indstillinger
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Rediger profil
                  </Button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" onClick={handleCancel}>
                      <X className="w-4 h-4 mr-2" />
                      Annuller
                    </Button>
                    <Button onClick={handleSave} disabled={isUpdating}>
                      {isUpdating ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Gem
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Navigation Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
              {[
                { id: 'profile', label: 'Profil', icon: User },
                { id: 'subscriptions', label: 'Abonnementer', icon: CreditCard },
                { id: 'notifications', label: 'Notifikationer', icon: Bell },
                { id: 'privacy', label: 'Privatliv', icon: Shield },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded transition-all ${
                    activeTab === id
                      ? 'bg-amber-100 text-amber-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Tab Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {activeTab === 'profile' && (
              <>
                {/* Profile Information */}
                <ProfileSection title="Personlige oplysninger">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2 flex items-center space-x-6 mb-6">
                      <div className="relative">
                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
                          <span className="text-2xl font-bold text-amber-900">
                            {user?.name?.charAt(0)?.toUpperCase() || 'K'}
                          </span>
                        </div>
                        {isEditing && (
                          <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center text-white hover:bg-amber-700 transition-colors">
                            <Camera className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {user?.name}
                        </h3>
                        <p className="text-gray-600">Kunde siden {format(new Date(user?.createdAt || ''), 'MMMM yyyy', { locale: da })}</p>
                        {activeSubscription && (
                          <Badge variant="success" className="mt-2">
                            {activeSubscription.name}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <FormField label="Fulde navn" error={errors.name}>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleFormChange('name', e.target.value)}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
                          !isEditing ? 'bg-gray-50' : 'bg-white'
                        } ${errors.name ? 'border-red-300' : 'border-gray-300'}`}
                      />
                    </FormField>

                    <FormField label="Email adresse" error={errors.email}>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleFormChange('email', e.target.value)}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
                          !isEditing ? 'bg-gray-50' : 'bg-white'
                        } ${errors.email ? 'border-red-300' : 'border-gray-300'}`}
                      />
                    </FormField>

                    <FormField label="Telefonnummer" error={errors.phone}>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleFormChange('phone', e.target.value)}
                        disabled={!isEditing}
                        placeholder="+45 12 34 56 78"
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
                          !isEditing ? 'bg-gray-50' : 'bg-white'
                        } ${errors.phone ? 'border-red-300' : 'border-gray-300'}`}
                      />
                    </FormField>

                    <FormField label="Sprog">
                      <select
                        value={formData.preferences.language}
                        onChange={(e) => handlePreferenceChange('language', '', e.target.value)}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
                          !isEditing ? 'bg-gray-50' : 'bg-white'
                        } border-gray-300`}
                      >
                        <option value="da">Dansk</option>
                        <option value="en">English</option>
                      </select>
                    </FormField>

                    <FormField label="Tidszone">
                      <select
                        value={formData.preferences.timezone}
                        onChange={(e) => handlePreferenceChange('timezone', '', e.target.value)}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
                          !isEditing ? 'bg-gray-50' : 'bg-white'
                        } border-gray-300`}
                      >
                        <option value="Europe/Copenhagen">Europe/Copenhagen (CET)</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </FormField>
                  </div>
                </ProfileSection>

                {/* Recent Activity */}
                <ProfileSection title="Seneste aktivitet">
                  <div className="space-y-4">
                    {appointmentsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <LoadingSpinner size="sm" />
                      </div>
                    ) : recentAppointments.length > 0 ? (
                      recentAppointments.slice(0, 3).map((appointment) => (
                        <div key={appointment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Calendar className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">
                                {appointment.service?.name}
                              </p>
                              <p className="text-sm text-gray-600">
                                {format(new Date(appointment.date), 'dd MMMM yyyy', { locale: da })}
                              </p>
                            </div>
                          </div>
                          <StatusBadge variant={appointment.status === 'completed' ? 'success' : 'info'}>
                            {appointment.status === 'completed' ? 'Gennemført' : 'Planlagt'}
                          </StatusBadge>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-600 text-center py-8">
                        Ingen seneste aktivitet
                      </p>
                    )}
                  </div>
                </ProfileSection>
              </>
            )}

            {activeTab === 'subscriptions' && (
              <>
                {/* Current Subscription */}
                {activeSubscription && (
                  <ProfileSection title="Nuværende abonnement">
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-6 border border-amber-200">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-amber-900">
                            {activeSubscription.name}
                          </h3>
                          <p className="text-amber-700">
                            {activeSubscription.price} DKK/{activeSubscription.interval === 'monthly' ? 'måned' : 'år'}
                          </p>
                        </div>
                        <Badge variant="success">Aktiv</Badge>
                      </div>
                      <ul className="space-y-2 mb-4">
                        {activeSubscription.features.map((feature, index) => (
                          <li key={index} className="flex items-center space-x-2 text-amber-800">
                            <div className="w-1.5 h-1.5 bg-amber-600 rounded-full" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {activeSubscription.nextBilling && (
                        <p className="text-sm text-amber-700">
                          Næste fakturering: {format(new Date(activeSubscription.nextBilling), 'dd MMMM yyyy', { locale: da })}
                        </p>
                      )}
                    </div>
                  </ProfileSection>
                )}

                {/* Available Plans */}
                <ProfileSection title="Tilgængelige planer">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {mockSubscriptions.map((plan) => (
                      <div
                        key={plan.id}
                        className={`border rounded-lg p-6 ${
                          plan.isActive
                            ? 'border-amber-300 bg-amber-50'
                            : 'border-gray-200 bg-white hover:border-amber-200 transition-colors'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {plan.name}
                          </h3>
                          {plan.isActive && <Badge variant="success">Aktiv</Badge>}
                        </div>
                        <p className="text-2xl font-bold text-gray-900 mb-4">
                          {plan.price} DKK
                          <span className="text-base font-normal text-gray-600">
                            /{plan.interval === 'monthly' ? 'måned' : 'år'}
                          </span>
                        </p>
                        <ul className="space-y-2 mb-6">
                          {plan.features.map((feature, index) => (
                            <li key={index} className="flex items-center space-x-2 text-gray-700">
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        <Button
                          variant={plan.isActive ? "outline" : "default"}
                          className="w-full"
                          disabled={plan.isActive}
                        >
                          {plan.isActive ? 'Nuværende plan' : 'Vælg plan'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </ProfileSection>
              </>
            )}

            {activeTab === 'notifications' && (
              <ProfileSection title="Notifikationsindstillinger">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">Email notifikationer</h4>
                      <p className="text-sm text-gray-600">
                        Modtag påmindelser og opdateringer via email
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.preferences.notifications.email}
                      onChange={(e) =>
                        handlePreferenceChange('notifications', 'email', e.target.checked)
                      }
                      disabled={!isEditing}
                      className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">SMS notifikationer</h4>
                      <p className="text-sm text-gray-600">
                        Modtag påmindelser via SMS (kræver telefonnummer)
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.preferences.notifications.sms}
                      onChange={(e) =>
                        handlePreferenceChange('notifications', 'sms', e.target.checked)
                      }
                      disabled={!isEditing || !formData.phone}
                      className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">Push notifikationer</h4>
                      <p className="text-sm text-gray-600">
                        Modtag notifikationer i browseren
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.preferences.notifications.push}
                      onChange={(e) =>
                        handlePreferenceChange('notifications', 'push', e.target.checked)
                      }
                      disabled={!isEditing}
                      className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                    />
                  </div>
                </div>
              </ProfileSection>
            )}

            {activeTab === 'privacy' && (
              <ProfileSection title="Privatliv og sikkerhed">
                <div className="space-y-6">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Adgangskode</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Sidst ændret for 3 måneder siden
                    </p>
                    <Button variant="outline" size="sm">
                      Skift adgangskode
                    </Button>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Data eksport</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Download en kopi af dine data
                    </p>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download data
                    </Button>
                  </div>

                  <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                    <h4 className="font-medium text-red-900 mb-2">Slet konto</h4>
                    <p className="text-sm text-red-700 mb-4">
                      Slet permanent din konto og alle tilknyttede data. Denne handling kan ikke fortrydes.
                    </p>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Slet konto
                    </Button>
                  </div>
                </div>
              </ProfileSection>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;