import React from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'brand';
  border?: boolean;
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  background?: 'white' | 'brand-light' | 'brand-accent';
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  padding = 'md',
  hover = false,
  shadow = 'md',
  border = false,
  borderRadius = 'lg',
  background = 'white',
  onClick,
}) => {
  const baseClasses = 'transition-all duration-200';

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const shadowClasses = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    brand: 'shadow-brand',
  };

  const hoverClasses = hover ? 'hover:shadow-lg hover:-translate-y-1 cursor-pointer' : '';

  const borderClasses = border ? 'border border-brown-200' : '';

  const radiusClasses = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
  };

  const backgroundClasses = {
    white: 'bg-white',
    'brand-light': 'bg-brand-light',
    'brand-accent': 'bg-brand-accent',
  };

  const cardClasses = clsx(
    baseClasses,
    paddingClasses[padding],
    shadowClasses[shadow],
    hoverClasses,
    borderClasses,
    radiusClasses[borderRadius],
    backgroundClasses[background],
    className
  );

  const CardComponent = onClick ? motion.div : 'div';

  return (
    <CardComponent
      className={cardClasses}
      onClick={onClick}
      whileHover={hover && onClick ? { scale: 1.02 } : undefined}
      whileTap={hover && onClick ? { scale: 0.98 } : undefined}
    >
      {children}
    </CardComponent>
  );
};

export interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className }) => {
  return (
    <div className={clsx('mb-4 border-b border-brown-100 pb-3', className)}>
      {children}
    </div>
  );
};

export interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export const CardTitle: React.FC<CardTitleProps> = ({
  children,
  className,
  as: Component = 'h3'
}) => {
  return (
    <Component className={clsx('text-lg font-semibold text-brand-dark', className)}>
      {children}
    </Component>
  );
};

export interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({ children, className }) => {
  return (
    <div className={clsx('text-gray-600', className)}>
      {children}
    </div>
  );
};

export interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({ children, className }) => {
  return (
    <div className={clsx('mt-4 pt-3 border-t border-brown-100', className)}>
      {children}
    </div>
  );
};