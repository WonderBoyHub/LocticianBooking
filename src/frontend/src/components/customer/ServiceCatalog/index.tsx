import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Service, ServiceCategory } from '../../../types';
import { ServiceFilters } from './ServiceFilters';
import { ServiceGrid } from './ServiceGrid';

// Mock API functions - replace with actual API calls
const fetchServices = async (): Promise<Service[]> => {
  // This would be replaced with actual API call
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate loading

  return [
    {
      id: '1',
      name: 'Starter Locs',
      description: 'Perfekt til første gang dreadlocks. Inkluderer konsultation, hårvask og initial loc opstart.',
      duration: 180,
      price: 1200,
      category: { id: '1', name: 'Loc Opstart', slug: 'loc-opstart', order: 1, isActive: true },
      isActive: true,
      images: ['/api/placeholder/400/300'],
      requirements: ['Minimum 10cm hår', 'Ren hovedbund'],
      aftercare: ['Undgå at vaske håret i 2 uger', 'Brug saltspray dagligt'],
      locticianId: '1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      name: 'Loc Vedligeholdelse',
      description: 'Almindelig vedligeholdelse af eksisterende locs. Inkluderer hårvask, root work og styling.',
      duration: 120,
      price: 800,
      category: { id: '2', name: 'Vedligeholdelse', slug: 'vedligeholdelse', order: 2, isActive: true },
      isActive: true,
      images: ['/api/placeholder/400/300'],
      requirements: ['Eksisterende locs'],
      aftercare: ['Brug læderrens shampoo', 'Undgå overflødig manipulation'],
      locticianId: '1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: '3',
      name: 'Loc Styling & Decorations',
      description: 'Kreativ styling af dine locs med accessories, perler, garn eller andre dekorative elementer.',
      duration: 90,
      price: 600,
      category: { id: '3', name: 'Styling', slug: 'styling', order: 3, isActive: true },
      isActive: true,
      images: ['/api/placeholder/400/300'],
      requirements: ['Etablerede locs', 'Minimum 3 måneder gamle'],
      aftercare: ['Pas på accessories under søvn', 'Fjern perler ved hårvask'],
      locticianId: '1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: '4',
      name: 'Loc Repair & Rescue',
      description: 'Reparation af beskadigede locs, sammengroede locs eller andre strukturelle problemer.',
      duration: 240,
      price: 1500,
      category: { id: '4', name: 'Reparation', slug: 'reparation', order: 4, isActive: true },
      isActive: true,
      images: ['/api/placeholder/400/300'],
      requirements: ['Konsultation påkrævet', 'Billeder af problemområder'],
      aftercare: ['Følg specifikke instruktioner', 'Kontrol efter 2 uger'],
      locticianId: '1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: '5',
      name: 'Konsultation',
      description: 'Personlig konsultation om loc journey, hårtype, vedligeholdelse og forventninger.',
      duration: 60,
      price: 300,
      category: { id: '5', name: 'Konsultation', slug: 'konsultation', order: 5, isActive: true },
      isActive: true,
      images: ['/api/placeholder/400/300'],
      requirements: ['Åbent sind', 'Spørgsmål forberedt'],
      aftercare: ['Reflekter over informationen', 'Tag noter'],
      locticianId: '1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: '6',
      name: 'Deep Cleanse & Treatment',
      description: 'Dybderengøring og behandling af hovedbund og locs med naturlige olier og behandlinger.',
      duration: 150,
      price: 950,
      category: { id: '2', name: 'Vedligeholdelse', slug: 'vedligeholdelse', order: 2, isActive: true },
      isActive: true,
      images: ['/api/placeholder/400/300'],
      requirements: ['Minimum 6 måneder gamle locs'],
      aftercare: ['Undgå hårvask i 48 timer', 'Brug anbefalede produkter'],
      locticianId: '1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }
  ];
};

const fetchCategories = async (): Promise<ServiceCategory[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));

  return [
    { id: '1', name: 'Loc Opstart', slug: 'loc-opstart', order: 1, isActive: true },
    { id: '2', name: 'Vedligeholdelse', slug: 'vedligeholdelse', order: 2, isActive: true },
    { id: '3', name: 'Styling', slug: 'styling', order: 3, isActive: true },
    { id: '4', name: 'Reparation', slug: 'reparation', order: 4, isActive: true },
    { id: '5', name: 'Konsultation', slug: 'konsultation', order: 5, isActive: true }
  ];
};

