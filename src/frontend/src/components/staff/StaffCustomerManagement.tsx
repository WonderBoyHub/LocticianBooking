import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit2,
  Eye,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Star,
  User as UserIcon,
  Users,
  Clock,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Chart } from '../ui/Chart';

import type { User, Appointment, SelectOption } from '../../types';
import { userUpdateSchema, type UserUpdateInput } from '../../schemas';

interface CustomerFilters {
  search?: string;
  sortBy?: 'name' | 'email' | 'lastVisit' | 'totalSpent';
  sortOrder?: 'asc' | 'desc';
  status?: 'active' | 'inactive' | '';
}

interface CustomerStats {
  totalCustomers: number;
  newThisMonth: number;
  averageSpending: number;
  retentionRate: number;
}

const CustomerTableRow: React.FC<{
  customer: User & { stats?: any };
  onEdit: (customer: User) => void;
  onViewDetails: (customer: User) => void;
  onScheduleAppointment: (customer: User) => void;
}> = ({ customer, onEdit, onViewDetails, onScheduleAppointment }) => {
  const { t } = useTranslation();

  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mr-4">
            {customer.avatar ? (
              <img
                src={customer.avatar}
                alt={customer.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span className="text-sm font-medium text-gray-600">
                {customer.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{customer.name}</div>
            <div className="text-sm text-gray-500">{customer.email}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">{customer.phone || '—'}</div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">
          {customer.stats?.lastVisit
            ? format(new Date(customer.stats.lastVisit), 'MMM dd, yyyy')
            : '—'
          }
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">
          {customer.stats?.appointmentCount || 0}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm font-medium text-gray-900">
          {customer.stats?.totalSpent
            ? `${customer.stats.totalSpent.toLocaleString('da-DK')} DKK`
            : '0 DKK'
          }
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${
                  i < (customer.stats?.rating || 0)
                    ? 'text-yellow-400 fill-current'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="ml-2 text-sm text-gray-600">
            {customer.stats?.rating || 0}
          </span>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewDetails(customer)}
            className="p-1 h-8 w-8"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(customer)}
            className="p-1 h-8 w-8"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onScheduleAppointment(customer)}
            className="p-1 h-8 w-8"
          >
            <Calendar className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="p-1 h-8 w-8"
          >
            <Phone className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="p-1 h-8 w-8"
          >
            <Mail className="w-4 h-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
};

const CustomerDetailsModal: React.FC<{
  customer: User | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onScheduleAppointment: () => void;
}> = ({ customer, isOpen, onClose, onEdit, onScheduleAppointment }) => {
  const { t } = useTranslation();

  if (!customer) return null;

  // Mock customer stats and appointments
  const customerStats = {
    totalSpent: 12500,
    appointmentCount: 8,
    averageSpent: 1562,
    lastVisit: '2024-01-15',
    rating: 4.8,
    favoriteService: 'Locs Maintenance',
  };

  const recentAppointments = [
    {
      id: '1',
      date: '2024-01-15',
      service: 'Locs Maintenance',
      status: 'completed',
      price: 500,
    },
    {
      id: '2',
      date: '2024-01-10',
      service: 'Styling',
      status: 'completed',
      price: 400,
    },
    {
      id: '3',
      date: '2024-01-05',
      service: 'New Installation',
      status: 'completed',
      price: 1500,
    },
  ];

  const spendingData = React.useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => ({
      month: format(new Date(2024, i, 1), 'MMM'),
      amount: Math.floor(Math.random() * 2000) + 500,
    }));
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={customer.name}
      size="lg"
    >
      <div className="space-y-6">
        {/* Customer Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              {customer.avatar ? (
                <img
                  src={customer.avatar}
                  alt={customer.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <span className="text-xl font-medium text-gray-600">
                  {customer.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{customer.name}</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  <span>{customer.email}</span>
                </div>
                {customer.phone && (
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 mr-2" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  <span>Customer since {format(new Date(customer.createdAt), 'MMM yyyy')}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onEdit}>
              <Edit2 className="w-4 h-4 mr-2" />
              {t('common.edit')}
            </Button>
            <Button onClick={onScheduleAppointment}>
              <Calendar className="w-4 h-4 mr-2" />
              {t('staff.customers.scheduleAppointment')}
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{customerStats.appointmentCount}</div>
            <div className="text-sm text-gray-600">{t('staff.customers.totalAppointments')}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {customerStats.totalSpent.toLocaleString('da-DK')} DKK
            </div>
            <div className="text-sm text-gray-600">{t('staff.customers.totalSpent')}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {customerStats.averageSpent.toLocaleString('da-DK')} DKK
            </div>
            <div className="text-sm text-gray-600">{t('staff.customers.averageSpent')}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < customerStats.rating
                        ? 'text-yellow-400 fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="ml-2 text-lg font-bold text-gray-900">
                {customerStats.rating}
              </span>
            </div>
            <div className="text-sm text-gray-600">{t('staff.customers.rating')}</div>
          </Card>
        </div>

        {/* Spending Chart */}
        <Card className="p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">
            {t('staff.customers.spendingHistory')}
          </h4>
          <Chart
            type="bar"
            data={spendingData}
            config={{
              xAxis: { dataKey: 'month' },
              yAxis: { tickFormatter: (value: number) => `${value.toLocaleString()} DKK` },
              series: [
                {
                  dataKey: 'amount',
                  fill: '#3B82F6',
                  name: 'Spending',
                },
              ],
            }}
            height={200}
          />
        </Card>

        {/* Recent Appointments */}
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4">
            {t('staff.customers.recentAppointments')}
          </h4>
          <div className="space-y-3">
            {recentAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">{appointment.service}</div>
                  <div className="text-sm text-gray-600">
                    {format(new Date(appointment.date), 'MMM dd, yyyy')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {appointment.price.toLocaleString('da-DK')} DKK
                  </div>
                  <Badge variant="success">
                    {t(`appointment.status.${appointment.status}`)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Preferences */}
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            {t('staff.customers.preferences')}
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t('staff.customers.favoriteService')}</span>
              <span className="font-medium text-gray-900">{customerStats.favoriteService}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('staff.customers.preferredLanguage')}</span>
              <span className="font-medium text-gray-900">
                {customer.preferences?.language || 'da'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('staff.customers.notifications')}</span>
              <span className="font-medium text-gray-900">
                {customer.preferences?.notifications?.email ? 'Email' : 'SMS'}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </Modal>
  );
};

