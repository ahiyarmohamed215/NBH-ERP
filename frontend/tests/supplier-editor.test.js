import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act,useState} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('supplier workspace blocks invalid saves, focuses errors and validates corrections',async()=>{
  const window=new Window();
  Object.assign(globalThis,{window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=await import('react-dom/client');
  const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try {
    const {default:Editor}=await server.ssrLoadModule('/src/components/SupplierEditorModal.jsx');
    let saves=0,closes=0,lastStatus;
    function Harness({saving=false}) {
      const [form,setForm]=useState({name:'',code:'',email:'',phone:'',phoneCountry:'LK',address:''});
      return React.createElement(Editor,{form,setForm,saving,onClose:()=>closes++,onSubmit:(event,status)=>{saves++;lastStatus=status;}});
    }
    await act(async()=>root.render(React.createElement(Harness)));
    const field=name=>host.querySelector(`[name="${name}"]`);
    const enter=async(name,value)=>act(async()=>{
      const input=field(name);
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);
      input.dispatchEvent(new window.Event('input',{bubbles:true}));
    });
    const submit=async()=>act(async()=>host.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
    assert.equal(document.activeElement.name,'name');assert.equal(field('code'),null);assert.equal(host.querySelector('.supplier-auto-code'),null);assert.equal(host.querySelector('.modal-backdrop'),null);assert.ok(host.querySelector('[aria-label="Supplier summary"]'));
    assert.equal(host.querySelector('[role="alert"]'),null);
    assert.equal([...host.querySelectorAll('button')].find(button=>button.textContent==='Save draft').disabled,true);
    await enter('contactPerson','Nimal');
    await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Save draft').click());assert.equal(saves,1);assert.equal(lastStatus,'DRAFT');saves=0;
    await submit();assert.equal(saves,0);assert.equal(document.activeElement.name,'name');
    assert.equal(field('name').getAttribute('aria-invalid'),'true');
    assert.ok(host.textContent.includes('Enter a supplier name.'));
    await enter('name',' ');assert.equal(field('name').getAttribute('aria-invalid'),'true');
    await enter('name','Acme Trading');assert.equal(host.querySelector('[role="alert"]'),null);
    await enter('email','bad@');await enter('phone','1234');
    await submit();assert.equal(saves,0);assert.equal(document.activeElement.name,'phone');
    for(const name of ['email','phone'])assert.equal(field(name).getAttribute('aria-invalid'),'true');
    await enter('email','orders@example.com');await enter('phone','0771234567');
    assert.equal(host.querySelector('[role="alert"]'),null);
    await submit();assert.equal(saves,1);
    await enter('email','');await enter('phone','');
    await submit();assert.equal(saves,2,'Optional details can be blank');
    await act(async()=>root.render(React.createElement(Harness,{saving:true})));
    assert.equal(host.querySelector('button[type="submit"]').disabled,true);
    assert.equal(host.querySelector('fieldset').disabled,true);
    await submit();assert.equal(saves,2,'Saving blocks repeated submissions');
    await act(async()=>host.querySelector('.supplier-workspace').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    assert.equal(closes,0,'Saving blocks dismissal');
    await act(async()=>root.render(React.createElement(Harness)));
    await act(async()=>host.querySelector('.supplier-workspace').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    assert.equal(closes,1);
  } finally {
    await act(async()=>root.unmount());await server.close();await window.happyDOM.close();
    for(const key of ['window','document','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];
  }
});
