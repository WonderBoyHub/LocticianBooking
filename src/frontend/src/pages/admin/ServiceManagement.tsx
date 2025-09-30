'use client'

import React from 'react';
import { motion } from 'framer-motion';
import { Routes, Route, Link } from 'react-router-dom';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  DollarSign,
  Clock,
  Star,
  Image as ImageIcon,
  Tag,
  MoreVertical
} from 'lucide-react';
import { z } from 'zod';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import {
  selectServices,
  selectServiceCategories,
  selectServicesLoading,
  selectSelectedService,
  setServices,
  setServiceCategories,
  setServicesLoading,
  setSelectedService,
  addService,
  updateService,
  removeService
} from '../../store/slices/adminSlice';
import { Form, FormField, Input, Select, Textarea, FormSubmit } from '../../components/ui/Form';
import { Modal, ConfirmationModal } from '../../components/ui/AdvancedModal';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

// Validation schemas
const serviceSchema = z.object({
  name: z.string().min(2, 'Service name must be at least 2 characters'),
  nameEn: z.string().optional(),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  descriptionEn: z.string().optional(),
  duration: z.number().min(15, 'Duration must be at least 15 minutes'),
  price: z.number().min(1, 'Price must be greater than 0'),
  categoryId: z.string().min(1, 'Please select a category'),
  isActive: z.boolean().default(true)
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface ServiceCardProps {
  service: any;
  onEdit: (service: any) => void;
  onDelete: (service: any) => void;
  onView: (service: any) => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onEdit, onDelete, onView }) => {
  return (
    <motion.div
      whilehover={{ y: -2 }}
      className="bg-white rounded-xl shadow-soft border border-brown-200 overflow-hidden"
    >
      {/* Service Image */}
      <div className="h-48 bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
        {service.images && service.images.length > 0 ? (
          <img
            src={service.images[0]}
            alt={service.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageIcon className="w-12 h-12 text-white/70" />
        )}
      </div>

      {/* Service Info */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-serif font-bold text-brand-dark text-lg mb-1">
              {service.name}
            </h3>
            <p className="text-sm text-brown-600 line-clamp-2">
              {service.description}
            </p>
          </div>
          <div className="ml-3">
            <button className="p-1 rounded-lg hover:bg-brown-100 transition-colors">
              <MoreVertical className="w-4 h-4 text-brown-600" />
            </button>
          </div>
        </div>

        {/* Service Details */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4 text-sm text-brown-600">
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {service.duration} min
            </div>
            <div className="flex items-center">
              <DollarSign className="w-4 h-4 mr-1" />
              {service.price} DKK
            </div>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            service.isActive
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {service.isActive ? 'Active' : 'Inactive'}
          </div>
        </div>

        {/* Category */}
        <div className="mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-accent text-brand-dark">
            <Tag className="w-3 h-3 mr-1" />
            {service.category?.name || 'Uncategorized'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onView(service)}
            className="flex-1 px-3 py-2 text-sm font-medium text-brand-primary border border-brand-primary rounded-lg hover:bg-brand-primary hover:text-white transition-colors"
          >
            <Eye className="w-4 h-4 mr-1 inline" />
            View
          </button>
          <button
            onClick={() => onEdit(service)}
            className="px-3 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(service)}
            className="px-3 py-2 text-sm font-medium text-red-600 border border-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export const ServiceManagement: React.FC = () => {
  const dispatch = useAppDispatch();
  const { toast } = useToast();

  const services = useAppSelector(selectServices);
  const categories = useAppSelector(selectServiceCategories);
  const loading = useAppSelector(selectServicesLoading);
  const selectedService = useAppSelector(selectSelectedService);

  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [serviceToDelete, setServiceToDelete] = React.useState<any>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('');

  // Mock data
  const mockCategories = [
    { id: '1', name: 'Loctician Services', slug: 'loctician', order: 1, isActive: true },
    { id: '2', name: 'Maintenance', slug: 'maintenance', order: 2, isActive: true },
    { id: '3', name: 'Extensions', slug: 'extensions', order: 3, isActive: true },
    { id: '4', name: 'Styling', slug: 'styling', order: 4, isActive: true }
  ];

  const mockServices = [
    {
      id: '1',
      name: 'Dreadlock Installation',
      description: 'Professional dreadlock installation service with high-quality techniques',
      duration: 360,
      price: 2500,
      category: mockCategories[0],
      isActive: true,
      locticianId: 'loctician1',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
      images: []
    },
    {
      id: '2',
      name: 'Dreadlock Maintenance',
      description: 'Regular maintenance to keep your locs healthy and looking their best',
      duration: 120,
      price: 800,
      category: mockCategories[1],
      isActive: true,
      locticianId: 'loctician1',
      createdAt: '2024-01-14T14:30:00Z',
      updatedAt: '2024-01-14T14:30:00Z',
      images: []
    },
    {
      id: '3',
      name: 'Loc Extensions',
      description: 'Add length and volume to your existing locs with premium extensions',
      duration: 240,
      price: 1800,
      category: mockCategories[2],
      isActive: true,
      locticianId: 'loctician1',
      createdAt: '2024-01-13T09:15:00Z',
      updatedAt: '2024-01-13T09:15:00Z',
      images: []
    }
  ];

  React.useEffect(() => {
    dispatch(setServicesLoading(true));
    setTimeout(() => {
      dispatch(setServices(mockServices));
      dispatch(setServiceCategories(mockCategories));
      dispatch(setServicesLoading(false));
    }, 1000);
  }, [dispatch]);

  const handleCreateService = (data: ServiceFormData) => {
    const category = mockCategories.find(cat => cat.id === data.categoryId);
    if (!category) return;

    const newService = {
      id: Date.now().toString(),
      ...data,
      category,
      locticianId: 'current-user-id',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      images: []
    };

    dispatch(addService(newService));
    setShowCreateModal(false);
    toast('success', 'Service created successfully');
  };

  const handleEditService = (data: ServiceFormData) => {
    if (!selectedService) return;

    const category = mockCategories.find(cat => cat.id === data.categoryId);
    if (!category) return;

    const updatedService = {
      ...selectedService,
      ...data,
      category,
      updatedAt: new Date().toISOString()
    };

    dispatch(updateService(updatedService));
    setShowEditModal(false);
    dispatch(setSelectedService(null));
    toast('success', 'Service updated successfully');
  };

  const handleDeleteService = () => {
    if (!serviceToDelete) return;

    dispatch(removeService(serviceToDelete.id));
    setShowDeleteModal(false);
    setServiceToDelete(null);
    toast('success', 'Service deleted successfully');
  };

  const handleServiceView = (service: any) => {
    dispatch(setSelectedService(service));
    // Could navigate to service detail view or open view modal
  };

  const handleServiceEdit = (service: any) => {
    dispatch(setSelectedService(service));
    setShowEditModal(true);
  };

  const handleServiceDelete = (service: any) => {
    setServiceToDelete(service);
    setShowDeleteModal(true);
  };

  const filteredServices = services.filter(service => {
    if (searchQuery && !service.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !service.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (categoryFilter && service.category?.id !== categoryFilter) {
      return false;
    }
    return true;
  });

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...mockCategories.map(cat => ({ value: cat.id, label: cat.name }))
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-brand-dark">
            Service Management
          </h1>
          <p className="text-brown-600 mt-1">
            Manage your services, pricing, and categories
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline">
            Manage Categories
          </Button>
          <Button
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowCreateModal(true)}
          >
            Add Service
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
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full rounded-lg border-brown-300 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>
          <Select
            options={categoryOptions}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            placeholder="Filter by category"
          />
          <div className="flex items-center justify-between">
            <span className="text-sm text-brown-600">
              {filteredServices.length} services found
            </span>
            <div className="flex items-center space-x-2">
              <button className="p-2 rounded-lg hover:bg-brown-100 transition-colors">
                <Filter className="w-4 h-4 text-brown-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-soft border border-brown-200 p-6 animate-pulse">
              <div className="h-32 bg-brown-200 rounded-lg mb-4"></div>
              <div className="h-4 bg-brown-200 rounded mb-2"></div>
              <div className="h-3 bg-brown-200 rounded mb-4"></div>
              <div className="flex space-x-2">
                <div className="h-8 bg-brown-200 rounded flex-1"></div>
                <div className="h-8 w-8 bg-brown-200 rounded"></div>
                <div className="h-8 w-8 bg-brown-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onView={handleServiceView}
              onEdit={handleServiceEdit}
              onDelete={handleServiceDelete}
            />
          ))}
        </div>
      )}

      {/* Create Service Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Service"
        size="lg"
      >
        <Form
          schema={serviceSchema}
          onSubmit={handleCreateService}
          defaultValues={{
            name: '',
            nameEn: '',
            description: '',
            descriptionEn: '',
            duration: 60,
            price: 500,
            categoryId: '',
            isActive: true
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField name="name" label="Service Name (Danish)" required>
              <Input placeholder="Enter service name" />
            </FormField>

            <FormField name="nameEn" label="Service Name (English)">
              <Input placeholder="Enter English name" />
            </FormField>
          </div>

          <FormField name="description" label="Description (Danish)" required>
            <Textarea
              placeholder="Describe the service"
              rows={3}
            />
          </FormField>

          <FormField name="descriptionEn" label="Description (English)">
            <Textarea
              placeholder="English description"
              rows={3}
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField name="duration" label="Duration (minutes)" required>
              <Input type="number" min="15" step="15" />
            </FormField>

            <FormField name="price" label="Price (DKK)" required>
              <Input type="number" min="1" step="10" />
            </FormField>

            <FormField name="categoryId" label="Category" required>
              <Select
                options={mockCategories.map(cat => ({
                  value: cat.id,
                  label: cat.name
                }))}
                placeholder="Select category"
              />
            </FormField>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <FormSubmit>Create Service</FormSubmit>
          </div>
        </Form>
      </Modal>

      {/* Edit Service Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          dispatch(setSelectedService(null));
        }}
        title="Edit Service"
        size="lg"
      >
        {selectedService && (
          <Form
            schema={serviceSchema}
            onSubmit={handleEditService}
            defaultValues={{
              name: selectedService.name,
              nameEn: selectedService.nameEn || '',
              description: selectedService.description,
              descriptionEn: selectedService.descriptionEn || '',
              duration: selectedService.duration,
              price: selectedService.price,
              categoryId: selectedService.category?.id || '',
              isActive: selectedService.isActive
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField name="name" label="Service Name (Danish)" required>
                <Input placeholder="Enter service name" />
              </FormField>

              <FormField name="nameEn" label="Service Name (English)">
                <Input placeholder="Enter English name" />
              </FormField>
            </div>

            <FormField name="description" label="Description (Danish)" required>
              <Textarea
                placeholder="Describe the service"
                rows={3}
              />
            </FormField>

            <FormField name="descriptionEn" label="Description (English)">
              <Textarea
                placeholder="English description"
                rows={3}
              />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField name="duration" label="Duration (minutes)" required>
                <Input type="number" min="15" step="15" />
              </FormField>

              <FormField name="price" label="Price (DKK)" required>
                <Input type="number" min="1" step="10" />
              </FormField>

              <FormField name="categoryId" label="Category" required>
                <Select
                  options={mockCategories.map(cat => ({
                    value: cat.id,
                    label: cat.name
                  }))}
                  placeholder="Select category"
                />
              </FormField>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  dispatch(setSelectedService(null));
                }}
              >
                Cancel
              </Button>
              <FormSubmit>Update Service</FormSubmit>
            </div>
          </Form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setServiceToDelete(null);
        }}
        onConfirm={handleDeleteService}
        title="Delete Service"
        message={`Are you sure you want to delete "${serviceToDelete?.name}"? This action cannot be undone.`}
        type="danger"
        confirmText="Delete"
      />
    </div>
  );
};
