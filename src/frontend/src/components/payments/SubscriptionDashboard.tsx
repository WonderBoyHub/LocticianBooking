import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Chart } from '../ui/Chart';

interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'pending' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
  billing_period: 'monthly' | 'yearly';
  amount: number;
  currency: string;
  starts_at: string;
  ends_at: string;
  trial_ends_at?: string;
  next_billing_date?: string;
  bookings_used_this_period: number;
  current_period_start: string;
  current_period_end: string;
  mollie_subscription_id?: string;
  mollie_customer_id?: string;
  cancel_at_period_end: boolean;
  canceled_at?: string;
  cancellation_reason?: string;
  metadata?: any;
  created_at: string;
}

interface UsageReport {
  subscription_id: string;
  user_id: string;
  plan_name: string;
  period: string;
  bookings_used: number;
  bookings_limit?: number;
  bookings_usage_percentage?: number;
  staff_count: number;
  staff_limit?: number;
  services_count: number;
  services_limit?: number;
  storage_used_gb: number;
  storage_limit_gb?: number;
  needs_upgrade: boolean;
  recommended_plan?: string;
  cost_savings_yearly?: number;
}

interface SubscriptionDashboardProps {
  onUpgrade?: () => void;
  onManageBilling?: () => void;
  onViewInvoices?: () => void;
}

