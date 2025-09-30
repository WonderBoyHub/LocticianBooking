import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Shield, FileText, RefreshCw } from 'lucide-react';

import { useGetCmsPageQuery } from '../../store/api';
import type { CmsPage } from '../../types';

const renderContent = (
  page: CmsPage | undefined | null,
  fallbackSections: { title: string; content: string }[],
  forceFallback = false
) => {
  if (forceFallback || !page?.content) {
    return (
      <div className="space-y-8">
        {fallbackSections.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl font-semibold text-brand-dark mb-2">
              {section.title}
            </h2>
            <p className="text-gray-700 leading-relaxed">{section.content}</p>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div
      className="prose prose-brand max-w-none"
      dangerouslySetInnerHTML={{ __html: page.content }}
    />
  );
};

export const TermsPage: React.FC = () => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useGetCmsPageQuery('terms-of-service');
  const page = data;
  const heroImage = page?.heroMedia?.url ?? 'https://picsum.photos/1200/600?blur=3';
  const fallbackSections = React.useMemo(
    () => [
      {
        title: t('legal.terms.fallback.processingTitle'),
        content: t('legal.terms.fallback.processingText')
      },
      {
        title: t('legal.terms.fallback.rightsTitle'),
        content: t('legal.terms.fallback.rightsText')
      },
      {
        title: t('legal.terms.fallback.cookiesTitle'),
        content: t('legal.terms.fallback.cookiesText')
      }
    ],
    [t]
  );

  const showFallbackContent = !page?.content || isError;

  return (
    <div className="bg-brand-light py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-soft border border-brown-100 overflow-hidden"
        >
          <div className="bg-brand-primary/10 p-8 border-b border-brown-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-serif font-bold text-brand-dark">
                    {page?.title ?? t('legal.terms.title')}
                  </h1>
                  <p className="text-gray-600 mt-1">
                    {page?.excerpt ?? t('legal.terms.subtitle')}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-start md:items-end gap-2 text-sm text-gray-600">
                <div className="inline-flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>{t('legal.terms.version', { version: page?.gdprVersion ?? '1.0' })}</span>
                </div>
                {page?.publishedAt ? (
                  <div className="inline-flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    <span>
                      {t('legal.terms.updated', {
                        date: new Date(page.publishedAt).toLocaleDateString('da-DK')
                      })}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-6 rounded-2xl overflow-hidden shadow-inner">
              <img
                src={heroImage}
                alt={page?.title ?? t('legal.terms.title')}
                className="w-full h-56 object-cover"
                loading="lazy"
              />
            </div>
          </div>

          <div className="p-8">
            {isLoading ? (
              <p className="text-gray-600">{t('common.loading')}</p>
            ) : (
              <div className="space-y-6">
                {isError ? (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
                    {t('legal.terms.error')}
                  </div>
                ) : null}
                {renderContent(page, fallbackSections, showFallbackContent)}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
