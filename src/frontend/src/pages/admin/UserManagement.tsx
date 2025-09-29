import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Routes, Route, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Mail,
  Phone,
  Calendar,
  Shield,
  User as UserIcon,
  Crown,
  Download,
  Upload,
  X
} from 'lucide-react';
import { z } from 'zod';
import type { User } from '../../types';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import {
  selectUsers,
  selectUsersLoading,
  selectSelectedUser,
  selectUserFilters,
  setUsers,
  setUsersLoading,
  setSelectedUser,
  setUserFilters,
  addUser,
  updateUser,
  removeUser
} from '../../store/slices/adminSlice';
import { Form, FormField, Input, Select, FormSubmit } from '../../components/ui/Form';
import { Modal, ConfirmationModal } from '../../components/ui/AdvancedModal';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

// Validation schemas
const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(8, 'Phone number must be at least 8 characters'),
  role: z.enum(['customer', 'loctician', 'admin']),
  password: z.string().min(8, 'Password must be at least 8 characters').optional()
});

type UserFormData = z.infer<typeof userSchema>;

interface UserTableProps {
  users: any[];
  loading: boolean;
  onUserSelect: (user: any) => void;
  onUserEdit: (user: any) => void;
  onUserDelete: (user: any) => void;
}

const UserTable: React.FC<UserTableProps> = ({
  users,
  loading,
  onUserSelect,
  onUserEdit,
  onUserDelete
}) => {
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return Crown;
      case 'loctician':
        return Shield;
      case 'customer':
        return UserIcon;
      default:
        return UserIcon;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-700';
      case 'loctician':
        return 'bg-purple-100 text-purple-700';
      case 'customer':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-soft border border-brown-200 p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-brown-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-brown-200 rounded w-1/4"></div>
                <div className="h-3 bg-brown-200 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-soft border border-brown-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-brown-50 border-b border-brown-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-brown-600 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-brown-600 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-brown-600 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-brown-600 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-brown-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brown-200">
            {users.map((user) => {
              const RoleIcon = getRoleIcon(user.role);

              return (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-brown-50 cursor-pointer"
                  onClick={() => onUserSelect(user)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-brand-dark">
                          {user.name}
                        </div>
                        <div className="text-sm text-brown-600">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                      <RoleIcon className="w-3 h-3 mr-1" />
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-brown-600">
                      {user.phone && (
                        <div className="flex items-center">
                          <Phone className="w-3 h-3 mr-1" />
                          {user.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-brown-600">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUserEdit(user);
                        }}
                        className="text-brand-primary hover:text-brand-dark p-1 rounded transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUserDelete(user);
                        }}
                        className="text-red-600 hover:text-red-800 p-1 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const UserManagement: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const users = useAppSelector(selectUsers);
  const loading = useAppSelector(selectUsersLoading);
  const selectedUser = useAppSelector(selectSelectedUser);
  const filters = useAppSelector(selectUserFilters);

  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState<any>(null);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Mock users data
  const mockUsers: User[] = [
    {
      id: '1',
      name: 'Maria Jensen',
      email: 'maria@example.com',
      phone: '+45 12 34 56 78',
      role: 'customer',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z'
    },
    {
      id: '2',
      name: 'Andreas Larsen',
      email: 'andreas@example.com',
      phone: '+45 98 76 54 32',
      role: 'loctician',
      createdAt: '2024-01-10T14:30:00Z',
      updatedAt: '2024-01-10T14:30:00Z'
    },
    {
      id: '3',
      name: 'Emma Nielsen',
      email: 'emma@example.com',
      phone: '+45 55 44 33 22',
      role: 'admin',
      createdAt: '2024-01-05T09:15:00Z',
      updatedAt: '2024-01-05T09:15:00Z'
    }
  ];

  React.useEffect(() => {
    dispatch(setUsersLoading(true));
    // Simulate API call
    setTimeout(() => {
      dispatch(setUsers(mockUsers));
      dispatch(setUsersLoading(false));
    }, 1000);
  }, [dispatch]);

  const handleCreateUser = (data: UserFormData) => {
    const newUser = {
      id: Date.now().toString(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dispatch(addUser(newUser));
    setShowCreateModal(false);
    toast('success', 'User created successfully');
  };

  const handleEditUser = (data: UserFormData) => {
    if (!selectedUser) return;

    const updatedUser = {
      ...selectedUser,
      ...data,
      updatedAt: new Date().toISOString()
    };

    dispatch(updateUser(updatedUser));
    setShowEditModal(false);
    dispatch(setSelectedUser(null));
    toast('success', 'User updated successfully');
  };

  const handleDeleteUser = () => {
    if (!userToDelete) return;

    dispatch(removeUser(userToDelete.id));
    setShowDeleteModal(false);
    setUserToDelete(null);
    toast('success', 'User deleted successfully');
  };

  const handleUserSelect = (user: any) => {
    dispatch(setSelectedUser(user));
    // Could navigate to user detail view
  };

  const handleUserEdit = (user: any) => {
    dispatch(setSelectedUser(user));
    setShowEditModal(true);
  };

  const handleUserDelete = (user: any) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const filteredUsers = users.filter(user => {
    if (searchQuery && !user.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !user.email.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filters.role && user.role !== filters.role) {
      return false;
    }
    return true;
  });

  const roleOptions = [
    { value: '', label: 'All Roles' },
    { value: 'customer', label: 'Customer' },
    { value: 'loctician', label: 'Loctician' },
    { value: 'admin', label: 'Admin' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-brand-dark">
            User Management
          </h1>
          <p className="text-brown-600 mt-1">
            Manage customers, staff, and administrators
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export
          </Button>
          <Button
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowCreateModal(true)}
          >
            Add User
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-soft border border-brown-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-brown-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full rounded-lg border-brown-300 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>
          <Select
            options={roleOptions}
            value={filters.role || ''}
            onChange={(e) => dispatch(setUserFilters({ role: e.target.value as any }))}
            placeholder="Filter by role"
          />
          <div className="flex items-center space-x-2">
            <span className="text-sm text-brown-600">
              {filteredUsers.length} users found
            </span>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <UserTable
        users={filteredUsers}
        loading={loading}
        onUserSelect={handleUserSelect}
        onUserEdit={handleUserEdit}
        onUserDelete={handleUserDelete}
      />

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New User"
        size="md"
      >
        <Form
          schema={userSchema}
          onSubmit={handleCreateUser}
          defaultValues={{
            name: '',
            email: '',
            phone: '',
            role: 'customer' as const,
            password: ''
          }}
        >
          <FormField name="name" label="Full Name" required>
            <Input placeholder="Enter full name" />
          </FormField>

          <FormField name="email" label="Email Address" required>
            <Input type="email" placeholder="Enter email address" />
          </FormField>

          <FormField name="phone" label="Phone Number" required>
            <Input placeholder="+45 XX XX XX XX" />
          </FormField>

          <FormField name="role" label="Role" required>
            <Select
              options={[
                { value: 'customer', label: 'Customer' },
                { value: 'loctician', label: 'Loctician' },
                { value: 'admin', label: 'Admin' }
              ]}
            />
          </FormField>

          <FormField name="password" label="Password" required>
            <Input type="password" placeholder="Enter password" />
          </FormField>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <FormSubmit>Create User</FormSubmit>
          </div>
        </Form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          dispatch(setSelectedUser(null));
        }}
        title="Edit User"
        size="md"
      >
        {selectedUser && (
          <Form
            schema={userSchema.omit({ password: true })}
            onSubmit={handleEditUser}
            defaultValues={{
              name: selectedUser.name,
              email: selectedUser.email,
              phone: selectedUser.phone,
              role: selectedUser.role
            }}
          >
            <FormField name="name" label="Full Name" required>
              <Input placeholder="Enter full name" />
            </FormField>

            <FormField name="email" label="Email Address" required>
              <Input type="email" placeholder="Enter email address" />
            </FormField>

            <FormField name="phone" label="Phone Number" required>
              <Input placeholder="+45 XX XX XX XX" />
            </FormField>

            <FormField name="role" label="Role" required>
              <Select
                options={[
                  { value: 'customer', label: 'Customer' },
                  { value: 'loctician', label: 'Loctician' },
                  { value: 'admin', label: 'Admin' }
                ]}
              />
            </FormField>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  dispatch(setSelectedUser(null));
                }}
              >
                Cancel
              </Button>
              <FormSubmit>Update User</FormSubmit>
            </div>
          </Form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setUserToDelete(null);
        }}
        onConfirm={handleDeleteUser}
        title="Delete User"
        message={`Are you sure you want to delete ${userToDelete?.name}? This action cannot be undone.`}
        type="danger"
        confirmText="Delete"
      />
    </div>
  );
};