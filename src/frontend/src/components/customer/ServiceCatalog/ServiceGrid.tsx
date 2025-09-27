import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Service } from '../../../types';
import { ServiceCard } from './ServiceCard';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { Button } from '../../ui/Button';
import { Grid, List, Search, Heart, Star, Clock, DollarSign } from 'lucide-react';

interface ServiceGridProps {
  services: Service[];
  isLoading: boolean;
  error: string | null;
  onServiceSelect: (service: Service) => void;
  className?: string;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  showFavorites?: boolean;
  favorites?: string[];
  onToggleFavorite?: (serviceId: string) => void;
}

interface ServiceListItemProps {
  service: Service;
  onSelect: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

const ServiceListItem: React.FC<ServiceListItemProps> = ({
  service,
  onSelect,
  isFavorite = false,
  onToggleFavorite,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start space-x-4">
        {/* Image */}
        <div className="flex-shrink-0">
          <div className="w-24 h-24 bg-gradient-to-br from-amber-100 to-orange-100 rounded-lg flex items-center justify-center">
            {service.images && service.images.length > 0 ? (
              <img
                src={service.images[0]}
                alt={service.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <div className="text-amber-600 text-2xl font-bold">
                {service.name.charAt(0)}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-xl font-semibold text-gray-900 truncate">
              {service.name}
            </h3>
            <div className="flex items-center space-x-2 ml-4">
              {onToggleFavorite && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite();
                  }}
                  className="p-2"
                >
                  <Heart
                    className={`w-5 h-5 ${
                      isFavorite ? 'text-red-500 fill-current' : 'text-gray-400'
                    }`}
                  />
                </Button>
              )}
              <div className="text-right">
                <p className="text-2xl font-bold text-amber-600">
                  {service.price.toLocaleString('da-DK')} DKK
                </p>
              </div>
            </div>
          </div>

          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
            {service.description}
          </p>

          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>{service.duration} min</span>
            </div>
            <div className="flex items-center space-x-1">
              <Star className="w-4 h-4 text-yellow-400 fill-current" />
              <span>4.8</span>
            </div>
            <div className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
              {service.category.name}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const ServiceGrid: React.FC<ServiceGridProps> = ({
  services,
  isLoading,
  error,
  onServiceSelect,
  className = '',
  viewMode = 'grid',
  onViewModeChange,
  showFavorites = false,
  favorites = [],
  onToggleFavorite,
}) => {
  const [hoveredService, setHoveredService] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-lg text-gray-600">Indlæser behandlinger...</p>
        <p className="text-sm text-gray-500">Dette tager kun et øjeblik</p>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-20"
      >
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Noget gik galt
          </h3>
          <p className="text-gray-600 mb-6">
            Der opstod en fejl ved indlæsning af behandlinger. Prøv igen senere.
          </p>
          <Button onClick={() => window.location.reload()}>
            Prøv igen
          </Button>
        </div>
      </motion.div>
    );
  }

  if (services.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-20"
      >
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Ingen behandlinger fundet
          </h3>
          <p className="text-gray-600 mb-6">
            Prøv at justere dine filtre eller søgekriterier for at se flere resultater.
          </p>
          <div className="flex items-center justify-center space-x-3">
            <Button variant="outline" onClick={() => window.location.href = '/services'}>
              Nulstil filtre
            </Button>
            <Button onClick={() => window.location.href = '/contact'}>
              Kontakt os
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  const filteredServices = showFavorites
    ? services.filter(service => favorites.includes(service.id))
    : services;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: 'easeOut',
      },
    },
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* View controls */}
      {onViewModeChange && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Viser {filteredServices.length} af {services.length} behandlinger
            {showFavorites && ' (favoritter)'}
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('grid')}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Services */}
      <AnimatePresence mode="wait">
        {viewMode === 'grid' ? (
          <motion.div
            key="grid"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredServices.map((service) => (
              <motion.div
                key={service.id}
                variants={itemVariants}
                onHoverStart={() => setHoveredService(service.id)}
                onHoverEnd={() => setHoveredService(null)}
              >
                <ServiceCard
                  service={service}
                  onSelect={() => onServiceSelect(service)}
                  showRating={true}
                  rating={4.8} // This would come from actual ratings data
                  reviewCount={47} // This would come from actual review data
                  isFavorite={favorites.includes(service.id)}
                  onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(service.id) : undefined}
                  isHovered={hoveredService === service.id}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {filteredServices.map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ServiceListItem
                  service={service}
                  onSelect={() => onServiceSelect(service)}
                  isFavorite={favorites.includes(service.id)}
                  onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(service.id) : undefined}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Load more button (if needed) */}
      {filteredServices.length >= 12 && (
        <div className="text-center pt-8">
          <Button variant="outline" size="lg">
            Indlæs flere behandlinger
          </Button>
        </div>
      )}
    </div>
  );
};