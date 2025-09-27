# API Contracts & Data Models

## Core Authentication Endpoints

### POST /auth/login
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```
**Response:**
```json
{
  "access_token": "jwt_token",
  "refresh_token": "refresh_jwt",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "customer|loctician|admin",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

### POST /auth/register
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+45123456789",
  "marketing_consent": true,
  "gdpr_consent": true
}
```

## Booking System Endpoints

### GET /services
**Response:**
```json
{
  "services": [
    {
      "id": "uuid",
      "name": "Traditional Comb Coils",
      "description": "Professional starter loc installation",
      "duration_minutes": 180,
      "price": 1500.00,
      "category": "starter_locs",
      "is_active": true
    }
  ]
}
```

### POST /bookings
```json
{
  "service_id": "uuid",
  "loctician_id": "uuid",
  "start_time": "2024-01-15T10:00:00Z",
  "notes": "Customer notes here",
  "customer_id": "uuid"
}
```

### GET /bookings/availability
**Query Parameters:**
- `loctician_id`: UUID
- `date`: YYYY-MM-DD
- `service_id`: UUID (optional)

**Response:**
```json
{
  "available_slots": [
    {
      "start_time": "2024-01-15T09:00:00Z",
      "end_time": "2024-01-15T12:00:00Z",
      "is_available": true
    }
  ]
}
```

## Real-time WebSocket Events

### Connection: `/ws/bookings/{user_id}`

**Events:**
- `booking_created`: New booking notification
- `booking_updated`: Booking status change
- `availability_changed`: Calendar availability update
- `payment_status`: Payment confirmation

## Data Models

### User Model
```typescript
interface User {
  id: string;
  email: string;
  role: 'customer' | 'loctician' | 'admin' | 'staff';
  first_name: string;
  last_name: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### Service Model
```typescript
interface Service {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  category: string;
  is_active: boolean;
  image_url?: string;
  preparation_instructions?: string;
}
```

### Booking Model
```typescript
interface Booking {
  id: string;
  customer_id: string;
  loctician_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}
```

## Brand Color Palette Constants

```typescript
export const BRAND_COLORS = {
  primary: {
    brown: '#8B5A3C',
    lightBrown: '#A0805A',
    darkBrown: '#6B4423'
  },
  secondary: {
    beige: '#F5F5DC',
    lightBeige: '#FAFAF5',
    warmBeige: '#E8DCC0'
  },
  accent: {
    gold: '#D4A574',
    cream: '#F7F3E9'
  },
  status: {
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3'
  }
};
```

## Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

## Pagination Format

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  }
}
```