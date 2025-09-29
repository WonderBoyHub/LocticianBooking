import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  User,
  Calendar,
  Settings,
  LogOut,
  ChevronDown,
  Phone,
  Mail
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import clsx from 'clsx';

export interface HeaderProps {
  user?: {
    id: string;
    name: string;
    email: string;
    role: 'customer' | 'loctician' | 'admin';
    avatar?: string;
  } | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navigationItems = [
    { href: '/', label: 'Hjem', labelEn: 'Home' },
    { href: '/services', label: 'Tjenester', labelEn: 'Services' },
    { href: '/about', label: 'Om os', labelEn: 'About' },
    { href: '/contact', label: 'Kontakt', labelEn: 'Contact' },
  ];

  const userMenuItems = [
    {
      href: user?.role === 'loctician' ? '/dashboard' : '/profile',
      icon: user?.role === 'loctician' ? Calendar : User,
      label: user?.role === 'loctician' ? 'Dashboard' : 'Min Profil',
    },
    {
      href: '/settings',
      icon: Settings,
      label: 'Indstillinger',
    },
  ];

  const handleBookNow = () => {
    navigate('/book');
  };

  const handleUserMenuToggle = () => {
    setIsUserMenuOpen(!isUserMenuOpen);
  };

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    onLogout?.();
  };

  return (
    <header className="bg-white shadow-soft sticky top-0 z-50">
      <div className="container-custom">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center space-x-2"
            aria-label="Just Locc It - Hjem"
          >
            <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">JLI</span>
            </div>
            <span className="text-xl font-serif font-bold text-brand-dark hidden sm:block">
              Just Locc It
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8" role="navigation">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={clsx(
                  'text-brand-dark hover:text-brand-primary transition-colors duration-200 font-medium',
                  location.pathname === item.href && 'text-brand-primary'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {/* Contact Info (Desktop) */}
            <div className="hidden lg:flex items-center space-x-4 text-sm text-brand-dark">
              <a
                href="tel:+4512345678"
                className="flex items-center space-x-1 hover:text-brand-primary transition-colors"
                aria-label="Ring til os"
              >
                <Phone className="h-4 w-4" />
                <span>+45 12 34 56 78</span>
              </a>
              <a
                href="mailto:info@justloccit.dk"
                className="flex items-center space-x-1 hover:text-brand-primary transition-colors"
                aria-label="Send os en email"
              >
                <Mail className="h-4 w-4" />
                <span>info@justloccit.dk</span>
              </a>
            </div>

            {/* Book Now Button */}
            <Button
              onClick={handleBookNow}
              size="sm"
              className="hidden sm:inline-flex"
            >
              Book Nu
            </Button>

            {/* User Menu or Auth Buttons */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={handleUserMenuToggle}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-brand-accent transition-colors"
                  aria-label="Brugermenu"
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="true"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <span className="hidden sm:block text-brand-dark font-medium">
                    {user.name}
                  </span>
                  <ChevronDown className="h-4 w-4 text-brand-dark" />
                </button>

                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-brand border border-brown-200 py-1"
                      role="menu"
                    >
                      {userMenuItems.map((item) => (
                        <Link
                          key={item.href}
                          to={item.href}
                          className="flex items-center space-x-2 px-4 py-2 text-brand-dark hover:bg-brand-accent transition-colors"
                          role="menuitem"
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      ))}
                      <hr className="my-1 border-brown-200" />
                      <button
                        onClick={handleLogout}
                        className="flex items-center space-x-2 w-full px-4 py-2 text-brand-dark hover:bg-brand-accent transition-colors"
                        role="menuitem"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Log ud</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="hidden sm:flex items-center space-x-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                  Log ind
                </Button>
                <Button size="sm" onClick={() => navigate('/register')}>
                  Tilmeld
                </Button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-brand-accent transition-colors"
              aria-label="Navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6 text-brand-dark" />
              ) : (
                <Menu className="h-6 w-6 text-brand-dark" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden border-t border-brown-200 py-4 space-y-4"
            >
              {/* Mobile Navigation */}
              <nav className="space-y-2" role="navigation">
                {navigationItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={clsx(
                      'block px-4 py-2 text-brand-dark hover:bg-brand-accent rounded-lg transition-colors',
                      location.pathname === item.href && 'bg-brand-accent text-brand-primary'
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              {/* Mobile Book Button */}
              <div className="px-4">
                <Button onClick={handleBookNow} fullWidth>
                  Book Nu
                </Button>
              </div>

              {/* Mobile Auth/User Actions */}
              {user ? (
                <div className="px-4 space-y-2 border-t border-brown-200 pt-4">
                  <div className="flex items-center space-x-3 mb-2">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-white" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-brand-dark">{user.name}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                  </div>
                  {userMenuItems.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      className="flex items-center space-x-2 px-2 py-2 text-brand-dark hover:bg-brand-accent rounded-lg transition-colors"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 w-full px-2 py-2 text-brand-dark hover:bg-brand-accent rounded-lg transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Log ud</span>
                  </button>
                </div>
              ) : (
                <div className="px-4 space-y-2 border-t border-brown-200 pt-4">
                  <Button variant="outline" fullWidth onClick={() => navigate('/login')}>
                    Log ind
                  </Button>
                  <Button fullWidth onClick={() => navigate('/register')}>
                    Tilmeld
                  </Button>
                </div>
              )}

              {/* Mobile Contact Info */}
              <div className="px-4 space-y-2 border-t border-brown-200 pt-4">
                <a
                  href="tel:+4512345678"
                  className="flex items-center space-x-3 text-brand-dark hover:text-brand-primary transition-colors"
                >
                  <Phone className="h-5 w-5" />
                  <span>+45 12 34 56 78</span>
                </a>
                <a
                  href="mailto:info@justloccit.dk"
                  className="flex items-center space-x-3 text-brand-dark hover:text-brand-primary transition-colors"
                >
                  <Mail className="h-5 w-5" />
                  <span>info@justloccit.dk</span>
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};