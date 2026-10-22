import axios from 'axios';
import {
  getUserFriendlyErrorMessage,
  isNetworkError,
  isTimeoutError,
  isCriticalMutation,
} from '../utils/errorHandler.js';

const API_ORIGIN = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');

const api = axios.create({
  baseURL: `${API_ORIGIN}/api/v1`,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// In-Memory Access Token Storage (Never in localStorage, sessionStorage, or IndexedDB)
let inMemoryAccessToken = null;
let sessionEpoch = 0;
let sessionEnded = false;

export const getAccessToken = () => {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  if (typeof localStorage !== 'undefined') {
    try { return localStorage.getItem('nbh_token') || null; } catch (_) {}
  }
  return null;
};

export const setAccessToken = (token) => {
  sessionEpoch++;
  inMemoryAccessToken = token || null;
  if (token && typeof localStorage !== 'undefined') {
    try { localStorage.removeItem('nbh_token'); } catch (_) {}
  }
};

export const clearAccessToken = () => {
  sessionEpoch++;
  inMemoryAccessToken = null;
  if (typeof localStorage !== 'undefined') {
    try { localStorage.removeItem('nbh_token'); } catch (_) {}
  }
};

// Idle Inactivity & User Activity Tracking
export const IDLE_TIMEOUT_MS = Number(import.meta.env?.VITE_IDLE_TIMEOUT_MS) || (30 * 60 * 1000); // 30 minutes (1,800,000 ms)
export const IDLE_EXPIRED_MESSAGE = 'Your session has expired due to 30 minutes of inactivity. Please sign in again.';

let lastRecordedActivity = 0;
export const recordUserActivity = () => {
  const now = Date.now();
  if (getLastUserActivity() && now - lastRecordedActivity < 2000) return; // Throttle to at most once every 2 seconds
  lastRecordedActivity = now;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('nbh_last_active', String(now));
    } catch (_) {}
  }
};