const CustomerEditModal: React.FC<{
  customer: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: UserUpdateInput) => void;
  isLoading?: boolean;
}> = ({ customer, isOpen, onClose, onSave, isLoading }) => {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<UserUpdateInput>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: customer ? {
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
    } : undefined,
  });

  React.useEffect(() => {
    if (customer && isOpen) {
      reset({
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
      });
    }
  }, [customer, isOpen, reset]);

  const onSubmit = (data: UserUpdateInput) => {
    onSave(data);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={customer ? t('staff.customers.editCustomer') : t('staff.customers.addCustomer')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <Input
            label={t('auth.form.name')}
            {...register('name')}
            error={errors.name?.message}
            disabled={isSubmitting || isLoading}
          />
          <Input
            label={t('auth.form.email')}
            type="email"
            {...register('email')}
            error={errors.email?.message}
            disabled={isSubmitting || isLoading}
          />
          <Input
            label={t('auth.form.phone')}
            {...register('phone')}
            error={errors.phone?.message}
            disabled={isSubmitting || isLoading}
          />
        </div>

        <div className="flex items-center justify-end space-x-3 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting || isLoading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting || isLoading ? (
              <LoadingSpinner size="sm" />
            ) : (
              t('common.save')
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export const StaffCustomerManagement: React.FC = () => {
  const { t } = useTranslation();

  // Mock data - replace with real API calls
  const [customers, setCustomers] = React.useState<User[]>([
    {
      id: '1',
      name: 'Anna Jensen',
      email: 'anna@example.com',
      phone: '+45 12 34 56 78',
      role: 'customer',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: '2',
      name: 'Michael Nielsen',
      email: 'michael@example.com',
      phone: '+45 98 76 54 32',
      role: 'customer',
      createdAt: '2024-01-10T10:00:00Z',
      updatedAt: '2024-01-10T10:00:00Z',
    },
    {
      id: '3',
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      role: 'customer',
      createdAt: '2024-01-05T10:00:00Z',
      updatedAt: '2024-01-05T10:00:00Z',
    },
  ]);

  const [filters, setFilters] = React.useState<CustomerFilters>({
    search: '',
    sortBy: 'name',
    sortOrder: 'asc',
    status: '',
  });

  const [selectedCustomer, setSelectedCustomer] = React.useState<User | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const customerStats: CustomerStats = {
    totalCustomers: customers.length,
    newThisMonth: 12,
    averageSpending: 1850,
    retentionRate: 87,
  };

  const filteredCustomers = React.useMemo(() => {
    let result = [...customers];

    // Apply search filter
    if (filters.search) {
      result = result.filter(
        customer =>
          customer.name.toLowerCase().includes(filters.search!.toLowerCase()) ||
          customer.email.toLowerCase().includes(filters.search!.toLowerCase())
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      const aVal = a[filters.sortBy as keyof User] as string;
      const bVal = b[filters.sortBy as keyof User] as string;

      if (filters.sortOrder === 'asc') {
        return aVal.localeCompare(bVal);
      } else {
        return bVal.localeCompare(aVal);
      }
    });

    return result;
  }, [customers, filters]);

  const handleViewDetails = (customer: User) => {
    setSelectedCustomer(customer);
    setIsDetailsModalOpen(true);
  };

  const handleEditCustomer = (customer: User) => {
    setSelectedCustomer(customer);
    setIsEditModalOpen(true);
  };

  const handleScheduleAppointment = (customer: User) => {
    // TODO: Navigate to calendar with customer pre-selected
    console.log('Schedule appointment for:', customer);
  };

  const handleSaveCustomer = async (data: UserUpdateInput) => {
    setIsLoading(true);
    try {
      // TODO: Implement API call
      console.log('Save customer:', data);
      setIsEditModalOpen(false);
      setSelectedCustomer(null);
    } catch (error) {
      console.error('Failed to save customer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sortOptions: SelectOption[] = [
    { value: 'name', label: t('common.name') },
    { value: 'email', label: t('common.email') },
    { value: 'createdAt', label: t('common.dateJoined') },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('staff.customers.title')}
          </h1>
          <p className="text-gray-600 mt-1">
            {t('staff.customers.subtitle', { count: filteredCustomers.length })}
          </p>
        </div>
        <Button onClick={() => setIsEditModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('staff.customers.addCustomer')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('staff.customers.stats.total')}
              </p>
              <p className="text-2xl font-bold text-gray-900">{customerStats.totalCustomers}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('staff.customers.stats.newThisMonth')}
              </p>
              <p className="text-2xl font-bold text-green-600">+{customerStats.newThisMonth}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('staff.customers.stats.averageSpending')}
              </p>
              <p className="text-2xl font-bold text-purple-600">
                {customerStats.averageSpending.toLocaleString('da-DK')} DKK
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('staff.customers.stats.retentionRate')}
              </p>
              <p className="text-2xl font-bold text-orange-600">{customerStats.retentionRate}%</p>
            </div>
            <Star className="w-8 h-8 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder={t('staff.customers.searchPlaceholder')}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10"
            />
          </div>
          <Select
            placeholder={t('common.sortBy')}
            options={sortOptions}
            value={filters.sortBy}
            onChange={(value) => setFilters({ ...filters, sortBy: value as any })}
          />
          <Select
            placeholder={t('common.sortOrder')}
            options={[
              { value: 'asc', label: t('common.ascending') },
              { value: 'desc', label: t('common.descending') },
            ]}
            value={filters.sortOrder}
            onChange={(value) => setFilters({ ...filters, sortOrder: value as any })}
          />
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            {t('common.moreFilters')}
          </Button>
        </div>
      </Card>

      {/* Customers Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('staff.customers.table.customer')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('staff.customers.table.phone')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('staff.customers.table.lastVisit')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('staff.customers.table.visits')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('staff.customers.table.totalSpent')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('staff.customers.table.rating')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.map((customer) => (
                <CustomerTableRow
                  key={customer.id}
                  customer={customer}
                  onEdit={handleEditCustomer}
                  onViewDetails={handleViewDetails}
                  onScheduleAppointment={handleScheduleAppointment}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modals */}
      <CustomerDetailsModal
        customer={selectedCustomer}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedCustomer(null);
        }}
        onEdit={() => {
          setIsDetailsModalOpen(false);
          setIsEditModalOpen(true);
        }}
        onScheduleAppointment={() => {
          setIsDetailsModalOpen(false);
          handleScheduleAppointment(selectedCustomer!);
        }}
      />

      <CustomerEditModal
        customer={selectedCustomer}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedCustomer(null);
        }}
        onSave={handleSaveCustomer}
        isLoading={isLoading}
      />
    </div>
  );
};