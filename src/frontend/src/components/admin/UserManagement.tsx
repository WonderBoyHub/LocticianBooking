import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Shield,
  UserCheck,
  UserX,
  Mail,
  Phone,
  Calendar,
  Eye,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '../ui';
import { useRoleAccess } from '../../hooks/useRoleAccess';
import type { User } from '../../types';
import type { UserRole } from '../../hooks/useRoleAccess';

// Mock data - this would come from your API
const mockUsers: User[] = [
  {
    id: '1',
    name: 'John Admin',
    email: 'admin@jli.dk',
    role: 'admin',
    phone: '+45 12 34 56 78',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-09-26T10:00:00Z',
    preferences: {
      language: 'da',
      notifications: { email: true, sms: false, push: true },
      timezone: 'Europe/Copenhagen',
    },
  },
  {
    id: '2',
    name: 'Maria Loctician',
    email: 'maria@jli.dk',
    role: 'loctician',
    phone: '+45 23 45 67 89',
    createdAt: '2024-02-10T14:30:00Z',
    updatedAt: '2024-09-25T16:45:00Z',
    preferences: {
      language: 'da',
      notifications: { email: true, sms: true, push: false },
      timezone: 'Europe/Copenhagen',
    },
  },
  {
    id: '3',
    name: 'Sarah Customer',
    email: 'sarah@example.com',
    role: 'customer',
    phone: '+45 34 56 78 90',
    createdAt: '2024-03-05T09:15:00Z',
    updatedAt: '2024-09-24T12:30:00Z',
    preferences: {
      language: 'en',
      notifications: { email: true, sms: false, push: true },
      timezone: 'Europe/Copenhagen',
    },
  },
  // Add more mock users as needed
];

type UserStatus = 'all' | 'active' | 'inactive' | 'suspended';
type SortField = 'name' | 'email' | 'role' | 'createdAt';
type SortOrder = 'asc' | 'desc';

interface UserManagementProps {
  className?: string;
}

export const UserManagement: React.FC<UserManagementProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const { getRoleDisplayName, getRoleBadgeColor, isAdmin } = useRoleAccess();

  const [users, setUsers] = useState<User[]>(mockUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           user.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      // For status filter, we'd check a status field if it existed
      const matchesStatus = statusFilter === 'all'; // Simplified for now

      return matchesSearch && matchesRole && matchesStatus;
    });

    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [users, searchQuery, roleFilter, statusFilter, sortField, sortOrder]);

  const handleCreateUser = () => {
    navigate('/auth/register?admin=true');
  };

  const handleEditUser = (user: User) => {
    navigate(`/admin/users/${user.id}/edit`);
  };

  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setShowUserDetails(true);
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      // This would be an API call
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const toggleUserStatus = async (user: User) => {
    try {
      // This would be an API call to toggle user status
      console.log('Toggle user status:', user.id);
    } catch (error) {
      console.error('Failed to toggle user status:', error);
    }
  };

  const roleOptions = [
    { value: 'all', label: 'All Roles' },
    { value: 'admin', label: 'Administrator' },
    { value: 'loctician', label: 'Loctician' },
    { value: 'customer', label: 'Customer' },
  ];

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'suspended', label: 'Suspended' },
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('da-DK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!isAdmin()) {
    return (
      <Card className={className}>
        <CardContent>
          <div className="text-center py-8">
            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-500">You don't have permission to access user management.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">User Management</CardTitle>
              <p className="text-gray-600 mt-1">Manage all users, roles, and permissions</p>
            </div>
            <Button
              onClick={handleCreateUser}
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add User
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filters and Search */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />

              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                options={roleOptions}
                fullWidth
              />

              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as UserStatus)}
                options={statusOptions}
                fullWidth
              />

              <Button
                variant="outline"
                leftIcon={<Filter className="w-4 h-4" />}
                fullWidth
              >
                More Filters
              </Button>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">User</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Contact</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Joined</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredAndSortedUsers.map((user) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center text-white font-medium">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {getRoleDisplayName(user.role)}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center text-sm text-gray-600">
                            <Mail className="w-3 h-3 mr-1" />
                            {user.email}
                          </div>
                          {user.phone && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Phone className="w-3 h-3 mr-1" />
                              {user.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(user.createdAt)}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          Active
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewUser(user)}
                            leftIcon={<Eye className="w-3 h-3" />}
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditUser(user)}
                            leftIcon={<Edit className="w-3 h-3" />}
                          >
                            Edit
                          </Button>
                          {user.role !== 'admin' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteUser(user)}
                              leftIcon={<Trash2 className="w-3 h-3" />}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>

            {filteredAndSortedUsers.length === 0 && (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">No users found</div>
                <p className="text-gray-500 text-sm">
                  {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Start by creating your first user'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Details Modal */}
      <Modal
        isOpen={showUserDetails}
        onClose={() => setShowUserDetails(false)}
        size="lg"
      >
        <ModalHeader>
          <h2 className="text-xl font-semibold">User Details</h2>
        </ModalHeader>
        <ModalBody>
          {selectedUser && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-brand-primary rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-medium">{selectedUser.name}</h3>
                  <p className="text-gray-600">{selectedUser.email}</p>
                  <Badge className={getRoleBadgeColor(selectedUser.role)}>
                    {getRoleDisplayName(selectedUser.role)}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Contact Information</h4>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm">{selectedUser.email}</span>
                    </div>
                    {selectedUser.phone && (
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm">{selectedUser.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Account Details</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Joined:</span>{' '}
                      {formatDate(selectedUser.createdAt)}
                    </div>
                    <div>
                      <span className="text-gray-500">Last Updated:</span>{' '}
                      {formatDate(selectedUser.updatedAt)}
                    </div>
                    <div>
                      <span className="text-gray-500">Language:</span>{' '}
                      {selectedUser.preferences?.language === 'da' ? 'Danish' : 'English'}
                    </div>
                  </div>
                </div>
              </div>

              {selectedUser.preferences && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Notification Preferences</h4>
                  <div className="flex space-x-4">
                    <Badge variant={selectedUser.preferences.notifications.email ? 'default' : 'secondary'}>
                      Email: {selectedUser.preferences.notifications.email ? 'On' : 'Off'}
                    </Badge>
                    <Badge variant={selectedUser.preferences.notifications.sms ? 'default' : 'secondary'}>
                      SMS: {selectedUser.preferences.notifications.sms ? 'On' : 'Off'}
                    </Badge>
                    <Badge variant={selectedUser.preferences.notifications.push ? 'default' : 'secondary'}>
                      Push: {selectedUser.preferences.notifications.push ? 'On' : 'Off'}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            onClick={() => setShowUserDetails(false)}
            variant="outline"
          >
            Close
          </Button>
          {selectedUser && (
            <Button
              onClick={() => handleEditUser(selectedUser)}
              variant="primary"
              leftIcon={<Edit className="w-4 h-4" />}
            >
              Edit User
            </Button>
          )}
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      >
        <ModalHeader>
          <h2 className="text-xl font-semibold text-red-600">Delete User</h2>
        </ModalHeader>
        <ModalBody>
          <p>
            Are you sure you want to delete{' '}
            <span className="font-medium">{selectedUser?.name}</span>? This action cannot be undone.
          </p>
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              <strong>Warning:</strong> Deleting this user will also remove all associated data including appointments and history.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            onClick={() => setShowDeleteModal(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDeleteUser}
            variant="primary"
            className="bg-red-600 hover:bg-red-700"
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Delete User
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};