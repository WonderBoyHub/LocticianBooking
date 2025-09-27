import React from 'react';
import {
  Settings,
  Building,
  Clock,
  CreditCard,
  Bell,
  Shield,
  Database,
  Globe
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const SystemSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-brand-dark">
            System Settings
          </h1>
          <p className="text-brown-600 mt-1">
            Configure business settings, integrations, and system preferences
          </p>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          {
            title: 'Business Information',
            description: 'Update company details, contact info, and branding',
            icon: Building,
            color: 'bg-blue-500'
          },
          {
            title: 'Working Hours',
            description: 'Set business hours and availability patterns',
            icon: Clock,
            color: 'bg-green-500'
          },
          {
            title: 'Payment Settings',
            description: 'Configure payment methods and pricing options',
            icon: CreditCard,
            color: 'bg-purple-500'
          },
          {
            title: 'Notifications',
            description: 'Manage email, SMS, and push notification settings',
            icon: Bell,
            color: 'bg-yellow-500'
          },
          {
            title: 'Security',
            description: 'User permissions, authentication, and access control',
            icon: Shield,
            color: 'bg-red-500'
          },
          {
            title: 'Data Management',
            description: 'Backup, export, and data retention policies',
            icon: Database,
            color: 'bg-gray-500'
          },
          {
            title: 'Integrations',
            description: 'Third-party services and API configurations',
            icon: Globe,
            color: 'bg-indigo-500'
          }
        ].map((setting) => {
          const Icon = setting.icon;
          return (
            <div
              key={setting.title}
              className="bg-white rounded-xl shadow-soft border border-brown-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className={`w-10 h-10 ${setting.color} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-serif font-bold text-brand-dark">
                  {setting.title}
                </h3>
              </div>
              <p className="text-brown-600 text-sm mb-4">
                {setting.description}
              </p>
              <Button variant="outline" size="sm">
                Configure
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};