interface ServiceCatalogProps {
  onServiceSelect: (service: Service) => void;
  className?: string;
  showHeader?: boolean;
  title?: string;
  subtitle?: string;
}

export const ServiceCatalog: React.FC<ServiceCatalogProps> = ({
  onServiceSelect,
  className = '',
  showHeader = true,
  title = 'Vores Behandlinger',
  subtitle = 'Find den perfekte loc-behandling til dig'
}) => {
  // State for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000]);
  const [durationFilter, setDurationFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('name');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Fetch data
  const { data: services = [], isLoading: servicesLoading, error: servicesError } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  // Calculate max price for slider
  const maxPrice = useMemo(() => {
    if (services.length === 0) return 2000;
    return Math.max(...services.map(s => s.price));
  }, [services]);

  // Update price range when services load
  React.useEffect(() => {
    if (services.length > 0 && priceRange[1] === 2000) {
      setPriceRange([0, maxPrice]);
    }
  }, [services, maxPrice, priceRange]);

  // Filter and sort services
  const filteredAndSortedServices = useMemo(() => {
    let filtered = services.filter(service => {
      // Search term filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesName = service.name.toLowerCase().includes(searchLower);
        const matchesDescription = service.description.toLowerCase().includes(searchLower);
        const matchesCategory = service.category.name.toLowerCase().includes(searchLower);

        if (!matchesName && !matchesDescription && !matchesCategory) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory && service.category.id !== selectedCategory) {
        return false;
      }

      // Price range filter
      if (service.price < priceRange[0] || service.price > priceRange[1]) {
        return false;
      }

      // Duration filter
      if (durationFilter) {
        if (durationFilter === 'short' && service.duration >= 60) return false;
        if (durationFilter === 'medium' && (service.duration < 60 || service.duration > 120)) return false;
        if (durationFilter === 'long' && service.duration <= 120) return false;
      }

      return service.isActive;
    });

    // Sort services
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name, 'da');
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'duration-asc':
          return a.duration - b.duration;
        case 'duration-desc':
          return b.duration - a.duration;
        case 'popular':
          // Would use actual popularity metrics
          return Math.random() - 0.5;
        default:
          return 0;
      }
    });

    return filtered;
  }, [services, searchTerm, selectedCategory, priceRange, durationFilter, sortBy]);

  const isLoading = servicesLoading || categoriesLoading;
  const error = servicesError?.message || null;

  return (
    <div className={`w-full ${className}`}>
      {showHeader && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-brand-dark mb-4">
            {title}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {subtitle}
          </p>
        </motion.div>
      )}

      <div className="max-w-7xl mx-auto">
        <ServiceFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          categories={categories}
          priceRange={priceRange}
          onPriceRangeChange={setPriceRange}
          maxPrice={maxPrice}
          durationFilter={durationFilter}
          onDurationFilterChange={setDurationFilter}
          showMobileFilters={showMobileFilters}
          onToggleMobileFilters={() => setShowMobileFilters(!showMobileFilters)}
          sortBy={sortBy}
          onSortChange={setSortBy}
          resultsCount={filteredAndSortedServices.length}
        />

        <ServiceGrid
          services={filteredAndSortedServices}
          isLoading={isLoading}
          error={error}
          onServiceSelect={onServiceSelect}
        />
      </div>
    </div>
  );
};