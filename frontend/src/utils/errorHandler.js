/**
 * Global ERP Error Handling & User-Friendly Message Normalization
 * Standardizes all technical errors (HTTP status codes, network errors, timeouts,
 * exceptions) into concise, friendly ERP messages without technical jargon.
 */

const TECHNICAL_PATTERNS = [
  /axioserror/i,
  /network\s*error/i,
  /failed\s*to\s*fetch/i,
  /request\s*failed\s*with\s*status\s*code\s*\d+/i,
  /\b500\s*(internal\s*server\s*error)?\b/i,
  /\b502\s*(bad\s*gateway)?\b/i,
  /\b503\s*(service\s*unavailable)?\b/i,
  /\b504\s*(gateway\s*timeout)?\b/i,
  /\b404\s*(not\s*found)?\b/i,
  /\b403\s*(forbidden)?\b/i,
  /\b401\s*(unauthorized)?\b/i,
  /\b408\s*(request\s*timeout)?\b/i,
  /econnrefused/i,
  /econnaborted/i,
  /timeout\s*of\s*\d+ms\s*exceeded/i,
  /org\.hibernate/i,
  /org\.springframework/i,
  /sql\s*(error|exception)/i,
  /nullpointerexception/i,
  /stack\s*trace/i,
  /unhandled\s*rejection/i,
];

export const isTechnicalError = (msg) => {
  if (!msg || typeof msg !== 'string') return false;
  return TECHNICAL_PATTERNS.some((pat) => pat.test(msg));
};

export const isNetworkError = (error) => {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.onLine === false) {
    return true;
  }
  if (!error) return false;
  if (error.code === 'ERR_NETWORK') return true;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('network error') || msg.includes('failed to fetch') || msg.includes('net::err');
};

export const isTimeoutError = (error) => {
  if (!error) return false;
  if (error.code === 'ECONNABORTED') return true;
  const status = error.response?.status;
  if (status === 408 || status === 504) return true;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('timeout') || msg.includes('timed out');
};

export const isCriticalMutation = (url = '', method = '') => {
  const m = (method || '').toLowerCase();
  const isMutation = ['post', 'put', 'patch', 'delete'].includes(m);
  if (!isMutation) return false;
  const u = (url || '').toLowerCase();
  return (
    u.includes('/invoices') ||
    u.includes('/payments') ||
    u.includes('/inventory') ||
    u.includes('/stock') ||
    u.includes('/purchase-orders') ||
    u.includes('/grns') ||
    u.includes('/gtns') ||
    u.includes('/purchase-returns') ||
    u.includes('/sales-returns') ||
    u.includes('/adjustments')
  );
};

/**
 * Maps an error and execution context to a safe, user-friendly message.
 */
export const getUserFriendlyErrorMessage = (error, context = '') => {
  const url = error?.config?.url || '';
  const method = error?.config?.method || '';
  const status = error?.response?.status || error?.status;
  const ctx = (context || '').toLowerCase();
  const lowerUrl = url.toLowerCase();

  // 1. Critical mutations where the status is unknown (Network drop or Timeout during POST/PUT/PATCH)
  const isMutation = isCriticalMutation(url, method) || ctx.includes('saving') || ctx.includes('payment') || ctx.includes('checkout');
  if (isMutation && (isNetworkError(error) || isTimeoutError(error) || !status)) {
    if (lowerUrl.includes('/invoices') || ctx.includes('invoice') || ctx.includes('bill')) {
      return "We couldn't confirm whether the invoice was saved. Please check the invoice list before trying again.";
    }
    if (lowerUrl.includes('/payments') || ctx.includes('payment')) {
      return "We couldn't confirm the payment status. Please check the payment record before trying again.";
    }
    if (lowerUrl.includes('/stock') || lowerUrl.includes('/inventory') || ctx.includes('stock')) {
      return "We couldn't confirm the stock update status. Please verify the inventory balance before trying again.";
    }
    return "We couldn't confirm whether the transaction completed. Please check the record list before trying again.";
  }

  // 2. Network disconnection / Offline
  if (isNetworkError(error)) {
    return "Unable to connect. Please check your internet connection and try again.";
  }

  // 3. Timeout
  if (isTimeoutError(error)) {
    return "The request is taking too long. Please try again.";
  }

  // 4. HTTP Status Mapping
  switch (status) {
    case 401:
      return "Your session has expired. Please log in again.";

    case 403:
      return "You don't have permission to perform this action.";

    case 404:
      if (ctx.includes('customer')) return "Customer could not be found.";
      if (ctx.includes('invoice')) return "Invoice could not be found.";
      return "The requested information could not be found.";

    case 408:
    case 504:
      return "The request is taking too long. Please try again.";

    case 409:
      return "The record has been modified or already exists. Please refresh and try again.";

    case 422: {
      const backendMsg = error?.response?.data?.message;
      if (backendMsg && !isTechnicalError(backendMsg)) {
        return backendMsg;
      }
      return "Unable to process this request. Please review the details and try again.";
    }

    case 400: {
      const fieldErrors = error?.response?.data?.errors;
      if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
        // Return clear validation advice
        return "Please check the highlighted fields and try again.";
      }
      const backendMsg = error?.response?.data?.message;
      if (backendMsg && !isTechnicalError(backendMsg)) {
        return backendMsg;
      }
      return "Please check the highlighted fields and try again.";
    }

    case 502:
    case 503:
      return "The system is temporarily unavailable. Please try again shortly.";

    case 500:
      return "Something went wrong. Please try again.";

    default:
      break;
  }

  // 5. Check if backend provided a safe, non-technical message
  const rawBackendMsg = error?.response?.data?.message;
  if (rawBackendMsg && typeof rawBackendMsg === 'string' && !isTechnicalError(rawBackendMsg)) {
    return rawBackendMsg;
  }

  // 6. Context-specific fallback
  if (ctx.includes('customer target') || ctx.includes('range') || lowerUrl.includes('/customer-targets')) {
    return "Unable to load customer range information. Please try again.";
  }
  if (ctx.includes('customer') || lowerUrl.includes('/customers')) {
    return "Unable to load customers. Please try again.";
  }
  if (ctx.includes('stock') || ctx.includes('inventory') || lowerUrl.includes('/inventory') || lowerUrl.includes('/stock')) {
    return "Unable to load stock information. Please try again.";
  }
  if (ctx.includes('report') || lowerUrl.includes('/reports')) {
    return "Unable to generate the report. Please try again.";
  }
  if (ctx.includes('invoice') || lowerUrl.includes('/invoices')) {
    return "Unable to load invoices. Please try again.";
  }

  return "Something went wrong. Please try again.";
};

