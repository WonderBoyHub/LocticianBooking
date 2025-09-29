import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  Scissors,
  Clock,
  DollarSign,
  ToggleLeft,
  Settings,
  Image as ImageIcon,
  Copy,
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
import { RichTextEditor } from '../../ui/RichTextEditor';
import { ImageGallery } from '../../ui/ImageGallery';

import type { Service, ServiceCategory, SelectOption } from '../../../types';
import { serviceCreateSchema, serviceUpdateSchema, type ServiceCreateInput, type ServiceUpdateInput } from '../../../schemas';

interface ServiceFilters {
  categoryId?: string;
  locticianId?: string;
  isActive?: boolean | string;
  search?: string;
  sortBy?: 'name' | 'price' | 'duration' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

const ServiceTableRow: React.FC<{
  service: Service;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
  onToggleActive: (service: Service) => void;
  onViewDetails: (service: Service) => void;
}> = ({ service, onEdit, onDelete, onToggleActive, onViewDetails }) => {
  const { t } = useTranslation();

  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center">
          {service.images && service.images.length > 0 ? (
            <img
              src={service.images[0]}
              alt={service.name}
              className="w-12 h-12 rounded-lg object-cover mr-4"
            />
          ) : (
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mr-4">
              <Scissors className="w-6 h-6 text-gray-400" />
            </div>
          )}
          <div>
            <div className="text-sm font-medium text-gray-900">{service.name}</div>
            <div className="text-sm text-gray-500">{service.category.name}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center text-sm text-gray-900">
          <Clock className="w-4 h-4 mr-1 text-gray-400" />
          {service.duration} min
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center text-sm text-gray-900">
          <DollarSign className="w-4 h-4 mr-1 text-gray-400" />
          {service.price.toLocaleString('da-DK')} DKK
        </div>
      </td>
      <td className="px-6 py-4">
        <Badge variant={service.isActive ? 'success' : 'secondary'}>
          {service.isActive ? t('common.active') : t('common.inactive')}
        </Badge>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">
          {format(new Date(service.updatedAt), 'MMM dd, yyyy')}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewDetails(service)}
            className="p-1 h-8 w-8"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(service)}
            className="p-1 h-8 w-8"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleActive(service)}
            className="p-1 h-8 w-8"
          >
            <ToggleLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(service)}
            className="p-1 h-8 w-8 text-red-500 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
};