export const getLastUserActivity = () => {
  if (typeof localStorage !== 'undefined') {
    try {
      const val = localStorage.getItem('nbh_last_active');
      const value = Number(val);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (_) {}
  }
  return lastRecordedActivity;
};

export const beginUserSession = () => {
  sessionEnded = false;
  try { localStorage.removeItem('nbh_session_ended'); } catch (_) {}
  lastRecordedActivity = 0;
  recordUserActivity();
};

export const assertSessionActive = () => {
  const last = getLastUserActivity();
  if (last > 0 && Date.now() - last >= IDLE_TIMEOUT_MS) {
    expireSession(IDLE_EXPIRED_MESSAGE);
    throw Object.assign(new Error(IDLE_EXPIRED_MESSAGE), { code: 'SESSION_IDLE' });
  }
  let ended = sessionEnded;
  try { ended = Boolean(localStorage.getItem('nbh_session_ended')); } catch (_) {}
  if (ended) throw Object.assign(new Error('Please sign in again.'), { code: 'SESSION_ENDED' });
};

const guardRequest = config => {
  if (!['/auth/login', '/auth/signup', '/auth/logout', '/auth/csrf', '/auth/forgot-password'].includes(config.url)) assertSessionActive();
};

// Deduplication & In-Memory TTL Cache for GET requests
const inFlightRequests = new Map();
const apiCache = new Map();
let cacheGeneration=0;

export const clearApiCache = (pattern) => {
  cacheGeneration++;
  inFlightRequests.clear();
  if (!pattern) {
    apiCache.clear();
    return;
  }
  for (const key of apiCache.keys()) {
    if (key.includes(pattern)) {
      apiCache.delete(key);
    }
  }
};

const getDefaultTtlForUrl = (url = '') => {
  const u = (url || '').toLowerCase();
  // Static / master data cached for 5 minutes in legacy apiCache
  if (u.includes('/warehouses') || u.includes('/categories') || u.includes('/brands') || u.includes('/roles/permissions')) {
    return 300000;
  }
  // TanStack Query is now the central primary cache for /products and /inventory/balances.
  // Axios response TTL cache is 0 for these endpoints to prevent duplicate caching conflicts.
  if (u.includes('/products') || u.includes('/inventory/balances')) {
    return 0;
  }
  return 0;
};

// Wrap api.request to provide in-flight deduplication & master-data caching
const originalRequest = api.request.bind(api);
api.request = function (configOrUrl, maybeConfig) {
  let config;
  if (typeof configOrUrl === 'string') {
    config = maybeConfig ? { ...maybeConfig, url: configOrUrl } : { url: configOrUrl };
  } else {
    config = configOrUrl ? { ...configOrUrl } : {};
  }
  try { guardRequest(config); } catch (error) { return Promise.reject(error); }
  const method = (config.method || 'get').toLowerCase();

  const shouldBypassCache = Boolean(config.skipCache || config.force);

  // Deduplicate and cache safe GET requests
  if (method === 'get' && !config.skipDedupe && !config.force) {
    const generation=cacheGeneration;
    const serializedParams = config.params ? JSON.stringify(config.params) : '';
    const sessionKey = getAccessToken() || '';
    const dedupeKey = `GET:${sessionKey}:${config.url || ''}:${serializedParams}`;

    // 1. Check TTL cache if not bypassed
    if (!shouldBypassCache && apiCache.has(dedupeKey)) {
      const entry = apiCache.get(dedupeKey);
      if (entry.expiresAt > Date.now()) {
        return Promise.resolve(entry.data);
      }
      apiCache.delete(dedupeKey);
    }

    // 2. Check in-flight promise to coalesce simultaneous requests
    if (inFlightRequests.has(dedupeKey)) {
      return inFlightRequests.get(dedupeKey);
    }

    const requestPromise = originalRequest(config)
      .then((data) => {
        const ttl = config.cacheTtl !== undefined ? config.cacheTtl : getDefaultTtlForUrl(config.url);
        if (ttl > 0 && !shouldBypassCache && data && generation===cacheGeneration) {
          apiCache.set(dedupeKey, { data, expiresAt: Date.now() + ttl });
        }
        return data;
      })
      .finally(() => {
        if(inFlightRequests.get(dedupeKey)===requestPromise)inFlightRequests.delete(dedupeKey);
      });

    inFlightRequests.set(dedupeKey, requestPromise);
    return requestPromise;
  }

  return originalRequest(config);
};

// Explicitly route api.get through wrapped api.request
api.get = function (url, config = {}) {
  return api.request({ ...config, method: 'get', url });
};

// Attach JWT token, correlation ID, idempotency key, and anti-CSRF header automatically
api.interceptors.request.use((config) => {
  // Network traffic is never evidence of human interaction.
  guardRequest(config);
  if (['post', 'put', 'patch'].includes(config.method?.toLowerCase()) && !config.headers['Idempotency-Key']) {
    config.headers['Idempotency-Key'] = crypto.randomUUID();
  }
  if (!config.headers['X-Request-Id']) {
    config.headers['X-Request-Id'] = crypto.randomUUID();
  }
  if (!config.headers['X-Requested-With']) {
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
  }
  const token = getAccessToken();
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:api_healthy', { detail: { timestamp: Date.now() } }));
    }

    // If request was a mutation (POST, PUT, PATCH, DELETE), broadcast real-time update & invalidate cache
    const method = response.config?.method?.toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method) && response.config?.url !== '/auth/activity') {
      const url = response.config?.url || '';

      // Invalidate relevant caches
      if (url.includes('/warehouses')) clearApiCache('/warehouses');
      if (url.includes('/categories')) clearApiCache('/categories');
      if (url.includes('/brands')) {clearApiCache('/brands');clearApiCache('/products');clearApiCache('/inventory');}
      if (url.includes('/roles')) clearApiCache('/roles');
      if (url.includes('/products')) {clearApiCache('/products');clearApiCache('/inventory');}
      if (url.includes('/invoices')) {clearApiCache('/products');clearApiCache('/inventory');}
      if (url.includes('/grns') || url.includes('/stock-adjustments')) {clearApiCache('/products');clearApiCache('/inventory');}
      if (url.includes('/customers')) clearApiCache('/customers');

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
        if (url.includes('/invoices') || url.includes('/products') || url.includes('/inventory') || url.includes('/warehouses') || url.includes('/stock') || url.includes('/categories') || url.includes('/brands') || url.includes('/adjustments')) {
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
    if (['SESSION_IDLE', 'SESSION_ENDED', 'SESSION_CHANGED'].includes(error.code)) throw error;
    const config = error.config || {};
    // Only refresh on HTTP 401 (never on 403), avoid refreshing on auth endpoints, and retry at most once
    if (error.response?.status === 401 && config && !config._retried && (!config.url?.startsWith('/auth/') || config.url === '/auth/activity')) {
      config._retried = true;
      try {
        await refreshSession();
        return api(config);
      } catch (refreshError) {
        if (!['SESSION_CHANGED', 'SESSION_IDLE', 'SESSION_ENDED'].includes(refreshError.code)) expireSession();
        throw refreshError;
      }
    }

    const friendlyMessage = getUserFriendlyErrorMessage(error, config.errorContext);
    error.friendlyMessage = friendlyMessage;
    error.message = friendlyMessage;
    error.status = error.response?.status;
    error.fieldErrors = error.response?.data?.errors || [];
    error.requestId = error.response?.data?.requestId || error.response?.headers?.['x-request-id'] || config.headers?.['X-Request-Id'];
    error.isNetworkError = isNetworkError(error);
    error.isTimeout = isTimeoutError(error);
    error.isUnknownStatus = isCriticalMutation(config.url, config.method) && (error.isNetworkError || error.isTimeout || !error.status);
    error.isOutage = [502, 503, 504].includes(error.status) || error.isNetworkError || error.isTimeout;

    if (error.response?.status === 401 && !config?.url?.includes('/auth/login') && !config?.url?.includes('/auth/refresh')) {
      expireSession();
    }

    if (typeof window !== 'undefined' && !config?.url?.startsWith('/auth/') && !config.skipGlobalErrorToast) {
      window.dispatchEvent(new CustomEvent('erp:api_error', {
        detail: {
          message: friendlyMessage,
          type: error.isUnknownStatus ? 'warning' : 'error',
          status: error.status,
          requestId: error.requestId,
          isOutage: error.isOutage,
        }
      }));
    }

    return Promise.reject(error);
  }
);

