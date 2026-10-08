import { formatBusinessDate } from '../utils/invoiceMapping';
import SettlementPanel from '../components/SettlementPanel';
import React, { useEffect, useState } from 'react';
import api, { fetchAllPages } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
const tabs = [['chart-of-accounts','Accounts'],['journal-entries','Journals'],['banking','Banking'],['cheques','Cheque journals'],['expenses','Expense journals'],['dividend','Dividend journals'],['trial-balance','Trial balance']];
const kinds = { banking:'BANKING', cheques:'CHEQUES', expenses:'EXPENSE', dividend:'DIVIDEND' };
const money = value => Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits:2, maximumFractionDigits:2 });
export default function AccountingHub({ activeSubTab, onSubTabChange }) {
 const { user } = useAuth(); const { addToast } = useToast();
 const canManage = user?.roles?.some(r => ['ROLE_ADMIN','ROLE_SUPER_ADMIN'].includes(r)) || user?.permissions?.includes('ACCOUNTING_MANAGE');
 const tab = activeSubTab || 'chart-of-accounts';
 const [accounts,setAccounts]=useState([]), [entries,setEntries]=useState([]), [balances,setBalances]=useState([]), [error,setError]=useState(''), [busy,setBusy]=useState(false);
 const [account,setAccount]=useState({code:'',name:'',type:'ASSET'});
 const [form,setForm]=useState({postingDate:formatBusinessDate(),description:'',debit:'EXPENSES',credit:'CASH',amount:''});
 const [reference,setReference]=useState(() => `MANUAL-${crypto.randomUUID()}`);
 const load = async () => { setError(''); try {
   const [a,j,b]=await Promise.all([api.get('/accounting/accounts'),fetchAllPages('/accounting/journals',kinds[tab]?{kind:kinds[tab]}:{}),api.get('/accounting/trial-balance')]);
   setAccounts(a.data); setEntries(j.data.content); setBalances(b.data);
 } catch(e) { setError(e.message); } };
 useEffect(() => { load(); },[tab]);
 const action = async fn => { setBusy(true); try { await fn(); await load(); addToast('Saved','success'); } catch(e) { setError(e.message); } finally { setBusy(false); } };
 const submit = e => { e.preventDefault(); action(async () => {
   await api.post('/accounting/journals',{source:reference,postingDate:form.postingDate,description:form.description,kind:kinds[tab] || 'GENERAL',lines:[{account:form.debit,debit:Number(form.amount),credit:0},{account:form.credit,debit:0,credit:Number(form.amount)}]});
   setForm(f=>({...f,description:'',amount:''})); setReference(`MANUAL-${crypto.randomUUID()}`);
 }); };
 const select = field => <select aria-label={field+' account'} required value={form[field]} onChange={e=>setForm({...form,[field]:e.target.value})}>{accounts.filter(a=>a.active).map(a=><option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}</select>;
 return <main style={{padding:24,overflow:'auto',flex:1}}>
   <h1>Accounting</h1><p>Posted journals, bank movements and financial balances.</p>
   <nav aria-label="Accounting sections" style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>{tabs.map(([id,label])=><button key={id} className={tab===id?'btn btn-primary':'btn'} onClick={()=>onSubTabChange?.(id)}>{label}</button>)}</nav>
   {error && <div role="alert" style={{color:'#b91c1c',padding:12}}>{error} <button onClick={load}>Retry</button></div>}
   {tab==='banking' && canManage && <SettlementPanel supplier />}
   {tab==='chart-of-accounts' ? <>
     {canManage && <form onSubmit={e=>{e.preventDefault();action(async()=>{await api.post('/accounting/accounts',account);setAccount({code:'',name:'',type:'ASSET'});});}} style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
       <input aria-label="Account code" required placeholder="Code" value={account.code} onChange={e=>setAccount({...account,code:e.target.value.toUpperCase()})}/>
       <input aria-label="Account name" required placeholder="Account name" value={account.name} onChange={e=>setAccount({...account,name:e.target.value})}/>
       <select aria-label="Account type" value={account.type} onChange={e=>setAccount({...account,type:e.target.value})}>{['ASSET','LIABILITY','EQUITY','INCOME','EXPENSE'].map(t=><option key={t}>{t}</option>)}</select>
       <button disabled={busy} className="btn btn-primary">Add account</button>
     </form>}
     <table className="data-table"><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Balance (debit − credit)</th></tr></thead><tbody>{accounts.map(a=><tr key={a.code}><td>{a.code}</td><td>{a.name}</td><td>{a.type}</td><td>{money(balances.find(b=>b.code===a.code)?.balance)}</td></tr>)}</tbody></table>
   </> : tab==='trial-balance' ? <>
     <table className="data-table"><thead><tr><th>Account</th><th>Type</th><th>Debits</th><th>Credits</th><th>Balance</th></tr></thead><tbody>{balances.map(b=><tr key={b.code}><td>{b.name}</td><td>{b.type}</td><td>{money(b.debit)}</td><td>{money(b.credit)}</td><td>{money(b.balance)}</td></tr>)}</tbody></table>
     <p>Debits: {money(balances.reduce((s,b)=>s+Number(b.debit),0))} · Credits: {money(balances.reduce((s,b)=>s+Number(b.credit),0))}</p>
     {canManage && <button className="btn" disabled={busy} onClick={()=>{const year=window.prompt('Fiscal year to close permanently:');if(year && /^\d{4}$/.test(year) && window.confirm(`Close ${year}? New postings to that year will be blocked.`)) action(()=>api.post(`/accounting/years/${year}/close`));}}>Close fiscal year</button>}
   </> : <>
     {canManage && <form onSubmit={submit} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:24}}>
       <label>Date<input type="date" required value={form.postingDate} onChange={e=>setForm({...form,postingDate:e.target.value})}/></label>
       <label>Description<input required value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
       <label>Debit{select('debit')}</label><label>Credit{select('credit')}</label>
       <label>Amount<input type="number" min="0.01" step="0.01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label>
       <button className="btn btn-primary" disabled={busy || form.debit===form.credit}>Post balanced entry</button>
     </form>}
     {!entries.length && <p>No posted entries yet.</p>}
     <table className="data-table"><thead><tr><th>Date</th><th>Reference</th><th>Description</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{entries.map(j=><tr key={j.id}>
       <td>{j.postingDate}</td><td>{j.source}</td><td>{j.description}<details><summary>Lines</summary>{j.lines.map((l,i)=><p key={i}>{l.account}: Dr {money(l.debit)} / Cr {money(l.credit)}</p>)}</details></td><td>{money(j.lines.reduce((s,l)=>s+Number(l.debit),0))}</td><td>{j.reversed?'Reversed':j.reconciled?'Reconciled':'Posted'}</td>
       <td>{canManage && !j.reversed && j.source.startsWith('MANUAL-') && <button disabled={busy} onClick={()=>{const reason=window.prompt('Reason for reversal');if(reason) action(()=>api.post(`/accounting/journals/${j.id}/reverse`,{reason}));}}>Reverse</button>}{canManage && tab==='banking' && !j.reconciled && <button disabled={busy} onClick={()=>action(()=>api.post(`/accounting/journals/${j.id}/reconcile`))}>Match statement</button>}</td>
     </tr>)}</tbody></table>
   </>}
 </main>;
}
