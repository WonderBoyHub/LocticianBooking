import React from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, X, SlidersHorizontal } from 'lucide-react';
import { ServiceCategory } from '../../../types';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';

interface ServiceFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedCategory: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  categories: ServiceCategory[];
  priceRange: [number, number];
  onPriceRangeChange: (range: [number, number]) => void;
  maxPrice: number;
  durationFilter: string | null;
  onDurationFilterChange: (duration: string | null) => void;
  showMobileFilters: boolean;
  onToggleMobileFilters: () => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  resultsCount: number;
}

const durationOptions = [
  { value: null, label: 'Alle varigheder' },
  { value: 'short', label: 'Under 1 time' },
  { value: 'medium', label: '1-2 timer' },
  { value: 'long', label: 'Over 2 timer' },
];

const sortOptions = [
  { value: 'name', label: 'Navn (A-Z)' },
  { value: 'price-asc', label: 'Pris (lav til høj)' },
  { value: 'price-desc', label: 'Pris (høj til lav)' },
  { value: 'duration-asc', label: 'Varighed (kort til lang)' },
  { value: 'duration-desc', label: 'Varighed (lang til kort)' },
  { value: 'popular', label: 'Mest populære' },
];

export const ServiceFilters: React.FC<ServiceFiltersProps> = ({
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories,
  priceRange,
  onPriceRangeChange,
  maxPrice,
  durationFilter,
  onDurationFilterChange,
  showMobileFilters,
  onToggleMobileFilters,
  sortBy,
  onSortChange,
  resultsCount,
}) => {
  const activeFiltersCount = [
    selectedCategory,
    durationFilter,
    priceRange[0] > 0 || priceRange[1] < maxPrice,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    onCategoryChange(null);
    onDurationFilterChange(null);
    onPriceRangeChange([0, maxPrice]);
    onSearchChange('');
  };

  return (
    <>
      {/* Desktop Search and Sort */}
      <div className="hidden md:flex items-center gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Søg efter behandlinger..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4 py-3 w-full rounded-xl border-brown-200 focus:border-brand-primary focus:ring-brand-primary/20"
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="px-4 py-3 rounded-xl border border-brown-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 bg-white text-sm"
        >
          {sortOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <Button
          variant="outline"
          onClick={onToggleMobileFilters}
          className="px-4 py-3 border-brown-200 text-brand-dark hover:bg-brand-accent"
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filtre
          {activeFiltersCount > 0 && (
            <span className="ml-2 bg-brand-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </Button>
      </div>

      {/* Mobile Search and Filter Toggle */}
      <div className="md:hidden mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Søg efter behandlinger..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4 py-3 w-full rounded-xl border-brown-200"
          />
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={onToggleMobileFilters}
            className="px-4 py-2 border-brown-200 text-brand-dark hover:bg-brand-accent"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtre & Sortering
            {activeFiltersCount > 0 && (
              <span className="ml-2 bg-brand-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </Button>

          <span className="text-sm text-gray-600">
            {resultsCount} {resultsCount === 1 ? 'behandling' : 'behandlinger'}
          </span>
        </div>
      </div>

      {/* Filter Panel */}
      {showMobileFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-soft border border-brown-100 p-6 mb-6 overflow-hidden"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-brand-dark">Filtre & Sortering</h3>
            <Button
              variant="ghost"
              onClick={onToggleMobileFilters}
              className="p-2 text-gray-500 hover:text-brand-primary"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="space-y-6">
            {/* Sort (Mobile Only) */}
            <div className="md:hidden">
              <label className="block text-sm font-medium text-brand-dark mb-2">
                Sorter efter
              </label>
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-brown-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 bg-white text-sm"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-3">
                Kategorier
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onCategoryChange(null)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                    !selectedCategory
                      ? 'bg-brand-primary text-white'
                      : 'bg-brand-accent text-brand-dark hover:bg-brand-secondary'
                  }`}
                >
                  Alle kategorier
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => onCategoryChange(category.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                      selectedCategory === category.id
                        ? 'bg-brand-primary text-white'
                        : 'bg-brand-accent text-brand-dark hover:bg-brand-secondary'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-3">
                Varighed
              </label>
              <div className="flex flex-wrap gap-2">
                {durationOptions.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => onDurationFilterChange(option.value)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                      durationFilter === option.value
                        ? 'bg-brand-primary text-white'
                        : 'bg-brand-accent text-brand-dark hover:bg-brand-secondary'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-3">
                Prisinterval: {priceRange[0].toLocaleString('da-DK')} - {priceRange[1].toLocaleString('da-DK')} DKK
              </label>
              <div className="px-2">
                <input
                  type="range"
                  min={0}
                  max={maxPrice}
                  value={priceRange[1]}
                  onChange={(e) => onPriceRangeChange([priceRange[0], parseInt(e.target.value)])}
                  className="w-full h-2 bg-brand-accent rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #8B6B47 0%, #8B6B47 ${(priceRange[1] / maxPrice) * 100}%, #F5F5DC ${(priceRange[1] / maxPrice) * 100}%, #F5F5DC 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>0 DKK</span>
                  <span>{maxPrice.toLocaleString('da-DK')} DKK</span>
                </div>
              </div>
            </div>

            {/* Clear Filters */}
            {activeFiltersCount > 0 && (
              <div className="pt-4 border-t border-brown-200">
                <Button
                  onClick={clearAllFilters}
                  variant="outline"
                  className="w-full border-brown-300 text-brand-dark hover:bg-brand-accent"
                >
                  Ryd alle filtre ({activeFiltersCount})
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #8B6B47;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(139, 107, 71, 0.3);
        }

        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #8B6B47;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(139, 107, 71, 0.3);
        }
      `}</style>
    </>
  );
};