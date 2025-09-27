import React from 'react';
import { clsx } from 'clsx';
import type { AppointmentStatus } from '../../types';

type GenericVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'brand'
  | 'processing'
  | 'outline';

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: AppointmentStatus;
  variant?: GenericVariant;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const statusConfig: Record<AppointmentStatus, { label: string; color: string }> = {
  pending: {
    label: 'Afventer',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  confirmed: {
    label: 'Bekræftet',
    color: 'bg-green-100 text-green-800 border-green-200',
  },
  in_progress: {
    label: 'I gang',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  completed: {
    label: 'Afsluttet',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
  },
  cancelled: {
    label: 'Aflyst',
    color: 'bg-red-100 text-red-800 border-red-200',
  },
  no_show: {
    label: 'Udeblev',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
  },
};

const variantStyles: Record<GenericVariant, string> = {
  default: 'bg-gray-100 text-gray-800 border-gray-200',
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  brand: 'bg-brand-accent text-brand-dark border-brand-primary/30',
  processing: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  outline: 'bg-transparent text-brand-dark border-brand-primary',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = 'default',
  size = 'md',
  label,
  className,
  children,
  ...rest
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
    lg: 'px-3 py-1 text-base',
  };

  const resolvedLabel = label || (status ? statusConfig[status].label : undefined);
  const resolvedColors = status
    ? statusConfig[status].color
    : variantStyles[variant];

  return (
    <span
      role="status"
      className={clsx(
        'inline-flex items-center font-medium rounded-full border',
        resolvedColors,
        sizeClasses[size],
        className
      )}
      aria-label={resolvedLabel ? `Status: ${resolvedLabel}` : undefined}
      {...rest}
    >
      {children ?? resolvedLabel}
    </span>
  );
};
