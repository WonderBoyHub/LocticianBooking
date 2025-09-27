import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '../../store/hooks';
import { setBreadcrumbs, setPageTitle } from '../../store/slices/uiSlice';

export const CustomersPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    dispatch(setPageTitle(t('navigation.customers')));
    dispatch(setBreadcrumbs([
      { label: t('navigation.dashboard'), href: '/dashboard' },
      { label: t('navigation.customers') },
    ]));
  }, [dispatch, t]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {t('navigation.customers')}
        </h1>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">Customer management interface coming soon...</p>
        </div>
      </div>
    </div>
  );
};