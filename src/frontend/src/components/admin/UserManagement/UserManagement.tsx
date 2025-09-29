import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit2,
  Trash2,
  UserPlus,
  Mail,
  Phone,
  Calendar,
  Eye,
  Shield,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Modal } from '../../ui/Modal';
import { Badge } from '../../ui/Badge';
import { LoadingSpinner } from '../../ui/LoadingSpinner';

import type { User, SelectOption } from '../../../types';
import { adminUserUpdateSchema, type AdminUserUpdateInput } from '../../../schemas';

interface UserFilters {
  role?: 'customer' | 'loctician' | 'admin' | '';
  status?: 'active' | 'inactive' | 'suspended' | '';
  search?: string;
  sortBy?: 'name' | 'email' | 'createdAt' | 'lastLogin';
  sortOrder?: 'asc' | 'desc';
}

interface UserManagementProps {}

const UserTableRow: React.FC<{
  user: User;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onViewDetails: (user: User) => void;
}> = ({ user, onEdit, onDelete, onViewDetails }) => {
  const { t } = useTranslation();

  const getRoleIcon = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return <ShieldCheck className="w-4 h-4 text-red-500" />;
      case 'loctician':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <UserIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadgeVariant = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return 'error' as const;
      case 'loctician':
        return 'info' as const;
      default:
        return 'default' as const;
    }
  };

  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mr-4">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span className="text-sm font-medium text-gray-600">
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{user.name}</div>
            <div className="text-sm text-gray-500">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center">
          {getRoleIcon(user.role)}
          <Badge
            variant={getRoleBadgeVariant(user.role)}
            className="ml-2"
          >
            {t(`user.role.${user.role}`)}
          </Badge>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">{user.phone || '—'}</div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">
          {format(new Date(user.createdAt), 'MMM dd, yyyy')}
        </div>
      </td>
      <td className="px-6 py-4">
        <Badge variant="success">Active</Badge>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewDetails(user)}
            className="p-1 h-8 w-8"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(user)}
            className="p-1 h-8 w-8"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(user)}
            className="p-1 h-8 w-8 text-red-500 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
};

const UserEditModal: React.FC<{
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: AdminUserUpdateInput) => void;
  isLoading?: boolean;
}> = ({ user, isOpen, onClose, onSave, isLoading }) => {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<AdminUserUpdateInput>({
    resolver: zodResolver(adminUserUpdateSchema),
    defaultValues: user ? {
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      isActive: true,
      status: 'active',
    } : undefined,
  });

  const roleOptions: SelectOption[] = [
    { value: 'customer', label: t('user.role.customer') },
    { value: 'loctician', label: t('user.role.loctician') },
    { value: 'admin', label: t('user.role.admin') },
  ];

  const statusOptions: SelectOption[] = [
    { value: 'active', label: t('user.status.active') },
    { value: 'inactive', label: t('user.status.inactive') },
    { value: 'suspended', label: t('user.status.suspended') },
  ];

  React.useEffect(() => {
    if (user && isOpen) {
      reset({
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: true,
        status: 'active',
      });
    }
  }, [user, isOpen, reset]);

  const onSubmit = (data: AdminUserUpdateInput) => {
    onSave(data);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user ? t('admin.users.editUser') : t('admin.users.createUser')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Input
              label={t('auth.form.name')}
              {...register('name')}
              error={errors.name?.message}
              disabled={isSubmitting || isLoading}
            />
          </div>
          <div>
            <Input
              label={t('auth.form.email')}
              type="email"
              {...register('email')}
              error={errors.email?.message}
              disabled={isSubmitting || isLoading}
            />
          </div>
          <div>
            <Input
              label={t('auth.form.phone')}
              {...register('phone')}
              error={errors.phone?.message}
              disabled={isSubmitting || isLoading}
            />
          </div>
          <div>
            <Select
              label={t('user.role.label')}
              options={roleOptions}
              {...register('role')}
              error={errors.role?.message}
              disabled={isSubmitting || isLoading}
            />
          </div>
          <div>
            <Select
              label={t('user.status.label')}
              options={statusOptions}
              {...register('status')}
              error={errors.status?.message}
              disabled={isSubmitting || isLoading}
            />
          </div>
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

export const UserManagement: React.FC<UserManagementProps> = () => {
  const { t } = useTranslation();

  // Mock data - replace with real API calls
  const [users, setUsers] = React.useState<User[]>([
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
      role: 'loctician',
      createdAt: '2024-01-10T10:00:00Z',
      updatedAt: '2024-01-10T10:00:00Z',
    },
    {
      id: '3',
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      role: 'admin',
      createdAt: '2024-01-05T10:00:00Z',
      updatedAt: '2024-01-05T10:00:00Z',
    },
  ]);

  const [filters, setFilters] = React.useState<UserFilters>({
    search: '',
    role: '',
    status: '',
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const filteredUsers = React.useMemo(() => {
    let result = [...users];

    // Apply search filter
    if (filters.search) {
      result = result.filter(
        user =>
          user.name.toLowerCase().includes(filters.search!.toLowerCase()) ||
          user.email.toLowerCase().includes(filters.search!.toLowerCase())
      );
    }

    // Apply role filter
    if (filters.role) {
      result = result.filter(user => user.role === filters.role);
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
  }, [users, filters]);

  const handleCreateUser = () => {
    setSelectedUser(null);
    setIsEditModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    // TODO: Show confirmation modal and handle deletion
    console.log('Delete user:', user);
  };

  const handleViewDetails = (user: User) => {
    // TODO: Show user details modal
    console.log('View user details:', user);
  };

  const handleSaveUser = async (data: AdminUserUpdateInput) => {
    setIsLoading(true);
    try {
      // TODO: Implement API call
      console.log('Save user:', data);
      setIsEditModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Failed to save user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const roleFilterOptions: SelectOption[] = [
    { value: '', label: t('common.all') },
    { value: 'customer', label: t('user.role.customer') },
    { value: 'loctician', label: t('user.role.loctician') },
    { value: 'admin', label: t('user.role.admin') },
  ];

  const statusFilterOptions: SelectOption[] = [
    { value: '', label: t('common.all') },
    { value: 'active', label: t('user.status.active') },
    { value: 'inactive', label: t('user.status.inactive') },
    { value: 'suspended', label: t('user.status.suspended') },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('admin.users.title')}
          </h1>
          <p className="text-gray-600 mt-1">
            {t('admin.users.subtitle', { count: filteredUsers.length })}
          </p>
        </div>
        <Button onClick={handleCreateUser}>
          <UserPlus className="w-4 h-4 mr-2" />
          {t('admin.users.createUser')}
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder={t('admin.users.searchPlaceholder')}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10"
            />
          </div>
          <Select
            placeholder={t('admin.users.filterByRole')}
            options={roleFilterOptions}
            value={filters.role}
            onChange={(value) => setFilters({ ...filters, role: value as any })}
          />
          <Select
            placeholder={t('admin.users.filterByStatus')}
            options={statusFilterOptions}
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value as any })}
          />
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            {t('common.moreFilters')}
          </Button>
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.users.table.user')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.users.table.role')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.users.table.phone')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.users.table.joined')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.users.table.status')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <UserTableRow
                  key={user.id}
                  user={user}
                  onEdit={handleEditUser}
                  onDelete={handleDeleteUser}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit/Create User Modal */}
      <UserEditModal
        user={selectedUser}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveUser}
        isLoading={isLoading}
      />
    </div>
  );
};