import PurchasingStatusDialog from '../components/PurchasingStatusDialog';
import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import '../components/PurchaseDocument.css';

export function usePurchasingStatusChange() {
  const [pending,setPending]=useState(null);
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const {addToast}=useToast();
  const requestStatusChange=config=>{setReason('');setPending(config);};
  const confirm=async()=>{
    if(busy || !pending || !reason.trim() || reason.trim().length>1000) return;
    setBusy(true);
    try { if(await pending.onConfirm(reason.trim()) !== false) setPending(null); }
    catch(error) {addToast(error.response?.data?.message || error.message || 'Status change failed','error');}
    finally {setBusy(false);}
  };
  const statusChangeDialog=pending && <PurchasingStatusDialog pending={pending} reason={reason} onReasonChange={setReason} busy={busy} onClose={()=>setPending(null)} onConfirm={confirm}/>;
  return {requestStatusChange,statusChangeDialog};
}
