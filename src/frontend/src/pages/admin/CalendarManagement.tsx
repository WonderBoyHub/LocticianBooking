import React from 'react';
import {
  Calendar as CalendarIcon,
  Users,
  Clock,
  Filter,
  Plus,
  Settings
} from 'lucide-react';
import { Calendar } from '../../components/ui/Calendar';
import { Button } from '../../components/ui/Button';

export const CalendarManagement: React.FC = () => {
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const [calendarView, setCalendarView] = React.useState<'month' | 'week' | 'day'>('month');

  // Mock events for demonstration
  const mockEvents = [
    {
      id: '1',
      title: 'Maria Jensen - Dreadlock Maintenance',
      start: new Date(2024, 0, 20, 10, 0),
      end: new Date(2024, 0, 20, 12, 0),
      type: 'appointment' as const,
      appointment: {
        id: '1',
        customerId: 'customer1',
        locticianId: 'loctician1',
        serviceId: 'service1',
        date: '2024-01-20',
        startTime: '10:00',
        endTime: '12:00',
        status: 'confirmed' as const,
        totalPrice: 800,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
        customer: {
          id: 'customer1',
          name: 'Maria Jensen',
          email: 'maria@example.com',
          role: 'customer' as const,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      }
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-brand-dark">
            Calendar Management
          </h1>
          <p className="text-brown-600 mt-1">
            Manage all appointments across staff and services
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" leftIcon={<Filter className="w-4 h-4" />}>
            Filter
          </Button>
          <Button variant="outline" leftIcon={<Settings className="w-4 h-4" />}>
            Settings
          </Button>
          <Button leftIcon={<Plus className="w-4 h-4" />}>
            New Appointment
          </Button>
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="bg-white rounded-xl shadow-soft border border-brown-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex bg-brown-100 rounded-lg p-1">
              {(['month', 'week', 'day'] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setCalendarView(view)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    calendarView === view
                      ? 'bg-brand-primary text-white'
                      : 'text-brown-600 hover:text-brand-dark'
                  }`}
                >
                  {view.charAt(0).toUpperCase() + view.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-status-confirmed rounded-full"></div>
              <span>Confirmed</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-status-pending rounded-full"></div>
              <span>Pending</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-status-progress rounded-full"></div>
              <span>In Progress</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <Calendar
        events={mockEvents}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        view={calendarView}
        onEventClick={(event) => console.log('Event clicked:', event)}
        onEventCreate={(date, time) => console.log('Create event:', date, time)}
        onEventEdit={(event) => console.log('Edit event:', event)}
        onEventDelete={(event) => console.log('Delete event:', event)}
        className="min-h-[600px]"
      />
    </div>
  );
};