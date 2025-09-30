import React from 'react';
import { motion } from 'framer-motion';
import { Clock, DollarSign, Plus, Minus, Info } from 'lucide-react';
import { Service } from '../../../types';
import { Button } from '../../ui/Button';

interface ServiceAdd {
  id: string;
  name: string;
  price: number;
  duration: number;
  description: string;
}

interface ServiceSelectionStepProps {
  selectedService: Service | null;
  selectedAddOns: ServiceAdd[];
  availableAddOns: ServiceAdd[];
  onAddOnToggle: (addOn: ServiceAdd) => void;
  onNext: () => void;
  onBack: () => void;
  isFirstStep?: boolean;
}

export const ServiceSelectionStep: React.FC<ServiceSelectionStepProps> = ({
  selectedService,
  selectedAddOns,
  availableAddOns,
  onAddOnToggle,
  onNext,
  onBack,
  isFirstStep = false,
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

  const totalPrice = selectedService ? selectedService.price + selectedAddOns.reduce((sum, addon) => sum + addon.price, 0) : 0;
  const totalDuration = selectedService ? selectedService.duration + selectedAddOns.reduce((sum, addon) => sum + addon.duration, 0) : 0;

  const isAddOnSelected = (addOn: ServiceAdd) => {
    return selectedAddOns.some(selected => selected.id === addOn.id);
  };

  if (!selectedService) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center py-12"
      >
        <div className="w-16 h-16 bg-brand-accent rounded-full flex items-center justify-center mx-auto mb-4">
          <Info className="h-8 w-8 text-brand-primary" />
        </div>
        <h3 className="text-lg font-semibold text-brand-dark mb-2">
          Ingen behandling valgt
        </h3>
        <p className="text-gray-600 mb-6">
          Vælg venligst en behandling fra vores katalog først.
        </p>
        <Button onClick={onBack} variant="outline">
          Vælg Behandling
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Selected Service Overview */}
      <div className="bg-white rounded-2xl p-6 border border-brown-200 shadow-soft">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            {selectedService.images && selectedService.images.length > 0 ? (
              <img
                src={selectedService.images[0]}
                alt={selectedService.name}
                className="w-24 h-24 object-cover rounded-xl"
              />
            ) : (
              <div className="w-24 h-24 bg-gradient-to-br from-brand-accent to-brand-secondary rounded-xl flex items-center justify-center">
                <span className="text-2xl">✨</span>
              </div>
            )}
          </div>

          <div className="flex-1">
            <h3 className="text-2xl font-serif font-semibold text-brand-dark mb-2">
              {selectedService.name}
            </h3>
            <p className="text-gray-600 mb-4">
              {selectedService.description}
            </p>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 text-brand-primary">
                <Clock className="h-4 w-4" />
                <span>{formatDuration(selectedService.duration)}</span>
              </div>
              <div className="flex items-center gap-2 text-brand-primary">
                <DollarSign className="h-4 w-4" />
                <span>{formatPrice(selectedService.price)}</span>
              </div>
            </div>

            {selectedService.requirements && selectedService.requirements.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-brand-dark mb-2">Krav:</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedService.requirements.map((requirement, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-brand-accent text-brand-dark"
                    >
                      {requirement}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add-ons Section */}
      {availableAddOns.length > 0 && (
        <div>
          <h3 className="text-xl font-serif font-semibold text-brand-dark mb-6">
            Tilføj ekstrabehind{' '}
            <span className="text-sm font-normal text-gray-600">
              (Valgfrit)
            </span>
          </h3>

          <div className="space-y-4">
            {availableAddOns.map((addOn) => {
              const isSelected = isAddOnSelected(addOn);

              return (
                <motion.div
                  key={addOn.id}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'border-brand-primary bg-brand-primary/5'
                      : 'border-brown-200 bg-white hover:border-brand-secondary'
                  }`}
                  onClick={() => onAddOnToggle(addOn)}
                  whilehover={{ scale: 1.02 }}
                  whiletap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-brand-dark">
                          {addOn.name}
                        </h4>
                        <button
                          className={`p-2 rounded-full transition-colors duration-200 ${
                            isSelected
                              ? 'bg-brand-primary text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-brand-accent'
                          }`}
                        >
                          {isSelected ? (
                            <Minus className="h-4 w-4" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      <p className="text-sm text-gray-600 mb-3">
                        {addOn.description}
                      </p>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-brand-primary">
                          <Clock className="h-3 w-3" />
                          <span>+{formatDuration(addOn.duration)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-brand-primary">
                          <DollarSign className="h-3 w-3" />
                          <span>+{formatPrice(addOn.price)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-brand-accent/30 rounded-2xl p-6 border border-brand-secondary">
        <h3 className="text-lg font-semibold text-brand-dark mb-4">
          Oversigt
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">{selectedService.name}</span>
            <span className="font-semibold text-brand-dark">
              {formatPrice(selectedService.price)}
            </span>
          </div>

          {selectedAddOns.map((addOn) => (
            <div key={addOn.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">+ {addOn.name}</span>
              <span className="text-gray-700">
                {formatPrice(addOn.price)}
              </span>
            </div>
          ))}

          <div className="border-t border-brand-secondary/30 pt-3 mt-3">
            <div className="flex items-center justify-between text-lg font-semibold">
              <span className="text-brand-dark">Total</span>
              <span className="text-brand-primary">
                {formatPrice(totalPrice)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600 mt-1">
              <span>Samlet tid</span>
              <span>{formatDuration(totalDuration)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6">
        {!isFirstStep && (
          <Button
            onClick={onBack}
            variant="outline"
            className="px-6 py-3 border-brown-300 text-brand-dark hover:bg-brand-accent"
          >
            Tilbage
          </Button>
        )}

        <div className={isFirstStep ? 'ml-auto' : ''}>
          <Button
            onClick={onNext}
            className="px-6 py-3 bg-brand-primary hover:bg-brand-dark text-white"
          >
            Fortsæt til Dato & Tid
          </Button>
        </div>
      </div>
    </motion.div>
  );
};