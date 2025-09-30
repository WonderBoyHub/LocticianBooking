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

  const legalLinks = [
    { href: '/privacy', label: 'Privatlivspolitik' },
    { href: '/terms', label: 'Vilkår og betingelser' },
    { href: '/cookies', label: 'Cookie politik' },
  ];

  return (
    <footer className="relative overflow-hidden bg-gradient-to-br from-brown-900 via-brand-dark to-brown-800 text-white">
      <div className="absolute -top-1 w-full overflow-hidden text-brand-dark/30">
        <svg
          className="block h-16 w-[200%] -translate-x-1/4"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,64 C180,96 360,0 540,16 C720,32 900,112 1080,96 C1260,80 1350,32 1440,0 L1440,120 L0,120 Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="pointer-events-none absolute -bottom-32 right-[-8rem] h-64 w-64 rounded-full bg-brand-primary/25 blur-3xl" />
      <div className="pointer-events-none absolute -top-24 left-[-6rem] h-72 w-72 rounded-full bg-brand-secondary/20 blur-3xl" />

      <div className="container-custom relative z-10 flex flex-col gap-12 py-14 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brown-600 shadow-brand">
              <span className="text-lg font-bold text-white">JLI</span>
            </div>
            <span className="text-2xl font-serif font-bold tracking-wide">Just Locc It</span>
          </div>
          <p className="text-sm leading-relaxed text-brown-100">
            Professionel loc-pleje og styling i hjertet af København. Vi hjælper dig med at opretholde og style dine locs med den højeste standard af service.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://instagram.com/justloccit"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/20"
              aria-label="Følg os på Instagram"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <a
              href="https://facebook.com/justloccit"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/20"
              aria-label="Følg os på Facebook"
            >
              <Facebook className="h-5 w-5" />
            </a>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-10">
          <div className="grid gap-6 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-6">
            <div className="flex flex-1 min-w-[14rem] items-center gap-4 rounded-2xl bg-white/10 px-6 py-4 text-sm text-brown-100 shadow-soft backdrop-blur">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <MapPin className="h-5 w-5 text-brand-secondary" />
              </span>
              <div>
                <p className="font-semibold text-white">Adresse</p>
                <p>Nørrebrogade 123, 2200 København N</p>
              </div>
            </div>
            <div className="flex flex-1 min-w-[14rem] items-center gap-4 rounded-2xl bg-white/10 px-6 py-4 text-sm text-brown-100 shadow-soft backdrop-blur">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <Phone className="h-5 w-5 text-brand-secondary" />
              </span>
              <div>
                <p className="font-semibold text-white">Telefon</p>
                <a href="tel:+4512345678" className="transition-colors duration-200 hover:text-white">
                  +45 12 34 56 78
                </a>
              </div>
            </div>
            <div className="flex flex-1 min-w-[14rem] items-center gap-4 rounded-2xl bg-white/10 px-6 py-4 text-sm text-brown-100 shadow-soft backdrop-blur">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <Mail className="h-5 w-5 text-brand-secondary" />
              </span>
              <div>
                <p className="font-semibold text-white">Email</p>
                <a href="mailto:info@justloccit.dk" className="transition-colors duration-200 hover:text-white">
                  info@justloccit.dk
                </a>
              </div>
            </div>
            <div className="flex flex-1 min-w-[14rem] items-center gap-4 rounded-2xl bg-white/10 px-6 py-4 text-sm text-brown-100 shadow-soft backdrop-blur">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <Clock className="h-5 w-5 text-brand-secondary" />
              </span>
              <div>
                <p className="font-semibold text-white">Åbningstider</p>
                <p>Man-Fre: 09:00-18:00 · Lør: 10:00-16:00</p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/10 p-6 text-white shadow-soft backdrop-blur">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-primary/20 blur-2xl" />
            <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-md space-y-2">
                <p className="inline-flex rounded-full bg-brand-primary/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-secondary">
                  Eksklusive opdateringer
                </p>
                <h3 className="text-2xl font-serif font-semibold">Hold dig opdateret</h3>
                <p className="text-sm text-brown-100">
                  Få de seneste tips, trends og særlige tilbud direkte i din indbakke. Vi lover kun inspirerende hårpleje.
                </p>
              </div>
              <form className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
                <label className="sr-only" htmlFor="newsletter-email">
                  Email adresse til nyhedsbrev
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  placeholder="Din email adresse"
                  className="w-full rounded-xl border border-white/40 bg-white/90 px-5 py-3 text-sm text-brand-dark shadow-inner transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40 sm:w-64"
                  aria-label="Email adresse til nyhedsbrev"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-primary to-brown-500 px-6 py-3 text-sm font-semibold text-white shadow-brand transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Tilmeld
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 border-t border-white/10 bg-black/10">
        <div className="container-custom py-6">
          <div className="flex flex-col items-center justify-between gap-4 text-sm text-brown-100 md:flex-row">
            <div className="flex flex-wrap justify-center gap-4 md:justify-start">
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="transition-colors duration-200 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2 text-center md:text-left">
              <span>&copy; {currentYear} Just Locc It. Lavet med</span>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20">
                <Heart className="h-4 w-4 text-red-400" />
              </span>
              <span>København</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};