// Multi-Tab Coordination Bus (NO tokens ever broadcasted)
let authChannel = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    authChannel = new BroadcastChannel('nbh_auth_bus');
    if (typeof authChannel.unref === 'function') {
      authChannel.unref();
    }
    authChannel.onmessage = (event) => {
      if (event.data?.type === 'LOGOUT') {
        if (typeof sessionStorage !== 'undefined') {
          try {
            if (event.data?.reason === 'MANUAL') {
              sessionStorage.removeItem('nbh_session_expired');
              sessionStorage.setItem('nbh_signed_out', event.data.message || 'You have successfully signed out.');
            } else if (event.data?.message) {
              sessionStorage.removeItem('nbh_signed_out');
              sessionStorage.setItem('nbh_session_expired', event.data.message);
            }
          } catch (_) {}
        }
        handleCrossTabLogout();
      }
    };
  }
} catch (_) {}

const handleCrossTabLogout = () => {
  sessionEnded = true;
  lastRecordedActivity = 0;
  try { localStorage.setItem('nbh_session_ended', String(Date.now())); } catch (_) {}
  clearAccessToken();
  clearApiCache();
  if (typeof localStorage !== 'undefined') {
    ['nbh_token', 'nbh_refresh', 'nbh_user', 'nbh_last_active'].forEach(key => {
      try { localStorage.removeItem(key); } catch (_) {}
    });
  }
  if (typeof window !== 'undefined') {
    const EventCtor = window.CustomEvent || window.Event || (typeof CustomEvent !== 'undefined' ? CustomEvent : null);
    if (EventCtor) {
      window.dispatchEvent(new EventCtor('nbh:session_expired'));
    }
  }
};

export const manualLogout = (message = 'You have successfully signed out.') => {
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem('nbh_session_expired');
      sessionStorage.setItem('nbh_signed_out', message);
    } catch (_) {}
  }
  handleCrossTabLogout();
  if (authChannel) {
    try {
      authChannel.postMessage({
        type: 'LOGOUT',
        reason: 'MANUAL',
        message: message,
      });
    } catch (_) {}
  }
};

