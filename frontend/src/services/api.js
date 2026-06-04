import axios from 'axios';

const normalizeBaseUrl = (value = '') => value.replace(/\/+$/, '');

const getApiBaseUrl = () => {
  const configuredBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || '/api');

  if (typeof window === 'undefined') {
    return configuredBaseUrl;
  }

  const isUsingRelativeApiPath = configuredBaseUrl === '/api';
  const isLocalBrowser = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const isFrontendDevServer = import.meta.env.DEV || ['5173', '5174'].includes(window.location.port);

  // In local development, call the backend directly so requests do not depend on the Vite proxy.
  if (isUsingRelativeApiPath && isLocalBrowser && isFrontendDevServer) {
    return `${window.location.protocol}//${window.location.hostname}:5003/api`;
  }

  return configuredBaseUrl;
};

const API_BASE_URL = getApiBaseUrl();
export const API_ROOT_URL = API_BASE_URL.replace(/\/api\/?$/, '');

export const resolveBackendUrl = (path = '') => {
  if (!path) return API_ROOT_URL || '';
  if (/^https?:\/\//i.test(path)) return path;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_ROOT_URL}${normalizedPath}`;
};

export const resolveUploadUrl = (path = '') => {
  if (!path) return null;

  const appendUploadToken = (uploadUrl) => {
    const token = getStoredAuthToken();
    if (!token || uploadUrl.includes('token=')) return uploadUrl;

    const separator = uploadUrl.includes('?') ? '&' : '?';
    return `${uploadUrl}${separator}token=${encodeURIComponent(token)}`;
  };

  if (/^https?:\/\//i.test(path)) {
    return path.includes('/uploads/') ? appendUploadToken(path) : path;
  }

  const normalizedPath = path.startsWith('/uploads/')
    ? path
    : `/uploads/${path.replace(/^\/+/, '')}`;

  const uploadUrl = resolveBackendUrl(normalizedPath);
  return appendUploadToken(uploadUrl);
};

export const workspaceService = {
  health: () => axios.get(resolveBackendUrl('/health'), { timeout: 6000 })
};

export const getReadableApiError = (error, fallbackMessage = 'Request failed.') => {
  if (error?.response?.data?.error) return error.response.data.error;
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.message === 'Network Error') {
    return 'Cannot reach the server. Make sure the backend is running and VITE_API_BASE_URL is correct.';
  }
  if (error?.message) return error.message;
  return fallbackMessage;
};

export const getStoredAuthToken = () => localStorage.getItem('token') || sessionStorage.getItem('token');
export const clearStoredAuthToken = () => {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
};

const getToken = () => getStoredAuthToken();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

const isAuthRoute = (url = '') => url.includes('/auth/login') || url.includes('/auth/register');

// Add token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthRoute(error.config?.url)) {
      clearStoredAuthToken();

      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Auth Service
export const authService = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  verifyLoginOtp: (data) => apiClient.post('/auth/verify-login-otp', data),
  getProfile: () => apiClient.get('/auth/profile'),
  updateProfile: (data) => apiClient.put('/auth/profile', data),
  changePassword: (data) => apiClient.put('/auth/change-password', data),
  listUsers: () => apiClient.get('/auth/users'),
  createUser: (data) => apiClient.post('/auth/users', data),
  updateUserStatus: (id, isActive) => apiClient.put(`/auth/users/${id}/status`, { is_active: isActive }),
  resetUserPassword: (id, newPassword) => apiClient.put(`/auth/users/${id}/password`, { newPassword }),
  verifyEmail: (token) => apiClient.get(`/auth/verify-email?token=${encodeURIComponent(token)}`),
  forgotPassword: (data) => apiClient.post('/auth/forgot-password', data),
  resetPassword: (data) => apiClient.post('/auth/reset-password', data),
  resetPasswordOtp: (data) => apiClient.post('/auth/reset-password-otp', data),
  uploadProfilePicture: (file) => {
    const formData = new FormData();
    formData.append('profile_picture', file);

    return apiClient.post('/auth/profile-picture', formData);
  }
};

export const auditService = {
  getLogs: (limit = 200) => apiClient.get('/audit-logs', { params: { limit } })
};

export const systemService = {
  getBackupStatus: () => apiClient.get('/system/backups/status'),
  runBackup: () => apiClient.post('/system/backups/run'),
  verifyBackup: () => apiClient.post('/system/backups/verify'),
  restoreBackup: (backup) => apiClient.post('/system/backups/restore', { backup }),
  getMessagingStatus: () => apiClient.get('/system/messaging/status')
};

// Buildings Service
export const buildingService = {
  getAll: () => apiClient.get('/buildings'),
  getById: (id) => apiClient.get(`/buildings/${id}`),
  create: (data) => apiClient.post('/buildings', data),
  update: (id, data) => apiClient.put(`/buildings/${id}`, data),
  delete: (id) => apiClient.delete(`/buildings/${id}`)
};

// Units Service
export const unitService = {
  getAll: () => apiClient.get('/units'),
  getById: (id) => apiClient.get(`/units/${id}`),
  getByBuilding: (buildingId) => apiClient.get(`/units/building/${buildingId}`),
  create: (data) => apiClient.post('/units', data),
  update: (id, data) => apiClient.put(`/units/${id}`, data),
  delete: (id) => apiClient.delete(`/units/${id}`)
};

