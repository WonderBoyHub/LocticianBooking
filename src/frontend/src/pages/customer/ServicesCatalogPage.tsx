import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Clock3, ArrowRightCircle, Sparkles, Play } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  useGetServiceCategoriesQuery,
  useGetServicesQuery,
  useGetFeaturedMediaQuery,
} from '../../store/api';
import type { Service, ServiceCategory, MediaAsset } from '../../types';
import { formatCurrency } from '../../i18n';

const filterServicesByCategory = (
  services: Service[],
  categoryId?: string | null
) => {
  if (!categoryId || categoryId === 'all') {
    return services;
  }

  return services.filter((service) => {
    const serviceCategoryId =
      service.category?.id ?? (service as any).categoryId ?? (service as any).category_id ?? null;

    return serviceCategoryId === categoryId;
  });
};

const useLocalizedText = () => {
  const { i18n } = useTranslation();

  return React.useCallback(
    (primary?: string | null, secondary?: string | null) => {
      if (i18n.language.startsWith('en')) {
        return secondary ?? primary ?? '';
      }

      return primary ?? secondary ?? '';
    },
    [i18n.language]
  );
};

const ServicesGrid: React.FC<{
  services: Service[];
}> = ({ services }) => {
  const { t } = useTranslation();
  const getLocalizedText = useLocalizedText();

  if (!services.length) {
    return (
      <div className="rounded-2xl border border-dashed border-brown-200 bg-brand-accent/40 p-8 text-center text-gray-600">
        {t('services.emptyState')}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {services.map((service) => {
        const name = getLocalizedText(
          service.name,
          service.nameEn ?? (service as any).nameEn ?? (service as any).name_en ?? undefined
        );
        const description = getLocalizedText(
          service.description,
          service.descriptionEn ?? (service as any).descriptionEn ?? (service as any).description_en ?? undefined
        );
        const servicePrice = service.price ?? (service as any).base_price ?? 0;
        const serviceDuration = service.duration ?? (service as any).duration_minutes ?? 0;
        const requirements: string[] =
          service.requirements ?? (service as any).requirements ?? [];
        const aftercare: string[] = service.aftercare ?? (service as any).aftercare ?? [];

        return (
          <motion.div
            key={service.id}
            whileHover={{ y: -4, boxShadow: '0 20px 30px -15px rgba(107,78,50,0.35)' }}
            className="bg-white rounded-2xl border border-brown-100 shadow-soft overflow-hidden flex flex-col"
          >
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-brand-dark">
                    {name || service.name}
                  </h3>
                  {description ? (
                    <p className="mt-2 text-gray-600 leading-relaxed">
                      {description}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-brand-primary font-serif text-2xl">
                    {formatCurrency(servicePrice)}
                  </p>
                  <p className="text-sm text-gray-500 inline-flex items-center gap-1">
                    <Clock3 className="w-4 h-4" />
                    {serviceDuration} min
                  </p>
                </div>
              </div>

              {requirements.length ? (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-brand-dark mb-1">
                    {t('services.requirements')}
                  </h4>
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                    {requirements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {aftercare.length ? (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-brand-dark mb-1">
                    {t('services.aftercare')}
                  </h4>
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                    {aftercare.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="px-6 pb-6">
              <Link
                to={`/book?serviceId=${service.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary text-white px-4 py-2 text-sm font-medium hover:bg-brand-dark transition"
              >
                {t('services.bookCta')}
                <ArrowRightCircle className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

const createPlaceholderMedia = (count: number): MediaAsset[] =>
  Array.from({ length: count }).map((_, index) => ({
    id: `placeholder-media-${index}`,
    url: `https://picsum.photos/600/400?random=${index + 1}`,
    originalFilename: 'placeholder.jpg',
    mimeType: 'image/jpeg',
    fileSize: 0,
    altText: 'Inspiration billede',
    caption: index % 2 === 0 ? 'Placeholder inspiration fra Just Locc It' : undefined,
    isFeatured: false,
    displayOrder: index,
    isPublished: true,
    publishedAt: new Date().toISOString(),
  }));

const MediaSpotlight: React.FC<{ media: MediaAsset[] }> = ({ media }) => {
  const { t } = useTranslation();
  const fallbackMedia = React.useMemo(() => createPlaceholderMedia(6), []);
  const hasMedia = media.length > 0;
  const items = hasMedia ? media : fallbackMedia;

  return (
    <section className="mt-16">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-serif font-bold text-brand-dark">
            {t('services.media.title')}
          </h2>
          <p className="text-sm text-gray-600">
            {hasMedia ? t('services.media.subtitle') : t('services.media.placeholderSubtitle')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {items.map((item) => {
          const isVideo = item.mimeType?.startsWith('video/');
          return (
            <motion.figure
              key={item.id}
              whileHover={{ scale: 1.02 }}
              className="relative overflow-hidden rounded-2xl shadow-soft border border-brown-100"
            >
              {isVideo ? (
                <video
                  src={item.url}
                  controls
                  className="w-full h-64 object-cover"
                />
              ) : (
                <img
                  src={item.url || `https://picsum.photos/600/400?random=${item.displayOrder + 10}`}
                  alt={item.altText ?? item.originalFilename}
                  className="w-full h-64 object-cover"
                  loading="lazy"
                />
              )}
              {item.caption ? (
                <figcaption className="p-4 text-sm text-gray-700 bg-white/90">
                  {item.caption}
                </figcaption>
              ) : null}
              {isVideo ? (
                <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
                  <Play className="w-3.5 h-3.5" />
                  {t('services.media.videoBadge')}
                </div>
              ) : null}
            </motion.figure>
          );
        })}
      </div>

      {!hasMedia ? (
        <p className="mt-4 text-xs text-gray-500 text-center">
          {t('services.media.placeholderNotice')}
        </p>
      ) : null}
    </section>
  );
};

const ProductHighlights: React.FC = () => {
  const { t } = useTranslation();
  const bundles = React.useMemo(
    () => {
      const hydrationItems = t('services.products.hydration.items', { returnObjects: true }) as string[];
      const starterItems = t('services.products.starter.items', { returnObjects: true }) as string[];
      const stylingItems = t('services.products.styling.items', { returnObjects: true }) as string[];

      return [
        {
          id: 'hydration',
          title: t('services.products.hydration.title'),
          description: t('services.products.hydration.description'),
          image: 'https://picsum.photos/600/400?random=21',
          items: hydrationItems,
        },
        {
          id: 'starter',
          title: t('services.products.starter.title'),
          description: t('services.products.starter.description'),
          image: 'https://picsum.photos/600/400?random=22',
          items: starterItems,
        },
        {
          id: 'styling',
          title: t('services.products.styling.title'),
          description: t('services.products.styling.description'),
          image: 'https://picsum.photos/600/400?random=23',
          items: stylingItems,
        },
      ];
    },
    [t]
  );

  return (
    <section className="mt-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-serif font-bold text-brand-dark">
          {t('services.products.title')}
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          {t('services.products.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {bundles.map((bundle, index) => (
          <motion.article
            key={bundle.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-2xl shadow-soft border border-brown-100 overflow-hidden flex flex-col"
          >
            <img
              src={bundle.image}
              alt={bundle.title}
              className="h-48 w-full object-cover"
              loading="lazy"
            />
            <div className="p-6 flex-1 flex flex-col">
              <h3 className="text-xl font-semibold text-brand-dark">
                {bundle.title}
              </h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                {bundle.description}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600 list-disc list-inside">
                {bundle.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="px-6 pb-6">
              <Link
                to="/tjenester"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-primary text-brand-primary px-4 py-2 text-sm font-medium hover:bg-brand-primary hover:text-white transition"
              >
                {t('services.products.cta')}
                <ArrowRightCircle className="w-4 h-4" />
              </Link>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
};

export const ServicesCatalogPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { data: categoryResponse } = useGetServiceCategoriesQuery();
  const { data: servicesResponse, isLoading } = useGetServicesQuery({ isActive: true });
  const { data: media } = useGetFeaturedMediaQuery(6);

  const categories: ServiceCategory[] = categoryResponse?.data ?? [];
  const services: Service[] = servicesResponse?.data ?? [];
  const mediaItems = media ?? [];

  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const filteredServices = React.useMemo(
    () => filterServicesByCategory(services, selectedCategory),
    [services, selectedCategory]
  );

  return (
    <div className="bg-brand-light py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-primary/10 text-brand-primary text-sm font-medium"
          >
            <Sparkles className="w-4 h-4" />
            {t('services.heroBadge')}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-4xl font-serif font-bold text-brand-dark"
          >
            {t('services.heroTitle')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto"
          >
            {t('services.heroSubtitle')}
          </motion.p>
        </header>

        <nav className="flex flex-wrap gap-3 justify-center mb-12">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition border ${
              selectedCategory === 'all'
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-white text-brand-dark border-brown-200 hover:border-brand-primary/40'
            }`}
          >
            {t('services.allServices')}
          </button>
          {categories.map((category) => {
            const displayName = i18n.language.startsWith('en')
              ? category.nameEn ?? (category as any).name_en ?? category.name
              : category.name;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition border ${
                  selectedCategory === category.id
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-white text-brand-dark border-brown-200 hover:border-brand-primary/40'
                }`}
              >
                {displayName}
              </button>
            );
          })}
        </nav>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-64 rounded-2xl bg-white border border-brown-100 shadow-soft animate-pulse"
              />
            ))}
          </div>
        ) : (
          <ServicesGrid services={filteredServices} />
        )}

        <MediaSpotlight media={mediaItems} />

        <ProductHighlights />
      </div>
    </div>
  );
};
