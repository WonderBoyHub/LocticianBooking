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
  RegisterRequest,
  RegisterApiResponse,
  InstagramPostDto,
  InstagramPostUpdatePayload,
  CmsPage,
  CmsPageSummary,
  MediaAsset,
  MediaAssetAdmin,
  PasswordResetRequestPayload,
  PasswordResetConfirmPayload,
} from '../types';

// Define the API base URL
const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const mapMediaAsset = (item: any): MediaAsset => ({
  id: item.id,
  url: item.url ?? item.public_url ?? item.media_url ?? item.file_path,
  originalFilename: item.original_filename,
  mimeType: item.mime_type,
  fileSize: item.file_size,
  altText: item.alt_text,
  caption: item.caption,
  isFeatured: item.is_featured,
  displayOrder: item.display_order,
  isPublished: item.is_published,
  publishedAt: item.published_at,
});

const mapMediaAssetAdmin = (item: any): MediaAssetAdmin => ({
  ...mapMediaAsset(item),
  filename: item.filename,
  filePath: item.file_path,
  fileSizeMb: item.file_size_mb,
  uploadedBy: item.uploaded_by,
  uploadedAt: item.uploaded_at,
});

const mapCmsPageSummary = (item: any): CmsPageSummary => ({
  id: item.id,
  title: item.title,
  slug: item.slug,
  pageType: item.page_type,
  isPublished: item.is_published,
  publishedAt: item.published_at,
  updatedAt: item.updated_at,
});

const mapCmsPage = (item: any): CmsPage => ({
  ...mapCmsPageSummary(item),
  content: item.content,
  excerpt: item.excerpt,
  metaTitle: item.meta_title,
  metaDescription: item.meta_description,
  metaKeywords: item.meta_keywords ?? undefined,
  gdprVersion: item.gdpr_version,
  heroMedia: item.hero_media ? mapMediaAsset(item.hero_media) : null,
});

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

      headers.set('accept', 'application/json');
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
    'CmsPage',
    'Media',
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

    register: builder.mutation<RegisterApiResponse, RegisterRequest>({
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

    requestPasswordReset: builder.mutation<{ message: string }, PasswordResetRequestPayload>({
      query: (payload) => ({
        url: '/auth/request-password-reset',
        method: 'POST',
        body: payload,
      }),
    }),

    resetPassword: builder.mutation<{ message: string }, PasswordResetConfirmPayload>({
      query: (payload) => ({
        url: '/auth/reset-password',
        method: 'POST',
        body: {
          token: payload.token,
          new_password: payload.newPassword,
          confirm_password: payload.confirmPassword,
        },
      }),
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

    // Legacy file upload endpoint
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

    // CMS endpoints
    getCmsPages: builder.query<CmsPageSummary[], { pageType?: string } | void>({
      query: (params) => ({
        url: '/cms/pages',
        params: params?.pageType ? { page_type: params.pageType } : undefined,
      }),
      transformResponse: (response: { data: any[] }) =>
        response.data?.map(mapCmsPageSummary) ?? [],
      providesTags: (result) =>
        result
          ? [
              ...result.map((page) => ({ type: 'CmsPage' as const, id: page.slug })),
              { type: 'CmsPage' as const, id: 'LIST' },
            ]
          : [{ type: 'CmsPage' as const, id: 'LIST' }],
    }),

    getCmsPage: builder.query<CmsPage, string>({
      query: (slug) => `/cms/pages/${slug}`,
      transformResponse: (response: { data: any }) => mapCmsPage(response.data),
      providesTags: (result, error, slug) => [{ type: 'CmsPage', id: slug }],
    }),

    // Media library endpoints
    getFeaturedMedia: builder.query<MediaAsset[], number | void>({
      query: (limit) => ({
        url: '/media/featured',
        params: { limit: limit ?? 12 },
      }),
      transformResponse: (response: { data: any[] }) =>
        response.data?.map(mapMediaAsset) ?? [],
      providesTags: ['Media'],
    }),

    getMediaLibrary: builder.query<MediaAssetAdmin[], void>({
      query: () => '/media',
      transformResponse: (response: { data: any[] }) =>
        response.data?.map(mapMediaAssetAdmin) ?? [],
      providesTags: ['Media'],
    }),

    uploadMediaAsset: builder.mutation<
      MediaAssetAdmin,
      {
        file: File;
        altText?: string;
        caption?: string;
        isFeatured?: boolean;
        displayOrder?: number;
        isPublished?: boolean;
      }
    >({
      query: ({ file, altText, caption, isFeatured, displayOrder, isPublished }) => {
        const formData = new FormData();
        formData.append('file', file);
        if (altText) formData.append('alt_text', altText);
        if (caption) formData.append('caption', caption);
        if (typeof isFeatured === 'boolean') {
          formData.append('is_featured', String(isFeatured));
        }
        if (typeof displayOrder === 'number') {
          formData.append('display_order', displayOrder.toString());
        }
        if (typeof isPublished === 'boolean') {
          formData.append('is_published', String(isPublished));
        }

        return {
          url: '/media/upload',
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: ['Media'],
    }),

    updateMediaAsset: builder.mutation<
      MediaAssetAdmin,
      {
        id: string;
        data: Partial<{
          altText: string | null;
          caption: string | null;
          isFeatured: boolean;
          displayOrder: number;
          isPublished: boolean;
        }>;
      }
    >({
      query: ({ id, data }) => {
        const payload: Record<string, unknown> = {};
        if (data.altText !== undefined) payload.alt_text = data.altText;
        if (data.caption !== undefined) payload.caption = data.caption;
        if (data.isFeatured !== undefined) payload.is_featured = data.isFeatured;
        if (data.displayOrder !== undefined) payload.display_order = data.displayOrder;
        if (data.isPublished !== undefined) payload.is_published = data.isPublished;

        return {
          url: `/media/${id}`,
          method: 'PUT',
          body: payload,
        };
      },
      invalidatesTags: ['Media'],
    }),

    deleteMediaAsset: builder.mutation<{ success: boolean } | void, string>({
      query: (id) => ({
        url: `/media/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Media'],
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
  useRequestPasswordResetMutation,
  useResetPasswordMutation,
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
  useGetCmsPagesQuery,
  useGetCmsPageQuery,
  useGetFeaturedMediaQuery,
  useGetMediaLibraryQuery,
  useUploadMediaAssetMutation,
  useUpdateMediaAssetMutation,
  useDeleteMediaAssetMutation,
  useGetInstagramPostsQuery,
  useGetInstagramPostsAdminQuery,
  useUpdateInstagramPostMutation,
} = api;