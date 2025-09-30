'use client'

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { AdminOverview } from './AdminOverview';
import { UserManagement } from './UserManagement';
import { ServiceManagement } from './ServiceManagement';
import { SystemAnalytics } from './SystemAnalytics';
import { SystemSettings } from './SystemSettings';
import { CalendarManagement } from './CalendarManagement';
import { ContentManagement } from './ContentManagement';

export const AdminDashboard: React.FC = () => {
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<AdminOverview />} />
        <Route path="/users/*" element={<UserManagement />} />
        <Route path="/services/*" element={<ServiceManagement />} />
        <Route path="/content" element={<ContentManagement />} />
        <Route path="/calendar" element={<CalendarManagement />} />
        <Route path="/analytics" element={<SystemAnalytics />} />
        <Route path="/settings" element={<SystemSettings />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </DashboardLayout>
  );
};
