import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from './index';
import type {
  User,
  Service,
  Appointment,
  Availability,
  ServiceCategory,
  AnalyticsData,
  PageContent,
  ApiResponse,
  FilterOptions,
  BookingFormData,
  InstagramPostDto,
  InstagramPostUpdatePayload,
} from '../types';

// Define the API base URL
const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers, { getState }) => {
      // Get the token from the auth state
      const token = (getState() as RootState).auth.token;

      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }

      headers.set('content-type', 'application/json');
      return headers;
    },
  }),
  tagTypes: [
    'User',
    'Service',
    'ServiceCategory',
    'Appointment',
    'Availability',
    'Analytics',
    'PageContent',
    'InstagramPost',
  ],
  endpoints: (builder) => ({
    // Authentication endpoints
    login: builder.mutation<
      ApiResponse<{ user: User; token: string }>,
      { email: string; password: string }
    >({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['User'],
    }),

    register: builder.mutation<
      ApiResponse<{ user: User; token: string }>,
      { email: string; password: string; name: string; phone?: string }
    >({
      query: (userData) => ({
        url: '/auth/register',
        method: 'POST',
        body: userData,
      }),
      invalidatesTags: ['User'],
    }),

    logout: builder.mutation<ApiResponse<null>, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['User'],
    }),

    // User endpoints
    getCurrentUser: builder.query<ApiResponse<User>, void>({
      query: () => '/auth/me',
      providesTags: ['User'],
    }),

    updateProfile: builder.mutation<
      ApiResponse<User>,
      Partial<User>
    >({
      query: (userData) => ({
        url: '/users/profile',
        method: 'PUT',
        body: userData,
      }),
      invalidatesTags: ['User'],
    }),

    // Service endpoints
    getServices: builder.query<
      ApiResponse<Service[]>,
      { categoryId?: string; locticianId?: string; isActive?: boolean }
    >({
      query: (params) => ({
        url: '/services',
        params,
      }),
      providesTags: ['Service'],
    }),

    getService: builder.query<ApiResponse<Service>, string>({
      query: (id) => `/services/${id}`,
      providesTags: (result, error, id) => [{ type: 'Service', id }],
    }),

    createService: builder.mutation<ApiResponse<Service>, Partial<Service>>({
      query: (serviceData) => ({
        url: '/services',
        method: 'POST',
        body: serviceData,
      }),
      invalidatesTags: ['Service'],
    }),

    updateService: builder.mutation<
      ApiResponse<Service>,
      { id: string; data: Partial<Service> }
    >({
      query: ({ id, data }) => ({
        url: `/services/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Service', id }],
    }),

    deleteService: builder.mutation<ApiResponse<null>, string>({
      query: (id) => ({
        url: `/services/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Service'],
    }),

    // Service categories
    getServiceCategories: builder.query<ApiResponse<ServiceCategory[]>, void>({
      query: () => '/service-categories',
      providesTags: ['ServiceCategory'],
    }),

    // Appointment endpoints
    getAppointments: builder.query<
      ApiResponse<Appointment[]>,
      FilterOptions & { page?: number; limit?: number }
    >({
      query: (params) => ({
        url: '/appointments',
        params,
      }),
      providesTags: ['Appointment'],
    }),

    getAppointment: builder.query<ApiResponse<Appointment>, string>({
      query: (id) => `/appointments/${id}`,
      providesTags: (result, error, id) => [{ type: 'Appointment', id }],
    }),

    createAppointment: builder.mutation<
      ApiResponse<Appointment>,
      BookingFormData
    >({
      query: (appointmentData) => ({
        url: '/appointments',
        method: 'POST',
        body: appointmentData,
      }),
      invalidatesTags: ['Appointment', 'Availability'],
    }),

    updateAppointment: builder.mutation<
      ApiResponse<Appointment>,
      { id: string; data: Partial<Appointment> }
    >({
      query: ({ id, data }) => ({
        url: `/appointments/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Appointment', id },
        'Availability',
      ],
    }),

    cancelAppointment: builder.mutation<
      ApiResponse<Appointment>,
      { id: string; reason?: string }
    >({
      query: ({ id, reason }) => ({
        url: `/appointments/${id}/cancel`,
        method: 'PUT',
        body: { reason },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Appointment', id },
        'Availability',
      ],
    }),

    // Availability endpoints
    getAvailability: builder.query<
      ApiResponse<Availability[]>,
      { locticianId: string; startDate: string; endDate: string }
    >({
      query: (params) => ({
        url: '/availability',
        params,
      }),
      providesTags: ['Availability'],
    }),

    getAvailableSlots: builder.query<
      ApiResponse<{ date: string; slots: string[] }[]>,
      { locticianId: string; serviceId: string; startDate: string; endDate: string }
    >({
      query: (params) => ({
        url: '/availability/slots',
        params,
      }),
      providesTags: ['Availability'],
    }),

    updateAvailability: builder.mutation<
      ApiResponse<Availability>,
      { id: string; data: Partial<Availability> }
    >({
      query: ({ id, data }) => ({
        url: `/availability/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Availability'],
    }),

    createAvailability: builder.mutation<
      ApiResponse<Availability>,
      Partial<Availability>
    >({
      query: (availabilityData) => ({
        url: '/availability',
        method: 'POST',
        body: availabilityData,
      }),
      invalidatesTags: ['Availability'],
    }),

    // Analytics endpoints
    getAnalytics: builder.query<
      ApiResponse<AnalyticsData>,
      { startDate: string; endDate: string; locticianId?: string }
    >({
      query: (params) => ({
        url: '/analytics',
        params,
      }),
      providesTags: ['Analytics'],
    }),

    // CMS endpoints
    getPages: builder.query<ApiResponse<PageContent[]>, void>({
      query: () => '/cms/pages',
      providesTags: ['PageContent'],
    }),

    getPage: builder.query<ApiResponse<PageContent>, string>({
      query: (slug) => `/cms/pages/${slug}`,
      providesTags: (result, error, slug) => [{ type: 'PageContent', id: slug }],
    }),

    updatePage: builder.mutation<
      ApiResponse<PageContent>,
      { id: string; data: Partial<PageContent> }
    >({
      query: ({ id, data }) => ({
        url: `/cms/pages/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'PageContent', id }],
    }),

    // File upload endpoint
    uploadFile: builder.mutation<
      ApiResponse<{ url: string; filename: string }>,
      FormData
    >({
      query: (formData) => ({
        url: '/upload',
        method: 'POST',
        body: formData,
      }),
    }),

    // Instagram endpoints
    getInstagramPosts: builder.query<
      ApiResponse<InstagramPostDto[]>,
      { limit?: number } | void
    >({
      query: (params) => ({
        url: '/instagram/posts',
        params: {
          limit: params?.limit ?? 9,
        },
      }),
      providesTags: ['InstagramPost'],
    }),

    getInstagramPostsAdmin: builder.query<
      ApiResponse<InstagramPostDto[]>,
      { featuredOnly?: boolean } | void
    >({
      query: (params) => ({
        url: '/instagram/posts/admin',
        params: {
          featured_only: params?.featuredOnly,
        },
      }),
      providesTags: ['InstagramPost'],
    }),

    updateInstagramPost: builder.mutation<
      ApiResponse<InstagramPostDto>,
      { id: string; data: InstagramPostUpdatePayload }
    >({
      query: ({ id, data }) => {
        const payload: Record<string, unknown> = {};

        if (data.isFeatured !== undefined) {
          payload.is_featured = data.isFeatured;
        }

        if (data.displayOrder !== undefined) {
          payload.display_order = data.displayOrder;
        }

        return {
          url: `/instagram/posts/${id}`,
          method: 'PUT',
          body: payload,
        };
      },
      invalidatesTags: ['InstagramPost'],
    }),
  }),
});

// Export hooks for usage in functional components
export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useGetCurrentUserQuery,
  useUpdateProfileMutation,
  useGetServicesQuery,
  useGetServiceQuery,
  useCreateServiceMutation,
  useUpdateServiceMutation,
  useDeleteServiceMutation,
  useGetServiceCategoriesQuery,
  useGetAppointmentsQuery,
  useGetAppointmentQuery,
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
  useCancelAppointmentMutation,
  useGetAvailabilityQuery,
  useGetAvailableSlotsQuery,
  useUpdateAvailabilityMutation,
  useCreateAvailabilityMutation,
  useGetAnalyticsQuery,
  useGetPagesQuery,
  useGetPageQuery,
  useUpdatePageMutation,
  useUploadFileMutation,
  useGetInstagramPostsQuery,
  useGetInstagramPostsAdminQuery,
  useUpdateInstagramPostMutation,
} = api;