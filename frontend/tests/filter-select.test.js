import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('modern filter supports searching, keyboard selection and dismissal without changing the value',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try {
  const {default:Filter}=await server.ssrLoadModule('/src/components/FilterSelect.jsx');const changes=[];
  const options=Array.from({length:10},(_,index)=>React.createElement('option',{key:index,value:index},`Warehouse ${index}`));
  await act(async()=>root.render(React.createElement(Filter,{value:'0',title:'Warehouse filter',onChange:event=>changes.push(event.target.value)},options)));
  await act(async()=>host.querySelector('button').click());const search=document.querySelector('.modern-filter-search input');assert.ok(search);
  await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(search,'Warehouse 7');search.dispatchEvent(new window.Event('input',{bubbles:true}));});
  assert.equal(document.querySelectorAll('[role="option"]').length,1);
  await act(async()=>search.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));assert.deepEqual(changes,['7']);assert.equal(document.querySelector('.modern-filter-popup'),null);
  await act(async()=>host.querySelector('button').click());await act(async()=>document.querySelector('.modern-filter-popup').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(changes.length,1);
  await act(async()=>host.querySelector('button').click());await act(async()=>document.body.dispatchEvent(new window.Event('pointerdown',{bubbles:true})));assert.equal(document.querySelector('.modern-filter-popup'),null);assert.equal(changes.length,1);
  let fieldValue='';
  const Field=()=>{const [value,setValue]=React.useState('');return React.createElement('form',null,React.createElement(Filter,{variant:'field',value,required:true,'aria-label':'Supplier',onChange:event=>{fieldValue=event.target.value;setValue(fieldValue);}},[React.createElement('option',{key:'empty',value:''},'Choose supplier'),React.createElement('option',{key:'chosen',value:'7'},'Supplier Seven')]));};
  await act(async()=>root.render(React.createElement(Field)));
  const fieldButton=host.querySelector('.modern-select-field');assert.ok(fieldButton);assert.equal(fieldButton.style.width,'100%');
  assert.equal(host.querySelector('select').getAttribute('aria-hidden'),'true');assert.equal(host.querySelector('select').validity.valid,false);
  await act(async()=>fieldButton.click());await act(async()=>document.querySelector('[role="option"][data-value="7"]').click());
  assert.equal(fieldValue,'7');assert.equal(fieldButton.textContent,'Supplier Seven');assert.equal(host.querySelector('select').validity.valid,true);
 } finally {await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','IS_REACT_ACT_ENVIRONMENT']) delete globalThis[key];}
});
