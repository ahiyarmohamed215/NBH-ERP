import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('Purchasing popups share compact details, table controls and status workflows', async () => {
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
    apis.productApi.getProducts=async()=>({data:{content:[{id:1,sku:'TEST-1',name:'Test product',defaultWarehouseId:1,costPrice:5}]}});
    apis.warehouseApi.getActive=async()=>({data:[{id:1,name:'North'},{id:2,name:'South'}]});
    apis.inventoryApi.getWarehouseStock=async()=>({data:[{productId:1,quantity:0,reservedQuantity:0}]});
    const item = { id: 1, productId: 1, productSku: 'TEST-1', sku: 'TEST-1', productName: 'Test product', quantityTransferred: 2, quantityReturned: 2, quantity: 2, unitCost: 5, totalCost: 10 };
    const docs = {
      GTN: { id: 1, dispatchDate:'2026-10-10', gtnNumber: 'GTN-1', sourceWarehouseId:1,destinationWarehouseId:2, sourceWarehouseName: 'North', destinationWarehouseName: 'South', status: 'TRANSFERRED', responsibleStaffId: 5, responsibleStaffName:'Transfer staff', items: [item] },
      PRN: { id: 2, prnNumber: 'PRN-2', supplierId:7,warehouseId:1,sourceGrnId:10,supplierName: 'Supplier', warehouseName: 'North', returnDate: '2026-10-10', createdAt:'2026-10-11T09:00:00', remarks:'Supplier requested return', status: 'PROCESSED', totalAmount: 10, items: [{...item,sourceGrnId:10,originalGrnNumber:'GRN-10',supplierId:7,supplierName:'Supplier',warehouseId:1,warehouseName:'North',reason:'Damaged'}] },
      PO: { id: 3, poNumber: 'PO-3', supplierName: 'Supplier', warehouseName: 'North', orderDate: '2026-09-01', createdAt:'2026-10-10T09:00:00', status: 'DRAFT', totalAmount: 10, items: [item] },
    };
    for (const [name, api] of [['GTN', apis.gtnApi], ['PRN', apis.prnApi], ['PO', apis.purchaseOrderApi]]) {
      api.search = async () => ({ data: { content: [docs[name],{...docs[name],id:40,poNumber:'PO-OLDER',gtnNumber:'GTN-OLDER',prnNumber:'PRN-OLDER',orderDate:'2026-10-10',dispatchDate:'2026-10-09',returnDate:'2026-10-09',createdAt:'2026-10-09T09:00:00'}] } });
      api.getById = async () => ({ data: docs[name] });
      api.cancel = async (id,reason) => { if(name!=='GTN') assert.equal(reason,'Warehouse correction');docs[name]={...docs[name],status:'CANCELLED'};return {data:docs[name]}; };
      const process=async(id,reason)=>{if(name!=='GTN') assert.equal(reason,'Warehouse correction');docs[name]={...docs[name],status:name==='GTN'?'TRANSFERRED':name==='PRN'?'PROCESSED':'APPROVED'};return {data:docs[name]};};
      if(name==='GTN') { api.transfer=process;api.dispatch=async()=>{docs[name]={...docs[name],status:'PENDING',responsibleStaffId:5};return {data:docs[name]};};api.getResponsibleStaff=async()=>({data:[{id:5,fullName:'Transfer staff'}]}); }
      else if(name==='PRN') api.process=process;
      else api.changeStatus=async(id,status,reason)=>{assert.equal(reason,'Warehouse correction');docs.PO={...docs.PO,status};return {data:docs.PO};};
    }
    apis.gtnApi.changeStatus=async(id,request)=>{assert.ok(request.reason.trim());docs.GTN={...docs.GTN,status:request.status,lastStatusReason:request.reason};return {data:docs.GTN};};
    let printed = '';
    window.open = () => ({ document: { open() {}, write(html) { printed = html; }, close() {} } });
    apis.pdfApi.printGtn = () => { printed = 'GTN-1'; };
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    for (const [type, name] of [['GTN', 'GtnView'], ['PRN', 'PrnView'], ['PO', 'PurchaseOrdersView']]) {
      const { default: View } = await server.ssrLoadModule(`/src/views/${name}.jsx`);
      await act(async () => root.render(React.createElement(ToastProvider, null, React.createElement(View, { key: type }))));
      const printList = host.querySelector(`[aria-label="Print ${type} list"]`);
      assert.ok(printList, `${type}: list print control is available`);
      if(type==='PO') {
        assert.deepEqual([...host.querySelectorAll('thead th')].map(cell=>cell.textContent),['PO NUMBER','SUPPLIER','DESTINATION WAREHOUSE','TOTAL PRODUCTS','DATE','STATUS','REMARKS','ACTIONS']);
      }
      {
        await act(async()=>host.querySelector(`[aria-label="${type} date range"]`).click());
        let range=document.querySelector(`[aria-label="Choose ${type} date range"]`);assert.ok(range);
        const now=new Date(), monthOffset=(2026-now.getFullYear())*12+9-now.getMonth();
        for(let step=0;step<Math.abs(monthOffset);step++) await act(async()=>range.querySelector(`[aria-label="${monthOffset<0 ? 'Previous' : 'Next'} month"]`).click());
        await act(async()=>range.querySelector('[aria-label="10 October 2026"]').click());assert.ok(range.textContent.includes('Select the end date'));
        await act(async()=>range.querySelector('[aria-label="10 October 2026"]').click());assert.equal(document.querySelector(`[aria-label="Choose ${type} date range"]`),null);

        assert.equal([...host.querySelectorAll('tbody tr')].filter(row=>row.textContent.includes(type+'-')).length,1);
      }
      if(type==='PRN') assert.deepEqual([...host.querySelectorAll('thead th')].map(cell=>cell.textContent.trim()),['PRN NUMBER','SUPPLIER','WAREHOUSE','TOTAL PRODUCTS','DATE','STATUS','REMARKS','ACTIONS']);
      printed = '';
      await act(async () => printList.click());
      assert.ok(printed.includes(type + '-'), `${type}: list printing includes the visible record`);assert.ok(!printed.includes(type+'-OLDER'),'Date-filtered printing excludes older documents');
      assert.ok(host.querySelector('[aria-label="Refresh records"]'));
      assert.ok(!host.textContent.includes('Export'));
      assert.equal(host.querySelector('[title="Execute Transfer"], [title="Process Return to Supplier"]'), null);
      const row = [...host.querySelectorAll('tbody tr')].find((row) => row.textContent.includes(type + '-'));
      assert.ok(row, `${type} record is visible`);
      if(type==='PRN') {assert.ok(host.querySelector('thead').textContent.includes('TOTAL PRODUCTS'));assert.ok(!host.querySelector('thead').textContent.includes('TOTAL VALUE'));assert.equal(row.children[3].textContent.trim(),'1');}
      if(type==='PRN') {
        assert.equal(row.children[4].textContent.trim(),'2026-10-10');
        assert.equal(row.children[6].textContent.trim(),'Supplier requested return','Remarks show the saved notes instead of the record date');
        assert.ok(row.querySelector('[title="Edit PRN"]'),'Processed PRNs expose the same edit action as GRN');
      }
      await act(async () => row.click());
      const popup = host.querySelector('[role="dialog"]');
      assert.ok(popup, `${type} popup opens`);
      assert.ok(popup.querySelector('.purchase-inspection-items table').textContent.includes('Test product'));
      const actions = popup.querySelector('.purchase-inspection-table-toolbar');
      assert.ok(actions, `${type} has table search and print controls`);
      assert.equal(popup.querySelector('.purchase-inspection-actions'),null,'Popup has no bottom Print or Close buttons');
      const search=actions.querySelector(`[aria-label="Search ${type} products"]`);assert.ok(search);
      assert.equal(actions.querySelector('.modern-filter-trigger'),null);
      assert.equal(actions.querySelector(`[aria-label="Print ${type}"]`).textContent.trim(),'Print');
      const changeSearch=async value=>act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(search,value);search.dispatchEvent(new window.Event('input',{bubbles:true}));});
      await changeSearch('Missing product');assert.ok(popup.querySelector('tbody').textContent.includes('No matching products'));
      await changeSearch('TEST-1');assert.ok(popup.querySelector('tbody').textContent.includes('Test product'));
      await act(async()=>actions.querySelector('[aria-label="Clear table search"]').click());
      const header=popup.querySelector('.purchase-inspection-header');
      assert.ok(header.querySelector('.purchase-inspection-number-row .erp-status-badge'),'Status is alongside the document number');
      assert.ok(header.querySelector('.purchase-inspection-details-card'),'Document details use the same coloured card');
      assert.equal(popup.querySelector('.purchase-inspection-sidebar'),null,'Details are above the full-width table');
      assert.equal(popup.querySelector('.purchase-inspection-header-actions'),null,'Management buttons are grouped together in the details card');
      const card=header.querySelector('.purchase-inspection-details-card');
      assert.ok(card.querySelectorAll('.purchase-inspection-detail-actions button').length>=2);

      assert.ok(header.querySelector('[aria-label="Close '+type+' details"]'),'Top-right close icon is available');
      assert.equal(header.querySelector('.purchase-inspection-header-controls').querySelectorAll('button').length,1,'Only the close icon occupies the top-right controls');

      assert.ok(popup.classList.contains('purchase-inspection-bottom-actions'));
      assert.ok(popup.querySelector('.purchase-inspection-details'));
      if(type==='PO') assert.equal(popup.querySelector('.purchase-inspection-detail-actions button').textContent.trim(),'Edit PO');
      if(type==='PRN') assert.ok(popup.querySelector('.purchase-inspection-details').textContent.includes('Total valueLKR 10.00'));
      assert.ok(popup.querySelector('.grn-inspection-symbol'));
      assert.ok([...popup.querySelectorAll('th')].some(cell => cell.textContent === 'Product name'));
      assert.equal(popup.querySelectorAll(`[title="Print ${type}"]`).length, 1);
      assert.ok(!popup.textContent.includes('PDF'));
      assert.equal(popup.querySelector('footer'), null);
      assert.ok(!popup.textContent.includes('Total Order Value') && !popup.textContent.includes('TOTAL INWARD VALUE'));
      printed = '';
      await act(async () => actions.querySelector(`[title="Print ${type}"]`).click());
      assert.ok(printed.includes(type + '-'), `${type} prints the selected document`);
      const actionByText=text=>[...host.querySelectorAll('.purchase-inspection-detail-actions button, .purchase-inspection-header-actions button')].find(button=>button.textContent.trim()===text);
      if(type !== 'PO') {assert.ok(actionByText(`Cancel ${type}`),`${type}: cancellation is available in the popup`);assert.ok(actionByText(`Cancel ${type}`).closest('.purchase-inspection-details-card'),'Cancel is inside the details card');}
      assert.ok(actionByText(`Edit ${type}`).closest('.purchase-inspection-details-card'),'Edit is beside Cancel in the card');
      if(type==='GTN') {
        assert.equal(popup.querySelector('.purchase-inspection-header').querySelector('select, input, textarea'),null,'GTN view shows details without editable fields');
        assert.ok(popup.textContent.includes('Transfer staff'));
        assert.ok(actionByText('Edit GTN'));
        const transition=async(label,status)=>{
          await act(async()=>actionByText(label).click());
          const dialog=host.querySelector('[aria-label="Change GTN status"]');assert.ok(dialog);
          const submit=[...dialog.querySelectorAll('button')].find(button=>button.textContent==='Confirm status change');
          assert.equal(submit.disabled,true,'Every status change requires a reason');
          await act(async()=>{
            const reason=dialog.querySelector('textarea');
            Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(reason,'Warehouse correction');
            reason.dispatchEvent(new window.Event('input',{bubbles:true}));
          });
          if(status==='TRANSFERRED') { assert.equal(submit.disabled,true);await act(async()=>dialog.querySelector('input[type="checkbox"]').click()); }
          assert.equal(submit.disabled,false);await act(async()=>submit.click());
          assert.equal(host.querySelector('[aria-label="Change GTN status"]'),null);
          assert.ok(host.querySelector('.purchase-inspection-header').textContent.includes(status));
          assert.ok(host.querySelector('.purchase-inspection-details').textContent.includes('Warehouse correction'));
        };
        await transition('Change to Pending','PENDING');
        assert.ok(actionByText('Mark Transferred').classList.contains('purchase-inspection-success'));
        await transition('Cancel GTN','CANCELLED');
        assert.equal(actionByText('Edit GTN'),undefined);
        assert.ok(actionByText('Mark Transferred'));assert.ok(actionByText('Change to Pending'));
        await transition('Mark Transferred','TRANSFERRED');
        await transition('Cancel GTN','CANCELLED');
        await transition('Change to Pending','PENDING');
        await transition('Mark Transferred','TRANSFERRED');
        assert.equal(host.querySelector('.purchase-inspection-items').closest('[role="dialog"]').querySelector('.purchase-inspection-header').querySelector('select, input, textarea'),null);
      } else {
        const changeStatus=async(label)=>{
          const previousStatus=docs[type].status;
          await act(async()=>actionByText(label).click());
          const dialog=host.querySelector(`[aria-label="Change ${type} status"]`);assert.ok(dialog);
          const submit=[...dialog.querySelectorAll('button')].find(button=>button.textContent==='Confirm status change');assert.equal(submit.disabled,true);
          assert.equal(docs[type].status,previousStatus,'Opening the reason popup does not change status');
          await act(async()=>{const reason=dialog.querySelector('textarea');Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(reason,'Warehouse correction');reason.dispatchEvent(new window.Event('input',{bubbles:true}));});
          await act(async()=>submit.click());assert.equal(host.querySelector(`[aria-label="Change ${type} status"]`),null);
        };
        if(type==='PO') {
          assert.equal(actionByText('Approve PO'),undefined);assert.ok(actionByText('Cancel PO'));
          assert.ok(actionByText('Edit PO'));assert.ok(host.querySelector('[title="Edit Purchase Order"]'));
          await changeStatus('Inform to Order');assert.equal(docs.PO.status,'INFORM_TO_ORDER');
          assert.ok(actionByText('Edit PO'));assert.ok(host.querySelector('[title="Edit Purchase Order"]'));
          await changeStatus('Cancel PO');assert.equal(docs.PO.status,'CANCELLED');
          assert.equal(actionByText('Edit PO'),undefined);assert.equal(host.querySelector('[title="Edit Purchase Order"]'),null);
          await changeStatus('Inform to Order');assert.equal(docs.PO.status,'INFORM_TO_ORDER');
          await changeStatus('Return to Draft');assert.equal(docs.PO.status,'DRAFT');
          await act(async()=>host.querySelector('.modern-filter-trigger').click());assert.deepEqual([...document.querySelectorAll('.modern-filter-options [role="option"]')].map(option=>option.textContent),['All Statuses','Draft','Inform to Order','Cancelled']);await act(async()=>document.querySelector('.modern-filter-popup').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
          await act(async()=>host.querySelector('[aria-label="Close PO details"]').click());
          printed='';await act(async()=>host.querySelector('[title="Print PO"]').click());
          assert.ok(printed.includes('PO-3') && printed.includes('TEST-1') && printed.includes('Test product') && printed.includes('LKR 10.00'));
          assert.equal(host.querySelector('[role="dialog"]'),null);continue;
        }
        await changeStatus(`Cancel ${type}`);
        assert.ok(host.querySelector('.purchase-inspection-header').textContent.includes('CANCELLED'));
        assert.equal(actionByText(`Cancel ${type}`),undefined);
        if(type==='PRN') assert.equal(actionByText('Edit PRN'),undefined,'Cancelled PRNs are locked in the popup');
        assert.ok(actionByText(`Reprocess ${type}`));
        assert.equal(host.querySelector('[title="Edit GTN Transfer"], [title="Edit PRN"], [title="Edit Purchase Order"]'),null);
        await changeStatus(`Reprocess ${type}`);
        assert.ok(!host.querySelector('.purchase-inspection-header').textContent.includes('CANCELLED'));
        assert.ok(actionByText(`Cancel ${type}`));
      }
      if(type==='GTN') {
        await act(async()=>actionByText('Edit GTN').click());
        assert.equal(host.querySelector('.purchase-inspection'),null);
        assert.ok(host.querySelector('.gtn-intake [aria-label="Responsible staff"]'),'Staff assignment can be changed through Edit');
        assert.ok(host.querySelector('.purchase-entry-fields input'),'Transferred quantities can be edited');
        await act(async()=>host.querySelector('[aria-label="Edit item 1"]').click());
        assert.equal(host.querySelector('.gtn-available-quantity strong').textContent,'2','Transferred edit includes the original quantity when source stock is zero');
        assert.equal(host.querySelector('.purchase-entry > button').disabled,false);
        await act(async()=>host.querySelector('.purchase-entry > button').click());
        assert.equal(host.querySelector('.purchase-items tbody tr .purchase-number').textContent,'2');
        const back=[...host.querySelectorAll('.purchase-form-actions button')].find(button=>button.textContent==='Back to list');
        await act(async()=>back.click());
        continue;
      }
      if(type==='PRN') {
        await act(async()=>actionByText('Edit PRN').click());
        assert.equal(host.querySelector('.purchase-inspection'),null);
        assert.ok(host.textContent.includes('Save Changes'));assert.ok(!host.textContent.includes('Save Draft'),'Processed edits stay processed');
        await act(async()=>host.querySelector('[aria-label="Edit item 1"]').click());
        const card=host.querySelector('.prn-return-card');assert.equal(card.querySelector('strong').textContent,'2','Existing return quantities are editable when live stock is zero');
        assert.ok(card.textContent.includes('Supplier'));assert.ok(card.textContent.includes('North'));assert.ok(card.textContent.includes('GRN-10'));
        assert.equal(host.querySelector('.purchase-entry > button').disabled,false);
        await act(async()=>host.querySelector('.purchase-entry > button').click());
        assert.equal(host.querySelector('.purchase-items tbody tr .purchase-number').textContent,'2');
        const back=[...host.querySelectorAll('.purchase-form-actions button')].find(button=>button.textContent==='Back to list');await act(async()=>back.click());
        continue;
      }
      await act(async () => host.querySelector(`[aria-label="Close ${type} details"]`).click());
      assert.equal(host.querySelector('[role="dialog"]'), null);
    }
  } finally {
    await act(async()=>new Promise(resolve=>setTimeout(resolve,5100)));
    await act(async () => root.unmount()); await server.close(); await window.happyDOM.close();
    for (const key of ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']) delete globalThis[key];
  }
});
