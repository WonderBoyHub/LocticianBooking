import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Header } from './Header';
import { Footer } from './Footer';

interface PublicLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
  className?: string;
  containerClassName?: string;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({
  children,
  showHeader = true,
  showFooter = true,
  className,
  containerClassName
}) => {
  return (
    <div className={clsx('min-h-screen bg-brand-light flex flex-col', className)}>
      {showHeader && <Header />}

      <main className={clsx('flex-1', containerClassName)}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>

      {showFooter && <Footer />}
    </div>
  );
};