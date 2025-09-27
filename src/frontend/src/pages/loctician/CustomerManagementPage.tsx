import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  User,
  Search,
  Filter,
  Plus,
  Phone,
  Mail,
  Calendar,
  Clock,
  Star,
  MessageCircle,
  Edit,
  MoreHorizontal,
  ArrowUpRight,
  ChevronDown,
  SortAsc,
  SortDesc,
  Download,
  Upload,
  UserPlus,
  Heart,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Send,
  X,
  Image,
  Paperclip,
  Smile,
} from 'lucide-react';
import { format, subDays, subMonths } from 'date-fns';
import { da } from 'date-fns/locale';

import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { StatusBadge } from '../../components/ui/StatusBadge';

import {
  useGetCurrentUserQuery,
  useGetAppointmentsQuery,
} from '../../store/api';
import type { User as UserType, Appointment } from '../../types';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  joinDate: string;
  lastVisit?: string;
  totalAppointments: number;
  totalSpent: number;
  averageRating: number;
  preferredServices: string[];
  notes?: string;
  status: 'active' | 'inactive' | 'vip';
  upcomingAppointments: number;
  loyaltyPoints: number;
  communicationPreferences: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
}

interface Message {
  id: string;
  customerId: string;
  content: string;
  timestamp: Date;
  type: 'sent' | 'received';
  channel: 'email' | 'sms' | 'whatsapp' | 'internal';
  isRead: boolean;
}

interface CustomerFilters {
  search: string;
  status: 'all' | 'active' | 'inactive' | 'vip';
  sortBy: 'name' | 'lastVisit' | 'totalSpent' | 'totalAppointments';
  sortOrder: 'asc' | 'desc';
  dateRange: 'all' | 'last_month' | 'last_3_months' | 'last_year';
}

// Mock customer data - replace with real API data
const mockCustomers: Customer[] = [
  {
    id: '1',
    name: 'Anna Jensen',
    email: 'anna@example.com',
    phone: '+45 12 34 56 78',
    joinDate: '2023-03-15',
    lastVisit: '2024-01-15',
    totalAppointments: 12,
    totalSpent: 8400,
    averageRating: 4.8,
    preferredServices: ['Loc Maintenance', 'Deep Cleanse'],
    notes: 'Preferer morgentider. Allergisk over for visse olier.',
    status: 'vip',
    upcomingAppointments: 2,
    loyaltyPoints: 840,
    communicationPreferences: {
      email: true,
      sms: true,
      whatsapp: false,
    },
  },
  {
    id: '2',
    name: 'Michael Nielsen',
    email: 'michael@example.com',
    phone: '+45 98 76 54 32',
    joinDate: '2023-08-22',
    lastVisit: '2024-01-10',
    totalAppointments: 6,
    totalSpent: 4200,
    averageRating: 4.5,
    preferredServices: ['Starter Locs', 'Consultation'],
    status: 'active',
    upcomingAppointments: 1,
    loyaltyPoints: 420,
    communicationPreferences: {
      email: true,
      sms: false,
      whatsapp: true,
    },
  },
  {
    id: '3',
    name: 'Sarah Johnson',
    email: 'sarah@example.com',
    phone: '+45 55 66 77 88',
    joinDate: '2022-11-05',
    lastVisit: '2023-12-20',
    totalAppointments: 18,
    totalSpent: 12600,
    averageRating: 4.9,
    preferredServices: ['Loc Styling', 'Repair'],
    notes: 'Stamkunde - meget loyal. Ofte bringer venner med.',
    status: 'vip',
    upcomingAppointments: 0,
    loyaltyPoints: 1260,
    communicationPreferences: {
      email: true,
      sms: true,
      whatsapp: true,
    },
  },
  {
    id: '4',
    name: 'Lars Andersen',
    email: 'lars@example.com',
    joinDate: '2024-01-02',
    totalAppointments: 1,
    totalSpent: 1200,
    averageRating: 5.0,
    preferredServices: ['Starter Locs'],
    status: 'active',
    upcomingAppointments: 1,
    loyaltyPoints: 120,
    communicationPreferences: {
      email: true,
      sms: false,
      whatsapp: false,
    },
  },
];