// Tenants Service
export const tenantService = {
  getAll: () => apiClient.get('/tenants'),
  getById: (id) => apiClient.get(`/tenants/${id}`),
  getLedger: (id) => apiClient.get(`/tenants/${id}/ledger`),
  createFollowUp: (id, data) => apiClient.post(`/tenants/${id}/followups`, data),
  updateFollowUp: (id, data) => apiClient.put(`/tenants/followups/${id}`, data),
  getByBuilding: (buildingId) => apiClient.get(`/tenants/building/${buildingId}`),
  getReminderEvents: () => apiClient.get('/tenants/reminders/events'),
  create: (data) => {
    // If a file is present, use FormData
    if (data.identification_document_file) {
      const formData = new FormData();
      Object.keys(data).forEach((key) => {
        if (key === 'identification_document_file' && data[key]) {
          formData.append('identification_document_file', data[key]);
        } else {
          formData.append(key, data[key]);
        }
      });
      return apiClient.post('/tenants', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return apiClient.post('/tenants', data);
  },
  update: (id, data) => {
    if (data.identification_document_file) {
      const formData = new FormData();
      Object.keys(data).forEach((key) => {
        if (key === 'identification_document_file' && data[key]) {
          formData.append('identification_document_file', data[key]);
        } else {
          formData.append(key, data[key]);
        }
      });
      return apiClient.put(`/tenants/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return apiClient.put(`/tenants/${id}`, data);
  },
  delete: (id) => apiClient.delete(`/tenants/${id}`)
};

// Contracts Service
export const contractService = {
  getAll: (params) => apiClient.get('/contracts', { params }),
  getByTenant: (tenantId) => apiClient.get(`/contracts/tenant/${tenantId}`),
  create: (data) => {
    const formData = new FormData();
    formData.append('tenant_id', data.tenant_id);
    formData.append('unit_id', data.unit_id);
    formData.append('contract_start', data.contract_start);
    formData.append('contract_end', data.contract_end);
    formData.append('notes', data.notes || '');

    if (data.contract_file) {
      formData.append('contract_file', data.contract_file);
    }

    return apiClient.post('/contracts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  update: (id, data) => {
    const formData = new FormData();
    formData.append('tenant_id', data.tenant_id);
    formData.append('unit_id', data.unit_id);
    formData.append('contract_start', data.contract_start);
    formData.append('contract_end', data.contract_end);
    formData.append('notes', data.notes || '');

    if (data.contract_file) {
      formData.append('contract_file', data.contract_file);
    }

    return apiClient.put(`/contracts/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  terminate: (id, data) => apiClient.put(`/contracts/${id}/terminate`, data),
  delete: (id) => apiClient.delete(`/contracts/${id}`)
};

// Calendar Events Service
export const calendarEventService = {
  getAll: () => apiClient.get('/calendar-events'),
  create: (data) => apiClient.post('/calendar-events', data),
  update: (id, data) => apiClient.put(`/calendar-events/${id}`, data),
  delete: (id) => apiClient.delete(`/calendar-events/${id}`)
};

// Payments Service
export const paymentService = {
  getAll: () => apiClient.get('/payments'),
  getById: (id) => apiClient.get(`/payments/${id}`),
  getByTenant: (tenantId) => apiClient.get(`/payments/tenant/${tenantId}`),
  getByBuilding: (buildingId) => apiClient.get(`/payments/building/${buildingId}`),
  generateIncomeReport: (filters) => apiClient.get('/payments/report', { params: filters }),
  exportIncomeReportPDF: (filters) => apiClient.get('/payments/report/pdf', { params: filters, responseType: 'blob' }),
  confirm: (id) => apiClient.put(`/payments/${id}/confirm`),
  confirmPayment: (id) => apiClient.put(`/payments/${id}/confirm`),
  rejectPayment: (id, rejection_reason) => apiClient.put(`/payments/${id}/reject`, { rejection_reason }),
  markReceiptPrinted: (id) => apiClient.put(`/payments/${id}/receipt-printed`),
  create: (data) => {
    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      if (key === 'receipt' && data[key]) {
        formData.append(key, data[key]);
      } else {
        formData.append(key, data[key]);
      }
    });
    return apiClient.post('/payments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  update: (id, data) => {
    const hasFile = data?.receipt instanceof File;
    if (!hasFile) {
      return apiClient.put(`/payments/${id}`, data);
    }

    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && data[key] !== null) {
        formData.append(key, data[key]);
      }
    });

    return apiClient.put(`/payments/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  delete: (id) => apiClient.delete(`/payments/${id}`),
  exportByBuilding: (buildingId) => apiClient.get(`/payments/building/${buildingId}/export`, { responseType: 'blob' })
};

// Dashboard Service
export const dashboardService = {
  getSummary: () => apiClient.get('/dashboard/summary'),
  getMonthlyIncome: () => apiClient.get('/dashboard/monthly-income'),
  getUnpaidTenants: () => apiClient.get('/dashboard/unpaid-tenants'),
  getOccupancyReport: () => apiClient.get('/dashboard/occupancy'),
  getBuildingPerformance: () => apiClient.get('/dashboard/building-performance'),
  getProfitTrends: () => apiClient.get('/dashboard/profit-trends'),
  getMonthlyExpectedIncome: () => apiClient.get('/dashboard/monthly-expected-income'),
  getTenantPaymentHistory: (tenantId) => apiClient.get(`/dashboard/tenant-payment-history/${tenantId}`)
};

// Team Chat Service
export const chatService = {
  getUsers: () => apiClient.get('/chat/users'),
  getMessages: (params = {}) => apiClient.get('/chat/messages', { params: { limit: 80, ...params } }),
  sendMessage: (message, options = {}) => apiClient.post('/chat/messages', { message, ...options })
};

export const expenseService = {
  getAll: () => apiClient.get('/expenses'),
  create: (data) => apiClient.post('/expenses', data),
  remove: (id) => apiClient.delete(`/expenses/${id}`)
};

export default apiClient;
