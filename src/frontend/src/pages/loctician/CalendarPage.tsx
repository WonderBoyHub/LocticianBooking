import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar } from '../../components/calendar';
import { useAppDispatch } from '../../store/hooks';
import { setBreadcrumbs, setPageTitle } from '../../store/slices/uiSlice';

export const CalendarPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    dispatch(setPageTitle(t('navigation.calendar')));
    dispatch(setBreadcrumbs([
      { label: t('navigation.dashboard'), href: '/dashboard' },
      { label: t('navigation.calendar') },
    ]));
  }, [dispatch, t]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Calendar />
      </div>
    </div>
  );
};