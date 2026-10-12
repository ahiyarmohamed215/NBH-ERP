import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('GTN, PRN and PO removal requires confirmation and removes only the selected duplicate-product row',async()=>{
  const window=new Window();Object.assign(globalThis,{window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  try {
    const {default:Lines}=await server.ssrLoadModule('/src/components/PurchaseLines.jsx');
    for(const quantityField of ['quantityTransferred','quantityReturned','quantity']) {
      const Harness=()=>{const [items,setItems]=React.useState([{productId:1,warehouseId:1,[quantityField]:2},{productId:1,warehouseId:2,[quantityField]:3}]);return React.createElement(Lines,{items,onChange:setItems,products:[{id:1,sku:'P-1',name:'Selected product'}],quantityField});};
      await act(async()=>root.render(React.createElement(Harness,{key:quantityField})));
      const remove=host.querySelector('[aria-label="Remove item 2"]');
      await act(async()=>remove.focus());await act(async()=>remove.click());
      const popup=document.querySelector('[role="alertdialog"]');assert.ok(popup.textContent.includes('P-1'));assert.ok(popup.textContent.includes('Selected product'));
      assert.equal(host.querySelectorAll('tbody tr').length,2);
      assert.equal(document.activeElement.textContent,'Cancel');
      await act(async()=>document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
      assert.equal(document.querySelector('[role="alertdialog"]'),null);assert.equal(host.querySelectorAll('tbody tr').length,2);assert.equal(document.activeElement,remove);
      await act(async()=>remove.click());await act(async()=>document.querySelector('.purchase-remove-confirm').click());
      assert.equal(host.querySelectorAll('tbody tr').length,1);
      assert.equal(host.querySelector('tbody tr td:nth-child(3)').textContent,'2','The first row for the same product is preserved');
      assert.equal(document.querySelector('[role="alertdialog"]'),null);
    }
  } finally {await act(async()=>root.unmount());await server.close();await window.happyDOM.close();}
});
