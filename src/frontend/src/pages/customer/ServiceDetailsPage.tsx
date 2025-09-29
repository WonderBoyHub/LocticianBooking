import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, DollarSign, Calendar, ArrowLeft } from 'lucide-react';
import { useGetServiceQuery } from '../../store/api';
import { Button, Card, CardContent, LoadingSpinner, Badge } from '../../components/ui';
import { formatCurrency } from '../../i18n/index';

export const ServiceDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();

  const {
    data: serviceResponse,
    isLoading,
    error
  } = useGetServiceQuery(id!, { skip: !id });

  const service = serviceResponse?.data;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Service Not Found</h1>
          <p className="text-gray-600 mb-6">The service you're looking for doesn't exist.</p>
          <Link to="/">
            <Button>Return Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const serviceName = i18n.language === 'da' ? service.name : (service.nameEn || service.name);
  const serviceDescription = i18n.language === 'da'
    ? service.description
    : (service.descriptionEn || service.description);

  return (
    <div className="min-h-screen bg-brand-light py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back button */}
        <Link to="/" className="inline-flex items-center text-brand-primary hover:text-brand-dark mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Services
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Service details */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-8">
                <div className="mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <h1 className="text-3xl font-bold text-brand-dark">
                      {serviceName}
                    </h1>
                    {service.category && (
                      <Badge variant="brand">
                        {i18n.language === 'da'
                          ? service.category.name
                          : (service.category.nameEn || service.category.name)
                        }
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center space-x-6 text-gray-600 mb-6">
                    <div className="flex items-center">
                      <Clock className="w-5 h-5 mr-2" />
                      <span>{service.duration} {t('time.minutes')}</span>
                    </div>
                    <div className="flex items-center">
                      <DollarSign className="w-5 h-5 mr-2" />
                      <span className="text-2xl font-bold text-brand-primary">
                        {formatCurrency(service.price)}
                      </span>
                    </div>
                  </div>

                  <p className="text-gray-700 text-lg leading-relaxed">
                    {serviceDescription}
                  </p>
                </div>

                {/* Service images */}
                {service.images && service.images.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-brand-dark mb-4">Gallery</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {service.images.map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt={`${serviceName} ${index + 1}`}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Requirements */}
                {service.requirements && service.requirements.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-brand-dark mb-4">Requirements</h3>
                    <ul className="space-y-2">
                      {service.requirements.map((requirement, index) => (
                        <li key={index} className="flex items-start">
                          <span className="w-2 h-2 bg-brand-primary rounded-full mt-2 mr-3 flex-shrink-0" />
                          <span className="text-gray-700">{requirement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Aftercare */}
                {service.aftercare && service.aftercare.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-brand-dark mb-4">Aftercare Instructions</h3>
                    <ul className="space-y-2">
                      {service.aftercare.map((instruction, index) => (
                        <li key={index} className="flex items-start">
                          <span className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0" />
                          <span className="text-gray-700">{instruction}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Booking sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-brand-dark mb-4">
                  Book This Service
                </h3>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium">{service.duration} minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Price:</span>
                    <span className="font-bold text-brand-primary text-lg">
                      {formatCurrency(service.price)}
                    </span>
                  </div>
                </div>

                <Link to="/book" state={{ selectedService: service }}>
                  <Button fullWidth size="lg" className="mb-4">
                    <Calendar className="w-5 h-5 mr-2" />
                    {t('services.bookNow')}
                  </Button>
                </Link>

                <div className="text-xs text-gray-500 text-center">
                  Free cancellation up to 24 hours before your appointment
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};