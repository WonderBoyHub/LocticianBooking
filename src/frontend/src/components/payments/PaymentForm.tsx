import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface PaymentFormProps {
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly';
  trialDays?: number;
  onSuccess?: (subscription: any) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

interface PaymentMethod {
  id: string;
  description: string;
  image: string;
  minimumAmount?: {
    value: string;
    currency: string;
  };
  maximumAmount?: {
    value: string;
    currency: string;
  };
}

const PaymentForm: React.FC<PaymentFormProps> = ({
  planId,
  planName,
  amount,
  currency,
  billingPeriod,
  trialDays = 0,
  onSuccess,
  onError,
  onCancel
}) => {
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [customerInfo, setCustomerInfo] = useState({
    email: '',
    name: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'DK'
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [step, setStep] = useState<'info' | 'method' | 'processing'>('info');

  React.useEffect(() => {
    fetchPaymentMethods();
  }, [amount, currency]);

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch(`/api/v1/payments/payment-methods?amount=${amount}&currency=${currency}`);
      if (response.ok) {
        const methods = await response.json();
        setPaymentMethods(methods);
      }
    } catch (error) {
      console.error('Failed to fetch payment methods:', error);
    }
  };

  const validateCustomerInfo = () => {
    const newErrors: {[key: string]: string} = {};

    if (!customerInfo.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(customerInfo.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!customerInfo.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (customerInfo.phone && !/^\+?[\d\s-()]+$/.test(customerInfo.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateCustomerInfo()) {
      setStep('method');
    }
  };

  const handlePaymentSubmit = async () => {
    if (!selectedMethod) {
      setErrors({ method: 'Please select a payment method' });
      return;
    }

    setLoading(true);
    setStep('processing');

    try {
      // Create Mollie customer first
      const customerResponse = await fetch('/api/v1/payments/customers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: customerInfo.name,
          email: customerInfo.email,
          metadata: {
            phone: customerInfo.phone,
            address: customerInfo.address,
            city: customerInfo.city,
            postalCode: customerInfo.postalCode,
            country: customerInfo.country
          }
        }),
      });

      if (!customerResponse.ok) {
        throw new Error('Failed to create customer');
      }

      // Create subscription
      const subscriptionResponse = await fetch('/api/v1/payments/subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: planId,
          billing_period: billingPeriod,
          trial_period_override: trialDays > 0 ? trialDays : undefined,
          metadata: {
            customer_info: customerInfo,
            payment_method: selectedMethod
          }
        }),
      });

      if (!subscriptionResponse.ok) {
        const errorData = await subscriptionResponse.json();
        throw new Error(errorData.detail || 'Failed to create subscription');
      }

      const subscription = await subscriptionResponse.json();

      // If there's a Mollie subscription ID, we need to create a payment intent
      // and redirect to Mollie checkout
      if (subscription.mollie_subscription_id) {
        // Create payment intent for the first payment
        const paymentResponse = await fetch('/api/v1/payments/create-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amount,
            currency: currency,
            description: `${planName} subscription (${billingPeriod})`,
            payment_type: 'subscription',
            metadata: {
              subscription_id: subscription.id,
              plan_id: planId,
              billing_period: billingPeriod
            }
          }),
        });

        if (!paymentResponse.ok) {
          throw new Error('Failed to create payment intent');
        }

        const paymentIntent = await paymentResponse.json();

        if (paymentIntent.checkout_url) {
          // Redirect to Mollie checkout
          window.location.href = paymentIntent.checkout_url;
          return;
        }
      }

      // If we get here, something went wrong
      throw new Error('No checkout URL received');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      setErrors({ payment: errorMessage });
      onError?.(errorMessage);
      setStep('method');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number, curr: string) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleInputChange = (field: string, value: string) => {
    setCustomerInfo(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (step === 'processing') {
    return (
      <Card className="p-8 text-center">
        <LoadingSpinner size="lg" className="mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Processing your subscription...</h3>
        <p className="text-gray-600">
          You will be redirected to complete your payment securely with Mollie.
        </p>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Order Summary */}
      <Card className="p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Plan</span>
            <span className="font-medium">{planName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Billing</span>
            <span className="font-medium capitalize">{billingPeriod}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Amount</span>
            <span className="font-medium">{formatPrice(amount, currency)}</span>
          </div>
          {trialDays > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Free Trial</span>
              <span className="font-medium text-green-600">{trialDays} days</span>
            </div>
          )}
          <hr className="border-gray-200" />
          <div className="flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>{trialDays > 0 ? 'Free for trial period' : formatPrice(amount, currency)}</span>
          </div>
        </div>

        {trialDays > 0 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">
              Your {trialDays}-day free trial starts immediately. You won't be charged until {' '}
              {new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toLocaleDateString('da-DK')}.
            </p>
          </div>
        )}
      </Card>

      {/* Step Indicator */}
      <div className="flex items-center justify-center mb-6">
        <div className={`flex items-center ${step === 'info' ? 'text-blue-600' : 'text-green-600'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step === 'info' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
          }`}>
            {step === 'info' ? '1' : '✓'}
          </div>
          <span className="ml-2 font-medium">Customer Info</span>
        </div>
        <div className="w-16 h-1 mx-4 bg-gray-200">
          <div className={`h-full bg-blue-600 transition-all duration-300 ${
            step === 'method' || step === 'processing' ? 'w-full' : 'w-0'
          }`} />
        </div>
        <div className={`flex items-center ${step === 'method' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step === 'method' ? 'bg-blue-600 text-white' : 'bg-gray-200'
          }`}>
            2
          </div>
          <span className="ml-2 font-medium">Payment Method</span>
        </div>
      </div>

      {/* Customer Information Form */}
      {step === 'info' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Customer Information</h3>
          <form onSubmit={handleInfoSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={customerInfo.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your full name"
                />
                {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={customerInfo.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="your@email.com"
                />
                {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={customerInfo.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.phone ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="+45 12 34 56 78"
                />
                {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <select
                  value={customerInfo.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DK">Denmark</option>
                  <option value="SE">Sweden</option>
                  <option value="NO">Norway</option>
                  <option value="DE">Germany</option>
                  <option value="NL">Netherlands</option>
                  <option value="BE">Belgium</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={customerInfo.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Street address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={customerInfo.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="City"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={customerInfo.postalCode}
                  onChange={(e) => handleInputChange('postalCode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1234"
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-2 text-gray-600 font-medium hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Continue to Payment
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Payment Method Selection */}
      {step === 'method' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Select Payment Method</h3>

          {paymentMethods.length > 0 ? (
            <div className="space-y-3 mb-6">
              {paymentMethods.map((method) => (
                <label
                  key={method.id}
                  className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedMethod === method.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method.id}
                    checked={selectedMethod === method.id}
                    onChange={(e) => setSelectedMethod(e.target.value)}
                    className="mr-3"
                  />
                  {method.image && (
                    <img
                      src={method.image}
                      alt={method.description}
                      className="w-8 h-8 mr-3"
                    />
                  )}
                  <span className="font-medium">{method.description}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <LoadingSpinner size="md" className="mx-auto mb-4" />
              <p className="text-gray-600">Loading payment methods...</p>
            </div>
          )}

          {errors.method && (
            <p className="text-red-600 text-sm mb-4">{errors.method}</p>
          )}

          {errors.payment && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">Payment Error</p>
              <p className="text-red-600 text-sm">{errors.payment}</p>
            </div>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep('info')}
              className="px-6 py-2 text-gray-600 font-medium hover:text-gray-800 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handlePaymentSubmit}
              disabled={loading || !selectedMethod}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center">
                  <LoadingSpinner size="sm" className="mr-2" />
                  Processing...
                </div>
              ) : (
                `Complete Subscription${trialDays > 0 ? ' (Start Trial)' : ''}`
              )}
            </button>
          </div>
        </Card>
      )}

      {/* Security Notice */}
      <div className="mt-6 text-center">
        <div className="flex items-center justify-center text-sm text-gray-600">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          Secured by Mollie • SSL Encrypted • PCI DSS Compliant
        </div>
      </div>
    </div>
  );
};

export default PaymentForm;