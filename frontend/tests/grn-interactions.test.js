import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('GRN directory prints and intake accepts products with different destinations', async () => {
  const window = new Window();
  Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import('react-dom/client');
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {
    const apis = await server.ssrLoadModule('/src/api/apiClient.js');
    for (const [name, api] of Object.entries(apis)) {
      if (!name.endsWith('Api') || !api || typeof api !== 'object') continue;
      for (const method of Object.keys(api)) if (typeof api[method] === 'function') api[method] = async () => ({ data: [] });
    }
    const products = [
      { id: 1, sku: 'P-1', name: 'First product', defaultWarehouseId: 10, defaultWarehouseName: 'Hidden North Warehouse', categoryName: 'Rice', brandName: 'First brand', markupPercent: 25, costPrice: 4 },
      { id: 2, sku: 'P-2', name: 'Second product', defaultWarehouseId: 20, defaultWarehouseName: 'Hidden South Warehouse', categoryName: 'Flour', brandName: 'Second brand', markupPercent: 0, costPrice: 6 },
    ];
    const grn = { id: 5, grnNumber: 'GRN-5', supplierName: 'Test supplier', notes:'Delivery checked', warehouseName: 'Hidden North Warehouse', receivedDate: '2026-10-10', status: 'PROCESSED', items: [{ productId: 1,productSku:'P-1',productName:'First product' }, { productId: 1,productSku:'P-1',productName:'First product' }, { productId: 2,productSku:'P-2',productName:'Second product' }] };
    apis.grnApi.search = async () => ({ data: { content: [grn,{...grn,id:9,grnNumber:'GRN-OLDER',receivedDate:'2026-10-09'}] } });
    apis.grnApi.getById = async () => ({ data: grn });
    apis.supplierApi.getActive = async () => ({ data: [{ id: 3, name: 'Test supplier' }] });
    apis.productApi.getProducts = async () => ({ data: { content: products } });
    apis.productApi.getById = async (id) => ({ data: products.find(product=>product.id===id) });
    const stockRequests = [];
    apis.inventoryApi.getWarehouseStock = async (id) => { stockRequests.push(id); return { data: [] }; };
    let saved;
    apis.grnApi.create = async (payload) => { saved = payload; return { data: { grnNumber: 'GRN-6' } }; };
    let printed,printedGrnId;
    apis.pdfApi.printGrn=async id=>{printedGrnId=id;};
    window.open = () => ({ focus() {}, print() {}, document: { readyState: 'complete', querySelectorAll() { return []; }, open() {}, write(html) { printed = html; }, close() {} } });
    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    const { default: GrnView } = await server.ssrLoadModule('/src/views/GrnView.jsx');
    const ref = React.createRef();
    await act(async () => root.render(React.createElement(AuthProvider, null, React.createElement(ToastProvider, null, React.createElement(GrnView, { ref })))));
    assert.deepEqual([...host.querySelectorAll('thead th')].map((cell) => cell.textContent.trim()), ['GRN NUMBER', 'SUPPLIER', 'TOTAL PRODUCTS', 'DATE', 'STATUS', 'REMARKS', 'ACTIONS']);
    assert.equal(host.querySelector('tbody tr td:nth-child(3)').textContent.trim(), '2');
    assert.ok(!host.textContent.includes('Hidden North Warehouse'));
    assert.ok(!host.textContent.includes('Create GRN'));
    assert.equal(host.querySelector('[aria-label="Refresh records"]').textContent.trim(), '');
    await act(async()=>host.querySelector('[aria-label="GRN date range"]').click());
    const calendar=document.querySelector('[aria-label="Choose GRN date range"]');assert.ok(calendar);
    const today=new Date(), offset=(2026-today.getFullYear())*12+9-today.getMonth();
    for(let step=0;step<Math.abs(offset);step++) await act(async()=>calendar.querySelector(`[aria-label="${offset<0 ? 'Previous' : 'Next'} month"]`).click());
    await act(async()=>calendar.querySelector('[aria-label="10 October 2026"]').click());
    await act(async()=>calendar.querySelector('[aria-label="10 October 2026"]').click());
    assert.equal(host.querySelectorAll('tbody tr').length,1);
    await act(async () => host.querySelector('[aria-label="Print GRN Directory (A4)"]').click());
    assert.ok(!printed.includes('GRN-OLDER'));
    assert.ok(printed.includes('GRN-5') && printed.includes('Total Products'));
    assert.ok(!printed.includes('Hidden North Warehouse'));
    await act(async () => host.querySelector('tbody tr').click());
    const popup = host.querySelector('[role="dialog"]');
    assert.equal(popup.querySelector('.grn-inspection-details'), null);
    assert.ok(popup.querySelector('.purchase-inspection-items table'));
    const header=popup.querySelector('.purchase-inspection-header');
    assert.equal(popup.querySelector('.purchase-inspection-sidebar'),null);
    const details=header.querySelector('.purchase-inspection-details-card');assert.ok(details.querySelector('.purchase-inspection-details'));
    for(const text of ['GRN-5','PROCESSED']) assert.ok(header.textContent.includes(text));
    for(const text of ['Test supplier','2026-10-10','Delivery checked']) assert.ok(details.textContent.includes(text));
    assert.ok(header.querySelector('[aria-label="Close GRN details"]'));
    assert.equal(popup.querySelector('.purchase-inspection-actions'),null,'No bottom buttons remain');
    const toolbar=popup.querySelector('.purchase-inspection-table-toolbar');assert.ok(toolbar);
    assert.ok(toolbar.querySelector('[aria-label="Print GRN"]'));assert.equal(toolbar.querySelector('.modern-filter-trigger'),null);assert.equal(toolbar.querySelector('[aria-label="Print GRN"]').textContent.trim(),'Print');
    const tableSearch=toolbar.querySelector('[aria-label="Search GRN products"]');
    const searchRows=async value=>act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(tableSearch,value);tableSearch.dispatchEvent(new window.Event('input',{bubbles:true}));});
    await searchRows('P-2');assert.equal(popup.querySelectorAll('tbody tr').length,1);assert.ok(popup.querySelector('tbody').textContent.includes('Second product'));
    await searchRows('Unknown product');assert.ok(popup.querySelector('tbody').textContent.includes('No matching products'));
    await searchRows('Second');assert.equal(popup.querySelectorAll('tbody tr').length,1);assert.ok(popup.querySelector('tbody').textContent.includes('Second product'));
    await act(async()=>toolbar.querySelector('[aria-label="Print GRN"]').click());assert.equal(printedGrnId,5,'Toolbar keeps the selected GRN print action');
    await act(async()=>toolbar.querySelector('[aria-label="Clear table search"]').click());assert.equal(popup.querySelectorAll('tbody tr').length,3);

    assert.equal(popup.querySelectorAll('[title="Print GRN"]').length, 1);
    assert.equal(popup.querySelector('footer'), null);
    assert.ok(!popup.textContent.includes('TOTAL INWARD VALUE'));
    assert.ok(!popup.textContent.includes('PDF'));
    await act(async () => popup.querySelector('[aria-label="Close GRN details"]').click());
    await act(async()=>host.querySelector('tbody tr').click());
    await act(async()=>host.querySelector('[aria-label="Close GRN details"]').click());
    assert.equal(host.querySelector('[role="dialog"]'),null);
    await act(async () => ref.current.openCreate());
    assert.deepEqual([...host.querySelectorAll('thead th')].map((cell) => cell.textContent.trim()), ['Product code', 'Product name', 'Qty', 'Unit cost', 'MP%', 'Selling price', 'Actions']);
    assert.ok(!host.textContent.includes('Supplier invoice') && !host.textContent.includes('GRN type'));
    assert.ok(!host.querySelector('input[name="freeQuantity"]') && !host.querySelector('input[name="discountPercent"]'));
    for (const product of products) {
      const input = host.querySelector('input[placeholder^="Search product"]');
      await act(async () => { input.blur(); input.focus(); });
      const label = [...host.querySelectorAll('span')].find((span) => span.textContent === product.sku);
      assert.ok(label, `Product ${product.sku} is available`);
      assert.ok(!host.textContent.includes(product.defaultWarehouseName));
      await act(async () => label.closest('[role="option"]').click());
      if (product.id === 1) assert.equal(host.querySelector('input[name="salePrice"]').value, '5');
      await act(async () => host.querySelector('.grn-add-item').click());
    }
    assert.equal(host.querySelectorAll('tbody tr').length, 2);
    assert.deepEqual(stockRequests, [10, 20]);
    await act(async () => host.querySelector('[aria-label="Edit item 1"]').click());
    assert.equal(host.querySelector('input[name="salePrice"]').readOnly, true);
    const changeNumber = async (name, value) => act(async () => {
      const input = host.querySelector(`input[name="${name}"]`);
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    await changeNumber('costPrice', '8');
    await changeNumber('costPrice', '');
    assert.equal(host.querySelector('input[name="costPrice"]').value, '');
    await changeNumber('costPrice', '008');
    assert.equal(host.querySelector('input[name="costPrice"]').value, '8');
    assert.equal(host.querySelector('input[name="salePrice"]').value, '10');
    assert.equal(host.querySelector('[aria-label="Use brand MP%"]'), null);
    assert.equal(host.querySelector('input[name="markupPercent"]').value, '25');
    await act(async () => host.querySelector('.grn-add-item').click());
    assert.equal(host.querySelectorAll('tbody tr').length, 2, 'Editing replaces a line without duplicating its quantity');
    assert.ok(host.querySelector('tbody tr').textContent.includes('10.00'));
    await act(async () => host.querySelector('[aria-label="Remove item 2"]').click());
    assert.equal(host.querySelectorAll('tbody tr').length,2,'GRN row is kept until removal is confirmed');
    assert.ok(document.querySelector('[role="alertdialog"]'));
    await act(async()=>document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    assert.equal(document.querySelector('[role="alertdialog"]'),null);assert.equal(host.querySelectorAll('tbody tr').length,2);
    await act(async()=>host.querySelector('[aria-label="Remove item 2"]').click());
    await act(async()=>document.querySelector('.purchase-remove-confirm').click());
    assert.equal(host.querySelectorAll('tbody tr').length, 1);
    const save = [...host.querySelectorAll('button')].find((button) => /Save (as )?Draft/.test(button.textContent));
    await act(async () => save.click());
    assert.deepEqual(saved.items.map((item) => item.productId), [1]);
    assert.equal(saved.items[0].sellingPrice, 10);
    assert.equal(saved.items[0].markupPercent, 25);
    assert.equal(saved.warehouseId, undefined);
    await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent.includes('Upload Sheet')).click());
    const fileInput=host.querySelector('input[type="file"]');
    const content='Product name,Product code,Received qty,Unit cost,MP%,Selling price,Supplier,Remarks\nFirst product,P-1,1.5,8,25,10,Test supplier,Sheet delivery\nSecond product,P-2,2,6,50,9,Test supplier,Sheet delivery';
    Object.defineProperty(fileInput,'files',{configurable:true,value:[{name:'receipt.csv',text:async()=>content}]});
    await act(async()=>{fileInput.dispatchEvent(new window.Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,100));});
    assert.equal(host.querySelectorAll('tbody tr').length,2);
    assert.equal(host.querySelector('[aria-label="GRN number"]'),null);
    assert.equal(host.querySelector('[name="remarks"]').value,'Sheet delivery');
    await act(async()=>[...host.querySelectorAll('button')].find(button=>/Save (as )?Draft/.test(button.textContent)).click());
    assert.equal(saved.grnNumber,undefined);assert.equal(saved.supplierId,3);assert.equal(saved.notes,'Sheet delivery');
    assert.deepEqual(saved.items.map(item=>[item.productId,item.quantityReceived,item.unitCost,item.markupPercent,item.sellingPrice]),[[1,1.5,8,25,10],[2,2,6,50,9]]);
  } finally {
    // Allow native toast expiry timers to complete before removing the browser globals.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5500)); });
    await act(async () => { await window.happyDOM.waitUntilComplete(); root.unmount(); });
    await server.close(); await window.happyDOM.close();
    for (const key of ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']) delete globalThis[key];
  }
});
