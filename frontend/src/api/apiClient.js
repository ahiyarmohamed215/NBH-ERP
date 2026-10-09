import axios from 'axios';

const API_ORIGIN = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');

const api = axios.create({
  baseURL: `${API_ORIGIN}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token automatically
api.interceptors.request.use((config) => {
  if (['post','put','patch'].includes(config.method?.toLowerCase()) && !config.headers['Idempotency-Key']) config.headers['Idempotency-Key'] = crypto.randomUUID();
  const token = localStorage.getItem('nbh_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Helper to explicitly broadcast data change to all pages/views
export const broadcastDataChange = (entityType, detail = {}) => {
  if (typeof window !== 'undefined') {
    const payload = { entityType, ...detail, timestamp: Date.now() };
    window.dispatchEvent(new CustomEvent('erp:data_changed', { detail: payload }));
    if (entityType) {
      window.dispatchEvent(new CustomEvent(`erp:${entityType}_updated`, { detail: payload }));
    }
  }
};

// Intercept responses for global error handling, session expiration & data synchronization
api.interceptors.response.use(
  (response) => {
    // If request was a mutation (POST, PUT, PATCH, DELETE), broadcast real-time update
    const method = response.config?.method?.toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      const url = response.config?.url || '';
      if (typeof window !== 'undefined') {
        const payload = { url, method, timestamp: Date.now() };
        window.dispatchEvent(new CustomEvent('erp:data_changed', { detail: payload }));

        if (url.includes('/roles')) {
          window.dispatchEvent(new CustomEvent('erp:roles_updated', { detail: payload }));
        }
        if (url.includes('/users')) {
          window.dispatchEvent(new CustomEvent('erp:users_updated', { detail: payload }));
        }
        if (url.includes('/customers') || url.includes('/customer-groups') || url.includes('/routes') || url.includes('/customer-targets')) {
          window.dispatchEvent(new CustomEvent('erp:customers_updated', { detail: payload }));
          window.dispatchEvent(new CustomEvent('erp:targets_updated', { detail: payload }));
        }
        if (url.includes('/products') || url.includes('/inventory') || url.includes('/warehouses') || url.includes('/stock') || url.includes('/categories') || url.includes('/brands') || url.includes('/adjustments')) {
          window.dispatchEvent(new CustomEvent('erp:inventory_updated', { detail: payload }));
        }
        if (url.includes('/invoices') || url.includes('/sales') || url.includes('/quotations') || url.includes('/payments')) {
          window.dispatchEvent(new CustomEvent('erp:sales_updated', { detail: payload }));
        }
        if (url.includes('/suppliers') || url.includes('/purchase') || url.includes('/grn') || url.includes('/gtn') || url.includes('/prn')) {
          window.dispatchEvent(new CustomEvent('erp:purchasing_updated', { detail: payload }));
        }
        if (url.includes('/delivery') || url.includes('/deliveries') || url.includes('/vehicles')) {
          window.dispatchEvent(new CustomEvent('erp:delivery_updated', { detail: payload }));
        }
      }
    }
    return response.data;
  },
  async (error) => {
    const config = error.config;
    if (error.response?.status === 401 && config && !config._retried && !config.url?.startsWith('/auth/')) {
      config._retried = true;
      try { await refreshSession(); return api(config); }
      catch (refreshError) { if (refreshError.response?.status === 401 || !localStorage.getItem('nbh_refresh')) expireSession(); throw refreshError; }
    }
    error.message = error.response?.data?.message || error.message || 'Request failed';
    error.status = error.response?.status;
    error.fieldErrors = error.response?.data?.errors || [];
    if (error.response?.status === 401 && !config?.url?.includes('/auth/login')) expireSession();
    if (!config?.url?.startsWith('/auth/')) window.dispatchEvent(new CustomEvent('erp:api_error', { detail: error.message }));
    return Promise.reject(error);
  }
);

const expireSession = () => {
  ['nbh_token','nbh_refresh','nbh_user'].forEach(key => localStorage.removeItem(key));
  sessionStorage.setItem('nbh_session_expired', 'Your session has expired. Please sign in again.');
  window.dispatchEvent(new CustomEvent('nbh:session_expired'));
};
let refreshPromise;
export const refreshSession = () => {
  if (!refreshPromise) {
    const previous = localStorage.getItem('nbh_token');
    const perform = async () => {
      if (localStorage.getItem('nbh_token') !== previous && localStorage.getItem('nbh_token')) return;
      const refreshToken = localStorage.getItem('nbh_refresh');
      if (!refreshToken) { expireSession(); throw new Error('Please sign in again'); }
      const res = await axios.post(`${API_ORIGIN}/api/v1/auth/refresh`, { refreshToken }, { timeout: 30000 });
      localStorage.setItem('nbh_token', res.data.data.accessToken);
      localStorage.setItem('nbh_refresh', res.data.data.refreshToken);
    };
    refreshPromise = (navigator.locks ? navigator.locks.request('erp-refresh', perform) : perform())
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};
// Exhaust pages for existing local-filter tables and complete exports; never silently truncate at page 1.
export const fetchAllPages = async (url, params = {}) => {
  let content = [], page = 0, result;
  do {
    result = await api.get(url, { params: { ...params, page, size: 200, sort: params.sort || 'id,asc' } });
    if (!Array.isArray(result.data?.content)) return result;
    content.push(...result.data.content);
    page += 1;
  } while (page < result.data.totalPages);
  return { ...result, data: { ...result.data, content, totalElements: content.length } };
};
export const purchaseOrderApi = {
  search: (params) => fetchAllPages('/purchase-orders', params),
  create: (data) => api.post('/purchase-orders', data),
  update: (id, data) => api.put(`/purchase-orders/${id}`, data),
  approve: (id) => api.post(`/purchase-orders/${id}/approve`),
  cancel: (id) => api.post(`/purchase-orders/${id}/cancel`),
};
export const downloadAuthenticated = async (url, filename) => {
  const res = await api.get(url, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(res);
  const link = document.createElement('a'); link.href = blobUrl; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
};

export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  signup: (data) => api.post('/auth/signup', data),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

export const userApi = {
  getAll: (params) => fetchAllPages('/users', params),
  getPending: (params) => fetchAllPages('/users/pending', params),
  getPendingCount: () => api.get('/users/pending/count'),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  toggleActive: (id) => api.patch(`/users/${id}/toggle-active`),
  approve: (id, dataOrRoles) => {
    const payload = Array.isArray(dataOrRoles) ? { roles: dataOrRoles } : (dataOrRoles || {});
    return api.post(`/users/${id}/approve`, payload);
  },
  reject: (id) => api.post(`/users/${id}/reject`),
  delete: (id) => api.delete(`/users/${id}`),
};

export const roleApi = {
  getAll: (params) => api.get('/roles', { params }),
  search: (query) => api.get('/roles/search', { params: { query } }),
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
  delete: (id) => api.delete(`/warehouses/${id}`),
};

export const categoryApi = {
  getAll: () => api.get('/categories'),
  getActive: () => api.get('/categories/active'),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  toggleActive: (id) => api.patch(`/categories/${id}/toggle-active`),
  delete: (id) => api.delete(`/categories/${id}`),
};

export const brandApi = {
  getAll: () => api.get('/brands'),
  getActive: () => api.get('/brands/active'),
  search: (query) => api.get('/brands/search', { params: { query } }),
  getById: (id) => api.get(`/brands/${id}`),
  create: (data) => api.post('/brands', data),
  update: (id, data) => api.put(`/brands/${id}`, data),
  toggleActive: (id) => api.patch(`/brands/${id}/toggle-active`),
  delete: (id) => api.delete(`/brands/${id}`),
};

export const productApi = {
  getProducts: (params) => fetchAllPages('/products', params),
  searchActive: (query) => api.get('/products/search', { params: { query } }),
  getByBarcode: (barcode) => api.get(`/products/barcode/${barcode}`),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  toggleActive: (id) => api.patch(`/products/${id}/toggle-active`),
  delete: (id) => api.delete(`/products/${id}`),
};

export const customerApi = {
  getAll: () => api.get('/customers'),
  getActive: () => api.get('/customers/active'),
  search: (query) => api.get('/customers/search', { params: { query } }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  toggleActive: (id) => api.patch(`/customers/${id}/toggle-active`),
  delete: (id) => api.delete(`/customers/${id}`),
};

export const customerTargetApi = {
  getAll: (activeOnly = false) => api.get('/customer-targets', { params: { activeOnly } }),
  getById: (id) => api.get(`/customer-targets/${id}`),
  getCustomerProgress: (customerId) => api.get(`/customer-targets/customer/${customerId}/progress`),
  create: (data) => api.post('/customer-targets', data),
  update: (id, data) => api.put(`/customer-targets/${id}`, data),
  toggleActive: (id) => api.patch(`/customer-targets/${id}/toggle-active`),
  delete: (id) => api.delete(`/customer-targets/${id}`),
};

export const supplierApi = {
  getAll: () => api.get('/suppliers'),
  getActive: () => api.get('/suppliers/active'),
  search: (query) => api.get('/suppliers/search', { params: { query } }),
  getById: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  toggleActive: (id) => api.patch(`/suppliers/${id}/toggle-active`),
  delete: (id) => api.delete(`/suppliers/${id}`),
};

export const salesmanApi = {
  getAll: () => api.get('/users/sales-reps'),
  getActive: () => api.get('/users/sales-reps'),
  getPosStaff: () => api.get('/users/pos-staff'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  toggleActive: (id) => api.patch(`/users/${id}/toggle-active`),
};

export const inventoryApi = {
  getBalances: (params) => api.get('/inventory/balances', { params }),
  getWarehouseStock: (whId) => api.get(`/inventory/warehouse/${whId}`),
  getLowStock: (whId) => api.get('/inventory/low-stock', { params: { warehouseId: whId } }),
  getLedger: (params) => api.get('/inventory/ledger', { params }),
  getProductStock: (whId, prodId) => api.get(`/inventory/warehouse/${whId}/product/${prodId}`),
};

export const staffQuotaApi = {
  search: (params) => api.get('/inventory/staff-quotas', { params }),
  getSummary: () => api.get('/inventory/staff-quotas/summary'),
  getById: (id) => api.get(`/inventory/staff-quotas/${id}`),
  check: (params) => api.get('/inventory/staff-quotas/check', { params }),
  getProductStock: (productId, warehouseId) => api.get(`/inventory/staff-quotas/product-stock/${productId}`, { params: { warehouseId } }),
  create: (data) => api.post('/inventory/staff-quotas', data),
  update: (id, data) => api.put(`/inventory/staff-quotas/${id}`, data),
  delete: (id) => api.delete(`/inventory/staff-quotas/${id}`),
};

export const grnApi = {
  search: (params) => api.get('/grns', { params }),
  getById: (id) => api.get(`/grns/${id}`),
  create: (data, process = false) => api.post(`/grns?process=${process}`, data),
  update: (id, data, process = false) => api.put(`/grns/${id}?process=${process}`, data),
  process: (id) => api.post(`/grns/${id}/process`),
  cancel: (id, data) => api.post(`/grns/${id}/cancel`, data),
  delete: (id) => api.delete(`/grns/${id}`),
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
  completeHeld: (ids) => api.post('/invoices/complete-held', { ids }),
  search: (params) => fetchAllPages('/invoices', params),
  getHeld: (cashier) => api.get('/invoices/held', { params: cashier ? { cashier } : {} }),
  getCashierSalesSummary: (params) => api.get('/invoices/cashiers/summary', { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  getByNumber: (number) => api.get(`/invoices/number/${number}`),
  create: (data) => api.post('/invoices', data),
  resumeHeld: (id, data) => api.post(`/invoices/held/${id}/resume`, data),
  cancelHeld: (id) => api.post(`/invoices/held/${id}/cancel`),
  deleteHeld: (id) => api.delete(`/invoices/held/${id}`),
  deleteHeldByNumber: (number) => api.delete(`/invoices/held/number/${number}`),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  updateByNumber: (number, data) => api.put(`/invoices/number/${number}`, data),
  void: (id, reason) => api.post(`/invoices/${id}/void`, null, { params: { reason } }),
  voidByNumber: (number, reason) => api.post(`/invoices/number/${number}/void`, null, { params: { reason } }),
  delete: (id) => api.delete(`/invoices/${id}`),
  deleteByNumber: (number) => api.delete(`/invoices/number/${number}`),
};

export const salesReturnApi = {
  search: (params) => fetchAllPages('/sales-returns', params),
  getById: (id) => api.get(`/sales-returns/${id}`),
  create: (data) => api.post('/sales-returns', data),
};

export const paymentApi = {
  search: (params) => fetchAllPages('/payments', params),
  getById: (id) => api.get(`/payments/${id}`),
  create: (data) => api.post('/payments', data),
  createAdvance: (data) => api.post('/payments', { ...data, paymentType: 'ADVANCE' }),
  allocate: (id, data) => api.post(`/payments/${id}/allocations`, data),
  void: (id, reason) => api.post(`/payments/${id}/void`, null, { params: { reason } }),
};

export const quotationApi = {
  search: (params) => fetchAllPages('/quotations', params),
  getById: (id) => api.get(`/quotations/${id}`),
  create: (data) => api.post('/quotations', data),
  update: (id, data) => api.put(`/quotations/${id}`, data),
  delete: (id) => api.delete(`/quotations/${id}`),
  convertToInvoice: (id, warehouseId) =>
    api.post(`/quotations/${id}/convert-to-invoice`, null, { params: warehouseId ? { warehouseId } : {} }),
};

export const auditApi = {
  search: (params) => api.get('/audit-logs', { params }),
  getLogs: (params) => api.get('/audit-logs', { params }),
  getDaySummary: (date) => api.get('/reports/day-summary', { params: date ? { date } : {} }),
};

export const reportApi = {
  getDaySummary: (date) =>
    api.get('/reports/day-summary', { params: date ? { date } : {} }),
  getSalesSummary: (startDate, endDate) =>
    api.get('/reports/sales-summary', { params: { startDate, endDate } }),
  getInventoryValuation: (warehouseId) =>
    api.get('/reports/inventory-valuation', { params: { warehouseId } }),
  getOutstandingPayments: () =>
    api.get('/reports/outstanding-payments'),
  getExcelDownloadUrl: (warehouseId) =>
    `${API_ORIGIN}/api/v1/reports/inventory/excel${warehouseId ? '?warehouseId=' + warehouseId : ''}`,
};

export const printPdfDocument = async (pdfUrl) => {
  try {
    const token = localStorage.getItem('nbh_token');
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Fetch PDF blob with Authorization header to prevent 401 Unauthorized
    const data = await api.get(pdfUrl, { responseType: 'blob' });
    const response = { ok: true, blob: async () => data };
    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.message || `Failed to fetch document (${response.status})`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    let iframe = document.getElementById('pdf-silent-printer');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'pdf-silent-printer';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    if (iframe.dataset.blobUrl) URL.revokeObjectURL(iframe.dataset.blobUrl);
    iframe.dataset.blobUrl = blobUrl;
    iframe.src = blobUrl;
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (err) {
          const win = window.open(blobUrl, '_blank');
          if (win) {
            win.onload = () => win.print();
          }
        }
      }, 350);
    };
  } catch (err) {
    window.dispatchEvent(new CustomEvent('erp:api_error', { detail: err.message }));
    throw err;
  }
};

export const downloadPdfDocument = async (pdfUrl, defaultFilename = 'document.pdf') => {
  try {
    const downloadUrl = pdfUrl.includes('?') ? `${pdfUrl}&download=true` : `${pdfUrl}?download=true`;
    const token = localStorage.getItem('nbh_token');
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Fetch PDF blob with Authorization header
    const data = await api.get(downloadUrl, { responseType: 'blob' });
    const response = { ok: true, blob: async () => data };
    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.message || `Download failed (${response.status})`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    window.dispatchEvent(new CustomEvent('erp:api_error', { detail: err.message }));
    throw err;
  }
};

export const pdfApi = {
  getInvoicePdfUrl: (id) => `${API_ORIGIN}/api/v1/pdf/invoices/${id}`,
  getGrnPdfUrl: (id) => `${API_ORIGIN}/api/v1/pdf/grns/${id}`,
  getGtnPdfUrl: (id) => `${API_ORIGIN}/api/v1/pdf/gtns/${id}`,
  printInvoice: (id) => printPdfDocument(`${API_ORIGIN}/api/v1/pdf/invoices/${id}`),
  downloadInvoice: (id, num) => downloadPdfDocument(`${API_ORIGIN}/api/v1/pdf/invoices/${id}`, `Invoice-${num || id}.pdf`),
  printGrn: (id) => printPdfDocument(`${API_ORIGIN}/api/v1/pdf/grns/${id}`),
  downloadGrn: (id, num) => downloadPdfDocument(`${API_ORIGIN}/api/v1/pdf/grns/${id}`, `GRN-${num || id}.pdf`),
  printGtn: (id) => printPdfDocument(`${API_ORIGIN}/api/v1/pdf/gtns/${id}`),
  downloadGtn: (id, num) => downloadPdfDocument(`${API_ORIGIN}/api/v1/pdf/gtns/${id}`, `GTN-${num || id}.pdf`),
  printCustomer: (id) => printPdfDocument(`${API_ORIGIN}/api/v1/pdf/customers/${id}`),
  downloadCustomer: (id, name) => downloadPdfDocument(`${API_ORIGIN}/api/v1/pdf/customers/${id}?download=true`, `Customer-${id}${name ? '-' + name.replace(/[^a-zA-Z0-9_-]/g, '_') : ''}.pdf`),
  printCustomerList: () => printPdfDocument(`${API_ORIGIN}/api/v1/pdf/customers`),
  downloadCustomerList: () => downloadPdfDocument(`${API_ORIGIN}/api/v1/pdf/customers?download=true`, 'Customers-Directory.pdf'),
  printCustomerGroup: (id) => printPdfDocument(`${API_ORIGIN}/api/v1/pdf/customer-groups/${id}`),
  downloadCustomerGroup: (id, name) => downloadPdfDocument(`${API_ORIGIN}/api/v1/pdf/customer-groups/${id}?download=true`, `CustomerGroup-${id}${name ? '-' + name.replace(/[^a-zA-Z0-9_-]/g, '_') : ''}.pdf`),
  printCustomerHistory: (id) => printPdfDocument(`${API_ORIGIN}/api/v1/pdf/customers/${id}/history`),
  downloadCustomerHistory: (id) => downloadPdfDocument(`${API_ORIGIN}/api/v1/pdf/customers/${id}/history?download=true`, `Customer-History-${id}.pdf`),
  printEmployeeList: () => printPdfDocument(`${API_ORIGIN}/api/v1/pdf/employees`),
  downloadEmployeeList: () => downloadPdfDocument(`${API_ORIGIN}/api/v1/pdf/employees?download=true`, 'Employees-Directory.pdf'),
  printEmployee: (id) => printPdfDocument(`${API_ORIGIN}/api/v1/pdf/employees/${id}`),
  downloadEmployee: (id, name) => downloadPdfDocument(`${API_ORIGIN}/api/v1/pdf/employees/${id}?download=true`, `Employee-${id}${name ? '-' + name.replace(/[^a-zA-Z0-9_-]/g, '_') : ''}.pdf`),
  printPdf: printPdfDocument,
  downloadPdf: downloadPdfDocument,
};

export const customerGroupApi = {
  getAll: (includeInactive = true) => api.get('/customer-groups', { params: { includeInactive } }),
  getActive: () => api.get('/customer-groups/active'),
  getById: (id) => api.get(`/customer-groups/${id}`),
  create: (data) => api.post('/customer-groups', data),
  update: (id, data) => api.put(`/customer-groups/${id}`, data),
  toggleActive: (id) => api.patch(`/customer-groups/${id}/toggle-active`),
  delete: (id) => api.delete(`/customer-groups/${id}`),
};

export const routeApi = customerGroupApi;

export const vehicleApi = {
  getAll: () => api.get('/vehicles'),
  getAvailable: () => api.get('/vehicles/available'),
  getById: (id) => api.get(`/vehicles/${id}`),
  create: (data) => api.post('/vehicles', data),
  update: (id, data) => api.put(`/vehicles/${id}`, data),
  delete: (id) => api.delete(`/vehicles/${id}`),
};

export const deliveryRouteApi = {
  getAll: () => api.get('/delivery-routes'),
  getActive: () => api.get('/delivery-routes/active'),
  getById: (id) => api.get(`/delivery-routes/${id}`),
  create: (data) => api.post('/delivery-routes', data),
  update: (id, data) => api.put(`/delivery-routes/${id}`, data),
  delete: (id) => api.delete(`/delivery-routes/${id}`),
};

export const deliveryApi = {
  search: (params) => api.get('/deliveries', { params }),
  getSummary: () => api.get('/deliveries/summary'),
  getPendingInvoices: () => api.get('/deliveries/pending-invoices'),
  getById: (id) => api.get(`/deliveries/${id}`),
  create: (data) => api.post('/deliveries', data),
  dispatch: (id, data) => api.post(`/deliveries/${id}/dispatch`, data || {}),
  complete: (id, data) => api.post(`/deliveries/${id}/complete`, data || {}),
  cancel: (id, data) => api.post(`/deliveries/${id}/cancel`, data || {}),
};

export default api;


