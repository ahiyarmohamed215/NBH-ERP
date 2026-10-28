import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('delivery route and delivery trip drafts work with single-field entry, and status dialog does not highlight red on cancel/close', async () => {
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

    let createdRoutePayload = null;
    let createdDeliveryPayload = null;

    let routes = [
      { id: 10, routeName: 'Western route', routeCode: 'DR-010', area: 'Colombo', status: 'ACTIVE', isActive: true, customerIds: [] }
    ];

    apis.deliveryRouteApi.getAll = async () => ({ data: routes });
    apis.deliveryRouteApi.create = async (payload) => {
      createdRoutePayload = payload;
      const created = {
        id: 20,
        ...payload,
        routeCode: 'DR-020',
        name: payload.routeName || 'Draft Route DR-020',
        routeName: payload.routeName || 'Draft Route DR-020',
        status: payload.isDraft ? 'DRAFT' : 'ACTIVE',
        isActive: !payload.isDraft,
      };
      routes.push(created);
      return { data: created };
    };

    apis.deliveryApi.search = async () => ({ data: [] });
    apis.deliveryApi.getSummary = async () => ({ data: null });
    apis.deliveryApi.getPendingInvoices = async () => ({ data: [] });
    apis.deliveryApi.create = async (payload) => {
      createdDeliveryPayload = payload;
      return {
        data: {
          id: 50,
          deliveryNumber: 'DEL-20261026-001',
          status: payload.isDraft ? 'DRAFT' : 'SCHEDULED',
          ...payload,
        }
      };
    };

    apis.vehicleApi.getAll = async () => ({
      data: [
        { id: 101, vehicleNumber: 'WP-CAB-4821', model: 'Truck', vehicleType: 'TRUCK', status: 'AVAILABLE', isActive: true }
      ]
    });

    const { default: DeliveryHub } = await server.ssrLoadModule('/src/views/DeliveryHub.jsx');
    const { default: CustomersHub } = await server.ssrLoadModule('/src/views/CustomersHub.jsx');
    const { default: PurchasingStatusDialog } = await server.ssrLoadModule('/src/components/PurchasingStatusDialog.jsx');
    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');

    // 1. Verify PurchasingStatusDialog does NOT turn red on blur or cancel
    let dialogClosed = false;
    await act(async () => {
      root.render(
        React.createElement(PurchasingStatusDialog, {
          pending: { type: 'Vehicle', number: 'WP-CAB-4821', current: 'AVAILABLE', target: 'IN_SERVICE' },
          reason: '',
          onReasonChange: () => {},
          busy: false,
          onClose: () => { dialogClosed = true; },
          onConfirm: () => {},
        })
      );
    });

    const textarea = host.querySelector('textarea[aria-label="Status change reason"]');
    assert.ok(textarea, 'Reason textarea should be rendered');
    assert.equal(textarea.getAttribute('aria-invalid'), 'false', 'Initial textarea should not be invalid');
    assert.equal(host.querySelector('.purchasing-status-error'), null, 'No error initially');

    // Blur the textarea (as happens when user moves mouse to click Cancel or Back)
    await act(async () => {
      textarea.dispatchEvent(new window.Event('blur', { bubbles: true }));
    });

    assert.equal(textarea.getAttribute('aria-invalid'), 'false', 'Textarea must NOT become invalid on blur');
    assert.equal(host.querySelector('.purchasing-status-error'), null, 'No error on blur');

    // Click Cancel
    const cancelBtn = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Back');
    assert.ok(cancelBtn, 'Cancel/Back button should exist');
    await act(async () => {
      cancelBtn.click();
    });
    assert.equal(dialogClosed, true, 'Dialog should close cleanly');

    // 2. Test Delivery Route Draft Creation in CustomersHub (deliveryMode)
    await act(async () => {
      root.render(
        React.createElement(
          AuthProvider,
          null,
          React.createElement(
            ToastProvider,
            null,
            React.createElement(CustomersHub, { activeSubTab: 'groups', deliveryMode: true })
          )
        )
      );
    });

    const createRouteBtn = [...host.querySelectorAll('button')].find(b => b.textContent.includes('Create Delivery Route'));
    assert.ok(createRouteBtn, 'Create Delivery Route button must exist');
    await act(async () => {
      createRouteBtn.click();
    });

    const dialog = host.querySelector('[role="dialog"]');
    assert.ok(dialog, 'Route dialog must open');

    const draftRouteBtn = [...dialog.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save as Draft');
    assert.ok(draftRouteBtn, 'Save as Draft button must be present in Route creation dialog');

    // Fill only ONE field (Area)
    const areaInput = dialog.querySelector('[aria-label="Route area"]');
    assert.ok(areaInput, 'Area input should exist');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(areaInput, 'Northern Region');
      areaInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    });

    // Save as draft
    await act(async () => {
      draftRouteBtn.click();
    });

    assert.ok(createdRoutePayload, 'Route create API should have been called');
    assert.equal(createdRoutePayload.isDraft, true, 'isDraft must be true');
    assert.equal(createdRoutePayload.status, 'DRAFT', 'status must be DRAFT');
    assert.equal(createdRoutePayload.area, 'Northern Region');

    // Verify draft route displays "Draft" status
    const draftBadge = [...host.querySelectorAll('*')].find(el => el.textContent.trim() === 'Draft');
    assert.ok(draftBadge, 'Draft route should show Draft status badge');

    // 3. Test Delivery Workspace Draft Creation in DeliveryHub
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

    const newDeliveryBtn = [...host.querySelectorAll('button')].find(b => b.textContent.includes('New Delivery'));
    assert.ok(newDeliveryBtn, 'New Delivery button must exist');
    await act(async () => {
      newDeliveryBtn.click();
    });

    const deliveryForm = host.querySelector('form[aria-label="New delivery"]');
    assert.ok(deliveryForm, 'New delivery form should be open');

    const draftDeliveryBtn = [...deliveryForm.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save as Draft');
    assert.ok(draftDeliveryBtn, 'Save as Draft button must be present in Delivery Workspace');

    // Fill only one field (notes)
    const notesInput = deliveryForm.querySelector('textarea[aria-label="Delivery notes"]');
    assert.ok(notesInput, 'Delivery notes input should exist');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(notesInput, 'Emergency hospital supplies draft');
      notesInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    });

    // Click Save as Draft
    await act(async () => {
      draftDeliveryBtn.click();
    });

    assert.ok(createdDeliveryPayload, 'Delivery create API should have been called for draft');
    assert.equal(createdDeliveryPayload.isDraft, true, 'isDraft must be true in delivery draft payload');
    assert.equal(createdDeliveryPayload.notes, 'Emergency hospital supplies draft');

  } finally {
    await act(async () => new Promise(resolve => setTimeout(resolve, 5100)));
    await act(async () => root.unmount());
    await server.close();
    await window.happyDOM.close();
    for (const key of ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']) {
      delete globalThis[key];
    }
  }
});
