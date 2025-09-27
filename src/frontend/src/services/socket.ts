import { io, Socket } from 'socket.io-client';
import { store } from '../store';
import { addNotification } from '../store/slices/uiSlice';
import {
  setAppointments,
  addEvent,
  updateEvent,
  removeEvent
} from '../store/slices/calendarSlice';
import type { SocketEvent, Appointment, CalendarEvent } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000;

  connect(token?: string) {
    const url = import.meta.env.VITE_WS_URL || 'http://localhost:8000';

    this.socket = io(url, {
      auth: {
        token: token || store.getState().auth.token,
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectInterval,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;

      store.dispatch(addNotification({
        type: 'success',
        message: 'Connected to real-time updates',
        duration: 3000,
      }));
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);

      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        store.dispatch(addNotification({
          type: 'error',
          message: 'Unable to connect to real-time updates',
          duration: 0,
        }));
      }
    });

    // Business logic events
    this.socket.on('appointment_created', (data: Appointment) => {
      console.log('New appointment created:', data);

      // Add to calendar
      const calendarEvent: CalendarEvent = {
        id: data.id,
        title: data.service?.name || 'Appointment',
        start: new Date(`${data.date}T${data.startTime}`),
        end: new Date(`${data.date}T${data.endTime}`),
        backgroundColor: this.getStatusColor(data.status),
        borderColor: this.getStatusColor(data.status),
        textColor: '#ffffff',
        extendedProps: {
          appointment: data,
          type: 'appointment',
        },
      };

      store.dispatch(addEvent(calendarEvent));

      // Show notification
      store.dispatch(addNotification({
        type: 'info',
        title: 'New Appointment',
        message: `New appointment booked for ${data.customer?.name}`,
        duration: 5000,
      }));
    });

    this.socket.on('appointment_updated', (data: Appointment) => {
      console.log('Appointment updated:', data);

      const calendarEvent: CalendarEvent = {
        id: data.id,
        title: data.service?.name || 'Appointment',
        start: new Date(`${data.date}T${data.startTime}`),
        end: new Date(`${data.date}T${data.endTime}`),
        backgroundColor: this.getStatusColor(data.status),
        borderColor: this.getStatusColor(data.status),
        textColor: '#ffffff',
        extendedProps: {
          appointment: data,
          type: 'appointment',
        },
      };

      store.dispatch(updateEvent(calendarEvent));

      store.dispatch(addNotification({
        type: 'info',
        title: 'Appointment Updated',
        message: `Appointment for ${data.customer?.name} has been updated`,
        duration: 4000,
      }));
    });

    this.socket.on('appointment_cancelled', (data: { id: string; appointment: Appointment }) => {
      console.log('Appointment cancelled:', data);

      store.dispatch(removeEvent(data.id));

      store.dispatch(addNotification({
        type: 'warning',
        title: 'Appointment Cancelled',
        message: `Appointment for ${data.appointment.customer?.name} has been cancelled`,
        duration: 5000,
      }));
    });

    this.socket.on('availability_updated', (data: any) => {
      console.log('Availability updated:', data);

      store.dispatch(addNotification({
        type: 'info',
        title: 'Availability Updated',
        message: 'Schedule availability has been updated',
        duration: 3000,
      }));
    });

    this.socket.on('user_notification', (data: {
      type: 'success' | 'error' | 'warning' | 'info';
      title?: string;
      message: string;
    }) => {
      store.dispatch(addNotification({
        type: data.type,
        title: data.title,
        message: data.message,
        duration: 5000,
      }));
    });

    // Calendar sync events
    this.socket.on('calendar_sync', (data: { appointments: Appointment[] }) => {
      console.log('Calendar sync received:', data);
      store.dispatch(setAppointments(data.appointments));
    });

    // Room management
    this.socket.on('joined_room', (room: string) => {
      console.log('Joined room:', room);
    });

    this.socket.on('left_room', (room: string) => {
      console.log('Left room:', room);
    });
  }

  // Join specific rooms for targeted updates
  joinRoom(room: string) {
    if (this.socket?.connected) {
      this.socket.emit('join_room', room);
    }
  }

  leaveRoom(room: string) {
    if (this.socket?.connected) {
      this.socket.emit('leave_room', room);
    }
  }

  // Join loctician room for their appointments
  joinLocticianRoom(locticianId: string) {
    this.joinRoom(`loctician_${locticianId}`);
  }

  // Join customer room for their appointments
  joinCustomerRoom(customerId: string) {
    this.joinRoom(`customer_${customerId}`);
  }

  // Emit events
  emitAppointmentUpdate(appointmentId: string, data: Partial<Appointment>) {
    if (this.socket?.connected) {
      this.socket.emit('update_appointment', { appointmentId, data });
    }
  }

  emitAvailabilityUpdate(locticianId: string, availability: any) {
    if (this.socket?.connected) {
      this.socket.emit('update_availability', { locticianId, availability });
    }
  }

  // Send typing indicators for chat
  emitTyping(room: string, isTyping: boolean) {
    if (this.socket?.connected) {
      this.socket.emit('typing', { room, isTyping });
    }
  }

  // Send chat messages
  sendMessage(room: string, message: string) {
    if (this.socket?.connected) {
      this.socket.emit('chat_message', { room, message });
    }
  }

  // Connection management
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Utility methods
  private getStatusColor(status: string): string {
    const colors = {
      pending: '#F59E0B',
      confirmed: '#10B981',
      in_progress: '#3B82F6',
      completed: '#6B7280',
      cancelled: '#EF4444',
      no_show: '#EF4444',
    };
    return colors[status as keyof typeof colors] || '#6B7280';
  }

  // Get connection status
  getStatus() {
    return {
      connected: this.isConnected(),
      id: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// Export singleton instance
export const socketService = new SocketService();

// React hook for using socket in components
export const useSocket = () => {
  return {
    socket: socketService,
    isConnected: socketService.isConnected(),
    connect: socketService.connect.bind(socketService),
    disconnect: socketService.disconnect.bind(socketService),
    joinRoom: socketService.joinRoom.bind(socketService),
    leaveRoom: socketService.leaveRoom.bind(socketService),
    emitAppointmentUpdate: socketService.emitAppointmentUpdate.bind(socketService),
    emitAvailabilityUpdate: socketService.emitAvailabilityUpdate.bind(socketService),
    sendMessage: socketService.sendMessage.bind(socketService),
    getStatus: socketService.getStatus.bind(socketService),
  };
};