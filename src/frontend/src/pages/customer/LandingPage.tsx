'use client'

import React from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Star,
  CheckCircle,
  ArrowRight,
  Clock,
  Users,
  Award,
  Instagram,
  Calendar,
  Heart,
  MessageCircle
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { useGetInstagramPostsQuery, useGetFeaturedMediaQuery } from '../../store/api';
import type { InstagramPost, MediaAsset } from '../../types';
import { mapInstagramPostDto } from '../../utils/instagram';

interface TestimonialProps {
  name: string;
  rating: number;
  text: string;
  initials: string;
}

const Testimonial: React.FC<TestimonialProps> = ({ name, rating, text, initials }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="bg-white rounded-xl p-6 shadow-soft"
  >
    <div className="flex items-center mb-4">
      <div className="w-12 h-12 bg-brand-primary rounded-full flex items-center justify-center mr-4">
        <span className="text-white font-semibold">{initials}</span>
      </div>
      <div>
        <h4 className="font-semibold text-brand-dark">{name}</h4>
        <div className="flex items-center">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${
                i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
    <p className="text-gray-600 italic">"{text}"</p>
  </motion.div>
);

interface ServiceCardProps {
  title: string;
  description: string;
  price: string;
  duration: string;
  href: string;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  title,
  description,
  price,
  duration,
  href
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="card card-hover p-6 h-full flex flex-col"
  >
    <h3 className="text-xl font-serif font-semibold text-brand-dark mb-3">
      {title}
    </h3>
    <p className="text-gray-600 mb-4 flex-grow">{description}</p>
    <div className="flex items-center justify-between mb-4">
      <span className="text-2xl font-bold text-brand-primary">{price}</span>
      <span className="text-sm text-gray-500 flex items-center">
        <Clock className="h-4 w-4 mr-1" />
        {duration}
      </span>
    </div>
    <Link to={href}>
      <Button variant="outline" fullWidth>
        Læs mere
      </Button>
    </Link>
  </motion.div>
);

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    data: instagramResponse,
    isLoading: instagramLoading,
    isError: instagramError
  } = useGetInstagramPostsQuery({ limit: 9 });
  const {
    data: mediaResponse,
    isLoading: mediaLoading,
    isError: mediaError
  } = useGetFeaturedMediaQuery(6);

  const instagramPosts = React.useMemo<InstagramPost[]>(() => {
    if (!instagramResponse?.data) {
      return [];
    }

    return instagramResponse.data.map(mapInstagramPostDto).slice(0, 9);
  }, [instagramResponse]);
  const instagramPlaceholders = React.useMemo(
    () =>
      Array.from({ length: 9 }).map((_, index) => ({
        id: `placeholder-${index}`,
        image: `https://picsum.photos/400/400?random=${index + 31}`,
        caption: 'Instagram inspiration fra Lorem Picsum',
      })),
    []
  );

  const mediaItems = React.useMemo<MediaAsset[]>(() => mediaResponse ?? [], [mediaResponse]);

  const testimonials = [
    {
      name: 'Kevin Samuel',
      rating: 5,
      text: 'Fantastisk oplevelse! Min loctician var professionel og omhyggelig.',
      initials: 'KS'
    },
    {
      name: 'Bob Marley',
      rating: 5,
      text: 'Elskede servicen. Mine locs ser aldrig bedre ud!',
      initials: 'BM'
    },
    {
      name: 'El Benny Jamo',
      rating: 5,
      text: 'Tilfredsstillende arbejde hver gang.',
      initials: 'EBJ'
    }
  ];

  const featuredServices = [
    {
      title: 'Traditional Comb Coils',
      description: 'Professionel starter loc service med traditionel teknik',
      price: '1.150 kr',
      duration: '2t 50min',
      href: '/services/starter-locs'
    },
    {
      title: 'Two-Strand Twist Starter Locs',
      description: 'Moderne twist-teknik til naturlige starter locs',
      price: '1.300 kr',
      duration: '3t 20min',
      href: '/services/starter-locs'
    },
    {
      title: 'Palm Roll Method',
      description: 'Skånsom palm roll teknik til vedligeholdelse',
      price: '1.200 kr',
      duration: '3t',
      href: '/services/maintenance'
    }
  ];

  const stats = [
    { icon: Users, value: '500+', label: 'Tilfredse kunder' },
    { icon: Star, value: '4.9', label: 'Gennemsnitlig rating' },
    { icon: Calendar, value: 'Hundredevis', label: 'Af glade kunder 😊' }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-brand-light to-brand-accent py-20 lg:py-32 overflow-hidden">
        <div className="container-custom relative z-10">
          <div className="grid lg:grid-cols-1 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold text-brand-dark mb-6 text-balance">
                Professionel{' '} 
                <span className="text-gradient">Loctician</span>{' '} i København
                
              </h1>

              <div className="mb-6">
                {instagramLoading ? (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 9 }).map((_, index) => (
                      <div
                        key={index}
                        className="aspect-square rounded-md bg-white/60 animate-pulse"
                      />
                    ))}
                  </div>
                ) : instagramError ? (
                  <div className="rounded-md border border-dashed border-brand-primary/40 bg-white/60 p-4 text-sm text-brand-dark/80">
                    Kunne ikke hente Instagram-indhold i øjeblikket. Prøv igen senere.
                  </div>
                ) : (
                  (instagramPosts.length ? instagramPosts : instagramPlaceholders).length ? (
                    <div className="grid grid-cols-3 gap-2">
                      {(instagramPosts.length ? instagramPosts : instagramPlaceholders).map((post) => (
                        <a
                          key={post.id}
                          href={'permalink' in post ? post.permalink : 'https://instagram.com/justloccit'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative block aspect-square overflow-hidden rounded-md shadow-sm"
                        >
                          <img
                            src={
                              'mediaUrl' in post
                                ? post.thumbnailUrl ?? post.mediaUrl ?? `https://picsum.photos/400/400?random=${post.displayOrder ?? 90}`
                                : post.image
                            }
                            alt={
                              'caption' in post && post.caption
                                ? post.caption.slice(0, 80)
                                : 'Instagram inspiration'
                            }
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                          <div className="absolute bottom-0 left-0 right-0 p-2 text-white text-xs">
                            <p
                              className="leading-snug text-white/90 overflow-hidden text-ellipsis"
                              style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}
                            >
                              {'caption' in post && post.caption ? post.caption : 'Følg med på Instagram'}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : null
                )}
              </div>

              <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
                Specialist i loc-vedligeholdelse, styling og pleje. Book din tid hos Københavns mest betryggende loctician.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  onClick={() => navigate('/book')}
                  rightIcon={<ArrowRight className="h-5 w-5" />}
                >
                  Book Nu
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/tjenester')}
                >
                  Se Tjenester
                </Button>
              </div>
            </motion.div>

          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-10">
          <div className="w-full h-full bg-brand-primary rounded-full transform translate-x-1/2 -translate-y-1/4"></div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="container-custom">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-brand-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="h-8 w-8 text-white" />
                </div>
                <div className="text-3xl font-bold text-brand-dark mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-600">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="section-padding bg-brand-light">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-brand-dark mb-4">
              Vores Tjenester
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Omfattende loc-pleje for hvert trin af din rejse
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {featuredServices.map((service, index) => (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <ServiceCard {...service} />
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/tjenester')}
              rightIcon={<ArrowRight className="h-5 w-5" />}
            >
              Se Alle Tjenester
            </Button>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-brand-dark mb-6">
                Hvorfor vælge Just Locc It?
              </h2>

              <div className="space-y-6">
                {[
                  {
                    title: 'Professionel ekspertise',
                    description: 'Erfaring med alle hårtyper og teknikker'
                  },
                  {
                    title: 'Personlig tilgang',
                    description: 'Hver behandling tilpasses dine specifikke behov'
                  },
                  {
                    title: 'Høj kvalitet',
                    description: 'Kun de bedste produkter og teknikker'
                  },
                  {
                    title: 'Fleksible tider',
                    description: 'Book online 24/7 og find en tid der passer dig'
                  }
                ].map((feature) => (
                  <div key={feature.title} className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-brand-dark mb-1">
                        {feature.title}
                      </h3>
                      <p className="text-gray-600">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="grid grid-cols-2 gap-4">
                <img
                  src="https://picsum.photos/400/500?random=1"
                  alt="Loc styling proces"
                  className="rounded-xl shadow-soft"
                />
                <img
                  src="https://picsum.photos/400/500?random=2"
                  alt="Færdig loc styling"
                  className="rounded-xl shadow-soft mt-8"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section className="section-padding bg-brand-light">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-brand-dark mb-4">
              Hvad siger vores kunder?
            </h2>
            <p className="text-lg text-gray-600">
              Læs anmeldelser fra vores tilfredse kunder
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Testimonial {...testimonial} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Instagram Section */}
      <section className="section-padding bg-white">
        <div className="container-custom text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-brand-dark mb-4">
              Følg vores arbejde
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Se de seneste transformationer på Instagram
            </p>
            <Button
              variant="outline"
              size="lg"
              leftIcon={<Instagram className="h-5 w-5" />}
              onClick={() => window.open('https://instagram.com/justloccit', '_blank')}
            >
              @justloccit
            </Button>
          </motion.div>

          {instagramLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-xl bg-brand-accent/50 animate-pulse"
                />
              ))}
            </div>
          ) : instagramError ? (
            <div className="rounded-xl border border-dashed border-brand-primary/40 bg-brand-accent/40 p-6 text-brand-dark">
              Kunne ikke hente Instagram-indhold i øjeblikket. Prøv igen senere.
            </div>
          ) : (
            (instagramPosts.length ? instagramPosts : instagramPlaceholders).length ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {(instagramPosts.length ? instagramPosts : instagramPlaceholders).map((post, index) => (
                  <motion.a
                    key={post.id}
                    href={'permalink' in post ? post.permalink : 'https://instagram.com/justloccit'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-square overflow-hidden rounded-xl shadow-soft"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <img
                      src={
                        'mediaUrl' in post
                          ? post.thumbnailUrl ?? post.mediaUrl ?? `https://picsum.photos/600/600?random=${index + 51}`
                          : post.image
                      }
                      alt={
                        'caption' in post && post.caption
                          ? post.caption.slice(0, 80)
                          : 'Instagram inspiration'
                      }
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <p
                        className="text-sm font-medium text-white overflow-hidden text-ellipsis"
                        style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}
                      >
                        {'caption' in post && post.caption ? post.caption : 'Få et glimt af vores kommende indhold'}
                      </p>
                      {'likesCount' in post ? (
                        <div className="mt-3 flex items-center gap-4 text-xs text-white/80">
                          <span className="flex items-center gap-1">
                            <Heart className="h-4 w-4" />
                            {post.likesCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-4 w-4" />
                            {post.commentsCount}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </motion.a>
                ))}
              </motion.div>
            ) : null
          )}
        </div>
      </section>

      {/* Media Spotlight Section */}
      <section className="section-padding bg-brand-light">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-brand-dark mb-4">
              {t('landing.media.title')}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {t('landing.media.subtitle')}
            </p>
          </motion.div>

          {mediaLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-xl bg-white border border-brown-100 shadow-soft animate-pulse"
                />
              ))}
            </div>
          ) : mediaError ? (
            <div className="rounded-xl border border-dashed border-brand-primary/40 bg-brand-accent/40 p-6 text-brand-dark">
              {t('landing.media.error')}
            </div>
          ) : mediaItems.length ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {mediaItems.map((item) => (
                <motion.figure
                  key={item.id}
                  className="relative overflow-hidden rounded-xl shadow-soft border border-brown-100 bg-white"
                  whilehover={{ scale: 1.01 }}
                >
                  {item.mimeType.startsWith('video/') ? (
                    <video
                      src={item.url}
                      controls
                      className="w-full h-72 object-cover"
                    />
                  ) : (
                    <img
                      src={item.url || 'https://picsum.photos/600/400'}
                      alt={item.altText ?? item.originalFilename}
                      className="w-full h-72 object-cover"
                      loading="lazy"
                    />
                  )}
                  {item.caption ? (
                    <figcaption className="p-3 text-sm text-gray-700 bg-white/90">
                      {item.caption}
                    </figcaption>
                  ) : null}
                </motion.figure>
              ))}
            </motion.div>
          ) : (
            <div className="rounded-xl border border-dashed border-brand-primary/40 bg-brand-accent/40 p-6 text-brand-dark">
              {t('landing.media.empty')}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-brand-primary text-white">
        <div className="container-custom text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
              Klar til at booke din næste behandling?
            </h2>
            <p className="text-lg text-brand-accent mb-8 max-w-2xl mx-auto">
              Book nemt online eller ring for at høre mere om vores tjenester
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate('/book')}
                rightIcon={<Calendar className="h-5 w-5" />}
              >
                Book Nu
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-white text-white hover:bg-white hover:text-brand-primary"
                onClick={() => navigate('/contact')}
              >
                Kontakt Os
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};