const SubscriptionDashboard: React.FC<SubscriptionDashboardProps> = ({
  onUpgrade,
  onManageBilling,
  onViewInvoices
}) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usageReport, setUsageReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);

      // Fetch current subscription
      const subResponse = await fetch('/api/v1/payments/subscriptions/my-subscription');
      if (subResponse.ok) {
        const subData = await subResponse.json();
        setSubscription(subData);

        // Fetch usage report if we have a subscription
        if (subData) {
          const usageResponse = await fetch('/api/v1/payments/usage/report');
          if (usageResponse.ok) {
            const usageData = await usageResponse.json();
            setUsageReport(usageData);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription || !window.confirm('Are you sure you want to cancel your subscription?')) {
      return;
    }

    try {
      setCancelLoading(true);
      const response = await fetch(`/api/v1/payments/subscriptions/${subscription.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      await fetchSubscriptionData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setCancelLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('da-DK', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'trialing':
        return 'bg-blue-100 text-blue-800';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-800';
      case 'canceled':
        return 'bg-gray-100 text-gray-800';
      case 'unpaid':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getUsageChartData = () => {
    if (!usageReport) return [];

    const data = [];

    if (usageReport.bookings_limit) {
      data.push({
        name: 'Bookings',
        used: usageReport.bookings_used,
        limit: usageReport.bookings_limit,
        percentage: usageReport.bookings_usage_percentage || 0,
      });
    }

    if (usageReport.staff_limit) {
      data.push({
        name: 'Staff',
        used: usageReport.staff_count,
        limit: usageReport.staff_limit,
        percentage: (usageReport.staff_count / usageReport.staff_limit) * 100,
      });
    }

    if (usageReport.services_limit) {
      data.push({
        name: 'Services',
        used: usageReport.services_count,
        limit: usageReport.services_limit,
        percentage: (usageReport.services_count / usageReport.services_limit) * 100,
      });
    }

    return data;
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
        <h3 className="text-red-800 font-medium">Error Loading Subscription</h3>
        <p className="text-red-600 mt-2">{error}</p>
        <button
          onClick={fetchSubscriptionData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          No Active Subscription
        </h3>
        <p className="text-gray-600 mb-6">
          Subscribe to a plan to start using all features of our booking system.
        </p>
        <button
          onClick={onUpgrade}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          View Plans
        </button>
      </div>
    );
  }

  const usageData = getUsageChartData();
  const isTrialing = subscription.status === 'trialing' && subscription.trial_ends_at;
  const trialEndsAt = isTrialing ? new Date(subscription.trial_ends_at!) : null;
  const trialDaysLeft = trialEndsAt ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Subscription Overview */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Subscription Overview</h2>
          <Badge className={getStatusColor(subscription.status)}>
            {subscription.status.toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Plan</h3>
            <p className="text-lg font-semibold text-gray-900">
              {usageReport?.plan_name || 'Unknown Plan'}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Amount</h3>
            <p className="text-lg font-semibold text-gray-900">
              {formatPrice(subscription.amount, subscription.currency)}
              <span className="text-sm text-gray-500 ml-1">
                /{subscription.billing_period === 'monthly' ? 'month' : 'year'}
              </span>
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">
              {isTrialing ? 'Trial Ends' : 'Next Billing'}
            </h3>
            <p className="text-lg font-semibold text-gray-900">
              {isTrialing ? formatDate(subscription.trial_ends_at!) :
               subscription.next_billing_date ? formatDate(subscription.next_billing_date) :
               formatDate(subscription.current_period_end)}
            </p>
            {isTrialing && trialDaysLeft > 0 && (
              <p className="text-sm text-orange-600">
                {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} left
              </p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
            <p className="text-lg font-semibold text-gray-900">
              {subscription.cancel_at_period_end ? 'Cancelling' : 'Active'}
            </p>
            {subscription.cancel_at_period_end && (
              <p className="text-sm text-orange-600">
                Ends {formatDate(subscription.current_period_end)}
              </p>
            )}
          </div>
        </div>

        {/* Trial Warning */}
        {isTrialing && trialDaysLeft <= 3 && trialDaysLeft > 0 && (
          <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-orange-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-orange-800 font-medium">Trial ending soon</h4>
                <p className="text-orange-600 text-sm">
                  Your trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}.
                  Update your payment method to continue using the service.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          {!subscription.cancel_at_period_end && (
            <>
              <button
                onClick={onUpgrade}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Change Plan
              </button>
              <button
                onClick={onManageBilling}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Manage Billing
              </button>
            </>
          )}

          <button
            onClick={onViewInvoices}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            View Invoices
          </button>

          {!subscription.cancel_at_period_end && (
            <button
              onClick={handleCancelSubscription}
              disabled={cancelLoading}
              className="border border-red-300 text-red-700 px-4 py-2 rounded-lg font-medium hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelLoading ? (
                <div className="flex items-center">
                  <LoadingSpinner size="sm" className="mr-2" />
                  Canceling...
                </div>
              ) : (
                'Cancel Subscription'
              )}
            </button>
          )}
        </div>
      </Card>

      {/* Usage Analytics */}
      {usageReport && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage This Period</h3>
            <p className="text-sm text-gray-600 mb-6">
              Period: {usageReport.period}
            </p>

            <div className="space-y-4">
              {usageData.map((item) => (
                <div key={item.name}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                    <span className="text-sm text-gray-600">
                      {item.used} / {item.limit === null ? '∞' : item.limit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        item.percentage > 80 ? 'bg-red-500' :
                        item.percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {item.percentage.toFixed(1)}% used
                  </div>
                </div>
              ))}
            </div>

            {usageReport.needs_upgrade && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="text-yellow-800 font-medium mb-2">Upgrade Recommended</h4>
                <p className="text-yellow-700 text-sm mb-3">
                  You're approaching your plan limits. Consider upgrading to {usageReport.recommended_plan} for more capacity.
                </p>
                <button
                  onClick={onUpgrade}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-700 transition-colors"
                >
                  Upgrade Now
                </button>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Optimization</h3>

            {usageReport.cost_savings_yearly && usageReport.cost_savings_yearly > 0 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
                <h4 className="text-green-800 font-medium mb-2">Yearly Plan Savings</h4>
                <p className="text-green-700 text-sm mb-3">
                  Switch to yearly billing and save{' '}
                  {formatPrice(usageReport.cost_savings_yearly, subscription.currency)} per year!
                </p>
                <button
                  onClick={onUpgrade}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  Switch to Yearly
                </button>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Current Plan</span>
                <span className="font-medium">{usageReport.plan_name}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Billing Period</span>
                <span className="font-medium capitalize">{subscription.billing_period}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Monthly Cost</span>
                <span className="font-medium">
                  {formatPrice(
                    subscription.billing_period === 'yearly'
                      ? subscription.amount / 12
                      : subscription.amount,
                    subscription.currency
                  )}
                </span>
              </div>

              {subscription.billing_period === 'yearly' && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Annual Cost</span>
                  <span className="font-medium">
                    {formatPrice(subscription.amount, subscription.currency)}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">Quick Actions</h4>
              <div className="space-y-2">
                <button
                  onClick={onManageBilling}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Update payment method
                </button>
                <button
                  onClick={onViewInvoices}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Download invoices
                </button>
                <button
                  onClick={onUpgrade}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Compare all plans
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SubscriptionDashboard;