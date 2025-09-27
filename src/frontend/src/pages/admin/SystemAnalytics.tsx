import React from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  Package,
  BarChart3,
  PieChart,
  Activity,
  Download,
  Filter
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const SystemAnalytics: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-brand-dark">
            System Analytics
          </h1>
          <p className="text-brown-600 mt-1">
            Comprehensive business insights and performance metrics
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" leftIcon={<Filter className="w-4 h-4" />}>
            Filter
          </Button>
          <Button leftIcon={<Download className="w-4 h-4" />}>
            Export Report
          </Button>
        </div>
      </div>

      {/* Analytics Content */}
      <div className="bg-white rounded-xl shadow-soft border border-brown-200 p-8">
        <div className="text-center py-12">
          <BarChart3 className="w-16 h-16 text-brand-primary mx-auto mb-4" />
          <h3 className="text-lg font-serif font-bold text-brand-dark mb-2">
            Advanced Analytics Dashboard
          </h3>
          <p className="text-brown-600 mb-6 max-w-md mx-auto">
            Comprehensive analytics dashboard with revenue tracking, customer insights,
            service performance metrics, and business growth indicators.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-gray-800">Revenue Trends</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-sm font-medium text-gray-800">Customer Analytics</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <p className="text-sm font-medium text-gray-800">Booking Patterns</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
              <p className="text-sm font-medium text-gray-800">Service Performance</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};