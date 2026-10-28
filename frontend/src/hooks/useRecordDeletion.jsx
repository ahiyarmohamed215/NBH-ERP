import React,{useState} from 'react';
import {recycleBinApi} from '../api/apiClient';
import {useToast} from '../context/ToastContext';
import RecordDeleteDialog from '../components/RecordDeleteDialog';

export default function useRecordDeletion(type,label,onChanged,options={}) {
  const requireReason = options.requireReason ?? (type === 'VEHICLE');
  const [record,setRecord]=useState(null);
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const {addToast}=useToast();

  const confirm=async()=>{
    if(!record || busy) return;
    const finalReason = reason.trim();
    if(requireReason && !finalReason) return;
    setBusy(true);
    try{
      await recycleBinApi.delete(type,record.id,finalReason || undefined);
      setRecord(null);
      setReason('');
      await onChanged?.();
      addToast(`${label} moved to recycle bin`,'success');
    }catch(error){
      addToast(error.response?.data?.message || error.message || 'Deletion failed','error');
    }finally{
      setBusy(false);
    }
  };

  return {
    requestDeletion:(rec)=>{setRecord(rec);setReason('');},
    deletionDialog:record && (
      <RecordDeleteDialog
        record={record}
        label={label}
        busy={busy}
        requireReason={requireReason}
        reason={reason}
        onReasonChange={setReason}
        onClose={()=>{setRecord(null);setReason('');}}
        onConfirm={confirm}
      />
    )
  };
}
