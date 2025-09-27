import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Chart } from '../ui/Chart';

interface DashboardMetrics {
  active_subscriptions: number;
  trial_subscriptions: number;
  canceled_subscriptions: number;
  total_subscribers: number;
  monthly_recurring_revenue: number;
  annual_recurring_revenue: number;
  average_revenue_per_user: number;
  new_subscribers_this_month: number;
  churned_subscribers_this_month: number;
  growth_rate: number;
  churn_rate: number;
  most_popular_plan: string;
  highest_revenue_plan: string;
  predicted_revenue_next_month: number;
  predicted_churn_next_month: number;
}

interface PaymentTransaction {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded';
  transaction_type: string;
  description: string;
  mollie_payment_id?: string;
  created_at: string;
  processed_at?: string;
  failure_reason?: string;
}

interface Subscription {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  plan_name: string;
  status: string;
  amount: number;
  currency: string;
  billing_period: 'monthly' | 'yearly';
  current_period_start: string;
  current_period_end: string;
  trial_ends_at?: string;
  mollie_subscription_id?: string;
  created_at: string;
  canceled_at?: string;
  cancellation_reason?: string;
}

const PaymentManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'subscriptions' | 'transactions' | 'plans'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Pagination and filters
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('30days');

  useEffect(() => {
    fetchData();
  }, [activeTab, currentPage, statusFilter, dateFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      switch (activeTab) {
        case 'dashboard':
          await fetchDashboardMetrics();
          break;
        case 'subscriptions':
          await fetchSubscriptions();
          break;
        case 'transactions':
          await fetchTransactions();
          break;
        case 'plans':
          // Plans would be fetched here
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardMetrics = async () => {
    const response = await fetch('/api/v1/admin/payments/dashboard', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch dashboard metrics');
    }

    const data = await response.json();
    setDashboardMetrics(data);
  };

  const fetchSubscriptions = async () => {
    const params = new URLSearchParams({
      page: currentPage.toString(),
      page_size: pageSize.toString(),
      status: statusFilter !== 'all' ? statusFilter : '',
      date_filter: dateFilter,
    });

    const response = await fetch(`/api/v1/admin/payments/subscriptions?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch subscriptions');
    }

    const data = await response.json();
    setSubscriptions(data.items || data);
  };

  const fetchTransactions = async () => {
    const params = new URLSearchParams({
      page: currentPage.toString(),
      page_size: pageSize.toString(),
      status: statusFilter !== 'all' ? statusFilter : '',
      date_filter: dateFilter,
    });

    const response = await fetch(`/api/v1/admin/payments/transactions?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch transactions');
    }

    const data = await response.json();
    setTransactions(data.items || data);
  };

  const handleRefund = async (transactionId: string, amount?: number, reason?: string) => {
    try {
      const response = await fetch(`/api/v1/admin/payments/refunds/${transactionId}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          amount: amount,
          reason: reason || 'Admin refund',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create refund');
      }

      // Refresh transactions
      await fetchTransactions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund failed');
    }
  };

  const handleCancelSubscription = async (subscriptionId: string, reason?: string) => {
    try {
      const response = await fetch(`/api/v1/admin/payments/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          reason: reason || 'Admin cancellation',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      // Refresh subscriptions
      await fetchSubscriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancellation failed');
    }
  };

  const formatCurrency = (amount: number, currency: string = 'DKK') => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('da-DK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'succeeded':
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
      case 'canceled':
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'trialing':
        return 'bg-blue-100 text-blue-800';
      case 'refunded':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Subscribers</h3>
          <p className="text-3xl font-bold text-gray-900">{dashboardMetrics?.total_subscribers || 0}</p>
          <p className="text-sm text-green-600 mt-1">
            +{dashboardMetrics?.new_subscribers_this_month || 0} this month
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Monthly Revenue</h3>
          <p className="text-3xl font-bold text-gray-900">
            {formatCurrency(dashboardMetrics?.monthly_recurring_revenue || 0)}
          </p>
          <p className="text-sm text-blue-600 mt-1">
            {dashboardMetrics?.growth_rate?.toFixed(1) || 0}% growth
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Average Revenue per User</h3>
          <p className="text-3xl font-bold text-gray-900">
            {formatCurrency(dashboardMetrics?.average_revenue_per_user || 0)}
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Churn Rate</h3>
          <p className="text-3xl font-bold text-gray-900">
            {dashboardMetrics?.churn_rate?.toFixed(1) || 0}%
          </p>
          <p className="text-sm text-red-600 mt-1">
            {dashboardMetrics?.churned_subscribers_this_month || 0} churned this month
          </p>
        </Card>
      </div>

      {/* Subscription Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Status</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Active Subscriptions</span>
              <Badge className="bg-green-100 text-green-800">
                {dashboardMetrics?.active_subscriptions || 0}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Trial Subscriptions</span>
              <Badge className="bg-blue-100 text-blue-800">
                {dashboardMetrics?.trial_subscriptions || 0}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Canceled Subscriptions</span>
              <Badge className="bg-gray-100 text-gray-800">
                {dashboardMetrics?.canceled_subscriptions || 0}
              </Badge>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Performance</h3>
          <div className="space-y-4">
            <div>
              <span className="text-sm text-gray-500">Most Popular Plan</span>
              <p className="font-semibold text-gray-900">
                {dashboardMetrics?.most_popular_plan || 'N/A'}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Highest Revenue Plan</span>
              <p className="font-semibold text-gray-900">
                {dashboardMetrics?.highest_revenue_plan || 'N/A'}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Predicted Next Month Revenue</span>
              <p className="font-semibold text-gray-900">
                {formatCurrency(dashboardMetrics?.predicted_revenue_next_month || 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderSubscriptions = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="trialing">Trial</option>
          <option value="past_due">Past Due</option>
          <option value="canceled">Canceled</option>
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="7days">Last 7 days</option>
          <option value="30days">Last 30 days</option>
          <option value="90days">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {/* Subscriptions Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Next Billing
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subscriptions.map((subscription) => (
                <tr key={subscription.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {subscription.user_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {subscription.user_email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {subscription.plan_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={getStatusColor(subscription.status)}>
                      {subscription.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(subscription.amount, subscription.currency)}
                    <span className="text-gray-500">/{subscription.billing_period}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(subscription.current_period_end)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          // Open subscription details modal
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </button>
                      {subscription.status === 'active' && (
                        <button
                          onClick={() => handleCancelSubscription(subscription.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderTransactions = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="succeeded">Succeeded</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="7days">Last 7 days</option>
          <option value="30days">Last 30 days</option>
          <option value="90days">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {/* Transactions Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {transaction.user_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {transaction.user_email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.transaction_type.replace('_', ' ').toUpperCase()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={getStatusColor(transaction.status)}>
                      {transaction.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(transaction.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          // Open transaction details modal
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </button>
                      {transaction.status === 'succeeded' && (
                        <button
                          onClick={() => handleRefund(transaction.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Refund
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

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
        <h3 className="text-red-800 font-medium">Error Loading Payment Data</h3>
        <p className="text-red-600 mt-2">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Payment Management</h1>
        <p className="text-gray-600 mt-2">
          Manage payments, subscriptions, and billing for all customers
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'subscriptions', label: 'Subscriptions' },
            { id: 'transactions', label: 'Transactions' },
            { id: 'plans', label: 'Plans' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'subscriptions' && renderSubscriptions()}
      {activeTab === 'transactions' && renderTransactions()}
      {activeTab === 'plans' && (
        <div className="text-center py-12">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Plan Management
          </h3>
          <p className="text-gray-600">
            Plan management interface coming soon...
          </p>
        </div>
      )}
    </div>
  );
};

export default PaymentManagement;