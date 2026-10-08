import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api, { paymentApi } from '../api/apiClient';
export default function SettlementPanel({ supplier = false }) {
 const {user}=useAuth();
 const canManage=user?.roles?.some(r=>['ROLE_ADMIN','ROLE_SUPER_ADMIN'].includes(r)) || user?.permissions?.includes(supplier?'SUPPLIER_PAYMENT_MANAGE':'PAYMENT_CREATE');
 const [records,setRecords]=useState([]),[credits,setCredits]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [form,setForm]=useState({kind:'advance',source:'',invoice:'',amount:''});
 const load=async()=>{try{if(supplier){const res=await api.get('/supplier-payments/outstanding');setRecords(res.data);const p=await api.get('/supplier-payments');setCredits(p.data);}else{const [p,c]=await Promise.all([paymentApi.search({paymentType:'ADVANCE',status:'COMPLETED'}),api.get('/credit-notes')]);setRecords(p.data.content);setCredits(c.data);}setError('');}catch(e){setError(e.message);}};
 useEffect(()=>{load();},[supplier]);
 const submit=async e=>{e.preventDefault();setBusy(true);try{
  if(supplier)await api.post('/supplier-payments',{grnId:Number(form.source),amount:Number(form.amount),method:'BANK_TRANSFER'});
  else if(form.kind==='advance')await paymentApi.allocate(Number(form.source),{invoiceId:Number(form.invoice),amount:Number(form.amount)});
  else await api.post(`/credit-notes/${form.source}/apply`,{invoiceId:Number(form.invoice),amount:Number(form.amount)});
  setForm({...form,amount:''});await load();
 }catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section style={{border:'1px solid #cbd5e1',padding:16,marginBottom:16,background:'#fff',maxHeight:360,overflow:'auto'}}>
  <h3>{supplier?'Supplier settlements':'Apply advances and credit notes'}</h3>
  {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
  {canManage&&<form onSubmit={submit} style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end'}}>
   {!supplier&&<label>Source<select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value,source:''})}><option value="advance">Advance</option><option value="credit">Credit note</option></select></label>}
   <label>{supplier?'Receipt':'Credit'}<select required value={form.source} onChange={e=>setForm({...form,source:e.target.value})}><option value="">Select</option>{(supplier||form.kind==='advance'?records:credits).map(r=><option key={r.id} value={r.id}>{r.grnNumber||r.paymentNumber||r.number} · {r.supplier||r.customerName||`Customer ${r.customerId}`} · {supplier?`Due ${r.balance}`:form.kind==='credit'?`Available ${r.available}`:`Receipt ${r.amount}`}</option>)}</select></label>
   {!supplier&&<label>Invoice ID<input required type="number" min="1" value={form.invoice} onChange={e=>setForm({...form,invoice:e.target.value})}/></label>}
   <label>Amount<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label>
   <button className="btn btn-primary" disabled={busy}>{supplier?'Record bank payment':'Apply credit'}</button>
  </form>}
  {supplier&&<table className="data-table"><thead><tr><th>Supplier</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{credits.map(p=><tr key={p.id}><td>{p.supplier}</td><td>{p.amount}</td><td>{p.reversed?'Reversed':'Posted'}</td><td>{canManage&&!p.reversed&&<button disabled={busy} onClick={async()=>{const reason=window.prompt('Reversal reason');if(!reason)return;setBusy(true);try{await api.post(`/supplier-payments/${p.id}/reverse`,{reason});await load();}catch(e){setError(e.message);}finally{setBusy(false);}}}>Reverse</button>}</td></tr>)}</tbody></table>}
 </section>;
}