export const expireSession = (customMessage) => {
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem('nbh_signed_out');
      sessionStorage.setItem('nbh_session_expired', customMessage || 'Your session has expired. Please sign in again.');
    } catch (_) {}
  }
  handleCrossTabLogout();
  if (authChannel) {
    try {
      authChannel.postMessage({
        type: 'LOGOUT',
        reason: customMessage ? 'IDLE_TIMEOUT' : 'EXPIRED',
        message: customMessage || 'Your session has expired. Please sign in again.',
      });
    } catch (_) {}
  }
};

// Cross-tab mutex with localStorage fallback for unsupported Web Locks environments
const acquireCrossTabLock = async (lockName, callback, timeoutMs = 8000) => {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(lockName, callback);
  }
  let storageAvailable = false;
  try {
    localStorage.setItem('nbh_lock_probe', '1');
    localStorage.removeItem('nbh_lock_probe');
    storageAvailable = true;
  } catch (_) {}
  if (!storageAvailable) {
    return callback();
  }
  const lockKey = `nbh_lock_${lockName}`;
  const myId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const existing = localStorage.getItem(lockKey);
    // Clear stale lock if older than 6 seconds (prevent deadlock if tab crashed)
    if (!existing || Date.now() - parseInt(existing.split(':')[1] || '0', 10) > 6000) {
      localStorage.setItem(lockKey, `${myId}:${Date.now()}`);
      // Short delay to verify no racing write
      await new Promise((r) => setTimeout(r, 20));
      if (localStorage.getItem(lockKey)?.startsWith(myId)) {
        try {
          return await callback();
        } finally {
          if (localStorage.getItem(lockKey)?.startsWith(myId)) {
            localStorage.removeItem(lockKey);
          }
        }
      }
    }
    await new Promise((r) => setTimeout(r, 25 + Math.random() * 20));
  }
  return callback();
};

let refreshPromise;
export const refreshSession = () => {
  try { assertSessionActive(); } catch (error) { return Promise.reject(error); }
  if (!refreshPromise) {
    const epoch = sessionEpoch;
    const checkRefresh = () => {
      if (epoch !== sessionEpoch) throw Object.assign(new Error('Session changed during refresh'), { code: 'SESSION_CHANGED' });
      assertSessionActive();
    };
    const perform = async () => {
      checkRefresh();
      // Safe migration: check for legacy token in localStorage once inside the coordinated lock
      let legacyRefreshToken = null;
      try { legacyRefreshToken = localStorage.getItem('nbh_refresh'); } catch (_) {}
      const payload = legacyRefreshToken ? { refreshToken: legacyRefreshToken } : {};

      // Short 15ms pause to allow multi-process browser cookie jar sync across tabs
      await new Promise((r) => setTimeout(r, 15));

      checkRefresh();
      let res;
      try {
        res = await axios.post(`${API_ORIGIN}/api/v1/auth/refresh`, payload, {
          timeout: 30000,
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });
      } catch (err) {
        // If a 401 occurred during a concurrent tab race, retry once after a short delay
        // to pick up the newly rotated cookie committed by a peer tab.
        if (err.response?.status === 401 && !err.config?._retriedRefresh) {
          err.config = err.config || {};
          err.config._retriedRefresh = true;
          await new Promise((r) => setTimeout(r, 60));
          checkRefresh();
          res = await axios.post(`${API_ORIGIN}/api/v1/auth/refresh`, {}, {
            timeout: 30000,
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
          });
        } else {
          throw err;
        }
      }

      checkRefresh();
      const data = res.data?.data;
      if (data?.accessToken) {
        setAccessToken(data.accessToken);
      }

      // Migration cleanup: once refresh succeeds, permanently purge legacy tokens from localStorage
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem('nbh_token');
          localStorage.removeItem('nbh_refresh');
        } catch (_) {}
      }

      return data;
    };

    const executeWithLock = async () => {
      try {
        return await acquireCrossTabLock('erp-refresh', perform);
      } catch (refreshError) {
        // DO NOT broadcast LOGOUT across BroadcastChannel on a failed silent refresh!
        // Only clear this tab's in-memory token and cache.
        if (epoch === sessionEpoch) {
          clearAccessToken();
          clearApiCache();
        }
        throw refreshError;
      }
    };

    refreshPromise = executeWithLock().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};
