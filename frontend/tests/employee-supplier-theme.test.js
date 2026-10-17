import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('Employee List toolbar, table, popup view, and create modal use the standardized Supplier theme', async () => {
  const window = new Window();
  Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
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

    localStorage.setItem('nbh_token', `test.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.sig`);
    apis.authApi.getMe = async () => ({
      data: { username: 'admin', roles: ['ROLE_ADMIN'], permissions: ['USER_VIEW', 'USER_MANAGE'] },
    });

    const mockEmployees = [
      {
        id: 10,
        username: 'john.smith',
        fullName: 'John Smith',
        employeeCode: 'EMP-0010',
        phone: '+94 77 123 4567',
        email: 'john@example.com',
        isActive: true,
        approvalStatus: 'APPROVED',
        status: 'ACTIVE',
        roles: ['ROLE_SALES'],
        createdAt: '2025-01-15T00:00:00Z',
      },
      {
        id: 11,
        username: 'draft.user',
        fullName: 'Draft User',
        employeeCode: 'EMP-0011',
        phone: '+94 71 987 6543',
        email: 'draft@example.com',
        isActive: false,
        approvalStatus: 'DRAFT',
        status: 'DRAFT',
        roles: ['ROLE_STAFF'],
        createdAt: '2025-02-01T00:00:00Z',
      },
      {
        id: 12,
        username: 'inactive.user',
        fullName: 'Inactive User',
        employeeCode: 'EMP-0012',
        phone: null,
        email: null,
        isActive: false,
        approvalStatus: 'APPROVED',
        status: 'INACTIVE',
        roles: ['ROLE_CASHIER'],
        createdAt: '2025-02-10T00:00:00Z',
      },
    ];

    apis.userApi.getAll = async () => ({ data: { content: mockEmployees } });
    apis.roleApi.getAll = async () => ({
      data: [
        { id: 1, name: 'ROLE_SALES', description: 'Sales Representative' },
        { id: 2, name: 'ROLE_CASHIER', description: 'Cashier' },
        { id: 3, name: 'ROLE_STAFF', description: 'General Staff' },
      ],
    });

    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    const { default: EmployeesHub } = await server.ssrLoadModule('/src/views/EmployeesHub.jsx');

    await act(async () => {
      root.render(
        React.createElement(AuthProvider, null,
          React.createElement(ToastProvider, null,
            React.createElement(EmployeesHub, { activeSubTab: 'list' })
          )
        )
      );
    });

    // 1. Toolbar Verification
    const toolbar = host.querySelector('.master-toolbar');
    assert.ok(toolbar, 'Toolbar exists with master-toolbar class matching Supplier theme');

    const searchInput = toolbar.querySelector('input.erp-search-input');
    assert.ok(searchInput, 'Reusable SearchBar input exists');
    assert.ok(searchInput.getAttribute('placeholder').startsWith('Search employees'), 'Search placeholder is correct');

    // Status filter options: ALL, DRAFT, ACTIVE, INACTIVE
    const statusTrigger = toolbar.querySelector('button[role="combobox"]');
    assert.ok(statusTrigger, 'Status FilterSelect trigger exists');
    assert.equal(statusTrigger.getAttribute('title'), 'Filter records by status');

    await act(async () => {
      statusTrigger.click();
    });

    const options = [...document.querySelectorAll('[role="option"]')];
    const optionValues = options.map((o) => o.getAttribute('data-value'));
    assert.deepEqual(optionValues, ['ALL', 'DRAFT', 'ACTIVE', 'INACTIVE'], 'Status options include DRAFT, ACTIVE, and INACTIVE');

    // Close filter dropdown
    await act(async () => {
      statusTrigger.click();
    });

    // Toolbar buttons: Print and Refresh exist; NO export CSV button
    const toolbarButtons = [...toolbar.querySelectorAll('button')];
    const printBtn = toolbarButtons.find((b) => b.getAttribute('aria-label') === 'Print Employee Directory (A4)');
    const refreshBtn = toolbarButtons.find((b) => b.getAttribute('aria-label') === 'Refresh employee records');
    const csvBtn = toolbarButtons.find((b) => (b.textContent || '').includes('CSV') || (b.getAttribute('aria-label') || '').includes('CSV'));

    assert.ok(printBtn, 'Print Employee Directory (A4) icon button exists');
    assert.ok(refreshBtn, 'Refresh employee records icon button exists');
    assert.equal(csvBtn, undefined, 'Export CSV button is omitted as requested');

    // 2. Table Header Verification: EMPLOYEE CODE first column
    const headers = [...host.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    assert.equal(headers[0], 'EMPLOYEE CODE', 'First column is EMPLOYEE CODE');
    assert.equal(headers[1], 'EMPLOYEE NAME', 'Second column is EMPLOYEE NAME');
    assert.equal(headers[2], 'ROLE', 'Third column is ROLE');
    assert.equal(headers[3], 'PHONE / EMAIL', 'Fourth column is PHONE / EMAIL');
    assert.equal(headers[4], 'JOINED', 'Fifth column is JOINED');
    assert.equal(headers[5], 'STATUS', 'Sixth column is STATUS');
    assert.equal(headers[6], 'ACTIONS', 'Seventh column is ACTIONS');

    // Table rows rendering
    const rows = host.querySelectorAll('tbody tr');
    assert.equal(rows.length, 3, 'All 3 employee rows rendered');
    assert.ok(rows[0].textContent.includes('EMP-0010'), 'Row 1 displays EMP-0010');
    assert.ok(rows[0].textContent.includes('John Smith'), 'Row 1 displays John Smith');
    assert.ok(rows[0].textContent.includes('Sales'), 'Row 1 displays Sales role');
    assert.ok(rows[1].textContent.includes('EMP-0011'), 'Row 2 displays EMP-0011');
    assert.ok(rows[1].textContent.includes('Draft User'), 'Row 2 displays Draft User');

    // 3. Employee Popup View Verification (Supplier-themed RecordDetailsModal & RecordActions)
    await act(async () => {
      rows[0].click(); // Click active employee John Smith
    });

    const detailsModal = host.querySelector('.glass-modal.supplier-floating-card');
    assert.ok(detailsModal, 'EmployeeDetailsModal popup opened with supplier-floating-card theme');
    assert.ok(detailsModal.textContent.includes('EMP-0010'), 'Displays staff code in popup');
    assert.ok(detailsModal.textContent.includes('John Smith'), 'Displays full name in popup');

    // RecordActions in popup: active employee has Deactivate button
    const deactivateBtn = detailsModal.querySelector('button[aria-label="Deactivate Employee"]');
    assert.ok(deactivateBtn, 'Status change button "Deactivate Employee" exists in popup');

    // Close modal
    const closeBtn = detailsModal.querySelector('button[data-close]');
    assert.ok(closeBtn, 'Close button exists');
    await act(async () => {
      closeBtn.click();
    });

    // Click inactive employee to verify Reactivate button in popup (same as Supplier)
    const freshRows = host.querySelectorAll('tbody tr');
    await act(async () => {
      freshRows[2].click(); // Inactive User
    });
    const inactiveDetailsModal = host.querySelector('.glass-modal.supplier-floating-card');
    assert.ok(inactiveDetailsModal, 'Inactive employee popup opened');
    const reactivateBtn = inactiveDetailsModal.querySelector('button[aria-label="Reactivate Employee"]');
    assert.ok(reactivateBtn, 'Status change button "Reactivate Employee" exists for inactive employee in popup');

    await act(async () => {
      inactiveDetailsModal.querySelector('button[data-close]').click();
    });

    // 4. Employee Create Modal Verification (Supplier-themed EmployeeEditorModal workspace layout)
    const newEmpBtn = host.querySelector('button.btn-primary');
    assert.ok(newEmpBtn && newEmpBtn.textContent.includes('New Employee'), 'New Employee button exists');

    await act(async () => {
      newEmpBtn.click();
    });

    const editorWorkspace = host.querySelector('.supplier-workspace-shell .allocation-workspace.supplier-editor');
    assert.ok(editorWorkspace, 'EmployeeEditorModal opened in 2-column workspace layout matching SupplierEditorModal');

    const codeField = editorWorkspace.querySelector('[aria-label="Staff code"]');
    assert.ok(codeField, 'Staff code read-only field exists');
    assert.equal(codeField.readOnly, true, 'Staff code field is read-only');

    const draftBtn = [...editorWorkspace.querySelectorAll('button')].find((b) => b.textContent.includes('Save draft'));
    assert.ok(draftBtn && draftBtn.textContent.includes('Save draft'), 'Save draft button exists');

    const saveBtn = editorWorkspace.querySelector('button.allocation-primary');
    assert.ok(saveBtn && saveBtn.textContent.includes('Save Employee'), 'Save Employee button exists');

    const summaryAside = editorWorkspace.querySelector('aside.allocation-receipt');
    assert.ok(summaryAside, 'Summary card aside exists matching Supplier theme');

  } finally {
    await act(async () => root.unmount());
    await server.close();
    await window.happyDOM.close();
    for (const key of ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']) {
      delete globalThis[key];
    }
  }
});
