import React from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useDrag } from 'react-dnd';
import { Clock, User, Phone, Mail } from 'lucide-react';
import { Badge } from '../ui';
import type { Appointment, CalendarEvent } from '../../types';
import { formatTime, formatPhoneNumber } from '../../i18n';

interface AppointmentCardProps {
  event: CalendarEvent;
  compact?: boolean;
  draggable?: boolean;
  onClick?: () => void;
  className?: string;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  event,
  compact = false,
  draggable = false,
  onClick,
  className,
}) => {
  const { t } = useTranslation();
  const appointment = event.extendedProps?.appointment;

  const [{ isDragging }, drag] = useDrag({
    type: 'appointment',
    item: { id: event.id, event },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: draggable,
  });

  if (!appointment) return null;

  const statusColors = {
    pending: 'warning',
    confirmed: 'success',
    in_progress: 'info',
    completed: 'default',
    cancelled: 'error',
    no_show: 'error',
  } as const;

  const startTime = formatTime(appointment.startTime);
  const endTime = formatTime(appointment.endTime);

  const cardContent = (
    <div
      className={clsx(
        'group relative rounded-lg p-3 border cursor-pointer transition-all duration-200',
        'hover:shadow-md hover:border-brand-primary',
        'focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2',
        isDragging && 'opacity-50 transform rotate-2',
        className
      )}
      style={{
        backgroundColor: event.backgroundColor,
        borderColor: event.borderColor,
      }}
      onClick={onClick}
      ref={draggable ? drag : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white truncate">
            {appointment.service?.name}
          </h4>
          {!compact && (
            <div className="flex items-center mt-1 text-xs text-white opacity-90">
              <Clock className="w-3 h-3 mr-1" />
              <span>{startTime} - {endTime}</span>
            </div>
          )}
        </div>
        <Badge
          variant={statusColors[appointment.status as keyof typeof statusColors]}
          size="sm"
          className="ml-2 shrink-0"
        >
          {t(`calendar.appointment.status.${appointment.status}`)}
        </Badge>
      </div>

      {/* Customer info */}
      {!compact && appointment.customer && (
        <div className="space-y-1">
          <div className="flex items-center text-xs text-white opacity-90">
            <User className="w-3 h-3 mr-1 shrink-0" />
            <span className="truncate">{appointment.customer.name}</span>
          </div>

          {appointment.customer.phone && (
            <div className="flex items-center text-xs text-white opacity-90">
              <Phone className="w-3 h-3 mr-1 shrink-0" />
              <span className="truncate">
                {formatPhoneNumber(appointment.customer.phone)}
              </span>
            </div>
          )}

          {appointment.customer.email && (
            <div className="flex items-center text-xs text-white opacity-90">
              <Mail className="w-3 h-3 mr-1 shrink-0" />
              <span className="truncate">{appointment.customer.email}</span>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {!compact && appointment.notes && (
        <div className="mt-2 pt-2 border-t border-white border-opacity-20">
          <p className="text-xs text-white opacity-90 line-clamp-2">
            {appointment.notes}
          </p>
        </div>
      )}

      {/* Compact view info */}
      {compact && (
        <div className="text-xs text-white opacity-90">
          <div className="flex items-center justify-between">
            <span className="truncate">{appointment.customer?.name}</span>
            <span>{startTime}</span>
          </div>
        </div>
      )}

      {/* Drag indicator */}
      {draggable && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-1 h-4 bg-white bg-opacity-50 rounded-full" />
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      {cardContent}
    </motion.div>
  );
};