const ServiceEditModal: React.FC<{
  service: Service | null;
  categories: ServiceCategory[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ServiceCreateInput | ServiceUpdateInput) => void;
  isLoading?: boolean;
}> = ({ service, categories, isOpen, onClose, onSave, isLoading }) => {
  const { t } = useTranslation();

  const isEditing = !!service;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<ServiceCreateInput>({
    resolver: zodResolver(isEditing ? serviceUpdateSchema : serviceCreateSchema) as any,
    defaultValues: service ? {
      name: service.name,
      nameEn: service.nameEn,
      description: service.description,
      descriptionEn: service.descriptionEn,
      duration: service.duration,
      price: service.price,
      categoryId: service.category.id,
      locticianId: service.locticianId,
      isActive: service.isActive,
      images: service.images,
      requirements: service.requirements,
      aftercare: service.aftercare,
    } : undefined,
  });

  const categoryOptions: SelectOption[] = categories.map(cat => ({
    value: cat.id,
    label: cat.name,
  }));

  // Mock loctician options - replace with real data
  const locticianOptions: SelectOption[] = [
    { value: '1', label: 'Michael Nielsen' },
    { value: '2', label: 'Sarah Johnson' },
  ];

  React.useEffect(() => {
    if (service && isOpen) {
      reset({
        name: service.name,
        nameEn: service.nameEn,
        description: service.description,
        descriptionEn: service.descriptionEn,
        duration: service.duration,
        price: service.price,
        categoryId: service.category.id,
        locticianId: service.locticianId,
        isActive: service.isActive,
        images: service.images,
        requirements: service.requirements,
        aftercare: service.aftercare,
      });
    } else if (!service && isOpen) {
      reset({
        name: '',
        description: '',
        duration: 60,
        price: 0,
        categoryId: '',
        locticianId: '',
        isActive: true,
        images: [],
        requirements: [],
        aftercare: [],
      });
    }
  }, [service, isOpen, reset]);

  const onSubmit = (data: ServiceCreateInput) => {
    if (isEditing && service) {
      onSave({ ...data, id: service.id } as ServiceUpdateInput);
    } else {
      onSave(data);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={service ? t('admin.services.editService') : t('admin.services.createService')}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Input
              label={t('service.form.name')}
              {...register('name')}
              error={errors.name?.message}
              disabled={isSubmitting || isLoading}
            />
          </div>
          <div>
            <Input
              label={t('service.form.nameEn')}
              {...register('nameEn')}
              error={errors.nameEn?.message}
              disabled={isSubmitting || isLoading}
            />
          </div>
          <div>
            <Select
              label={t('service.form.category')}
              options={categoryOptions}
              {...register('categoryId')}
              error={errors.categoryId?.message}
              disabled={isSubmitting || isLoading}
            />
          </div>
          <div>
            <Select
              label={t('service.form.loctician')}
              options={locticianOptions}
              {...register('locticianId')}
              error={errors.locticianId?.message}
              disabled={isSubmitting || isLoading}
            />
          </div>
          <div>
            <Input
              label={t('service.form.duration')}
              type="number"
              min="15"
              max="480"
              step="15"
              {...register('duration', { valueAsNumber: true })}
              error={errors.duration?.message}
              disabled={isSubmitting || isLoading}
            />
          </div>
          <div>
            <Input
              label={t('service.form.price')}
              type="number"
              min="0"
              step="50"
              {...register('price', { valueAsNumber: true })}
              error={errors.price?.message}
              disabled={isSubmitting || isLoading}
            />
          </div>
        </div>

        <div>
          <RichTextEditor
            label={t('service.form.description')}
            value={watch('description')}
            onChange={(value) => setValue('description', value)}
            error={errors.description?.message}
            disabled={isSubmitting || isLoading}
          />
        </div>

        <div>
          <RichTextEditor
            label={t('service.form.descriptionEn')}
            value={watch('descriptionEn')}
            onChange={(value) => setValue('descriptionEn', value)}
            error={errors.descriptionEn?.message}
            disabled={isSubmitting || isLoading}
          />
        </div>

        {/* TODO: Add image gallery management */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('service.form.images')}
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <Button type="button" variant="outline" size="sm">
                {t('service.form.uploadImages')}
              </Button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {t('service.form.imageHint')}
            </p>
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

export const ServiceManagement: React.FC = () => {
  const { t } = useTranslation();

  // Mock data - replace with real API calls
  const [services, setServices] = React.useState<Service[]>([
    {
      id: '1',
      name: 'Locs Maintenance',
      description: 'Regular maintenance for existing locs',
      duration: 120,
      price: 500,
      category: { id: '1', name: 'Maintenance', slug: 'maintenance', order: 1, isActive: true },
      isActive: true,
      images: [],
      locticianId: '1',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: '2',
      name: 'New Locs Installation',
      description: 'Complete new locs installation service',
      duration: 240,
      price: 1500,
      category: { id: '2', name: 'Installation', slug: 'installation', order: 2, isActive: true },
      isActive: true,
      images: [],
      locticianId: '1',
      createdAt: '2024-01-10T10:00:00Z',
      updatedAt: '2024-01-10T10:00:00Z',
    },
  ]);

  const [categories, setCategories] = React.useState<ServiceCategory[]>([
    { id: '1', name: 'Maintenance', slug: 'maintenance', order: 1, isActive: true },
    { id: '2', name: 'Installation', slug: 'installation', order: 2, isActive: true },
    { id: '3', name: 'Styling', slug: 'styling', order: 3, isActive: true },
  ]);

  const [filters, setFilters] = React.useState<ServiceFilters>({
    search: '',
    categoryId: '',
    isActive: '',
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const [selectedService, setSelectedService] = React.useState<Service | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const filteredServices = React.useMemo(() => {
    let result = [...services];

    // Apply search filter
    if (filters.search) {
      result = result.filter(
        service =>
          service.name.toLowerCase().includes(filters.search!.toLowerCase()) ||
          service.description.toLowerCase().includes(filters.search!.toLowerCase())
      );
    }

    // Apply category filter
    if (filters.categoryId) {
      result = result.filter(service => service.category.id === filters.categoryId);
    }

    // Apply active filter
    if (filters.isActive !== '') {
      result = result.filter(service => service.isActive === (filters.isActive === 'true'));
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (filters.sortBy) {
        case 'price':
          aVal = a.price;
          bVal = b.price;
          break;
        case 'duration':
          aVal = a.duration;
          bVal = b.duration;
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt);
          bVal = new Date(b.createdAt);
          break;
        default:
          aVal = a.name;
          bVal = b.name;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return filters.sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return filters.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [services, filters]);

  const handleCreateService = () => {
    setSelectedService(null);
    setIsEditModalOpen(true);
  };

  const handleEditService = (service: Service) => {
    setSelectedService(service);
    setIsEditModalOpen(true);
  };

  const handleDeleteService = (service: Service) => {
    // TODO: Show confirmation modal and handle deletion
    console.log('Delete service:', service);
  };

  const handleToggleActive = (service: Service) => {
    // TODO: Implement toggle active status
    console.log('Toggle active:', service);
  };

  const handleViewDetails = (service: Service) => {
    // TODO: Show service details modal
    console.log('View service details:', service);
  };

  const handleSaveService = async (data: ServiceCreateInput | ServiceUpdateInput) => {
    setIsLoading(true);
    try {
      // TODO: Implement API call
      console.log('Save service:', data);
      setIsEditModalOpen(false);
      setSelectedService(null);
    } catch (error) {
      console.error('Failed to save service:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const categoryFilterOptions: SelectOption[] = [
    { value: '', label: t('common.all') },
    ...categories.map(cat => ({ value: cat.id, label: cat.name })),
  ];

  const activeFilterOptions: SelectOption[] = [
    { value: '', label: t('common.all') },
    { value: 'true', label: t('common.active') },
    { value: 'false', label: t('common.inactive') },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('admin.services.title')}
          </h1>
          <p className="text-gray-600 mt-1">
            {t('admin.services.subtitle', { count: filteredServices.length })}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={() => {}}>
            <Settings className="w-4 h-4 mr-2" />
            {t('admin.services.manageCategories')}
          </Button>
          <Button onClick={handleCreateService}>
            <Plus className="w-4 h-4 mr-2" />
            {t('admin.services.createService')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder={t('admin.services.searchPlaceholder')}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10"
            />
          </div>
          <Select
            placeholder={t('admin.services.filterByCategory')}
            options={categoryFilterOptions}
            value={filters.categoryId}
            onChange={(value) => setFilters({ ...filters, categoryId: value })}
          />
          <Select
            placeholder={t('admin.services.filterByStatus')}
            options={activeFilterOptions}
            value={filters.isActive}
            onChange={(value) => setFilters({ ...filters, isActive: value })}
          />
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            {t('common.moreFilters')}
          </Button>
        </div>
      </Card>

      {/* Services Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.services.table.service')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.services.table.duration')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.services.table.price')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.services.table.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.services.table.updated')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredServices.map((service) => (
                <ServiceTableRow
                  key={service.id}
                  service={service}
                  onEdit={handleEditService}
                  onDelete={handleDeleteService}
                  onToggleActive={handleToggleActive}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit/Create Service Modal */}
      <ServiceEditModal
        service={selectedService}
        categories={categories}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveService}
        isLoading={isLoading}
      />
    </div>
  );
};