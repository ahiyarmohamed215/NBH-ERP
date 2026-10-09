import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import api from '../src/api/apiClient.js';
import {
  getUserFriendlyErrorMessage,
  sanitizeErrorMessage,
  isTechnicalError,
  isNetworkError,
  isTimeoutError,
  isCriticalMutation,
} from '../src/utils/errorHandler.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, v),
  removeItem: (k) => storage.delete(k),
};
globalThis.sessionStorage = globalThis.localStorage;
globalThis.window = new EventTarget();

test('Scenario 1: Backend returns 500 produces user-friendly message', async () => {
  api.defaults.adapter = async (config) => {
    throw new axios.AxiosError(
      'Request failed with status code 500',
      'ERR_BAD_RESPONSE',
      config,
      null,
      {
        status: 500,
        data: {
          success: false,
          errorCode: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected internal server error occurred. Please contact the administrator.',
        },
      }
    );
  };

  let capturedToast = null;
  const listener = (e) => {
    capturedToast = e.detail;
  };
  window.addEventListener('erp:api_error', listener);

  await assert.rejects(api.get('/inventory/balances'), (err) => {
    assert.equal(err.status, 500);
    assert.equal(err.message, 'Something went wrong. Please try again.');
    assert.equal(err.friendlyMessage, 'Something went wrong. Please try again.');
    return true;
  });

  window.removeEventListener('erp:api_error', listener);
  assert.ok(capturedToast);
  assert.equal(capturedToast.message, 'Something went wrong. Please try again.');
  assert.equal(isTechnicalError(capturedToast.message), false);
});

test('Scenario 2: Reverse proxy returns 502 Bad Gateway', async () => {
  api.defaults.adapter = async (config) => {
    throw new axios.AxiosError(
      'Request failed with status code 502',
      'ERR_BAD_RESPONSE',
      config,
      null,
      { status: 502, data: '<html>502 Bad Gateway</html>' }
    );
  };

  await assert.rejects(api.get('/products'), (err) => {
    assert.equal(err.status, 502);
    assert.equal(err.message, 'The system is temporarily unavailable. Please try again shortly.');
    return true;
  });
});

test('Scenario 3: Backend returns 503 Service Unavailable', async () => {
  api.defaults.adapter = async (config) => {
    throw new axios.AxiosError(
      'Request failed with status code 503',
      'ERR_BAD_RESPONSE',
      config,
      null,
      { status: 503, data: { success: false, message: 'Service Unavailable' } }
    );
  };

  await assert.rejects(api.get('/warehouses'), (err) => {
    assert.equal(err.status, 503);
    assert.equal(err.message, 'The system is temporarily unavailable. Please try again shortly.');
    return true;
  });
});

test('Scenario 4: Internet connection is lost / Network Error', async () => {
  api.defaults.adapter = async (config) => {
    const err = new axios.AxiosError('Network Error', 'ERR_NETWORK', config);
    throw err;
  };

  await assert.rejects(api.get('/customers'), (err) => {
    assert.equal(err.isNetworkError, true);
    assert.equal(err.message, 'Unable to connect. Please check your internet connection and try again.');
    return true;
  });
});

test('Scenario 5: Request times out (Axios ECONNABORTED & 504 Gateway Timeout)', async () => {
  // Test ECONNABORTED
  api.defaults.adapter = async (config) => {
    const err = new axios.AxiosError('timeout of 30000ms exceeded', 'ECONNABORTED', config);
    throw err;
  };

  await assert.rejects(api.get('/reports/day-summary'), (err) => {
    assert.equal(err.isTimeout, true);
    assert.equal(err.message, 'The request is taking too long. Please try again.');
    return true;
  });

  // Test 504 Gateway Timeout
  api.defaults.adapter = async (config) => {
    throw new axios.AxiosError('Request failed with status code 504', 'ERR_BAD_RESPONSE', config, null, {
      status: 504,
      data: '',
    });
  };

  await assert.rejects(api.get('/reports/sales-summary'), (err) => {
    assert.equal(err.status, 504);
    assert.equal(err.message, 'The request is taking too long. Please try again.');
    return true;
  });
});