/**
 * Sanitizes arbitrary message strings (e.g. from components doing `"Failed to load: " + err.message`)
 * Strips technical substrings and returns clear, human-readable wording.
 */
export const sanitizeErrorMessage = (input) => {
  if (!input || typeof input !== 'string') {
    return "Something went wrong. Please try again.";
  }

  const str = input.trim();
  const lower = str.toLowerCase();

  // If there's no technical keyword, return clean string
  if (!isTechnicalError(str)) {
    return str;
  }

  // Check specific contexts in concatenated strings
  if (lower.includes('customer target') || lower.includes('range')) {
    return "Unable to load customer range information. Please try again.";
  }
  if (lower.includes('customer')) {
    return "Unable to load customers. Please try again.";
  }
  if (lower.includes('invoice') || lower.includes('bill')) {
    if (lower.includes('save') || lower.includes('create') || lower.includes('hold')) {
      return "Unable to save the invoice. Please try again.";
    }
    return "Unable to load invoices. Please try again.";
  }
  if (lower.includes('payment')) {
    return "Unable to process payment. Please try again.";
  }
  if (lower.includes('stock') || lower.includes('inventory') || lower.includes('balance')) {
    return "Unable to load stock information. Please try again.";
  }
  if (lower.includes('report')) {
    return "Unable to generate the report. Please try again.";
  }
  if (lower.includes('sales return') || lower.includes('return')) {
    return "Unable to load sales returns. Please try again.";
  }
  if (lower.includes('purchase order')) {
    return "Unable to load purchase orders. Please try again.";
  }
  if (lower.includes('prn') || lower.includes('purchase return')) {
    return "Unable to load purchase returns. Please try again.";
  }
  if (lower.includes('gtn') || lower.includes('transfer')) {
    return "Unable to load transfer details. Please try again.";
  }
  if (lower.includes('grn')) {
    return "Unable to load goods receipts. Please try again.";
  }
  if (lower.includes('role') || lower.includes('permission')) {
    return "Unable to load roles and permissions. Please try again.";
  }
  if (lower.includes('employee')) {
    return "Unable to load employee records. Please try again.";
  }
  if (lower.includes('dashboard')) {
    return "Unable to load dashboard metrics. Please try again.";
  }

  // General HTTP error patterns
  if (lower.includes('network error') || lower.includes('failed to fetch')) {
    return "Unable to connect. Please check your internet connection and try again.";
  }
  if (lower.includes('502') || lower.includes('503') || lower.includes('bad gateway') || lower.includes('service unavailable')) {
    return "The system is temporarily unavailable. Please try again shortly.";
  }
  if (lower.includes('504') || lower.includes('408') || lower.includes('timeout')) {
    return "The request is taking too long. Please try again.";
  }
  if (lower.includes('401') || lower.includes('unauthorized')) {
    return "Your session has expired. Please log in again.";
  }
  if (lower.includes('403') || lower.includes('forbidden')) {
    return "You don't have permission to perform this action.";
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return "The requested information could not be found.";
  }
  if (lower.includes('500') || lower.includes('internal server error')) {
    return "Something went wrong. Please try again.";
  }

  return "Something went wrong. Please try again.";
};