// Exhaust pages for existing local-filter tables and complete exports; never silently truncate at page 1.
export const fetchAllPages = async (url, params = {}, requestConfig = {}) => {
  let content = [], page = 0, result;
  do {
    result = await api.get(url, { ...requestConfig, params: { ...params, page, size: 200, sort: params.sort || 'id,asc' } });
    if (!Array.isArray(result.data?.content)) return result;
    content.push(...result.data.content);
    page += 1;
  } while (page < result.data.totalPages);
  return { ...result, data: { ...result.data, content, totalElements: content.length } };
};
export const purchaseOrderApi = {
  search: (params, config = {}) => fetchAllPages('/purchase-orders', params, config),
  create: (data) => api.post('/purchase-orders', data),
  update: (id, data) => api.put(`/purchase-orders/${id}`, data),
  changeStatus: (id, status, reason) => api.post(`/purchase-orders/${id}/status`, {status,reason}),
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
  getMe: () => api.get('/auth/me', {skipCache:true,skipDedupe:true}),
  logout: () => api.post('/auth/logout'),
  activity: () => api.post('/auth/activity'),
  updateProfile: (data) => api.put('/auth/profile', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
};

export const userApi = {
  getStaffLookup: () => api.get('/users/lookup'),
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
  getAll: (config = {}) => api.get('/warehouses', config),
  getActive: (config = {}) => api.get('/warehouses/active', config),
  getById: (id) => api.get(`/warehouses/${id}`),
  create: (data) => api.post('/warehouses', data),
  update: (id, data) => api.put(`/warehouses/${id}`, data),
  changeStatus: (id,status,reason) => api.patch(`/warehouses/${id}/status`, {status,reason}),
  toggleActive: (id) => api.patch(`/warehouses/${id}/toggle-active`),
  delete: (id) => api.delete(`/warehouses/${id}`),
};

export const categoryApi = {
  getAll: (config = {}) => api.get('/categories', config),
  getActive: (config = {}) => api.get('/categories/active', config),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  changeStatus: (id,status,reason) => api.patch(`/categories/${id}/status`, {status,reason}),
  toggleActive: (id) => api.patch(`/categories/${id}/toggle-active`),
  delete: (id) => api.delete(`/categories/${id}`),
};

export const brandApi = {
  getAll: (config = {}) => api.get('/brands', config),
  getActive: (config = {}) => api.get('/brands/active', config),
  search: (query) => api.get('/brands/search', { params: { query } }),
  getById: (id) => api.get(`/brands/${id}`),
  create: (data) => api.post('/brands', data),
  update: (id, data) => api.put(`/brands/${id}`, data),
  changeStatus: (id,status,reason) => api.patch(`/brands/${id}/status`, {status,reason}),
  toggleActive: (id) => api.patch(`/brands/${id}/toggle-active`),
  delete: (id) => api.delete(`/brands/${id}`),
};

export const productApi = {
  getProducts: (params, config = {}) => fetchAllPages('/products', params, config),
  getProductsPaged: (params, config = {}) => api.get('/products', { ...config, params }),
  searchActive: (query) => api.get('/products/search', { params: { query } }),
  getByBarcode: (barcode) => api.get(`/products/barcode/${barcode}`),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  changeStatus: (id,status,reason) => api.patch(`/products/${id}/status`, {status,reason}),
  toggleActive: (id) => api.patch(`/products/${id}/toggle-active`),
  delete: (id) => api.delete(`/products/${id}`),
};

export const customerApi = {
  getAll: (config = {}) => api.get('/customers', config),
  getActive: (config = {}) => api.get('/customers/active', config),
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

export const recycleBinApi = {
  getAll: () => api.get('/recycle-bin'),
  delete: (type,id) => api.delete(`/recycle-bin/${type}/${id}`),
  restore: (type,id) => api.post(`/recycle-bin/${type}/${id}/restore`),
  permanentlyDelete: (type,id) => api.delete(`/recycle-bin/${type}/${id}/permanent`),
};

export const supplierApi = {
  getAll: (config = {}) => api.get('/suppliers', config),
  getActive: (config = {}) => api.get('/suppliers/active', config),
  search: (query) => api.get('/suppliers/search', { params: { query } }),
  getById: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  toggleActive: (id, reason) => api.patch(`/suppliers/${id}/toggle-active`, {reason}),
  changeStatus: (id,status,reason) => api.patch(`/suppliers/${id}/status`, {status,reason}),
  delete: (id) => api.delete(`/suppliers/${id}`),
  getRecycleBin: () => api.get('/suppliers/recycle-bin'),
  restore: (id) => api.post(`/suppliers/${id}/restore`),
  permanentlyDelete: (id) => api.delete(`/suppliers/${id}/permanent`),
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
  getBalances: (params, config = {}) => api.get('/inventory/balances', { ...config, params }),
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
  process: (id, reason) => api.post(`/grns/${id}/process`, {reason}),
  cancel: (id, data) => api.post(`/grns/${id}/cancel`, data),
  delete: (id) => api.delete(`/grns/${id}`),
};

export const gtnApi = {
  search: (params) => api.get('/gtns', { params }),
  getById: (id) => api.get(`/gtns/${id}`),
  create: (data, transfer = false) => api.post(`/gtns?transfer=${transfer}`, data),
  update: (id, data) => api.put(`/gtns/${id}`, data),
  getResponsibleStaff: () => api.get('/gtns/responsible-staff'),
  dispatch: (id, responsibleStaffId, reason) => api.post(`/gtns/${id}/dispatch`, { responsibleStaffId: Number(responsibleStaffId) || null, reason }),
  transfer: (id, reason) => api.post(`/gtns/${id}/transfer`, { signedCopyReceived: true, reason }),
  cancel: (id, reason) => api.post(`/gtns/${id}/cancel`, { status: 'CANCELLED', reason }),
  changeStatus: (id, data) => api.post(`/gtns/${id}/status`, data),
};

export const prnApi = {
  getReturnSources: () => api.get('/purchase-returns/return-sources'),
  update: (id, data, process = false) => api.put(`/purchase-returns/${id}?process=${process}`, data),
  search: (params) => api.get('/purchase-returns', { params }),
  getById: (id) => api.get(`/purchase-returns/${id}`),
  create: (data, process = false) => api.post(`/purchase-returns?process=${process}`, data),
  process: (id, reason) => api.post(`/purchase-returns/${id}/process`, {reason}),
  cancel: (id, reason) => api.post(`/purchase-returns/${id}/cancel`, {reason}),
};

export const adjustmentApi = {
  update: (id,data,process=false) => api.put(`/stock-adjustments/${id}?process=${process}`,data),
  cancel: (id,reason) => api.post(`/stock-adjustments/${id}/cancel`,{reason}),
  searchProducts: (query, config = {}) => api.get('/stock-adjustments/products',{params:{query},skipCache:true,skipDedupe:true,...config}),
  search: (params, config = {}) => api.get('/stock-adjustments', { params, ...config }),
  getById: (id) => api.get(`/stock-adjustments/${id}`),
  create: (data, process = false) => api.post(`/stock-adjustments?process=${process}`, data),
  process: (id,reason) => api.post(`/stock-adjustments/${id}/process`,reason?{reason}:undefined),
  reject: (id) => api.post(`/stock-adjustments/${id}/reject`),
};

export const salesApi = {



  getPosStaffPerformance: (params={}) => api.get('/invoices/held/performance',{params,skipCache:true,skipDedupe:true}),
  getHeldReviewLimits: id => api.get(`/invoices/held/${id}/review-limits`,{skipCache:true,skipDedupe:true}),
  getPosStockLimits: params => api.get('/invoices/pos/stock-limits',{params,skipCache:true,skipDedupe:true}),
  getHeldOriginals: params => api.get('/invoices/held/originals',{params,skipCache:true,skipDedupe:true}),
  sendHeld: (id,data) => api.post(`/invoices/held/${id}/send`,data),
  reviewHeld: (id,data) => api.post(`/invoices/held/${id}/review`,data),

  printHeld: (id,warehouseId) => api.post(`/invoices/held/${id}/print`,undefined,{params:{warehouseId}}),



  savePosDraft: (id,data) => api.put(`/invoices/held/${id}/draft`,data),
  getHeldWorkspace: (params) => api.get('/invoices/held/workspace',{params,skipCache:true,skipDedupe:true}),
  previewHeldMerge: (ids) => api.post('/invoices/held/merge-preview',{ids}),
  getPosProgress: (params) => api.get('/invoices/pos/progress',{params,skipCache:true,skipDedupe:true}),
  completeHeld: (ids,expectedVersions,packing) => api.post('/invoices/complete-held', { ids,expectedVersions,packing }),
  search: (params) => fetchAllPages('/invoices', params),
  getCustomerOutstanding: (customerId, outstandingOnly = true) => api.get(`/invoices/customer/${customerId}/outstanding`, { params: { outstandingOnly }, skipCache: true, skipDedupe: true }),
  getHeld: (cashier) => api.get('/invoices/held', { params: cashier ? { cashier } : {} }),
  getCashierSalesSummary: (params) => api.get('/invoices/cashiers/summary', { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  getByNumber: (number) => api.get(`/invoices/number/${number}`),
  create: (data) => api.post('/invoices', data),
  resumeHeld: (id, data) => api.post(`/invoices/held/${id}/resume`, data),
  cancelHeld: (id, data) => api.post(`/invoices/held/${id}/cancel`,data),
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
  createRefund: (data) => api.post('/payments', { ...data, paymentType: 'REFUND' }),
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

const normalizePdfUrl = (url = '') => {
  if (!url) return url;
  if (API_ORIGIN && url.startsWith(`${API_ORIGIN}/api/v1`)) {
    return url.substring(`${API_ORIGIN}/api/v1`.length);
  }
  if (url.startsWith('/api/v1')) {
    return url.substring('/api/v1'.length);
  }
  return url;
};

export const printPdfDocument = async (pdfUrl) => {
  try {
    const cleanUrl = normalizePdfUrl(pdfUrl);
    // Fetch PDF blob with Authorization header to prevent 401 Unauthorized
    const data = await api.get(cleanUrl, { responseType: 'blob' });
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(blob);

    const win = window.open(blobUrl, '_blank');
    if (win) {
      win.onload = () => {
        try {
          win.focus();
          win.print();
        } catch (_) {}
      };
    } else {
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
          } catch (_) {}
        }, 350);
      };
    }
  } catch (err) {
    window.dispatchEvent(new CustomEvent('erp:api_error', { detail: err.message }));
    throw err;
  }
};

export const downloadPdfDocument = async (pdfUrl, defaultFilename = 'document.pdf') => {
  try {
    const cleanUrl = normalizePdfUrl(pdfUrl);
    const downloadUrl = cleanUrl.includes('?') ? `${cleanUrl}&download=true` : `${cleanUrl}?download=true`;

    // Fetch PDF blob with Authorization header
    const data = await api.get(downloadUrl, { responseType: 'blob' });
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
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

export const customerMonthlyRangeApi = {
  getAllRanges: () => api.get('/customer-ranges'),
  createRange: (data) => api.post('/customer-ranges', data),
  updateRange: (id, data) => api.put(`/customer-ranges/${id}`, data),
  toggleStatus: (id, active) => api.patch(`/customer-ranges/${id}/status`, null, { params: { active } }),
  getAuditTrail: () => api.get('/customer-ranges/audit-trail'),
  getCustomerProgress: (customerId, cartTotal) =>
    api.get(`/customer-ranges/customer/${customerId}/progress`, {
      params: cartTotal ? { cartTotal } : {},
    }),
  getCustomerHistory: (customerId) => api.get(`/customer-ranges/customer/${customerId}/history`),
  getMyTargets: (params) => api.get('/customer-ranges/my-targets', { params }),
  getNearTargets: () => api.get('/customer-ranges/near-target'),
  getManagerDashboard: (params) => api.get('/customer-ranges/manager-dashboard', { params }),
  getStaffPerformance: (yearMonth) =>
    api.get('/customer-ranges/staff-performance', {
      params: yearMonth ? { yearMonth } : {},
    }),
  assignStaff: (customerId, staffId) =>
    api.put(`/customer-ranges/customer/${customerId}/assign-staff`, null, {
      params: staffId ? { staffId } : {},
    }),
  syncMonth: (yearMonth) =>
    api.post('/customer-ranges/sync-month', null, {
      params: yearMonth ? { yearMonth } : {},
    }),
};

export default api;


