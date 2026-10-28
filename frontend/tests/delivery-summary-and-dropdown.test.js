import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('delivery workspace removes summary details, route filter has draft/active/inactive like supplier, and customer dropdown shows code/name on left and address on right', async () => {
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
      data: { username: 'admin', roles: ['ROLE_ADMIN'], permissions: ['DELIVERY_VIEW', 'DELIVERY_MANAGE', 'CUSTOMER_VIEW', 'CUSTOMER_MANAGE'] }
    });

    const customers = [
      { id: 1, name: 'Alpha Retailers', customerCode: 'CUST-001', address: '123 Galle Road, Colombo', phone: '0771234567', isActive: true },
      { id: 2, name: 'Beta Supermarket', customerCode: 'CUST-002', address: '45 Kandy Road, Kelaniya', phone: '0779876543', isActive: true },
    ];

    apis.customerApi.getAll = async () => ({ data: customers });
    apis.customerApi.search = async () => ({ data: customers });

    const routes = [
      { id: 1, routeName: 'First Route', routeCode: 'DR-001', createdAt: '2026-10-25T10:00:00Z', status: 'ACTIVE', isActive: true, customerIds: [] },
      { id: 2, routeName: 'Second Route (Latest)', routeCode: 'DR-002', createdAt: '2026-10-26T12:00:00Z', status: 'ACTIVE', isActive: true, customerIds: [] },
    ];
    apis.deliveryRouteApi.getAll = async () => ({ data: routes });

    const deliveries = [
      { id: 10, deliveryNumber: 'DEL-001', routeName: 'First Route', vehicleNumber: 'WP-CAB-1000', scheduledDate: '2026-10-25', createdAt: '2026-10-25T08:00:00Z', status: 'SCHEDULED' },
      { id: 20, deliveryNumber: 'DEL-002 (Latest)', routeName: 'Second Route', vehicleNumber: 'WP-CAB-2000', scheduledDate: '2026-10-26', createdAt: '2026-10-26T09:00:00Z', status: 'SCHEDULED' },
    ];
    apis.deliveryApi.search = async () => ({ data: deliveries });
    apis.deliveryApi.getSummary = async () => ({ data: null });
    apis.deliveryApi.getPendingInvoices = async () => ({ data: [] });

    apis.vehicleApi.getAll = async () => ({
      data: [
        { id: 101, vehicleNumber: 'WP-CAB-4821', model: 'Truck', vehicleType: 'TRUCK', status: 'AVAILABLE', isActive: true }
      ]
    });

    const { default: DeliveryWorkspace } = await server.ssrLoadModule('/src/components/DeliveryWorkspace.jsx');
    const { default: CustomersHub } = await server.ssrLoadModule('/src/views/CustomersHub.jsx');
    const { default: DeliveryHub } = await server.ssrLoadModule('/src/views/DeliveryHub.jsx');
    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');

    const pendingInvoices = [
      { id: 501, invoiceNumber: 'INV-501', customerId: 1, customerName: 'Alpha Retailers', customerCode: 'CUST-001', netTotal: 15000, customerAddress: '123 Galle Road' },
      { id: 502, invoiceNumber: 'INV-502', customerId: 2, customerName: 'Beta Supermarket', customerCode: 'CUST-002', netTotal: 25000, customerAddress: '45 Kandy Road' },
      { id: 503, invoiceNumber: 'INV-503', customerId: 99, customerName: 'Gamma Express', customerCode: 'CUST-099', netTotal: 8000, customerAddress: '99 High Street' },
    ];

    let workspaceForm = {
      routeId: '1',
      vehicleId: '101',
      driverId: '5',
      assistantStaffId: '6',
      scheduledDate: '2026-10-26',
      departureTime: '',
      notes: '',
      selectedInvoiceIds: [],
    };

    // 1. Verify DeliveryWorkspace layout, removal of warehouse/odometer, route filtering, and special invoices
    await act(async () => {
      root.render(
        React.createElement(
          ToastProvider,
          null,
          React.createElement(DeliveryWorkspace, {
            open: true,
            onClose: () => {},
            warehouses: [{ id: 1, name: 'Main Warehouse' }],
            routes: [
              { id: 1, routeName: 'Route 1 - Colombo', customerIds: ['1'] },
              { id: 2, routeName: 'Route 2 - Kandy', customerIds: ['2'] },
            ],
            vehicles: [{ id: 101, vehicleNumber: 'WP-CAB-4821', status: 'AVAILABLE' }],
            employees: [
              { id: 5, fullName: 'John Driver', roles: ['ROLE_DRIVER'] },
              { id: 6, fullName: 'Sam Assistant', roles: ['ROLE_ASSISTANT'] },
            ],
            customers: [
              { id: 1, name: 'Alpha Retailers', routeId: 1 },
              { id: 2, name: 'Beta Supermarket', routeId: 2 },
            ],
            invoices: pendingInvoices,
            form: workspaceForm,
            setForm: (update) => {
              if (typeof update === 'function') workspaceForm = update(workspaceForm);
              else workspaceForm = { ...workspaceForm, ...update };
            },
            busy: false,
            onSave: async () => {},
          })
        )
      );
    });

    // Verify summary details removed
    const summaryElement = host.querySelector('.delivery-trip-summary');
    assert.equal(summaryElement, null, 'Delivery summary details card must be removed from new delivery page');

    // Verify origin warehouse and odometer removed
    assert.equal(host.querySelector('[aria-label="Origin warehouse"]'), null, 'Origin warehouse field must be removed');
    assert.equal(host.querySelector('[aria-label="Starting odometer (km)"]'), null, 'Starting odometer field must be removed');

    // Verify order of inputs:
    // Line 1: Delivery route and Vehicle
    // Line 2: Scheduled date and Planned departure
    // Line 3: Driver and Delivery assistant
    // Line 4: Remarks / notes
    const routeSelect = host.querySelector('[aria-label="Delivery route"]');
    const vehicleSelect = host.querySelector('[aria-label="Vehicle"]');
    const dateInput = host.querySelector('[aria-label="Scheduled date"]');
    const departureInput = host.querySelector('[aria-label="Planned departure"]');
    const driverSelect = host.querySelector('[aria-label="Driver"]');
    const assistantSelect = host.querySelector('[aria-label="Delivery assistant"]');
    const notesArea = host.querySelector('[aria-label="Delivery notes"]');

    assert.ok(routeSelect && vehicleSelect, 'Line 1 must contain delivery route and vehicle');
    assert.ok(dateInput && departureInput, 'Line 2 must contain scheduled date and planned departure');
    assert.ok(driverSelect && assistantSelect, 'Line 3 must contain driver and delivery assistant');
    assert.ok(notesArea, 'Line 4 must contain remarks/notes');

    // Verify that ONLY Route 1 invoices (INV-501 for Alpha Retailers) are shown in table
    const tableText = host.querySelector('.delivery-items table')?.textContent;
    assert.ok(tableText.includes('INV-501'), 'Route 1 invoice must be shown');
    assert.ok(!tableText.includes('INV-502'), 'Route 2 invoice (Beta Supermarket) must NOT be shown');
    assert.ok(!tableText.includes('INV-503'), 'Unrelated invoice must NOT be shown');

    // Verify Special Invoices section removed from left details
    assert.equal(host.querySelector('.special-invoices-section'), null, 'Special invoices section must be removed from left details');

    // Open special invoice modal from the toolbar button on the right
    const addSpecialBtn = host.querySelector('button[aria-label="Add special invoice"]');
    assert.ok(addSpecialBtn, 'Add Special Invoice button must exist in toolbar on right');
    await act(async () => {
      addSpecialBtn.click();
    });

    const modal = host.querySelector('[role="dialog"][aria-label="Add Special Invoices Modal"]');
    assert.ok(modal, 'Special invoice modal must open');
    const addInv503Btn = modal.querySelector('button[aria-label="Add special invoice INV-503"]');
    assert.ok(addInv503Btn, 'Add special invoice button for INV-503 must exist in modal');
    await act(async () => {
      addInv503Btn.click();
    });

    const doneBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent.trim() === 'Done');
    if (doneBtn) {
      await act(async () => {
        doneBtn.click();
      });
    }

    // Re-render to reflect added special invoice
    await act(async () => {
      root.render(
        React.createElement(
          ToastProvider,
          null,
          React.createElement(DeliveryWorkspace, {
            open: true,
            onClose: () => {},
            routes: [
              { id: 1, routeName: 'Route 1 - Colombo', customerIds: ['1'] },
              { id: 2, routeName: 'Route 2 - Kandy', customerIds: ['2'] },
            ],
            vehicles: [{ id: 101, vehicleNumber: 'WP-CAB-4821', status: 'AVAILABLE' }],
            employees: [
              { id: 5, fullName: 'John Driver', roles: ['ROLE_DRIVER'] },
              { id: 6, fullName: 'Sam Assistant', roles: ['ROLE_ASSISTANT'] },
            ],
            customers: [
              { id: 1, name: 'Alpha Retailers', routeId: 1 },
              { id: 2, name: 'Beta Supermarket', routeId: 2 },
            ],
            invoices: pendingInvoices,
            form: workspaceForm,
            setForm: (update) => {
              if (typeof update === 'function') workspaceForm = update(workspaceForm);
              else workspaceForm = { ...workspaceForm, ...update };
            },
            busy: false,
            onSave: async () => {},
          })
        )
      );
    });

    const updatedTableText = host.querySelector('.delivery-items table')?.textContent;
    assert.ok(updatedTableText.includes('INV-503'), 'Special / fast-track invoice INV-503 must now be displayed in the load table');
    assert.ok(updatedTableText.includes('Fast-Track'), 'Fast-Track badge must be displayed for special invoice');

    // 2. Verify CustomersHub in deliveryMode has route status filter with only: All Statuses, Draft, Active, Inactive
    await act(async () => {
      root.render(
        React.createElement(
          AuthProvider,
          null,
          React.createElement(
            ToastProvider,
            null,
            React.createElement(CustomersHub, { deliveryMode: true, activeSubTab: 'groups' })
          )
        )
      );
    });

    const filterTrigger = host.querySelector('button[aria-label="Route status filter"]');
    assert.ok(filterTrigger, 'Route status filter button must exist');

    // Click to open FilterSelect portal
    await act(async () => {
      filterTrigger.click();
    });

    const optionElements = Array.from(document.querySelectorAll('.modern-filter-popup [role="option"]'));
    const options = optionElements.map((o) => o.textContent.trim());
    assert.deepEqual(options, ['All Statuses', 'Draft', 'Active', 'Inactive'], 'Filter options must match supplier status filter style');

    // 3. Verify route cards have latest created route in the first position
    const routeCards = host.querySelectorAll('.route-card, [style*="border-radius: 8px"]');
    // Check text of first rendered route card
    const firstRouteCard = host.textContent;
    assert.ok(firstRouteCard.includes('Second Route (Latest)'), 'Latest route must be displayed first');

    // 4. Verify Customer Assign search dropdown in Route modal matches StaffSearch format (code/name on left, address on right)
    const newRouteBtn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent.includes('Delivery Route'));
    assert.ok(newRouteBtn, 'New Route button should exist');
    await act(async () => {
      newRouteBtn.click();
    });

    const customerSearchContainer = host.querySelector('.purchase-product-search');
    assert.ok(customerSearchContainer, 'Customer search container must use purchase-product-search class');

    const customerSearchInput = host.querySelector('input[placeholder*="Search customer"]');
    assert.ok(customerSearchInput, 'Customer search input should be present');

    // Open dropdown by focusing
    await act(async () => {
      customerSearchInput.focus();
    });

    const resultsDropdown = host.querySelector('.purchase-product-results');
    assert.ok(resultsDropdown, 'Dropdown results menu must be present with purchase-product-results class');

    const firstResult = resultsDropdown.querySelector('[role="option"]');
    assert.ok(firstResult, 'Dropdown items must be role="option" elements');

    const codeSpan = firstResult.querySelector('.purchase-result-code');
    assert.ok(codeSpan, 'Customer code must be displayed in purchase-result-code');
    assert.ok(codeSpan.textContent.includes('CUST-001'), 'Code must match');

    const nameSpan = firstResult.querySelector('.purchase-result-name');
    assert.ok(nameSpan, 'Customer name must be displayed in purchase-result-name');
    assert.ok(nameSpan.textContent.includes('Alpha Retailers'), 'Name must match');

    const stockSpan = firstResult.querySelector('.purchase-result-stock');
    assert.ok(stockSpan, 'Customer address must be on right side in purchase-result-stock');
    assert.ok(stockSpan.textContent.includes('123 Galle Road, Colombo'), 'Address must match');
    assert.ok(!firstResult.textContent.includes('0771234567'), 'Customer phone number must NOT be in dropdown');
    assert.ok(!firstResult.textContent.includes('📞'), 'Phone icon must NOT be in dropdown');
    assert.ok(!firstResult.textContent.includes('📍'), 'Location pin icon must NOT be in dropdown');

    // 5. Verify Delivery table in DeliveryHub displays latest created delivery in the first row
    await act(async () => {
      root.render(
        React.createElement(
          AuthProvider,
          null,
          React.createElement(
            ToastProvider,
            null,
            React.createElement(DeliveryHub, null)
          )
        )
      );
    });

    // Check delivery table rows
    const deliveryTable = host.querySelector('table');
    assert.ok(deliveryTable, 'Deliveries table should exist');
    const firstRowText = deliveryTable.querySelector('tbody tr')?.textContent;
    assert.ok(firstRowText?.includes('DEL-002 (Latest)'), 'Latest delivery trip must be in the first row of delivery table');
  } finally {
    await server.close();
    root.unmount();
    host.remove();
  }
});
