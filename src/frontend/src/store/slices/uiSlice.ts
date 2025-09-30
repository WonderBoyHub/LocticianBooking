import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
  duration?: number;
  action?: {
    label: string;
    handler: () => void;
  };
}

interface Modal {
  id: string;
  component: string;
  props?: Record<string, any>;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
}

interface UiState {
  theme: 'light' | 'dark' | 'system';
  language: 'da' | 'en';
  sidebarCollapsed: boolean;
  notifications: Notification[];
  modals: Modal[];
  loading: {
    global: boolean;
    components: Record<string, boolean>;
  };
  breadcrumbs: Array<{
    label: string;
    href?: string;
  }>;
  pageTitle: string;
  isMobile: boolean;
  isOnline: boolean;
}

const initialState: UiState = {
  theme: typeof window !== 'undefined'
    ? (localStorage.getItem('jli_theme') as 'light' | 'dark' | 'system') || 'system'
    : 'system',
  language: typeof window !== 'undefined'
    ? (localStorage.getItem('jli_language') as 'da' | 'en') || 'da'
    : 'da',
  sidebarCollapsed: typeof window !== 'undefined'
    ? localStorage.getItem('jli_sidebar_collapsed') === 'true'
    : false,
  notifications: [],
  modals: [],
  loading: {
    global: false,
    components: {},
  },
  breadcrumbs: [],
  pageTitle: 'JLI Loctician',
  isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('jli_theme', action.payload);
      }
    },
    setLanguage: (state, action: PayloadAction<'da' | 'en'>) => {
      state.language = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('jli_language', action.payload);
      }
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      if (typeof window !== 'undefined') {
        localStorage.setItem('jli_sidebar_collapsed', state.sidebarCollapsed.toString());
      }
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('jli_sidebar_collapsed', action.payload.toString());
      }
    },
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id'>>) => {
      const notification: Notification = {
        id: Date.now().toString(),
        duration: 5000,
        ...action.payload,
      };
      state.notifications.push(notification);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        (notification) => notification.id !== action.payload
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    openModal: (state, action: PayloadAction<Omit<Modal, 'id'>>) => {
      const modal: Modal = {
        id: Date.now().toString(),
        size: 'md',
        closable: true,
        ...action.payload,
      };
      state.modals.push(modal);
    },
    closeModal: (state, action: PayloadAction<string>) => {
      state.modals = state.modals.filter((modal) => modal.id !== action.payload);
    },
    closeTopModal: (state) => {
      state.modals.pop();
    },
    clearModals: (state) => {
      state.modals = [];
    },
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.global = action.payload;
    },
    setComponentLoading: (
      state,
      action: PayloadAction<{ component: string; loading: boolean }>
    ) => {
      state.loading.components[action.payload.component] = action.payload.loading;
    },
    setBreadcrumbs: (
      state,
      action: PayloadAction<Array<{ label: string; href?: string }>>
    ) => {
      state.breadcrumbs = action.payload;
    },
    setPageTitle: (state, action: PayloadAction<string>) => {
      state.pageTitle = action.payload;
      if (typeof window !== 'undefined') {
        document.title = `${action.payload} - JLI Loctician`;
      }
    },
    setIsMobile: (state, action: PayloadAction<boolean>) => {
      state.isMobile = action.payload;
    },
    setIsOnline: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
  },
});

export const {
  setTheme,
  setLanguage,
  toggleSidebar,
  setSidebarCollapsed,
  addNotification,
  removeNotification,
  clearNotifications,
  openModal,
  closeModal,
  closeTopModal,
  clearModals,
  setGlobalLoading,
  setComponentLoading,
  setBreadcrumbs,
  setPageTitle,
  setIsMobile,
  setIsOnline,
} = uiSlice.actions;

export default uiSlice.reducer;

// Selectors
export const selectUiState = (state: { ui: UiState }) => state.ui;
export const selectIsSidebarCollapsed = (state: { ui: UiState }) => state.ui.sidebarCollapsed;
export const selectIsSidebarOpen = (state: { ui: UiState }) => !state.ui.sidebarCollapsed;

// Selectors
export const selectTheme = (state: { ui: UiState }) => state.ui.theme;
export const selectLanguage = (state: { ui: UiState }) => state.ui.language;
export const selectSidebarCollapsed = (state: { ui: UiState }) => state.ui.sidebarCollapsed;
export const selectNotifications = (state: { ui: UiState }) => state.ui.notifications;
export const selectModals = (state: { ui: UiState }) => state.ui.modals;
export const selectLoading = (state: { ui: UiState }) => state.ui.loading;
export const selectBreadcrumbs = (state: { ui: UiState }) => state.ui.breadcrumbs;
export const selectPageTitle = (state: { ui: UiState }) => state.ui.pageTitle;
export const selectIsMobile = (state: { ui: UiState }) => state.ui.isMobile;
export const selectIsOnline = (state: { ui: UiState }) => state.ui.isOnline;
