import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('delivery phone display, rescheduling workflow, and dispatching without odometer', async () => {
  const window = new Window();
  Object.assign(globalThis, {
    window,
    document: window.document,
    localStorage: window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });

  const { createRoot } = await import('react-dom/client');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);

  const server = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });

  try {
    const apis = await server.ssrLoadModule('/src/api/apiClient.js');
    for (const [name, api] of Object.entries(apis)) {
      if (name.endsWith('Api') && api && typeof api === 'object') {
        for (const method of Object.keys(api)) {
          if (typeof api[method] === 'function') api[method] = async () => ({ data: [] });
        }
      }
    }

    localStorage.setItem(
      'nbh_token',
      `test.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.sig`
    );
    apis.authApi.getMe = async () => ({
      data: { username: 'admin', roles: ['ROLE_ADMIN'], permissions: ['DELIVERY_VIEW', 'DELIVERY_MANAGE'] }
    });

    let reschedulePayload = null;
    let dispatchPayload = null;

    const mockTrip = {
      id: 101,
      deliveryNumber: 'DEL-20261026-001',
      routeName: 'Metro Colombo',
      warehouseName: 'Central Hub',
      vehicleNumber: 'WP-CAD-5566',
      driverName: 'Kamal Perera',
      driverPhone: '0771234567',
      assistantStaffName: 'Sunil Silva',
      assistantStaffPhone: '0719876543',
      scheduledDate: '2026-10-26',
      totalAmount: 45000,
      status: 'SCHEDULED',
      notes: 'Early morning run',
      invoices: [
        { id: 1, invoiceNumber: 'INV-001', customerName: 'Apex Store', netTotal: 45000, deliveryStatus: 'OUT_FOR_DELIVERY' }
      ]
    };

    apis.deliveryApi.search = async () => ({ data: [mockTrip] });
    apis.deliveryApi.getById = async (id) => ({ data: mockTrip });
    apis.deliveryApi.reschedule = async (id, payload) => {
      reschedulePayload = payload;
      return {
        data: {
          ...mockTrip,
          status: 'RESCHEDULED',
          scheduledDate: payload.newScheduledDate,
          rescheduledDate: payload.newScheduledDate,
          rescheduleReason: payload.reason,
          notes: payload.notes || mockTrip.notes,
        }
      };
    };
    apis.deliveryApi.dispatch = async (id, payload) => {
      dispatchPayload = payload;
      return {
        data: {
          ...mockTrip,
          status: 'IN_TRANSIT',
          departureTime: payload.departureTime,
          notes: payload.notes || mockTrip.notes,
        }
      };
    };

    const { default: DeliveryHub } = await server.ssrLoadModule('/src/views/DeliveryHub.jsx');
    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');

    const changeInput = (input, val) => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, val);
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    };
    const changeTextarea = (textarea, val) => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, val);
      textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
    };

    await act(async () => {
      root.render(
        React.createElement(
          AuthProvider,
          null,
          React.createElement(
            ToastProvider,
            null,
            React.createElement(DeliveryHub, { activeSubTab: 'deliveries' })
          )
        )
      );
    });
    await new Promise((r) => setTimeout(r, 100));

    // 1. Verify status filter includes RESCHEDULED
    const statusBtn = document.querySelector('button[aria-label="Delivery status"]');
    assert.ok(statusBtn, 'Delivery status filter trigger button should exist');
    await act(async () => {
      statusBtn.click();
    });
    await new Promise((r) => setTimeout(r, 50));
    const rescheduleOption = Array.from(document.querySelectorAll('[role="option"]')).find(o => o.textContent.includes('RESCHEDULED'));
    assert.ok(rescheduleOption, 'Status filter popup should include RESCHEDULED option');
    await act(async () => {
      statusBtn.click(); // close popup
    });
    await new Promise((r) => setTimeout(r, 50));

    // 2. Click on the delivery trip row to open PurchaseInspectionModal
    const tripRow = document.querySelector('tbody tr');
    assert.ok(tripRow, 'Trip row in table should exist');

    await act(async () => {
      tripRow.click();
    });
    await new Promise((r) => setTimeout(r, 100));

    // 3. Verify driver and assistant phone numbers are displayed
    const modalText = document.body.textContent;
    assert.ok(modalText.includes('Kamal Perera'), 'Driver name should be visible');
    assert.ok(modalText.includes('0771234567'), 'Driver phone should be visible');
    assert.ok(modalText.includes('Sunil Silva'), 'Assistant name should be visible');
    assert.ok(modalText.includes('0719876543'), 'Assistant phone should be visible');

    // 4. Verify detailActions has Dispatch Delivery and Reschedule Delivery
    const dispatchBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Dispatch Delivery'));
    const rescheduleBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Reschedule Delivery'));
    assert.ok(dispatchBtn, 'Dispatch Delivery button should be in popup actions');
    assert.ok(rescheduleBtn, 'Reschedule Delivery button should be in popup actions');

    // 5. Click Reschedule Delivery
    await act(async () => {
      rescheduleBtn.click();
    });
    await new Promise((r) => setTimeout(r, 100));

    const rescheduleDialog = document.querySelector('[aria-label="Reschedule delivery"]');
    assert.ok(rescheduleDialog, 'Reschedule delivery dialog should open');

    const newDateInput = rescheduleDialog.querySelector('input[type="date"]');
    const reasonTextarea = rescheduleDialog.querySelector('textarea[aria-label="Reschedule reason"]');
    const confirmRescheduleBtn = rescheduleDialog.querySelector('.supplier-status-confirm');

    assert.ok(newDateInput, 'New scheduled date input should exist');
    assert.ok(reasonTextarea, 'Reason textarea should exist');
    assert.ok(confirmRescheduleBtn.disabled, 'Confirm should be disabled when reason is empty');

    // Enter date & reason
    await act(async () => {
      changeInput(newDateInput, '2026-10-28');
      changeTextarea(reasonTextarea, 'Driver vehicle tyre punctured, rescheduled to Wednesday');
    });
    await new Promise((r) => setTimeout(r, 50));

    assert.equal(confirmRescheduleBtn.disabled, false, 'Confirm button should be enabled after filling required fields');

    // Submit reschedule
    await act(async () => {
      confirmRescheduleBtn.click();
    });
    await new Promise((r) => setTimeout(r, 100));

    assert.ok(reschedulePayload, 'reschedule payload should be sent to backend');
    assert.equal(reschedulePayload.newScheduledDate, '2026-10-28');
    assert.equal(reschedulePayload.reason, 'Driver vehicle tyre punctured, rescheduled to Wednesday');

    // 6. Check that modal view now reflects RESCHEDULED status, Rescheduled date, and Reschedule reason
    const updatedModalText = document.body.textContent;
    assert.ok(updatedModalText.includes('RESCHEDULED'), 'Status badge should show RESCHEDULED');
    assert.ok(updatedModalText.includes('Driver vehicle tyre punctured'), 'Reschedule reason should be displayed in details');

    // 7. Verify that from RESCHEDULED status, Dispatch Delivery is still available when they go!
    const dispatchFromRescheduledBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Dispatch Delivery'));
    assert.ok(dispatchFromRescheduledBtn, 'Dispatch Delivery should still be available on RESCHEDULED delivery');

    await act(async () => {
      dispatchFromRescheduledBtn.click();
    });
    await new Promise((r) => setTimeout(r, 100));

    const dispatchDialog = document.querySelector('[aria-label="Dispatch delivery"]');
    assert.ok(dispatchDialog, 'Dispatch delivery dialog should open');

    // Verify odometer is NOT required / present in dispatch mode
    const dispatchOdometerInput = dispatchDialog.querySelector('input[aria-label="Odometer"]');
    assert.equal(dispatchOdometerInput, null, 'Odometer input should not be in dispatch mode');

    const departureTimeInput = dispatchDialog.querySelector('input[aria-label="Departure time"]');
    assert.ok(departureTimeInput, 'Departure time input should be present');

    const notesInput = dispatchDialog.querySelector('textarea[aria-label="Delivery status notes"]');
    assert.ok(notesInput, 'Remarks / notes textarea should be present');

    await act(async () => {
      changeTextarea(notesInput, 'Departed at 8:45 AM, goods verified with driver');
    });

    const confirmDispatchBtn = dispatchDialog.querySelector('.supplier-status-confirm');
    await act(async () => {
      confirmDispatchBtn.click();
    });
    await new Promise((r) => setTimeout(r, 100));

    assert.ok(dispatchPayload, 'dispatch payload should be sent');
    assert.equal(dispatchPayload.notes, 'Departed at 8:45 AM, goods verified with driver');

    const inTransitModalText = document.body.textContent;
    assert.ok(inTransitModalText.includes('IN TRANSIT'), 'Status should update to IN TRANSIT');
  } finally {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    await server.close();
  }
});