const mockMessages: Message[] = [
  {
    id: '1',
    customerId: '1',
    content: 'Hej Anna! Din næste aftale er i morgen kl. 10:00. Glæder mig til at se dig! 😊',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    type: 'sent',
    channel: 'sms',
    isRead: true,
  },
  {
    id: '2',
    customerId: '1',
    content: 'Tak for påmindelsen! Jeg glæder mig også. Skal jeg medbringe noget specielt?',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    type: 'received',
    channel: 'sms',
    isRead: true,
  },
  {
    id: '3',
    customerId: '2',
    content: 'Hej Michael! Bare en påmindelse om din aftale på fredag. Hav en god dag!',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    type: 'sent',
    channel: 'whatsapp',
    isRead: true,
  },
];

const CustomerCard: React.FC<{
  customer: Customer;
  onSelect: (customer: Customer) => void;
  onEdit: (id: string) => void;
  onMessage: (customer: Customer) => void;
  isSelected?: boolean;
}> = ({ customer, onSelect, onEdit, onMessage, isSelected = false }) => {
  const [showActions, setShowActions] = useState(false);

  const getStatusColor = (status: Customer['status']) => {
    switch (status) {
      case 'vip': return 'text-purple-600 bg-purple-100';
      case 'active': return 'text-green-600 bg-green-100';
      case 'inactive': return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusLabel = (status: Customer['status']) => {
    switch (status) {
      case 'vip': return 'VIP';
      case 'active': return 'Aktiv';
      case 'inactive': return 'Inaktiv';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`bg-white rounded-lg border p-6 cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'border-amber-300 shadow-md' : 'border-gray-200'
      }`}
      onClick={() => onSelect(customer)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <span className="text-lg font-semibold text-amber-900">
                {customer.name.charAt(0).toUpperCase()}
              </span>
            </div>
            {customer.status === 'vip' && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                <Star className="w-3 h-3 text-white fill-current" />
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{customer.name}</h3>
            <p className="text-sm text-gray-600">{customer.email}</p>
            {customer.phone && (
              <p className="text-sm text-gray-600">{customer.phone}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={getStatusColor(customer.status)}>
            {getStatusLabel(customer.status)}
          </Badge>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(!showActions);
              }}
              className="p-2"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
            {showActions && (
              <div className="absolute right-0 top-8 z-10 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMessage(customer);
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send besked</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(customer.id);
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <Edit className="w-4 h-4" />
                  <span>Rediger</span>
                </button>
                <Link
                  to={`/appointments/new?customerId=${customer.id}`}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Book aftale</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500">Samlede aftaler</p>
          <p className="text-sm font-semibold text-gray-900">{customer.totalAppointments}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Total omsætning</p>
          <p className="text-sm font-semibold text-gray-900">
            {customer.totalSpent.toLocaleString('da-DK')} DKK
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Gennemsnitlig rating</p>
          <div className="flex items-center space-x-1">
            <Star className="w-3 h-3 text-yellow-400 fill-current" />
            <p className="text-sm font-semibold text-gray-900">{customer.averageRating}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500">Loyalitetspoint</p>
          <p className="text-sm font-semibold text-gray-900">{customer.loyaltyPoints}</p>
        </div>
      </div>

      {customer.lastVisit && (
        <p className="text-xs text-gray-500">
          Sidst besøg: {format(new Date(customer.lastVisit), 'dd MMM yyyy', { locale: da })}
        </p>
      )}

      {customer.upcomingAppointments > 0 && (
        <div className="mt-3 flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-amber-700">
            {customer.upcomingAppointments} kommende aftale{customer.upcomingAppointments > 1 ? 'r' : ''}
          </span>
        </div>
      )}
    </motion.div>
  );
};

const CustomerDetails: React.FC<{
  customer: Customer;
  onClose: () => void;
  onMessage: (customer: Customer) => void;
}> = ({ customer, onClose, onMessage }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'notes'>('overview');

  // Mock appointment data for the customer
  const customerAppointments = [
    {
      id: '1',
      date: '2024-01-20',
      service: 'Loc Maintenance',
      status: 'confirmed',
      price: 700,
    },
    {
      id: '2',
      date: '2024-01-15',
      service: 'Deep Cleanse',
      status: 'completed',
      price: 950,
    },
    {
      id: '3',
      date: '2023-12-10',
      service: 'Loc Styling',
      status: 'completed',
      price: 600,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="h-full bg-white border-l border-gray-200"
    >
      <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <span className="text-lg font-semibold text-amber-900">
                  {customer.name.charAt(0).toUpperCase()}
                </span>
              </div>
              {customer.status === 'vip' && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                  <Star className="w-3 h-3 text-white fill-current" />
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{customer.name}</h2>
              <p className="text-gray-600">Kunde siden {format(new Date(customer.joinDate), 'MMM yyyy', { locale: da })}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => onMessage(customer)}>
              <MessageCircle className="w-4 h-4 mr-2" />
              Besked
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{customer.totalAppointments}</p>
            <p className="text-xs text-gray-600">Aftaler</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {(customer.totalSpent / 1000).toFixed(1)}k
            </p>
            <p className="text-xs text-gray-600">DKK brugt</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{customer.averageRating}</p>
            <p className="text-xs text-gray-600">Gns. rating</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{customer.loyaltyPoints}</p>
            <p className="text-xs text-gray-600">Point</p>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'overview', label: 'Oversigt' },
            { id: 'appointments', label: 'Aftaler' },
            { id: 'notes', label: 'Noter' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-all ${
                activeTab === id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 overflow-auto">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Contact info */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Kontaktoplysninger</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{customer.email}</span>
                </div>
                {customer.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{customer.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Communication preferences */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Kommunikationspræferencer</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Email</span>
                  <Badge variant={customer.communicationPreferences.email ? 'success' : 'default'}>
                    {customer.communicationPreferences.email ? 'Aktiveret' : 'Deaktiveret'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">SMS</span>
                  <Badge variant={customer.communicationPreferences.sms ? 'success' : 'default'}>
                    {customer.communicationPreferences.sms ? 'Aktiveret' : 'Deaktiveret'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">WhatsApp</span>
                  <Badge variant={customer.communicationPreferences.whatsapp ? 'success' : 'default'}>
                    {customer.communicationPreferences.whatsapp ? 'Aktiveret' : 'Deaktiveret'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Preferred services */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Foretrukne behandlinger</h3>
              <div className="flex flex-wrap gap-2">
                {customer.preferredServices.map((service, index) => (
                  <Badge key={index} variant="outline">
                    {service}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'appointments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Aftaler</h3>
              <Button size="sm" asChild>
                <Link to={`/appointments/new?customerId=${customer.id}`}>
                  <Plus className="w-4 h-4 mr-2" />
                  Ny aftale
                </Link>
              </Button>
            </div>
            <div className="space-y-3">
              {customerAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="bg-gray-50 rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">{appointment.service}</p>
                    <p className="text-sm text-gray-600">
                      {format(new Date(appointment.date), 'dd MMMM yyyy', { locale: da })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      {appointment.price.toLocaleString('da-DK')} DKK
                    </p>
                    <StatusBadge
                      variant={appointment.status === 'completed' ? 'success' : 'info'}
                    >
                      {appointment.status === 'completed' ? 'Gennemført' : 'Planlagt'}
                    </StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Noter</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-700">
                {customer.notes || 'Ingen noter endnu...'}
              </p>
            </div>
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Rediger noter
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const MessageModal: React.FC<{
  customer: Customer;
  onClose: () => void;
  onSend: (message: string, channel: string) => void;
}> = ({ customer, onClose, onSend }) => {
  const [message, setMessage] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('sms');
  const [showTemplates, setShowTemplates] = useState(false);

  const messageTemplates = [
    'Hej {name}! Din næste aftale er i morgen kl. {time}. Glæder mig til at se dig!',
    'Tak for dit besøg i dag, {name}! Husk at følge efterbehandlingsrådene.',
    'Hej {name}! Vil du gerne booke din næste behandling? Jeg har ledige tider næste uge.',
    'Tillykke med din fødselsdag, {name}! Du får 20% rabat på din næste behandling.',
  ];

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'sms': return <Phone className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'whatsapp': return <MessageCircle className="w-4 h-4" />;
      default: return <MessageCircle className="w-4 h-4" />;
    }
  };

  const availableChannels = [
    { id: 'sms', label: 'SMS', enabled: customer.communicationPreferences.sms && customer.phone },
    { id: 'email', label: 'Email', enabled: customer.communicationPreferences.email },
    { id: 'whatsapp', label: 'WhatsApp', enabled: customer.communicationPreferences.whatsapp && customer.phone },
  ].filter(channel => channel.enabled);

  const handleSend = () => {
    if (!message.trim()) return;
    onSend(message, selectedChannel);
    setMessage('');
    onClose();
  };

  const useTemplate = (template: string) => {
    const personalizedMessage = template.replace('{name}', customer.name.split(' ')[0]);
    setMessage(personalizedMessage);
    setShowTemplates(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Send besked til {customer.name}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Channel selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vælg kanal
          </label>
          <div className="flex space-x-2">
            {availableChannels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => setSelectedChannel(channel.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-all ${
                  selectedChannel === channel.id
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {getChannelIcon(channel.id)}
                <span className="text-sm">{channel.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Message input */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Besked
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTemplates(!showTemplates)}
            >
              Skabeloner
            </Button>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Skriv din besked her..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            {message.length}/500 tegn
          </p>
        </div>

        {/* Templates */}
        {showTemplates && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">Skabeloner:</p>
            <div className="space-y-2">
              {messageTemplates.map((template, index) => (
                <button
                  key={index}
                  onClick={() => useTemplate(template)}
                  className="w-full text-left p-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                >
                  {template.replace('{name}', customer.name.split(' ')[0])}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3">
          <Button variant="outline" onClick={onClose}>
            Annuller
          </Button>
          <Button onClick={handleSend} disabled={!message.trim()}>
            <Send className="w-4 h-4 mr-2" />
            Send besked
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

const CustomerManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<CustomerFilters>({
    search: searchParams.get('search') || '',
    status: (searchParams.get('status') as CustomerFilters['status']) || 'all',
    sortBy: (searchParams.get('sortBy') as CustomerFilters['sortBy']) || 'lastVisit',
    sortOrder: (searchParams.get('sortOrder') as CustomerFilters['sortOrder']) || 'desc',
    dateRange: (searchParams.get('dateRange') as CustomerFilters['dateRange']) || 'all',
  });

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showMessageModal, setShowMessageModal] = useState<Customer | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // API queries
  const { data: userData } = useGetCurrentUserQuery();

  // Filter and sort customers
  const filteredCustomers = useMemo(() => {
    let filtered = [...mockCustomers];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(searchLower) ||
        customer.email.toLowerCase().includes(searchLower) ||
        (customer.phone && customer.phone.includes(filters.search))
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(customer => customer.status === filters.status);
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      let cutoffDate: Date;

      switch (filters.dateRange) {
        case 'last_month':
          cutoffDate = subMonths(now, 1);
          break;
        case 'last_3_months':
          cutoffDate = subMonths(now, 3);
          break;
        case 'last_year':
          cutoffDate = subMonths(now, 12);
          break;
        default:
          cutoffDate = new Date(0);
      }

      filtered = filtered.filter(customer => {
        const lastVisit = customer.lastVisit ? new Date(customer.lastVisit) : new Date(customer.joinDate);
        return lastVisit >= cutoffDate;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (filters.sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'lastVisit':
          aValue = new Date(a.lastVisit || a.joinDate).getTime();
          bValue = new Date(b.lastVisit || b.joinDate).getTime();
          break;
        case 'totalSpent':
          aValue = a.totalSpent;
          bValue = b.totalSpent;
          break;
        case 'totalAppointments':
          aValue = a.totalAppointments;
          bValue = b.totalAppointments;
          break;
        default:
          return 0;
      }

      if (filters.sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [filters]);

  // Statistics
  const stats = useMemo(() => {
    const totalCustomers = mockCustomers.length;
    const activeCustomers = mockCustomers.filter(c => c.status === 'active' || c.status === 'vip').length;
    const vipCustomers = mockCustomers.filter(c => c.status === 'vip').length;
    const totalRevenue = mockCustomers.reduce((sum, c) => sum + c.totalSpent, 0);

    return { totalCustomers, activeCustomers, vipCustomers, totalRevenue };
  }, []);

  const updateFilters = (newFilters: Partial<CustomerFilters>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);

    // Update URL
    const params = new URLSearchParams();
    Object.entries(updated).forEach(([key, value]) => {
      if (value && value !== 'all' && value !== '') {
        params.set(key, value);
      }
    });
    setSearchParams(params);
  };

  const handleSendMessage = (message: string, channel: string) => {
    // Here you would send the message via the selected channel
    console.log('Sending message:', { message, channel, customer: showMessageModal });

    // Mock success feedback
    alert(`Besked sendt via ${channel}!`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Kunder
                </h1>
                <p className="text-gray-600">
                  Administrer dine kunder og kommuniker direkte med dem
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Eksporter
                </Button>
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Importer
                </Button>
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Tilføj kunde
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{stats.totalCustomers}</p>
                <p className="text-sm text-gray-600">Total kunder</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{stats.activeCustomers}</p>
                <p className="text-sm text-gray-600">Aktive kunder</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-purple-600">{stats.vipCustomers}</p>
                <p className="text-sm text-gray-600">VIP kunder</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">
                  {(stats.totalRevenue / 1000).toFixed(0)}k
                </p>
                <p className="text-sm text-gray-600">DKK omsætning</p>
              </Card>
            </div>

            {/* Search and filters */}
            <Card className="p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Søg kunder..."
                      value={filters.search}
                      onChange={(e) => updateFilters({ search: e.target.value })}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent w-64"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Filtre
                    {showFilters && <ChevronDown className="w-4 h-4 ml-2 rotate-180 transition-transform" />}
                  </Button>
                </div>
                <div className="text-sm text-gray-600">
                  {filteredCustomers.length} af {mockCustomers.length} kunder
                </div>
              </div>

              {/* Extended filters */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-gray-200"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Status
                        </label>
                        <select
                          value={filters.status}
                          onChange={(e) => updateFilters({ status: e.target.value as CustomerFilters['status'] })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        >
                          <option value="all">Alle status</option>
                          <option value="active">Aktive</option>
                          <option value="inactive">Inaktive</option>
                          <option value="vip">VIP</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Sortér efter
                        </label>
                        <div className="flex space-x-2">
                          <select
                            value={filters.sortBy}
                            onChange={(e) => updateFilters({ sortBy: e.target.value as CustomerFilters['sortBy'] })}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          >
                            <option value="name">Navn</option>
                            <option value="lastVisit">Sidste besøg</option>
                            <option value="totalSpent">Total brugt</option>
                            <option value="totalAppointments">Antal aftaler</option>
                          </select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateFilters({
                              sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc'
                            })}
                          >
                            {filters.sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Aktivitet
                        </label>
                        <select
                          value={filters.dateRange}
                          onChange={(e) => updateFilters({ dateRange: e.target.value as CustomerFilters['dateRange'] })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        >
                          <option value="all">Alle perioder</option>
                          <option value="last_month">Sidste måned</option>
                          <option value="last_3_months">Sidste 3 måneder</option>
                          <option value="last_year">Sidste år</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* Content */}
          <div className="flex gap-6">
            {/* Customer list */}
            <div className={`${selectedCustomer ? 'w-2/3' : 'w-full'} transition-all duration-300`}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {filteredCustomers.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <AnimatePresence>
                      {filteredCustomers.map((customer) => (
                        <CustomerCard
                          key={customer.id}
                          customer={customer}
                          onSelect={setSelectedCustomer}
                          onEdit={(id) => navigate(`/customers/${id}/edit`)}
                          onMessage={setShowMessageModal}
                          isSelected={selectedCustomer?.id === customer.id}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <User className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Ingen kunder fundet
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Prøv at ændre dine søgekriterier eller tilføj en ny kunde.
                    </p>
                    <Button>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Tilføj kunde
                    </Button>
                  </Card>
                )}
              </motion.div>
            </div>

            {/* Customer details */}
            <AnimatePresence>
              {selectedCustomer && (
                <div className="w-1/3">
                  <CustomerDetails
                    customer={selectedCustomer}
                    onClose={() => setSelectedCustomer(null)}
                    onMessage={setShowMessageModal}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Message modal */}
      <AnimatePresence>
        {showMessageModal && (
          <MessageModal
            customer={showMessageModal}
            onClose={() => setShowMessageModal(null)}
            onSend={handleSendMessage}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerManagementPage;