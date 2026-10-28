import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('delivery vehicle status filter, supplier-style popup view, and status change reason modal', async () => {
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

    let vehiclesList = [
      { id: 101, vehicleNumber: 'WP-CAB-4821', model: 'Isuzu Elf 4-Ton Truck', vehicleType: 'TRUCK', capacityKg: 4000, status: 'AVAILABLE', notes: 'Prime heavy truck' },
      { id: 102, vehicleNumber: 'WP-DA-9150', model: 'Toyota HiAce Delivery Van', vehicleType: 'VAN', capacityKg: 1500, status: 'IN_SERVICE', notes: 'Regular oil service' },
      { id: 103, vehicleNumber: 'SP-LK-3320', model: 'Mitsubishi Canter 3.5T Lorry', vehicleType: 'LORRY', capacityKg: 3500, status: 'IN_GARAGE', notes: 'Brake overhaul' },
      { id: 104, vehicleNumber: 'WP-BIKE-001', model: 'Honda CD 110', vehicleType: 'MOTORCYCLE', capacityKg: 50, status: 'DRAFT', notes: 'Pending registration' }
    ];

    apis.default.get = async url => {
      if (url === '/users/lookup') return { data: [] };
      if (url === '/warehouses') return { data: [] };
      if (url === '/customers') return { data: [] };
      return { data: [] };
    };
    apis.deliveryApi.search = async () => ({ data: [] });
    apis.deliveryApi.getSummary = async () => ({ data: null });
    apis.deliveryApi.getPendingInvoices = async () => ({ data: [] });
    apis.deliveryRouteApi.getAll = async () => ({ data: [] });
    apis.vehicleApi.getAll = async () => ({ data: vehiclesList });

    let statusChangeCalledWith = null;
    apis.vehicleApi.changeStatus = async (id, status, reason) => {
      statusChangeCalledWith = { id, status, reason };
      vehiclesList = vehiclesList.map(v => v.id === id ? { ...v, status } : v);
      return { data: { id, status, notes: reason } };
    };

    const { default: DeliveryHub } = await server.ssrLoadModule('/src/views/DeliveryHub.jsx');
    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');

    await act(async () =>
      root.render(
        React.createElement(
          AuthProvider,
          null,
          React.createElement(
            ToastProvider,
            null,
            React.createElement(DeliveryHub, { activeSubTab: 'vehicles' })
          )
        )
      )
    );

    // 1. Verify "Vehicles" tab and title (not "Fleet Vehicles")
    const vehiclesTab = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Vehicles');
    assert.ok(vehiclesTab, 'Vehicles tab should exist and be labeled "Vehicles"');
    assert.ok(host.querySelector('[aria-label="Search Vehicles"]'), 'Vehicles directory search should be labeled "Search Vehicles"');

    // 2. Verify Status Filter exists with: All Statuses, Available, In Garage, In Service, Draft
    const statusFilterBtn = host.querySelector('button[role="combobox"][aria-label="Vehicle status"]');
    assert.ok(statusFilterBtn, 'Status filter combobox should exist for vehicles');
    assert.ok(statusFilterBtn.textContent.includes('All Statuses'));

    // Open options
    await act(async () => statusFilterBtn.click());
    const optionLabels = [...document.querySelectorAll('[role="option"]')].map(o => o.textContent.trim());
    assert.ok(optionLabels.includes('All Statuses'));
    assert.ok(optionLabels.includes('Available'));
    assert.ok(optionLabels.includes('In Garage'));
    assert.ok(optionLabels.includes('In Service'));
    assert.ok(optionLabels.includes('Draft'));

    // Initially all 4 vehicles should be visible
    let rows = host.querySelectorAll('tbody tr');
    assert.equal(rows.length, 4, 'All 4 vehicles should be visible under All Statuses');

    // Filter by IN_GARAGE
    const inGarageOption = [...document.querySelectorAll('[role="option"]')].find(o => o.textContent.trim() === 'In Garage');
    await act(async () => inGarageOption.click());

    rows = host.querySelectorAll('tbody tr');
    assert.equal(rows.length, 1, 'Only 1 vehicle should be shown for IN_GARAGE filter');
    assert.ok(rows[0].textContent.includes('SP-LK-3320'));
    assert.ok(rows[0].querySelector('[data-status="IN_GARAGE"]').classList.contains('erp-status-garage'));

    // Filter by IN_SERVICE
    await act(async () => statusFilterBtn.click());
    const inServiceOption = [...document.querySelectorAll('[role="option"]')].find(o => o.textContent.trim() === 'In Service');
    await act(async () => inServiceOption.click());

    rows = host.querySelectorAll('tbody tr');
    assert.equal(rows.length, 1);
    assert.ok(rows[0].textContent.includes('WP-DA-9150'));
    assert.ok(rows[0].querySelector('[data-status="IN_SERVICE"]').classList.contains('erp-status-service'));

    // Filter by DRAFT
    await act(async () => statusFilterBtn.click());
    const draftOption = [...document.querySelectorAll('[role="option"]')].find(o => o.textContent.trim() === 'Draft');
    await act(async () => draftOption.click());

    rows = host.querySelectorAll('tbody tr');
    assert.equal(rows.length, 1);
    assert.ok(rows[0].textContent.includes('WP-BIKE-001'));

    // Reset filter to All Statuses
    await act(async () => statusFilterBtn.click());
    const allOption = [...document.querySelectorAll('[role="option"]')].find(o => o.textContent.trim() === 'All Statuses');
    await act(async () => allOption.click());

    rows = host.querySelectorAll('tbody tr');
    assert.equal(rows.length, 4);

    // 3. Click vehicle to open supplier-style details popup
    const targetRow = [...rows].find(r => r.textContent.includes('WP-CAB-4821'));
    await act(async () => {
      targetRow.click();
    });

    const modal = host.querySelector('[role="dialog"][aria-label="Vehicle details"]');
    assert.ok(modal, 'Vehicle details modal should be open');
    assert.ok(modal.classList.contains('master-details-modal'), 'Should use RecordDetailsModal / master-details-modal styling');
    assert.ok(modal.classList.contains('supplier-floating-card'), 'Should use supplier-floating-card styling');
    assert.ok(modal.textContent.includes('WP-CAB-4821'));
    assert.ok(modal.textContent.includes('Isuzu Elf 4-Ton Truck'));

    // Check action buttons in popup view
    const changeStatusBtn = [...modal.querySelectorAll('button')].find(b => b.textContent.trim() === 'Change Status');
    assert.ok(changeStatusBtn, 'Change Status button should be present in vehicle details popup');
    assert.ok(changeStatusBtn.classList.contains('purchase-inspection-warning'), 'Vehicle status change button should have orange/warning tone like supplier status change');

    const editBtn = [...modal.querySelectorAll('button')].find(b => b.textContent.trim() === 'Edit Vehicle');
    assert.ok(editBtn, 'Edit Vehicle button should be present in vehicle details popup');

    // 4. Click "Change Status" to open the status reason popup
    await act(async () => {
      changeStatusBtn.click();
    });

    const statusDialog = host.querySelector('.supplier-status-dialog');
    assert.ok(statusDialog, 'Status reason dialog should be open with supplier-status-dialog styling');
    assert.ok(statusDialog.classList.contains('supplier-status-available'), 'Should have green tone matching available current status');
    assert.ok(statusDialog.textContent.includes('WP-CAB-4821'));
    assert.ok(statusDialog.textContent.includes('Change Vehicle Status'));

    // Check status options in reason popup
    const newStatusSelect = statusDialog.querySelector('select[aria-label="New status"]');
    assert.ok(newStatusSelect, 'New status select should be present in the reason dialog');
    const newStatusOptions = [...newStatusSelect.querySelectorAll('option')].map(o => o.value);
    assert.deepEqual(newStatusOptions, ['IN_SERVICE', 'IN_GARAGE']);
    assert.ok(statusDialog.querySelector('.modern-filter-trigger'), 'Should use modern GRN dropdown theme');
    assert.ok(modal.querySelector('.master-details-print-btn.erp-button-primary'), 'Print button should have blue primary styling');

    // Confirm button should be disabled when reason is empty
    const confirmBtn = statusDialog.querySelector('.supplier-status-confirm');
    assert.ok(confirmBtn.disabled, 'Confirm status change should be disabled without a reason');

    // Select IN_GARAGE
    await act(async () => {
      newStatusSelect.value = 'IN_GARAGE';
      newStatusSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    });

    // Enter reason
    const reasonTextarea = statusDialog.querySelector('textarea[aria-label="Status change reason"]');
    assert.ok(reasonTextarea, 'Reason textarea should exist');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(
        reasonTextarea,
        'Scheduled suspension repair and painting'
      );
      reasonTextarea.dispatchEvent(new window.Event('input', { bubbles: true }));
    });

    assert.equal(confirmBtn.disabled, false, 'Confirm button should be enabled after entering reason');

    // Confirm status change
    await act(async () => {
      confirmBtn.click();
    });

    assert.deepEqual(statusChangeCalledWith, {
      id: 101,
      status: 'IN_GARAGE',
      reason: 'Scheduled suspension repair and painting'
    });

    // Reason dialog should be closed
    assert.equal(host.querySelector('.supplier-status-dialog'), null, 'Reason dialog should close on confirm');

    // Modal should now reflect the new status
    assert.ok(modal.textContent.includes('IN GARAGE'));

    // Close details modal
    const closeBtn = [...modal.querySelectorAll('button')].find(b => b.textContent.trim() === 'Close');
    await act(async () => {
      closeBtn.click();
    });
    assert.equal(host.querySelector('[role="dialog"][aria-label="Vehicle details"]'), null);

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
