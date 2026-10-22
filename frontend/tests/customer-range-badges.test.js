import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';
import {getRangeBadgeAppearance} from '../src/utils/customerRangeBadges.js';

test('range medals follow spend thresholds, including custom names, ties and baseline',()=>{
 const ranges=[{id:1,name:'Starter',rangeCode:'RANGE_0',minSpend:0},{id:2,name:'Trade',minSpend:100},{id:3,name:'Preferred',minSpend:200},{id:4,name:'Premier',minSpend:300},{id:5,name:'Previous',minSpend:999,isActive:false},{id:6,name:'Premier partner',minSpend:300}];
 assert.equal(getRangeBadgeAppearance({name:'Premier'},ranges).tone,'gold');
 assert.equal(getRangeBadgeAppearance({id:6},ranges).tone,'gold');
 assert.equal(getRangeBadgeAppearance({name:'Preferred'},ranges).tone,'silver');
 assert.equal(getRangeBadgeAppearance({name:'Trade'},ranges).tone,'bronze');
 assert.equal(getRangeBadgeAppearance({code:'RANGE_0'},ranges).tone,'teal');
 assert.equal(getRangeBadgeAppearance({name:'Previous'},ranges).tone,'standard');
 assert.equal(getRangeBadgeAppearance({name:'Range 0'}).tone,'teal');
 assert.equal(getRangeBadgeAppearance({name:'Range 5'}).tone,'gold');
 assert.equal(getRangeBadgeAppearance({name:'Range 4'}).tone,'silver');
 assert.equal(getRangeBadgeAppearance({name:'Range 3'}).tone,'bronze');
 assert.equal(getRangeBadgeAppearance({name:'Unassigned'}).tone,'standard');
});

test('new ranges stay colourful beyond the original five levels',()=>{
 const ranges=Array.from({length:9},(_,index)=>({id:index,name:`Custom ${index}`,minSpend:index*100,isActive:true}));
 const tones=ranges.map(range=>getRangeBadgeAppearance({id:range.id},ranges).tone);
 assert.equal(tones[0],'teal');
 assert.equal(tones[8],'gold');
 assert.equal(new Set(tones).size,9);
 assert.ok(!tones.includes('standard'));
 assert.equal(getRangeBadgeAppearance({name:'Range 0'},[{name:'Premier',minSpend:100}]).tone,'teal');
});

test('shared badges load configuration once and update together after range setup changes',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try {
  const {customerMonthlyRangeApi}=await server.ssrLoadModule('/src/api/apiClient.js');
  let calls=0,levels=[{name:'Trade',minSpend:100},{name:'Premier',minSpend:200}];
  customerMonthlyRangeApi.getAllRanges=async()=>{calls++;return {data:levels};};
  const {default:Badge,CustomerRangeBadgeProvider:Provider}=await server.ssrLoadModule('/src/components/CustomerRangeBadge.jsx');
  const view=user=>React.createElement(Provider,{user},React.createElement(Badge,{name:'Trade'}),React.createElement(Badge,{name:'Premier'}));
  await act(async()=>root.render(view({username:'cashier',permissions:['SALES_CREATE']})));
  assert.equal(calls,1);assert.deepEqual([...host.querySelectorAll('[data-range-tone]')].map(badge=>badge.dataset.rangeTone),['silver','gold']);
  levels=[...levels,{name:'Elite',minSpend:300}];
  await act(async()=>window.dispatchEvent(new window.CustomEvent('erp:targets_updated',{detail:{topics:['targets']}})));
  assert.deepEqual([...host.querySelectorAll('[data-range-tone]')].map(badge=>badge.dataset.rangeTone),['bronze','silver']);
  assert.equal(calls,2);
  await act(async()=>root.render(view(null)));assert.equal(calls,2);
 } finally {await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];}
});
