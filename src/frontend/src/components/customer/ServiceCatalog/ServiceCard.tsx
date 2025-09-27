import React from 'react';
import { motion } from 'framer-motion';
import { Clock, DollarSign, Star, ArrowRight } from 'lucide-react';
import { Service } from '../../../types';
import { Button } from '../../ui/Button';

interface ServiceCardProps {
  service: Service;
  onSelect: (service: Service) => void;
  className?: string;
  showRating?: boolean;
  rating?: number;
  reviewCount?: number;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  onSelect,
  className = '',
  showRating = false,
  rating = 0,
  reviewCount = 0,
}) => {
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}t ${remainingMinutes}min` : `${hours}t`;
  };

  const formatPrice = (price: number): string => {
    return `${price.toLocaleString('da-DK')} DKK`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -4 }}
      className={`bg-white rounded-2xl overflow-hidden shadow-soft hover:shadow-brand transition-all duration-300 border border-brown-100 ${className}`}
    >
      {/* Service Image */}
      <div className="relative h-48 bg-gradient-to-br from-brand-accent to-brand-secondary overflow-hidden">
        {service.images && service.images.length > 0 ? (
          <img
            src={service.images[0]}
            alt={service.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-16 h-16 bg-brand-primary/20 rounded-full flex items-center justify-center">
              <span className="text-2xl text-brand-primary">✨</span>
            </div>
          </div>
        )}

        {/* Price Badge */}
        <div className="absolute top-3 right-3">
          <div className="bg-white/95 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-brand-primary" />
            <span className="text-sm font-semibold text-brand-dark">
              {formatPrice(service.price)}
            </span>
          </div>
        </div>

        {/* Category Badge */}
        <div className="absolute top-3 left-3">
          <div className="bg-brand-primary/90 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="text-xs font-medium text-white">
              {service.category.name}
            </span>
          </div>
        </div>
      </div>

      {/* Service Content */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-xl font-serif font-semibold text-brand-dark line-clamp-2">
            {service.name}
          </h3>
        </div>

        {/* Rating */}
        {showRating && rating > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < Math.floor(rating)
                      ? 'text-yellow-400 fill-current'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-gray-600">
              {rating.toFixed(1)} ({reviewCount} anmeldelser)
            </span>
          </div>
        )}

        <p className="text-gray-600 text-sm line-clamp-3 mb-4">
          {service.description}
        </p>

        {/* Duration and Requirements */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4 text-brand-primary" />
            <span>{formatDuration(service.duration)}</span>
          </div>

          {service.requirements && service.requirements.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {service.requirements.slice(0, 2).map((requirement, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-brand-accent text-brand-dark"
                >
                  {requirement}
                </span>
              ))}
              {service.requirements.length > 2 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                  +{service.requirements.length - 2} mere
                </span>
              )}
            </div>
          )}
        </div>

        {/* Book Now Button */}
        <Button
          onClick={() => onSelect(service)}
          className="w-full bg-brand-primary hover:bg-brand-dark text-white font-medium py-3 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <span>Book Nu</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
};