import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('month filter navigates years without committing, restores focus and resets to this month',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try {
  const {default:MonthFilter,currentBusinessMonth}=await server.ssrLoadModule('/src/components/MonthFilter.jsx');
  const current=currentBusinessMonth(),year=Number(current.slice(0,4)),changes=[];
  await act(async()=>root.render(React.createElement(MonthFilter,{value:current,label:'Range month',onChange:value=>changes.push(value)})));
  const trigger=host.querySelector('button');
  await act(async()=>trigger.click());
  assert.equal(document.querySelectorAll('.month-filter-cell').length,12);
  assert.equal(document.querySelectorAll('.month-filter-cell:disabled').length,12-Number(current.slice(5)));
  await act(async()=>document.querySelector('[aria-label="Choose year"]').click());
  await act(async()=>document.querySelector(`[aria-label="${year-1}"]`).click());
  assert.deepEqual(changes,[]);
  const january=document.querySelector(`[aria-label="January ${year-1}"]`);
  assert.ok(january);
  await act(async()=>january.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  assert.equal(document.querySelector('.month-filter-popover'),null);
  assert.equal(document.activeElement,trigger);
  assert.deepEqual(changes,[]);
  await act(async()=>trigger.click());
  await act(async()=>document.querySelector('[aria-label="Previous year"]').click());
  await act(async()=>document.querySelector(`[aria-label="January ${year-1}"]`).click());
  assert.deepEqual(changes,[`${year-1}-01`]);
  await act(async()=>trigger.click());
  await act(async()=>[...document.querySelectorAll('.month-filter-popover button')].find(button=>button.textContent==='This month').click());
  assert.equal(changes.at(-1),current);
  assert.equal(document.querySelector('.month-filter-popover'),null);
 } finally {await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];}
});