test('Scenario 6: Session expires (401 Unauthorized)', async () => {
  storage.set('nbh_token', 'expired-token');

  let sessionExpiredFired = false;
  const expiredListener = () => {
    sessionExpiredFired = true;
  };
  window.addEventListener('nbh:session_expired', expiredListener);

  api.defaults.adapter = async (config) => {
    throw new axios.AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, null, {
      status: 401,
      data: { success: false, message: 'Your session has expired.' },
    });
  };

  await assert.rejects(api.get('/auth/me'), (err) => {
    assert.equal(err.status, 401);
    assert.equal(err.message, 'Your session has expired. Please log in again.');
    return true;
  });

  window.removeEventListener('nbh:session_expired', expiredListener);
  assert.equal(sessionExpiredFired, true);
  assert.equal(localStorage.getItem('nbh_token'), null);
});

test('Scenario 7: User lacks permission (403 Forbidden)', async () => {
  api.defaults.adapter = async (config) => {
    throw new axios.AxiosError('Request failed with status code 403', 'ERR_BAD_REQUEST', config, null, {
      status: 403,
      data: { success: false, message: 'Access denied: You do not have permission to perform this action' },
    });
  };

  await assert.rejects(api.get('/roles/permissions'), (err) => {
    assert.equal(err.status, 403);
    assert.equal(err.message, "You don't have permission to perform this action.");
    return true;
  });
});

test('Scenario 8: Validation fails (400 Bad Request with field errors)', async () => {
  api.defaults.adapter = async (config) => {
    throw new axios.AxiosError('Validation failed', 'ERR_BAD_REQUEST', config, null, {
      status: 400,
      data: {
        success: false,
        message: 'Validation failed',
        errors: ['customerName: Customer name is required', 'amount: Must be greater than 0'],
      },
    });
  };

  await assert.rejects(api.post('/customers', {}), (err) => {
    assert.equal(err.status, 400);
    assert.equal(err.message, 'Please check the highlighted fields and try again.');
    assert.equal(err.fieldErrors.length, 2);
    return true;
  });
});

test('Scenario 9: Invoice request succeeds but response is lost / network drop during invoice mutation', async () => {
  api.defaults.adapter = async (config) => {
    const err = new axios.AxiosError('Network Error', 'ERR_NETWORK', config);
    throw err;
  };

  let capturedToast = null;
  const listener = (e) => {
    capturedToast = e.detail;
  };
  window.addEventListener('erp:api_error', listener);

  await assert.rejects(api.post('/invoices', { items: [] }), (err) => {
    assert.equal(err.isUnknownStatus, true);
    assert.equal(
      err.message,
      "We couldn't confirm whether the invoice was saved. Please check the invoice list before trying again."
    );
    return true;
  });

  window.removeEventListener('erp:api_error', listener);
  assert.ok(capturedToast);
  assert.equal(
    capturedToast.message,
    "We couldn't confirm whether the invoice was saved. Please check the invoice list before trying again."
  );
  assert.equal(capturedToast.type, 'warning');
});

test('Scenario 10: Payment request fails with unknown status (timeout during payment post)', async () => {
  api.defaults.adapter = async (config) => {
    const err = new axios.AxiosError('timeout of 30000ms exceeded', 'ECONNABORTED', config);
    throw err;
  };

  await assert.rejects(api.post('/payments', { amount: 500 }), (err) => {
    assert.equal(err.isUnknownStatus, true);
    assert.equal(
      err.message,
      "We couldn't confirm the payment status. Please check the payment record before trying again."
    );
    return true;
  });
});

test('Scenario 11: Sanitizer cleans concatenated component messages', () => {
  // Legacy string concatenations like "Failed to load customers: Request failed with status code 500"
  assert.equal(
    sanitizeErrorMessage('Failed to load customers: Request failed with status code 500'),
    'Unable to load customers. Please try again.'
  );

  // Customer targets / range loading
  assert.equal(
    sanitizeErrorMessage('Error loading customer targets: AxiosError: Network Error'),
    'Unable to load customer range information. Please try again.'
  );

  // Stock loading
  assert.equal(
    sanitizeErrorMessage('Failed to load inventory balances: Request failed with status code 502'),
    'Unable to load stock information. Please try again.'
  );

  // Report generation
  assert.equal(
    sanitizeErrorMessage('Failed to generate report: 500 Internal Server Error'),
    'Unable to generate the report. Please try again.'
  );

  // Raw Axios errors
  assert.equal(
    sanitizeErrorMessage('AxiosError: timeout of 30000ms exceeded'),
    'The request is taking too long. Please try again.'
  );
});
