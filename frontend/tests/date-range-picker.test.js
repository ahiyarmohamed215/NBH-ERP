import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('date range fits small and zoomed viewports and applies only after two date clicks',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  const {default:Picker,dateRangePosition,matchesDateRange}=await server.ssrLoadModule('/src/components/DateRangePicker.jsx');
  for(const viewport of [{width:360,height:420},{width:500,height:360},{width:320,height:480,left:40,top:30}]) {
   const bounds=dateRangePosition({right:viewport.width+30,bottom:viewport.height-10,top:viewport.height-48},viewport,450);
   assert.ok(bounds.left>=(viewport.left || 0)+12);assert.ok(bounds.left+bounds.width<=(viewport.left || 0)+viewport.width-12);
   assert.ok(bounds.top>=(viewport.top || 0)+12);assert.ok(bounds.top+Math.min(450,bounds.maxHeight)<=(viewport.top || 0)+viewport.height-12);
  }
  assert.equal(matchesDateRange('2026-10-10T09:00:00','2026-10-10','2026-10-11'),true);assert.equal(matchesDateRange('2026-10-09','2026-10-10','2026-10-11'),false);
  assert.equal(matchesDateRange(null,'',''),true);assert.equal(matchesDateRange(null,'2026-10-10',''),false);
  const changes=[];
  await act(async()=>root.render(React.createElement(Picker,{documentType:'GRN',from:'2026-10-10',to:'2026-10-12',onChange:(...values)=>changes.push(values)})));
  await act(async()=>host.querySelector('button').click());let popup=document.querySelector('[aria-label="Choose GRN date range"]');assert.ok(popup);
  await act(async()=>popup.querySelector('[aria-label="11 October 2026"]').click());assert.equal(changes.length,0);
  await act(async()=>popup.querySelector('[aria-label="9 October 2026"]').click());assert.deepEqual(changes,[['2026-10-09','2026-10-11']]);assert.equal(document.querySelector('[role="dialog"]'),null);
  await act(async()=>host.querySelector('button').click());popup=document.querySelector('[role="dialog"]');
  await act(async()=>popup.querySelector('[aria-label="15 October 2026"]').click());
  await act(async()=>document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(changes.length,1);assert.equal(document.querySelector('[role="dialog"]'),null);
  await act(async()=>host.querySelector('button').click());await act(async()=>[...document.querySelectorAll('.date-range-popover button')].find(button=>button.textContent==='Clear dates').click());assert.deepEqual(changes[1],['','']);
 } finally {await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','IS_REACT_ACT_ENVIRONMENT']) delete globalThis[key];}
});
