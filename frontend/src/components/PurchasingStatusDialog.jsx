import React,{useState} from 'react';
import {AlertTriangle,CheckCircle,RotateCw,ArrowRight,X} from 'lucide-react';
import FilterSelect from './FilterSelect';
import StatusBadge from './StatusBadge';
import './SupplierStatusDialog.css';
import './PurchasingAppearance.css';

const statusLabel=value=>String(value || '').toLowerCase().replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
export default function PurchasingStatusDialog({pending,reason,onReasonChange,busy,onClose,onConfirm,confirmation,title:customTitle,confirmLabel,closeLabel,reasonPlaceholder,targetOptions,onTargetChange}) {
  const [touched,setTouched]=useState(false);
  const supplier=pending.type==='Supplier';
  const toneStatus = String((pending.type === 'Vehicle' ? pending.current : pending.target) || pending.current || pending.target || '').toUpperCase();
  let toneClass = 'purchasing-status-neutral';
  let Icon = RotateCw;

  if (['AVAILABLE', 'ACTIVE', 'PROCESSED', 'TRANSFERRED', 'INFORM_TO_ORDER'].includes(toneStatus)) {
    toneClass = 'supplier-status-available';
    Icon = CheckCircle;
  } else if (toneStatus === 'IN_SERVICE') {
    toneClass = 'supplier-status-service';
    Icon = RotateCw;
  } else if (['IN_GARAGE', 'MAINTENANCE', 'PENDING'].includes(toneStatus)) {
    toneClass = 'supplier-status-garage';
    Icon = AlertTriangle;
  } else if (toneStatus === 'DRAFT') {
    toneClass = 'supplier-status-draft';
    Icon = RotateCw;
  } else if (['INACTIVE', 'CANCELLED'].includes(toneStatus)) {
    toneClass = 'supplier-status-deactivate';
    Icon = AlertTriangle;
  }

  const error=!reason.trim()?'Enter a reason for this status change.':reason.trim().length>1000?'Reason must be 1000 characters or fewer.':'';
  const title=customTitle || (supplier?`${pending.target==='INACTIVE'?'Deactivate':'Activate'} supplier`:`Change ${pending.type} status`);
  return <div className="modal-backdrop purchasing-no-shadows" style={{padding:12,zIndex:1300}}>
    <div className={`glass-modal supplier-status-dialog ${toneClass}`} role="dialog" aria-modal="true" aria-label={`Change ${pending.type} status`}>
      <header><div className="purchasing-status-symbol"><Icon size={19}/></div><h3>{title}</h3><button type="button" aria-label="Close status change" disabled={busy} onClick={()=>{setTouched(false);onClose();}}><X size={18}/></button></header>
      <div className="purchasing-status-body">
        <div className="supplier-status-summary">
          <div className="purchasing-status-record"><small>{pending.type==='Vehicle'?'Plate number':supplier?'Supplier':`${pending.type} number`}</small><strong>{pending.number}</strong></div>
          <div className="purchasing-status-transition" aria-label="Status transition">
            <div><small>Current status</small><StatusBadge status={pending.current}/></div>
            <ArrowRight size={16} aria-hidden="true"/>
            <div>
              <small>New status</small>
              {targetOptions && onTargetChange ? (
                <FilterSelect
                  variant="field"
                  aria-label="New status"
                  value={pending.target}
                  disabled={busy}
                  onChange={event=>onTargetChange(event.target.value)}
                  style={{ minWidth: 150 }}
                >
                  {targetOptions.map(opt=>{
                    const val=typeof opt==='string'?opt:opt.value;
                    const lbl=typeof opt==='string'?statusLabel(opt):opt.label;
                    return <option key={val} value={val}>{lbl}</option>;
                  })}
                </FilterSelect>
              ) : (
                <StatusBadge status={pending.target}/>
              )}
            </div>
          </div>
        </div>
        <p className="purchasing-status-description">{pending.description || 'Enter the reason for this change. It will be recorded in the audit log.'}</p>
        <label className="purchasing-status-reason"><span>Reason / remarks <span className="purchasing-status-required">*</span></span><textarea className="erp-field" autoFocus aria-label="Status change reason" aria-invalid={Boolean(touched && error)} maxLength={1000} rows={3} value={reason} disabled={busy} onChange={event=>{setTouched(true);onReasonChange(event.target.value);}} placeholder={reasonPlaceholder || 'Explain why this status needs to change...'}/>{touched && error && <small className="purchasing-status-error">{error}</small>}</label>
        {confirmation && <label className="purchasing-status-confirmation"><input type="checkbox" checked={confirmation.checked} disabled={busy} onChange={event=>confirmation.onChange(event.target.checked)}/><span>{confirmation.label}</span></label>}
      </div>
      <footer><button type="button" className="btn btn-glass erp-button" disabled={busy} onClick={()=>{setTouched(false);onClose();}}>{closeLabel || (supplier?'Close':'Back')}</button><button type="button" className="supplier-status-confirm" aria-label={confirmLabel || 'Confirm status change'} disabled={busy || Boolean(error) || (confirmation && !confirmation.checked)} onClick={onConfirm}>{busy?'Updating...':confirmLabel || (supplier?`Confirm ${pending.target==='INACTIVE'?'Deactivation':'Activation'}`:'Confirm status change')}</button></footer>
    </div>
  </div>;
}
