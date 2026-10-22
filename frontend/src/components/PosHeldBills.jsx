import React,{useEffect,useState,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X,Clock} from 'lucide-react';
import {salesApi} from '../api/apiClient';
import OnholdBillsTable from './OnholdBillsTable';
import HeldBillDetails from './HeldBillDetails';
import './PurchaseInspectionModal.css';
import './PosHeldBills.css';

export default function PosHeldBills({activeBillId,busy,user,onClose}) {
  const [scope,setScope]=useState('mine'),[query,setQuery]=useState(''),[status,setStatus]=useState('ALL');
  const [workspace,setWorkspace]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[selected,setSelected]=useState(null);
  const dialog=useRef(null),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    let alive=true,sequence=0;
    const load=async()=>{const request=++sequence;try{const response=await salesApi.getHeldOriginals({scope,query,history:true});if(alive && request===sequence){const original=response.data?.data || response.data;setWorkspace({...original,bills:(original?.bills || []).filter(b=>String(b.id)!==String(activeBillId))});setError('');}}catch(e){if(alive && request===sequence)setError(e.message || 'Unable to load onhold bills.');}finally{if(alive && request===sequence)setLoading(false);}};
    setLoading(true);setWorkspace(null);setError('');const timer=setTimeout(load,200),interval=setInterval(load,5000);return()=>{alive=false;clearTimeout(timer);clearInterval(interval);};
  },[scope,query,activeBillId,revision]);
  useEffect(()=>{
    if(selected)return;
    const previous=document.activeElement;dialog.current?.querySelector('[aria-label="Close held bills"]')?.focus();
    const keydown=event=>{
      if(!dialog.current?.contains(event.target))return;
      if(event.key==='Escape' && !event.defaultPrevented){event.preventDefault();event.stopPropagation();close.current();}
      if(event.key==='Tab'){
        const controls=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')],first=controls[0],last=controls.at(-1);
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',keydown);
    return()=>{document.removeEventListener('keydown',keydown);previous?.focus?.();};
  },[Boolean(selected)]);
  const refresh=()=>setRevision(value=>value+1);
  return createPortal(<>
    {!selected && <div className="modal-backdrop pos-held-backdrop" onClick={onClose}><section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="pos-held-title" className="purchase-inspection pos-held-dialog" onClick={event=>event.stopPropagation()}>
      <header className="purchase-inspection-header"><div className="purchase-inspection-title"><div className="grn-inspection-symbol"><Clock size={22} strokeWidth={1.7}/></div><h2 id="pos-held-title" className="erp-dialog-title">Held Bills</h2></div><button type="button" className="purchase-inspection-close" aria-label="Close held bills" onClick={onClose}><X size={18}/></button></header>
      <div className="pos-held-body">{error && <p className="pos-held-error" role="alert">{error}</p>}
        <OnholdBillsTable bills={workspace?.bills || []} loading={loading} user={user} scope={scope} onScopeChange={setScope} query={query} onQueryChange={setQuery} status={status} onStatusChange={setStatus} onRefresh={refresh} onView={setSelected} posOnly archive history workspace={workspace}
          />
      </div>
    </section></div>}
    {selected && <HeldBillDetails key={selected.id} bill={selected} user={user} posOnly onClose={()=>setSelected(null)} onChanged={refresh}/>}
  </>,document.body);
}
