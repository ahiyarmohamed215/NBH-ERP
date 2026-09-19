import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nbh_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept responses for global error handling & session expiration
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If unauthorized and not on login endpoint, clear token
      if (!window.location.pathname.includes('/login') && !error.config.url.includes('/auth/login')) {
        localStorage.removeItem('nbh_token');
        localStorage.removeItem('nbh_user');
        window.location.reload();
      }
    }
    const message = error.response?.data?.message || error.message || 'An error occurred';
    return Promise.reject(new Error(message));
  }
);

export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  signup: (data) => api.post('/auth/signup', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

export const userApi = {
  getAll: (params) => api.get('/users', { params }),
  getPending: (params) => api.get('/users/pending', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  toggleActive: (id) => api.patch(`/users/${id}/toggle-active`),
  approve: (id, roles) => api.post(`/users/${id}/approve`, { roles }),
  reject: (id) => api.post(`/users/${id}/reject`),
};

export const roleApi = {
  getAll: () => api.get('/roles'),
  getPermissions: () => api.get('/roles/permissions'),
  create: (data) => api.post('/roles', data),
  update: (id, data) => api.put(`/roles/${id}`, data),
  delete: (id) => api.delete(`/roles/${id}`),
};

export const dashboardApi = {
  getSummary: () => api.get('/dashboard/summary'),
};

export const warehouseApi = {
  getAll: () => api.get('/warehouses'),
  getActive: () => api.get('/warehouses/active'),
  getById: (id) => api.get(`/warehouses/${id}`),
  create: (data) => api.post('/warehouses', data),
  update: (id, data) => api.put(`/warehouses/${id}`, data),
  toggleActive: (id) => api.patch(`/warehouses/${id}/toggle-active`),
};

export const categoryApi = {
  getAll: () => api.get('/categories'),
  getActive: () => api.get('/categories/active'),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  toggleActive: (id) => api.patch(`/categories/${id}/toggle-active`),
};

export const productApi = {
  getProducts: (params) => api.get('/products', { params }),
  searchActive: (query) => api.get('/products/search', { params: { query } }),
  getByBarcode: (barcode) => api.get(`/products/barcode/${barcode}`),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  toggleActive: (id) => api.patch(`/products/${id}/toggle-active`),
};

export const customerApi = {
  getAll: () => api.get('/customers'),
  getActive: () => api.get('/customers/active'),
  search: (query) => api.get('/customers/search', { params: { query } }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  toggleActive: (id) => api.patch(`/customers/${id}/toggle-active`),
};

export const supplierApi = {
  getAll: () => api.get('/suppliers'),
  getActive: () => api.get('/suppliers/active'),
  search: (query) => api.get('/suppliers/search', { params: { query } }),
  getById: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  toggleActive: (id) => api.patch(`/suppliers/${id}/toggle-active`),
};

export const salesmanApi = {
  getAll: () => api.get('/salesmen'),
  getActive: () => api.get('/salesmen/active'),
  create: (data) => api.post('/salesmen', data),
  update: (id, data) => api.put(`/salesmen/${id}`, data),
  toggleActive: (id) => api.patch(`/salesmen/${id}/toggle-active`),
};

export const inventoryApi = {
  getBalances: (params) => api.get('/inventory/balances', { params }),
  getWarehouseStock: (whId) => api.get(`/inventory/warehouse/${whId}`),
  getLowStock: (whId) => api.get('/inventory/low-stock', { params: { warehouseId: whId } }),
  getLedger: (params) => api.get('/inventory/ledger', { params }),
};

export const grnApi = {
  search: (params) => api.get('/grns', { params }),
  getById: (id) => api.get(`/grns/${id}`),
  create: (data, process = false) => api.post(`/grns?process=${process}`, data),
  process: (id) => api.post(`/grns/${id}/process`),
  cancel: (id) => api.post(`/grns/${id}/cancel`),
};

export const gtnApi = {
  search: (params) => api.get('/gtns', { params }),
  getById: (id) => api.get(`/gtns/${id}`),
  create: (data, transfer = false) => api.post(`/gtns?transfer=${transfer}`, data),
  transfer: (id) => api.post(`/gtns/${id}/transfer`),
  cancel: (id) => api.post(`/gtns/${id}/cancel`),
};

export const prnApi = {
  search: (params) => api.get('/purchase-returns', { params }),
  getById: (id) => api.get(`/purchase-returns/${id}`),
  create: (data, process = false) => api.post(`/purchase-returns?process=${process}`, data),
  process: (id) => api.post(`/purchase-returns/${id}/process`),
  cancel: (id) => api.post(`/purchase-returns/${id}/cancel`),
};

export const adjustmentApi = {
  search: (params) => api.get('/stock-adjustments', { params }),
  getById: (id) => api.get(`/stock-adjustments/${id}`),
  create: (data, process = false) => api.post(`/stock-adjustments?process=${process}`, data),
  process: (id) => api.post(`/stock-adjustments/${id}/process`),
  reject: (id) => api.post(`/stock-adjustments/${id}/reject`),
};

export const salesApi = {
  search: (params) => api.get('/invoices', { params }),
  getHeld: (cashier) => api.get('/invoices/held', { params: cashier ? { cashier } : {} }),
  getCashierAccounting: (params) => api.get('/invoices/accounting/cashiers', { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  getByNumber: (number) => api.get(`/invoices/number/${number}`),
  create: (data) => api.post('/invoices', data),
  resumeHeld: (id, data) => api.post(`/invoices/held/${id}/resume`, data),
  cancelHeld: (id) => api.post(`/invoices/held/${id}/cancel`),
};

export const salesReturnApi = {
  search: (params) => api.get('/sales-returns', { params }),
  getById: (id) => api.get(`/sales-returns/${id}`),
  create: (data) => api.post('/sales-returns', data),
};

export const reportApi = {
  getSalesSummary: (startDate, endDate) =>
    api.get('/reports/sales-summary', { params: { startDate, endDate } }),
  getInventoryValuation: (warehouseId) =>
    api.get('/reports/inventory-valuation', { params: { warehouseId } }),
  getExcelDownloadUrl: (warehouseId) =>
    `/api/v1/reports/inventory/excel${warehouseId ? '?warehouseId=' + warehouseId : ''}`,
};

export const pdfApi = {
  getInvoicePdfUrl: (id) => `/api/v1/pdf/invoices/${id}`,
  getGrnPdfUrl: (id) => `/api/v1/pdf/grns/${id}`,
};

export default api;
