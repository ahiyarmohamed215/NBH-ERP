import React from 'react';
import {Edit2,Ban,CheckCircle,Trash2} from 'lucide-react';
import './RecordActions.css';

export default function RecordActions({name,status,canManage,onEdit,onStatusChange,onDelete,disabled=false,activationDisabled=false,compact=false,className=''}) {
 if(!canManage)return null;
 return <div className={`purchase-inspection-detail-actions record-actions ${className}`} aria-label={`${name} management actions`}>
  <button type="button" className="btn btn-glass erp-button" aria-label={`Edit ${name}`} disabled={disabled} onClick={onEdit}><Edit2 size={14}/> Edit {compact?'':name}</button>
  {(status==='ACTIVE'?<button type="button" className="btn btn-glass erp-button purchase-inspection-warning" aria-label={`Deactivate ${name}`} disabled={disabled} onClick={()=>onStatusChange('INACTIVE')}><Ban size={14}/> Deactivate {compact?'':name}</button>:<button type="button" className="btn btn-glass erp-button purchase-inspection-success" aria-label={`${status==='INACTIVE'?'Reactivate':'Activate'} ${name}`} disabled={disabled || activationDisabled} onClick={()=>onStatusChange('ACTIVE')}><CheckCircle size={14}/> {status==='INACTIVE'?'Reactivate':'Activate'} {compact?'':name}</button>)}
  {onDelete && <button type="button" className="btn btn-glass erp-button purchase-inspection-danger" aria-label={`Delete ${name}`} disabled={disabled} onClick={onDelete}><Trash2 size={14}/> Delete {compact?'':name}</button>}
 </div>;
}
