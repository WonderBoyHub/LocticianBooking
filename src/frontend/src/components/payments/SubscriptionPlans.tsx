import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  tier: 'basic' | 'premium' | 'vip' | 'enterprise';
  price_monthly: number;
  price_yearly: number;
  currency: string;
  max_bookings_per_month: number | null;
  max_staff_members: number | null;
  max_services: number | null;
  priority_support: boolean;
  custom_branding: boolean;
  api_access: boolean;
  advanced_analytics: boolean;
  multi_location: boolean;
  booking_discount_percentage: number;
  setup_fee: number;
  trial_days: number;
  features: string[];
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
}

interface SubscriptionPlansProps {
  onSelectPlan: (planId: string, billingPeriod: 'monthly' | 'yearly') => void;
  currentPlanId?: string;
  isLoading?: boolean;
}

const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({
  onSelectPlan,
  currentPlanId,
  isLoading = false
}) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/v1/payments/subscriptions/plans');
      if (!response.ok) {
        throw new Error('Failed to fetch subscription plans');
      }
      const data = await response.json();
      setPlans(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getYearlySavings = (monthlyPrice: number, yearlyPrice: number) => {
    const monthlyYearly = monthlyPrice * 12;
    const savings = monthlyYearly - yearlyPrice;
    const percentage = (savings / monthlyYearly) * 100;
    return { amount: savings, percentage };
  };

  const getPlanPrice = (plan: SubscriptionPlan) => {
    return billingPeriod === 'monthly' ? plan.price_monthly : plan.price_yearly;
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'basic':
        return 'bg-blue-500';
      case 'premium':
        return 'bg-purple-500';
      case 'vip':
        return 'bg-gold-500';
      case 'enterprise':
        return 'bg-gray-800';
      default:
        return 'bg-gray-500';
    }
  };

  const getPlanButtonText = (plan: SubscriptionPlan) => {
    if (currentPlanId === plan.id) {
      return 'Current Plan';
    }
    if (plan.trial_days > 0) {
      return `Start ${plan.trial_days}-Day Free Trial`;
    }
    return 'Choose Plan';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-medium">Error Loading Plans</h3>
        <p className="text-red-600 mt-2">{error}</p>
        <button
          onClick={fetchPlans}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Billing Period Toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              billingPeriod === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              billingPeriod === 'yearly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Yearly
            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
              Save up to 17%
            </span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
        {plans
          .filter(plan => plan.is_active)
          .sort((a, b) => a.display_order - b.display_order)
          .map((plan) => {
            const price = getPlanPrice(plan);
            const isCurrentPlan = currentPlanId === plan.id;
            const yearlySavings = billingPeriod === 'yearly' ?
              getYearlySavings(plan.price_monthly, plan.price_yearly) : null;

            return (
              <Card
                key={plan.id}
                className={`relative overflow-hidden ${
                  plan.is_featured ? 'ring-2 ring-purple-500 shadow-lg' : ''
                } ${isCurrentPlan ? 'ring-2 ring-blue-500' : ''}`}
              >
                {plan.is_featured && (
                  <div className="absolute top-0 left-0 right-0 bg-purple-500 text-white text-center py-2 text-sm font-medium">
                    Most Popular
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute top-0 left-0 right-0 bg-blue-500 text-white text-center py-2 text-sm font-medium">
                    Current Plan
                  </div>
                )}

                <div className={`p-6 ${plan.is_featured || isCurrentPlan ? 'pt-12' : ''}`}>
                  {/* Plan Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                    <Badge
                      variant="secondary"
                      className={getTierColor(plan.tier)}
                    >
                      {plan.tier.toUpperCase()}
                    </Badge>
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 text-sm mb-6 min-h-[3rem]">
                    {plan.description}
                  </p>

                  {/* Pricing */}
                  <div className="mb-6">
                    <div className="flex items-baseline">
                      <span className="text-3xl font-bold text-gray-900">
                        {formatPrice(price, plan.currency)}
                      </span>
                      <span className="text-gray-600 ml-1">
                        /{billingPeriod === 'monthly' ? 'month' : 'year'}
                      </span>
                    </div>

                    {billingPeriod === 'yearly' && yearlySavings && yearlySavings.amount > 0 && (
                      <div className="text-sm text-green-600 mt-1">
                        Save {formatPrice(yearlySavings.amount, plan.currency)} per year
                        ({Math.round(yearlySavings.percentage)}% off)
                      </div>
                    )}

                    {plan.setup_fee > 0 && (
                      <div className="text-sm text-gray-500 mt-1">
                        + {formatPrice(plan.setup_fee, plan.currency)} setup fee
                      </div>
                    )}
                  </div>

                  {/* Key Features */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Key Features:</h4>
                    <ul className="space-y-2 text-sm">
                      {plan.max_bookings_per_month && (
                        <li className="flex items-center">
                          <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {plan.max_bookings_per_month === null ?
                            'Unlimited bookings' :
                            `${plan.max_bookings_per_month} bookings/month`
                          }
                        </li>
                      )}

                      {plan.max_staff_members && (
                        <li className="flex items-center">
                          <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {plan.max_staff_members === null ?
                            'Unlimited staff' :
                            `Up to ${plan.max_staff_members} staff members`
                          }
                        </li>
                      )}

                      {plan.max_services && (
                        <li className="flex items-center">
                          <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {plan.max_services === null ?
                            'Unlimited services' :
                            `Up to ${plan.max_services} services`
                          }
                        </li>
                      )}

                      {plan.booking_discount_percentage > 0 && (
                        <li className="flex items-center">
                          <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {plan.booking_discount_percentage}% booking discount
                        </li>
                      )}

                      {plan.priority_support && (
                        <li className="flex items-center">
                          <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Priority support
                        </li>
                      )}

                      {plan.custom_branding && (
                        <li className="flex items-center">
                          <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Custom branding
                        </li>
                      )}

                      {plan.api_access && (
                        <li className="flex items-center">
                          <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          API access
                        </li>
                      )}

                      {plan.advanced_analytics && (
                        <li className="flex items-center">
                          <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Advanced analytics
                        </li>
                      )}

                      {plan.multi_location && (
                        <li className="flex items-center">
                          <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Multi-location support
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Additional Features */}
                  {plan.features.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-3">Also includes:</h4>
                      <ul className="space-y-1 text-sm text-gray-600">
                        {plan.features.slice(0, 3).map((feature, index) => (
                          <li key={index} className="flex items-center">
                            <svg className="h-3 w-3 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {feature}
                          </li>
                        ))}
                        {plan.features.length > 3 && (
                          <li className="text-xs text-gray-500 ml-5">
                            +{plan.features.length - 3} more features
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    onClick={() => onSelectPlan(plan.id, billingPeriod)}
                    disabled={isCurrentPlan || isLoading}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                      isCurrentPlan
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : plan.is_featured
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <LoadingSpinner size="sm" className="mr-2" />
                        Processing...
                      </div>
                    ) : (
                      getPlanButtonText(plan)
                    )}
                  </button>

                  {/* Trial Info */}
                  {plan.trial_days > 0 && !isCurrentPlan && (
                    <p className="text-xs text-gray-500 text-center mt-2">
                      No charge for {plan.trial_days} days. Cancel anytime.
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
      </div>

      {/* Enterprise Contact */}
      <div className="text-center">
        <Card className="p-8 bg-gradient-to-r from-gray-50 to-gray-100">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Need something custom?
          </h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Our Enterprise plan offers unlimited everything plus custom features,
            dedicated support, and flexible pricing for large organizations.
          </p>
          <button className="bg-gray-800 text-white px-8 py-3 rounded-lg font-medium hover:bg-gray-900 transition-colors">
            Contact Sales
          </button>
        </Card>
      </div>
    </div>
  );
};

export default SubscriptionPlans;