import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Loader
} from 'lucide-react';

// Toast Types
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
  persistent?: boolean;
}

interface ToastProps {
  toast: ToastData;
  onClose: (id: string) => void;
  position: ToastPosition;
}

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader
};

const toastStyles = {
  success: {
    bg: 'bg-green-50 border-green-200',
    icon: 'text-green-500',
    title: 'text-green-800',
    description: 'text-green-700'
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    icon: 'text-red-500',
    title: 'text-red-800',
    description: 'text-red-700'
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200',
    icon: 'text-amber-500',
    title: 'text-amber-800',
    description: 'text-amber-700'
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-500',
    title: 'text-blue-800',
    description: 'text-blue-700'
  },
  loading: {
    bg: 'bg-brand-light border-brand-secondary',
    icon: 'text-brand-primary',
    title: 'text-brand-dark',
    description: 'text-brown-600'
  }
};

const Toast: React.FC<ToastProps> = ({ toast, onClose, position }) => {
  const { id, type, title, description, action, duration = 5000, persistent } = toast;
  const [isExiting, setIsExiting] = React.useState(false);

  const Icon = toastIcons[type];
  const styles = toastStyles[type];

  // Auto-close timer
  React.useEffect(() => {
    if (persistent || type === 'loading') return;

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onClose(id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose, persistent, type]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(id), 300);
  };

  const getMotionProps = () => {
    const isTop = position.includes('top');
    const isRight = position.includes('right');
    const isCenter = position.includes('center');

    let x = 0;
    let y = 0;

    if (isCenter) {
      y = isTop ? -100 : 100;
    } else if (isRight) {
      x = 100;
    } else {
      x = -100;
    }

    return {
      initial: { opacity: 0, x, y, scale: 0.95 },
      animate: {
        opacity: isExiting ? 0 : 1,
        x: isExiting ? x : 0,
        y: isExiting ? y : 0,
        scale: isExiting ? 0.95 : 1
      },
      exit: { opacity: 0, x, y, scale: 0.95 }
    };
  };

  return (
    <motion.div
      {...getMotionProps()}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={clsx(
        'relative w-full max-w-sm bg-white border rounded-lg shadow-lg pointer-events-auto overflow-hidden',
        styles.bg
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Progress bar for auto-close */}
      {!persistent && type !== 'loading' && (
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: isExiting ? '100%' : '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          className="absolute top-0 left-0 h-1 bg-current opacity-30"
        />
      )}

      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {type === 'loading' ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Icon className={clsx('w-5 h-5', styles.icon)} />
              </motion.div>
            ) : (
              <Icon className={clsx('w-5 h-5', styles.icon)} />
            )}
          </div>

          <div className="ml-3 flex-1">
            <p className={clsx('text-sm font-medium', styles.title)}>
              {title}
            </p>
            {description && (
              <p className={clsx('mt-1 text-sm', styles.description)}>
                {description}
              </p>
            )}

            {action && (
              <div className="mt-3">
                <button
                  onClick={action.onClick}
                  className={clsx(
                    'text-sm font-medium underline hover:no-underline focus:outline-none',
                    styles.title
                  )}
                >
                  {action.label}
                </button>
              </div>
            )}
          </div>

          <div className="ml-4 flex-shrink-0">
            <button
              onClick={handleClose}
              className={clsx(
                'inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 hover:bg-black/5',
                styles.icon
              )}
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Toast Container
interface ToastContainerProps {
  toasts: ToastData[];
  onClose: (id: string) => void;
  position?: ToastPosition;
  maxToasts?: number;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onClose,
  position = 'top-right',
  maxToasts = 5
}) => {
  const visibleToasts = toasts.slice(0, maxToasts);

  const getContainerClasses = () => {
    const base = 'fixed z-50 flex flex-col space-y-2 pointer-events-none';

    switch (position) {
      case 'top-right':
        return `${base} top-4 right-4`;
      case 'top-left':
        return `${base} top-4 left-4`;
      case 'bottom-right':
        return `${base} bottom-4 right-4`;
      case 'bottom-left':
        return `${base} bottom-4 left-4`;
      case 'top-center':
        return `${base} top-4 left-1/2 transform -translate-x-1/2`;
      case 'bottom-center':
        return `${base} bottom-4 left-1/2 transform -translate-x-1/2`;
      default:
        return `${base} top-4 right-4`;
    }
  };

  if (visibleToasts.length === 0) return null;

  return createPortal(
    <div className={getContainerClasses()}>
      <AnimatePresence>
        {visibleToasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onClose={onClose}
            position={position}
          />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
};

// Toast Hook
interface ToastContextValue {
  toasts: ToastData[];
  addToast: (toast: Omit<ToastData, 'id'>) => string;
  removeToast: (id: string) => void;
  removeAllToasts: () => void;
  updateToast: (id: string, updates: Partial<ToastData>) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{
  children: React.ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
}> = ({ children, position = 'top-right', maxToasts = 5 }) => {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const addToast = React.useCallback((toastData: Omit<ToastData, 'id'>) => {
    const id = Math.random().toString(36).substring(2);
    const toast: ToastData = { ...toastData, id };

    setToasts(prev => [toast, ...prev]);
    return id;
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const removeAllToasts = React.useCallback(() => {
    setToasts([]);
  }, []);

  const updateToast = React.useCallback((id: string, updates: Partial<ToastData>) => {
    setToasts(prev => prev.map(toast =>
      toast.id === id ? { ...toast, ...updates } : toast
    ));
  }, []);

  return (
    <ToastContext.Provider value={{
      toasts,
      addToast,
      removeToast,
      removeAllToasts,
      updateToast
    }}>
      {children}
      <ToastContainer
        toasts={toasts}
        onClose={removeToast}
        position={position}
        maxToasts={maxToasts}
      />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  const { addToast, removeToast, updateToast } = context;

  const notify = (
    typeOrToast: ToastType | Omit<ToastData, 'id'>,
    title?: string,
    description?: string,
    options?: Partial<ToastData>
  ) => {
    if (typeof typeOrToast === 'string') {
      return addToast({
        type: typeOrToast,
        title: title ?? '',
        description,
        ...options,
      });
    }

    return addToast(typeOrToast);
  };

  return {
    toast: notify,
    success: (title: string, description?: string, options?: Partial<ToastData>) =>
      addToast({ type: 'success', title, description, ...options }),
    error: (title: string, description?: string, options?: Partial<ToastData>) =>
      addToast({ type: 'error', title, description, ...options }),
    warning: (title: string, description?: string, options?: Partial<ToastData>) =>
      addToast({ type: 'warning', title, description, ...options }),
    info: (title: string, description?: string, options?: Partial<ToastData>) =>
      addToast({ type: 'info', title, description, ...options }),
    loading: (title: string, description?: string, options?: Partial<ToastData>) =>
      addToast({ type: 'loading', title, description, persistent: true, ...options }),
    dismiss: removeToast,
    update: updateToast
  };
};
