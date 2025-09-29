import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, Clock, DollarSign, Filter } from 'lucide-react';
import { useAppDispatch } from '../../store/hooks';
import { selectService, nextStep } from '../../store/slices/bookingSlice';
import { useGetServicesQuery, useGetServiceCategoriesQuery } from '../../store/api';
import { Button, Input, Select, LoadingSpinner, Badge } from '../ui';
import { formatCurrency } from '../../i18n';
import clsx from 'clsx';
import type { Service, ServiceCategory } from '../../types';

interface ServiceCardProps {
  service: Service;
  onSelect: (service: Service) => void;
  isSelected?: boolean;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onSelect, isSelected = false }) => {
  const { t, i18n } = useTranslation();

  const serviceName = i18n.language === 'da' ? service.name : (service.nameEn || service.name);
  const serviceDescription = i18n.language === 'da'
    ? service.description
    : (service.descriptionEn || service.description);

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={clsx(
        'border rounded-xl p-6 cursor-pointer transition-all duration-200',
        isSelected
          ? 'border-brand-primary bg-brand-accent shadow-brand'
          : 'border-gray-200 bg-white hover:border-brand-primary hover:shadow-md'
      )}
      onClick={() => onSelect(service)}
    >
      {/* Service header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-brand-dark mb-1">
            {serviceName}
          </h3>
          <p className="text-gray-600 text-sm line-clamp-2">
            {serviceDescription}
          </p>
        </div>
        {isSelected && (
          <div className="w-6 h-6 bg-brand-primary rounded-full flex items-center justify-center ml-3">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>

      {/* Service details */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            <span>{service.duration} {t('time.minutes')}</span>
          </div>
          <div className="flex items-center">
            <DollarSign className="w-4 h-4 mr-1" />
            <span>{formatCurrency(service.price)}</span>
          </div>
        </div>
        {service.category && (
          <Badge variant="brand" size="sm">
            {i18n.language === 'da'
              ? service.category.name
              : (service.category.nameEn || service.category.name)
            }
          </Badge>
        )}
      </div>

      {/* Service images */}
      {service.images && service.images.length > 0 && (
        <div className="mt-4">
          <img
            src={service.images[0]}
            alt={serviceName}
            className="w-full h-32 object-cover rounded-lg"
          />
        </div>
      )}
    </motion.div>
  );
};

export const ServiceSelection: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Fetch services and categories
  const {
    data: servicesResponse,
    isLoading: servicesLoading,
    error: servicesError
  } = useGetServicesQuery({ isActive: true });

  const {
    data: categoriesResponse,
    isLoading: categoriesLoading
  } = useGetServiceCategoriesQuery();

  const services = servicesResponse?.data || [];
  const categories = categoriesResponse?.data || [];

  // Filter and search services
  const filteredServices = useMemo(() => {
    let filtered = services;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(service => service.category?.id === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(service =>
        service.name.toLowerCase().includes(query) ||
        service.nameEn?.toLowerCase().includes(query) ||
        service.description.toLowerCase().includes(query) ||
        service.descriptionEn?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [services, selectedCategory, searchQuery]);

  // Create category options for select
  const categoryOptions = useMemo(() => {
    const options = [
      { value: '', label: t('common.all') }
    ];

    categories.forEach(category => {
      options.push({
        value: category.id,
        label: category.name
      });
    });

    return options;
  }, [categories, t]);

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
  };

  const handleContinue = () => {
    if (selectedService) {
      dispatch(selectService(selectedService));
      dispatch(nextStep());
    }
  };

  if (servicesLoading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (servicesError) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {t('errors.generic')}
        </h3>
        <p className="text-gray-500">
          Unable to load services. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-dark mb-2">
          {t('booking.service.title')}
        </h2>
        <p className="text-gray-600">
          Choose the service you would like to book
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          placeholder={`${t('common.search')} services...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className="flex-1"
        />
        <Select
          options={categoryOptions}
          value={selectedCategory}
          onChange={setSelectedCategory}
          placeholder={t('booking.service.category')}
          className="sm:w-48"
        />
      </div>

      {/* Services grid */}
      {filteredServices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onSelect={handleServiceSelect}
              isSelected={selectedService?.id === service.id}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No services found
          </h3>
          <p className="text-gray-500">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      )}

      {/* Continue button */}
      <div className="flex justify-end">
        <Button
          onClick={handleContinue}
          disabled={!selectedService}
          size="lg"
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  );
};