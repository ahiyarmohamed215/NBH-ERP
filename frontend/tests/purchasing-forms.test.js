import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('all purchasing creation forms use inline workspaces and report focus mode', async () => {
  const window = new Window();
  Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=await import('react-dom/client');
  const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const chooseField=async(select,value)=>{await act(async()=>select.parentElement.querySelector('.modern-filter-trigger').click());const option=document.querySelector(`[role="option"][data-value="${value}"]`);assert.ok(option);await act(async()=>option.click());};
  try {
    const apis=await server.ssrLoadModule('/src/api/apiClient.js');
    for (const [name,api] of Object.entries(apis)) {
      if (!name.endsWith('Api') || !api || typeof api !== 'object') continue;
      for (const method of Object.keys(api)) if(typeof api[method]==='function') api[method]=async()=>({data:[]});
    }
    apis.productApi.getProducts=async()=>({data:{content:[{id:1,sku:'TEST-1',name:'Test product',costPrice:4,sellingPrice:125,defaultWarehouseId:2},{id:2,sku:'ZERO-2',name:'Zero stock product',costPrice:2,sellingPrice:75,defaultWarehouseId:1},{id:3,sku:'RESERVED-3',name:'Fully reserved product',costPrice:3,defaultWarehouseId:2}]}});
    apis.supplierApi.getActive=async()=>({data:[{id:7,name:'Selected supplier'},{id:8,name:'Other supplier'}]});
    let savedPoPayload=null;
    apis.purchaseOrderApi.create=async payload=>{savedPoPayload=payload;return {data:{id:20,poNumber:'PO-20',...payload}};};
    apis.gtnApi.getResponsibleStaff=async()=>({data:[{id:5,fullName:'Transfer staff',username:'transfer',employeeCode:'STAFF-5',phone:'0771234567',roles:['ROLE_WAREHOUSE_STAFF']},{id:6,fullName:'Other staff',username:'other',employeeCode:'STAFF-6'}]});
    apis.warehouseApi.getActive=async()=>({data:[{id:1,name:'Main warehouse'},{id:2,name:'Product warehouse'}]});
    apis.inventoryApi.getBalances=async()=>({data:{content:[{productId:1,warehouseId:2,warehouseName:'Product warehouse',quantity:100,reservedQuantity:10},{productId:1,warehouseId:1,quantity:100,reservedQuantity:10},{productId:3,warehouseId:1,quantity:10,reservedQuantity:10}],totalPages:1}});
    apis.inventoryApi.getWarehouseStock=async id=>{assert.ok([1,2].includes(Number(id)));return {data:[{productId:1,quantity:100,reservedQuantity:10}]};};
    apis.prnApi.getReturnSources=async()=>({data:[{productId:1,sourceGrnId:10,originalGrnNumber:'GRN-10',supplierId:7,supplierName:'First supplier',warehouseId:2,warehouseName:'Product warehouse',costPrice:6,returnableQuantity:100},{productId:1,sourceGrnId:11,originalGrnNumber:'GRN-11',supplierId:8,supplierName:'Second supplier',warehouseId:1,warehouseName:'Main warehouse',costPrice:9,returnableQuantity:100}]});
    let savedPrnPayload=null;
    apis.prnApi.create=async payload=>{savedPrnPayload=payload;return {data:{id:12,prnNumber:'PRN-12',status:'DRAFT',...payload}};};
    let createdGtn=null, savedGtnPayload=null, autoPrintedGtn=null;
    apis.gtnApi.search=async()=>({data:{content:createdGtn?[createdGtn]:[]}});
    apis.gtnApi.create=async(payload,transfer)=>{assert.equal(transfer,false);savedGtnPayload=payload;createdGtn={id:9,gtnNumber:'GTN-9',...payload,items:payload.items.map(item=>({...item,productName:'Test product',productSku:'TEST-1',sourceWarehouseName:item.sourceWarehouseId===2?'Product warehouse':'Main warehouse',destinationWarehouseName:item.destinationWarehouseId===2?'Product warehouse':'Main warehouse'}))};return {data:createdGtn};};
    apis.pdfApi.printGtn=async id=>{autoPrintedGtn=id;};
    const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');
    for (const name of ['GrnView','GtnView','PrnView','PurchaseOrdersView']) {
      const originalProducts = apis.productApi.getProducts, originalInventory = apis.inventoryApi.getBalances, originalSources=apis.prnApi.getReturnSources;
      if(name==='PurchaseOrdersView') {
        apis.productApi.getProducts=async params=>{assert.equal(params.activeOnly,false);const response=await originalProducts();return {data:{content:[...response.data.content,...Array.from({length:55},(_,index)=>({id:index+4,sku:`CAT-${index+4}`,name:`Catalogue product ${index+4}`,costPrice:3,defaultWarehouseId:1}))]}};};
      }
      if (name === 'PrnView') {
        const extraProducts = Array.from({length:55},(_,index)=>({id:index+4,sku:`STOCK-${index+4}`,name:`Stocked product ${index+4}`,costPrice:5}));
        apis.productApi.getProducts = async params => {
          assert.equal(params.activeOnly,false,'PRN includes stocked products regardless of catalogue active filter');
          const response = await originalProducts();return {data:{content:[...response.data.content,...extraProducts]}};
        };
        apis.inventoryApi.getBalances = async ({page}) => ({data:{content:page===0 ? (await originalInventory()).data.content : extraProducts.map(product=>({productId:product.id,warehouseId:2,quantity:7,reservedQuantity:0})),totalPages:2}});
        apis.prnApi.getReturnSources=async()=>({data:[...(await originalSources()).data,...extraProducts.map(product=>({productId:product.id,sourceGrnId:10,originalGrnNumber:'GRN-10',supplierId:7,supplierName:'First supplier',warehouseId:2,warehouseName:'Product warehouse',costPrice:5,returnableQuantity:7}))]});
      }
      const {default:View}=await server.ssrLoadModule(`/src/views/${name}.jsx`);
      const ref=React.createRef();let focused=false;
      await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,
        React.createElement(View,{key:name,ref,onFormModeChange:value=>{focused=value;}})))));
      await act(async()=>ref.current.openCreate());
      assert.equal(focused,true,`${name} should hide hub navigation`);
      const form=host.querySelector('.purchase-document,.grn-page');
      assert.ok(form,`${name} should have an inline editor`);
      assert.notEqual(form.style.position,'fixed');
      assert.ok(form.querySelector('input'),'Header fields should be visible');
      assert.ok(/Save (as )?Draft/.test(host.textContent),`${name}: save action should be visible`);
      assert.equal(host.querySelector('.modal-backdrop'),null);
      if (name !== 'GrnView') {
        assert.ok(form.querySelector('.purchase-entry .purchase-fields'), `${name}: common fields belong to the intake panel`);
        assert.ok(form.querySelector('.purchase-entry textarea'), `${name}: remarks belong to the intake panel`);
        assert.ok(form.querySelector('.purchase-lines > .purchase-form-actions'), `${name}: buttons have a fixed grid area`);
        assert.ok([...form.querySelectorAll('th')].some(cell => cell.textContent === 'Product name'));
        assert.equal(form.querySelectorAll('.purchase-entry > label select').length,0,`${name}: no separate product selector`);
        const productSearch=form.querySelector('[role="combobox"]');
        await act(async()=>{productSearch.focus();});
        await act(async()=>{
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(productSearch,'TEST-1');
          productSearch.dispatchEvent(new window.Event('input',{bubbles:true}));
        });
        const result=form.querySelector('[role="option"]');
        assert.ok(result.textContent.includes(name === 'PurchaseOrdersView' ? 'Available: 180' : 'Available: 90'),`${name}: results include available quantity`);
        const resultsText=form.querySelector('[role="listbox"]').textContent;
        if(['GtnView','PurchaseOrdersView'].includes(name)){assert.match(resultsText,/Selling price: LKR 125\.00/);assert.ok(!resultsText.includes('Unit cost:'));}
        if(name==='PrnView'){
          assert.ok(!resultsText.includes('Supplier:'));
          const reference=result.querySelector('.purchase-result-reference-line');
          assert.ok(reference.textContent.includes('Warehouse: Product warehouse'));
          assert.ok(reference.textContent.includes('GRN: GRN-10'));
          assert.equal(reference.children.length,2,'Warehouse and original GRN share one detail line');
        }
        assert.ok(!resultsText.includes('Zero stock product'));
        if(name === 'PurchaseOrdersView') assert.ok(!form.textContent.includes('Payment terms'));
        if(['PrnView','PurchaseOrdersView'].includes(name)){
          assert.ok([...form.querySelectorAll('th')].some(cell=>cell.textContent==='Selling price'));
          assert.ok(![...form.querySelectorAll('th')].some(cell=>cell.textContent==='Unit cost'));
        }
        await act(async()=>{
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(productSearch,'');
          productSearch.dispatchEvent(new window.Event('input',{bubbles:true}));
        });
        const allResults=form.querySelector('[role="listbox"]').textContent;
        if(name==='PurchaseOrdersView') {assert.equal(form.querySelectorAll('[role="option"]').length,58,'PO search shows every catalogue product beyond inventory rows and 50 results');assert.ok(allResults.includes('Catalogue product 58'));}
        assert.equal(allResults.includes('Zero stock product'),name === 'PurchaseOrdersView');
        assert.equal(allResults.includes('Fully reserved product'),name === 'PurchaseOrdersView');
        if(name === 'PrnView') {
          assert.equal(form.querySelectorAll('[role="option"]').length,57,'All stocked warehouse rows appear, including beyond the first inventory page and 50 results');
          assert.ok(allResults.includes('Stocked product 58'));
          assert.ok(allResults.includes('Main warehouse'));
          assert.ok(allResults.includes('Product warehouse'));
        }
        assert.ok(result.textContent.includes('Test product'));
        await act(async()=>form.querySelector('[role="option"]').click());
        assert.equal(form.querySelector('[role="listbox"]'),null);
        if(name === 'PurchaseOrdersView') {
          assert.equal(form.querySelector('.po-supplier-field').parentElement,form.querySelector('.purchase-entry-fields'),'Supplier and Qty share one row');
          const card=form.querySelector('.po-product-card');assert.ok(card.textContent.includes('Product warehouse'));assert.ok(card.textContent.includes('LKR 125.00'));
          assert.equal(form.querySelector('.purchase-entry-fields input[data-purchase-field="cost"]'),null);
          assert.equal(form.querySelector('.po-supplier-field select').value,'','Supplier is selected by staff');
          assert.equal(form.querySelector('.purchase-fields input[type="date"]'),null,'PO uses its creation date');
          assert.ok(!form.textContent.includes('Expected date'));assert.equal(form.querySelectorAll('.po-supplier-field select').length,1,'The warehouse is filled automatically');
        }
        if(name === 'PrnView') {
          const field=label=>[...form.querySelectorAll('label')].find(element=>element.textContent.startsWith(label)).querySelector('input,textarea');
          const card=form.querySelector('.prn-return-card');assert.ok(card.textContent.includes('First supplier'));assert.ok(card.textContent.includes('Product warehouse'));assert.ok(card.textContent.includes('GRN-10'));
          assert.ok(card.querySelector('.prn-return-card-metrics').textContent.includes('LKR 125.00'));
          assert.equal(form.querySelector('.purchase-entry-fields input[data-purchase-field="cost"]'),null,'Receipt price appears in the details card');
          assert.ok(![...form.querySelectorAll('th')].some(cell=>cell.textContent==='Supplier'),'Supplier is displayed in the intake card instead of the creation table');
          assert.ok(![...form.querySelectorAll('th')].some(cell=>cell.textContent==='Warehouse'),'Warehouse is displayed in the intake card instead of the creation table');
          assert.equal(field('Return quantity').value,'','The user enters return quantity');
          await act(async()=>{
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(field('Return reason'),'Damaged packaging');field('Return reason').dispatchEvent(new window.Event('input',{bubbles:true}));
            Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(field('Remarks'),'Box torn');field('Remarks').dispatchEvent(new window.Event('input',{bubbles:true}));
          });
        }
        if (name === 'GtnView') {
          assert.equal(form.querySelector('.purchase-fields input[readonly]').value,'Product warehouse');
          assert.equal(form.querySelectorAll('.purchase-fields select').length,1);
          assert.equal(form.querySelector('.purchase-entry > button').disabled,true,'Destination is required before adding products');
          const destination=form.querySelector('.purchase-fields select');
          await chooseField(destination,'1');
          assert.ok(form.querySelector('.purchase-stock-details').textContent.includes('90'));
          const intake=form.querySelector('.gtn-intake');
          const sections=[...intake.children];
          const order=['.purchase-product-search','.gtn-available-quantity','.gtn-warehouse-fields','.gtn-staff-search','.purchase-entry-fields','.purchase-fields:has(.purchase-remarks)','.btn'];
          const positions=order.map(selector=>sections.findIndex(section=>section.matches(selector)));
          assert.ok(positions.every((position,index)=>position>=0 && (!index || position>positions[index-1])),'GTN intake follows the handover entry order');
          assert.equal(intake.lastElementChild.textContent,'Add item');
          assert.equal(form.querySelector('.purchase-fields select option[value="2"]'),null);
        }
        assert.ok(productSearch.value.includes('TEST-1'));
        const add=form.querySelector('.purchase-entry > button');
        assert.equal(add.disabled,['PrnView','PurchaseOrdersView'].includes(name),`${name}: selected product can be added after required fields`);
        const changeInput = async (input, value) => act(async()=>{
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);
          input.dispatchEvent(new window.Event('input',{bubbles:true}));
        });
        const quantityInput=form.querySelector('.purchase-entry-fields input');
        await changeInput(quantityInput,'');
        assert.equal(quantityInput.value,''); assert.equal(add.disabled,true);
        await changeInput(quantityInput,'045');
        assert.equal(quantityInput.value,'45');
        const costInput=form.querySelector('.purchase-entry-fields input[data-purchase-field="cost"]');
        if(costInput && !costInput.readOnly){
          await changeInput(costInput,'');
          assert.equal(costInput.value,''); assert.equal(add.disabled,true);
          await changeInput(costInput,'045');
          assert.equal(costInput.value,'45'); assert.equal(add.disabled,false);
        }
        if (name === 'GtnView') {
          await changeInput(quantityInput,'91');
          await act(async()=>add.click());
          assert.equal(form.querySelectorAll('tbody tr').length,0,'GTN cannot exceed unreserved stock');
          await changeInput(quantityInput,'45');
        }
        if(name==='PurchaseOrdersView') {const supplier=form.querySelector('.po-supplier-field select');await chooseField(supplier,'7');}
        await act(async()=>add.click());
        assert.equal(form.querySelectorAll('tbody tr').length,1,`${name}: item appears in table`);
        assert.ok(form.querySelector('tbody').textContent.includes('Test product'));
        if(['PrnView','PurchaseOrdersView'].includes(name)) assert.ok(form.querySelector('tbody').textContent.includes('LKR 125.00'));
        await act(async()=>form.querySelector('[aria-label="Remove item 1"]').click());
        const confirmation=document.querySelector('[role="alertdialog"]');assert.ok(confirmation,`${name}: removing an added row asks for confirmation`);
        assert.ok(confirmation.textContent.includes('Test product'));
        assert.equal(form.querySelectorAll('tbody tr').length,1,'Opening the popup does not remove the row');
        await act(async()=>[...confirmation.querySelectorAll('button')].find(button=>button.textContent==='Cancel').click());
        assert.equal(document.querySelector('[role="alertdialog"]'),null);assert.equal(form.querySelectorAll('tbody tr').length,1);

        if(name === 'PurchaseOrdersView') {
          await act(async()=>{productSearch.blur();productSearch.focus();});
          const zeroStock=[...form.querySelectorAll('[role="option"]')].find(option=>option.textContent.includes('Zero stock product'));assert.ok(zeroStock);
          await act(async()=>zeroStock.click());assert.ok(form.querySelector('.po-product-card').textContent.includes('Main warehouse'));assert.ok(form.querySelector('.po-product-card').textContent.includes('LKR 75.00'));
          const secondSupplier=form.querySelector('.po-supplier-field select');await chooseField(secondSupplier,'8');await changeInput(quantityInput,'3');await act(async()=>add.click());assert.equal(form.querySelectorAll('tbody tr').length,2,'Zero-stock products can be ordered for their configured warehouse');
          await act(async()=>form.querySelector('[aria-label="Edit item 1"]').click());assert.ok(form.querySelector('.po-product-card').textContent.includes('Product warehouse'));assert.ok(form.querySelector('.po-product-card').textContent.includes('LKR 125.00'));
          await changeInput(quantityInput,'20');await act(async()=>add.click());
          const supplierSelect=form.querySelector('.po-supplier-field select');await chooseField(supplierSelect,'7');
          const notes=form.querySelector('textarea');await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(notes,'Order new stock');notes.dispatchEvent(new window.Event('input',{bubbles:true}));});
          await act(async()=>[...form.querySelectorAll('button')].find(button=>button.textContent==='Save as Draft').click());
          assert.equal(savedPoPayload.status,'DRAFT');assert.equal(savedPoPayload.supplierId,7);assert.equal(Object.hasOwn(savedPoPayload,'orderDate'),false);assert.equal(savedPoPayload.expectedDate,null);assert.equal(savedPoPayload.notes,'Order new stock');
          assert.equal(savedPoPayload.items[0].supplierId,7);assert.equal(savedPoPayload.items[1].supplierId,8);assert.ok(![...form.querySelectorAll('th')].some(cell=>cell.textContent==='Delivery warehouse'));assert.ok([...form.querySelectorAll('th')].some(cell=>cell.textContent==='Supplier name'));assert.equal(savedPoPayload.items[0].warehouseId,2);assert.equal(savedPoPayload.items[0].quantity,20);assert.equal(savedPoPayload.items[0].unitCost,4);assert.equal(savedPoPayload.items[1].warehouseId,1);assert.equal(savedPoPayload.items[1].unitCost,2);
          assert.equal(focused,false);apis.productApi.getProducts=originalProducts;apis.inventoryApi.getBalances=originalInventory;apis.prnApi.getReturnSources=originalSources;continue;
        }
        if(name === 'PrnView') {
          const firstRow=form.querySelector('tbody tr');assert.ok(firstRow.textContent.includes('GRN-10'));
          await act(async()=>{productSearch.blur();productSearch.focus();});
          const otherWarehouse=[...form.querySelectorAll('[role="option"]')].find(option=>option.textContent.includes('Main warehouse'));
          await act(async()=>otherWarehouse.click());
          assert.ok(form.querySelector('.prn-return-card-metrics').textContent.includes('LKR 125.00'));
          const reason=[...form.querySelectorAll('label')].find(label=>label.textContent.startsWith('Return reason')).querySelector('input');
          await changeInput(reason,'Quality issue');await changeInput(quantityInput,'3');
          await act(async()=>add.click());
          assert.equal(form.querySelectorAll('tbody tr').length,2,'One PRN can include different suppliers and warehouses');
          await act(async()=>form.querySelector('[aria-label="Edit item 1"]').click());
          assert.ok(form.querySelector('.prn-return-card-metrics').textContent.includes('LKR 125.00'));
          assert.equal(reason.value,'Damaged packaging');await changeInput(quantityInput,'4');await act(async()=>add.click());
          const saveDraft=[...form.querySelectorAll('button')].find(button=>button.textContent.trim()==='Save Draft');
          await act(async()=>saveDraft.click());
          assert.ok(savedPrnPayload.returnDate);assert.equal(savedPrnPayload.items.length,2);
          assert.equal(savedPrnPayload.items[0].sourceGrnId,10);assert.equal(savedPrnPayload.items[0].warehouseId,2);assert.equal(savedPrnPayload.items[0].unitCost,6);assert.equal(savedPrnPayload.items[0].remarks,'Box torn');assert.equal(savedPrnPayload.items[0].quantityReturned,4);
          assert.equal(savedPrnPayload.items[1].sourceGrnId,11);assert.equal(savedPrnPayload.items[1].warehouseId,1);assert.equal(savedPrnPayload.items[1].reason,'Quality issue');
          await act(async()=>host.querySelector('[aria-label="Close PRN details"]').click());
          apis.productApi.getProducts=originalProducts;apis.inventoryApi.getBalances=originalInventory;apis.prnApi.getReturnSources=originalSources;
          continue;
        }
        if(name === 'GtnView') {
          await act(async()=>{productSearch.blur();productSearch.focus();});
          const secondSource=[...form.querySelectorAll('[role="option"]')].find(option=>option.textContent.includes('Available: 90'));
          assert.ok(secondSource,'The same product remains available in its other warehouse');
          await act(async()=>secondSource.click());
          assert.equal(form.querySelector('.gtn-warehouse-fields input').value,'Main warehouse');
          const secondDestination=form.querySelector('.gtn-warehouse-fields select');
          assert.equal(secondDestination.value,'','Choosing a source resets a conflicting destination');
          await chooseField(secondDestination,'2');
          await changeInput(quantityInput,'20');await act(async()=>add.click());
          const rows=form.querySelectorAll('.purchase-items tbody tr');assert.equal(rows.length,2);
          assert.equal(rows[0].children[2].textContent,'Product warehouse');assert.equal(rows[0].children[3].textContent,'Main warehouse');
          assert.equal(rows[1].children[2].textContent,'Main warehouse');assert.equal(rows[1].children[3].textContent,'Product warehouse');
          const createPending=[...form.querySelectorAll('button')].find(button=>button.textContent.includes('Create Pending & Print'));
          await act(async()=>createPending.click());
          assert.equal(savedGtnPayload,null,'Pending GTN requires responsible staff');
          const staffSearch=form.querySelector('[aria-label="Responsible staff"]');
          await act(async()=>staffSearch.focus());
          assert.equal(form.querySelector('[aria-label="Staff search results"]').querySelectorAll('[role="option"]').length,2,'Staff search initially shows all staff');
          assert.ok(form.querySelector('[aria-label="Staff search results"]').textContent.includes('Warehouse Staff'));
          assert.ok(form.querySelector('[aria-label="Staff search results"]').textContent.includes('0771234567'));
          await changeInput(staffSearch,'0771234567');
          assert.equal(form.querySelector('[aria-label="Staff search results"]').querySelectorAll('[role="option"]').length,1);
          await changeInput(staffSearch,'STAFF-5');
          assert.equal(form.querySelector('[aria-label="Staff search results"]').querySelectorAll('[role="option"]').length,1);
          await act(async()=>staffSearch.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
          assert.equal(staffSearch.value,'Transfer staff');
          await act(async()=>createPending.click());
          assert.equal(savedGtnPayload.status,'PENDING');assert.equal(savedGtnPayload.responsibleStaffId,5);
          assert.equal(savedGtnPayload.sourceWarehouseId,undefined);assert.equal(savedGtnPayload.destinationWarehouseId,undefined);
          assert.equal(savedGtnPayload.items[0].sourceWarehouseId,2);assert.equal(savedGtnPayload.items[0].destinationWarehouseId,1);assert.equal(savedGtnPayload.items[0].quantityTransferred,45);
          assert.equal(savedGtnPayload.items[1].sourceWarehouseId,1);assert.equal(savedGtnPayload.items[1].destinationWarehouseId,2);assert.equal(savedGtnPayload.items[1].quantityTransferred,20);
          assert.equal(autoPrintedGtn,9,'New pending GTN automatically prints the dispatch document');
          assert.equal(focused,false);assert.ok(host.querySelector('.purchase-inspection-header').textContent.includes('PENDING'));
          await act(async()=>host.querySelector('[aria-label="Close GTN details"]').click());
          assert.ok(host.textContent.includes('2 sources · 2 destinations'));
          assert.ok(!host.textContent.includes('ROUTE (FROM'));
          await act(async()=>host.querySelector('.modern-filter-trigger').click());
          assert.deepEqual([...document.querySelectorAll('.modern-filter-options [role="option"]')].map(option=>option.textContent),['All Statuses','Draft','Pending','Transferred','Cancelled']);
          await act(async()=>document.querySelector('.modern-filter-popup').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));

          continue;
        }
        const remove=form.querySelector('[aria-label="Remove item 1"]');
        await act(async()=>remove.click());
        await act(async()=>document.querySelector('.purchase-remove-confirm').click());
        assert.equal(form.querySelectorAll('tbody tr').length,0);
      }
      const back=[...form.querySelectorAll('button')].find(button=>/Back to/.test(button.textContent));
      assert.ok(back,`${name} should have a back action`);
      await act(async()=>back.click());
      assert.equal(focused,false);
      assert.equal(host.querySelector('.purchase-document,.grn-page'),null);
      apis.productApi.getProducts=originalProducts;apis.inventoryApi.getBalances=originalInventory;apis.prnApi.getReturnSources=originalSources;
    }
  } finally {
    await act(async()=>new Promise(resolve=>setTimeout(resolve,5100)));
    await act(async()=>root.unmount());await server.close();await window.happyDOM.close();
    for(const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT']) delete globalThis[key];
  }
});
