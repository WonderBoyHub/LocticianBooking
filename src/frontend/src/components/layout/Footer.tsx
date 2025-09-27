import React from 'react';
import { Link } from 'react-router-dom';
import {
  Phone,
  Mail,
  MapPin,
  Instagram,
  Facebook,
  Clock,
  Heart
} from 'lucide-react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { href: '/services', label: 'Tjenester' },
    { href: '/about', label: 'Om os' },
    { href: '/contact', label: 'Kontakt' },
    { href: '/book', label: 'Book tid' },
  ];

  const legalLinks = [
    { href: '/privacy', label: 'Privatlivspolitik' },
    { href: '/terms', label: 'Vilkår og betingelser' },
    { href: '/cookies', label: 'Cookie politik' },
  ];

  const serviceCategories = [
    { href: '/services/starter-locs', label: 'Starter Locs' },
    { href: '/services/retwists', label: 'Loc Retwists' },
    { href: '/services/wash', label: 'Vask & pleje' },
    { href: '/services/styling', label: 'Styling' },
  ];

  return (
    <footer className="bg-brand-dark text-white">
      {/* Main Footer Content */}
      <div className="container-custom py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">JLI</span>
              </div>
              <span className="text-xl font-serif font-bold">Just Locc It</span>
            </div>

            <p className="text-brown-200 leading-relaxed">
              Professionel loc-pleje og styling i hjertet af København.
              Vi hjælper dig med at opretholde og style dine locs med
              den højeste standard af service.
            </p>

            <div className="flex space-x-4">
              <a
                href="https://instagram.com/justloccit"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center hover:bg-brand-secondary transition-colors"
                aria-label="Følg os på Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://facebook.com/justloccit"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center hover:bg-brand-secondary transition-colors"
                aria-label="Følg os på Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-serif font-semibold">Hurtige Links</h3>
            <nav className="space-y-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="block text-brown-200 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Services */}
          <div className="space-y-4">
            <h3 className="text-lg font-serif font-semibold">Tjenester</h3>
            <nav className="space-y-2">
              {serviceCategories.map((service) => (
                <Link
                  key={service.href}
                  to={service.href}
                  className="block text-brown-200 hover:text-white transition-colors"
                >
                  {service.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-serif font-semibold">Kontakt</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-brand-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-brown-200">
                    Nørrebrogade 123<br />
                    2200 København N<br />
                    Danmark
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-brand-secondary flex-shrink-0" />
                <a
                  href="tel:+4512345678"
                  className="text-brown-200 hover:text-white transition-colors"
                >
                  +45 12 34 56 78
                </a>
              </div>

              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-brand-secondary flex-shrink-0" />
                <a
                  href="mailto:info@justloccit.dk"
                  className="text-brown-200 hover:text-white transition-colors"
                >
                  info@justloccit.dk
                </a>
              </div>

              <div className="flex items-start space-x-3">
                <Clock className="h-5 w-5 text-brand-secondary mt-0.5 flex-shrink-0" />
                <div className="text-brown-200">
                  <p className="font-medium">Åbningstider:</p>
                  <p>Man-Fre: 09:00-18:00</p>
                  <p>Lør: 10:00-16:00</p>
                  <p>Søn: Lukket</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Newsletter Signup */}
      <div className="border-t border-brown-700">
        <div className="container-custom py-8">
          <div className="max-w-md mx-auto text-center">
            <h3 className="text-lg font-serif font-semibold mb-2">
              Hold dig opdateret
            </h3>
            <p className="text-brown-200 mb-4">
              Få de seneste tips og tilbud direkte i din indbakke
            </p>
            <form className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                placeholder="Din email adresse"
                className="flex-1 px-4 py-2 rounded-lg bg-brand-light text-brand-dark placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                aria-label="Email adresse til nyhedsbrev"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary hover:text-brand-dark transition-colors font-medium"
              >
                Tilmeld
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-brown-700">
        <div className="container-custom py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-brown-200">
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center space-x-1 text-sm text-brown-200">
              <span>&copy; {currentYear} Just Locc It. Lavet med</span>
              <Heart className="h-4 w-4 text-red-400" />
              <span>i København</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};