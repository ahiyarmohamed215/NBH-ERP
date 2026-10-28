import React,{useState} from 'react';
import {Truck,X,Save} from 'lucide-react';
import FilterSelect from './FilterSelect';
import StaffSearch from './StaffSearch';
import {numberError} from '../utils/purchasingValidation';
import './AllocationWorkspace.css';
import './MasterWorkspace.css';
import './PurchaseDocument.css';
import './PurchaseProductSearch.css';

export default function DeliveryVehicleWorkspace({form,setForm,employees=[],staffLoading=false,staffError='',onRetryStaff,busy,onClose,onSave}) {
 const [error,setError]=useState('');
 const isDraft=form.id && form.status==='DRAFT';
 const hasInput=['vehicleNumber','model','vehicleType','notes','capacityKg','assignedStaffId'].some(key=>String(form[key] ?? '').trim());
 const submit=(event,draft=false)=>{
   event.preventDefault();if(busy)return;
   const invalid=form.capacityKg ? numberError(form.capacityKg,'Capacity',{decimals:2}) : '';
   const message=invalid || (draft ? !hasInput && 'Fill at least one input before saving a vehicle draft.' : !form.assignedStaffId ? 'Select the staff member responsible for this vehicle.' : !form.vehicleType ? 'Select a vehicle type.' : !String(form.vehicleNumber || '').trim() || !String(form.model || '').trim() ? 'Vehicle plate number and model are required.' : '');
   setError(message || '');if(!message)onSave(event,draft);
 };
 const change=(key,value)=>setForm(previous=>({...previous,[key]:value}));
 const input=(key,label,props={})=><label>{label}<input className="erp-field" aria-label={label} value={form[key] ?? ''} onChange={event=>change(key,event.target.value)} {...props}/></label>;

 return (
  <form
    className="allocation-workspace purchase-document master-workspace vehicle-workspace"
    aria-label={form.id ? 'Edit vehicle' : 'New vehicle'}
    noValidate
    onSubmit={event=>submit(event,Boolean(isDraft))}
  >
    <header className="allocation-workspace-header">
      <div className="allocation-workspace-title">
        <span className="allocation-title-icon"><Truck size={23}/></span>
        <div>
          <h2 className="erp-dialog-title">{form.id ? 'Edit' : 'New'} Vehicle</h2>
          <p>Enter the vehicle details and check the summary.</p>
        </div>
      </div>
      <button type="button" className="allocation-header-close" aria-label="Close vehicle editor" disabled={busy} onClick={onClose}>
        <X size={18}/>
      </button>
    </header>

    <div className="allocation-workspace-body">
      <fieldset disabled={busy} className="master-workspace-inputs">
        <div className="master-workspace-pair">
          {input('vehicleNumber','Plate number *',{required:true})}
          {input('model','Vehicle model *',{required:true})}
        </div>
        <div className="master-workspace-pair">
          <label>Vehicle type *
            <FilterSelect variant="field" aria-label="Vehicle type" value={form.vehicleType || ''} onChange={event=>change('vehicleType',event.target.value)}>
              <option value="">Select vehicle type</option>
              {['LORRY','TRUCK','THREEWHEEL','VAN'].map(type=><option key={type} value={type}>{type}</option>)}
            </FilterSelect>
          </label>
          {input('capacityKg','Capacity (kg)',{type:'text',inputMode:'decimal'})}
        </div>
        <StaffSearch staff={employees} value={form.assignedStaffId || ''} onChange={value=>change('assignedStaffId',value)} disabled={busy} label="Responsible staff *" showDetails={false} showRoles loading={staffLoading} error={staffError} onRetry={onRetryStaff}/>
        <small>Responsible for maintenance. Required before activation.</small>
        {error && <small role="alert" className="allocation-field-error">{error}</small>}
        <label>Remarks / notes
          <textarea className="erp-field" aria-label="Vehicle notes" value={form.notes || ''} onChange={event=>change('notes',event.target.value)}/>
        </label>
      </fieldset>

      <aside className="allocation-receipt allocation-inline-review" aria-label="Vehicle summary">
        <div className="allocation-receipt-heading"><h3>Vehicle summary</h3></div>
        <div className="allocation-receipt-section">
          <strong>{form.vehicleNumber || 'Plate number not entered'}</strong>
          <dl>
            {[
              ['Vehicle model', form.model],
              ['Vehicle type', form.vehicleType],
              ['Capacity (kg)', form.capacityKg],
              ['Responsible staff', (()=>{if(!form.assignedStaffId)return '';const staff=employees.find(staff=>String(staff.id)===String(form.assignedStaffId));const staffName=staff?.fullName || staff?.name || staff?.username || form.assignedStaffName || '';if(!staff)return staffName;const role=(staff.roles||[]).map(r=>String(typeof r==='string'?r:r.name||'').replace(/^ROLE_/,'').replace(/_/g,' ').toLowerCase().replace(/\b\w/g,l=>l.toUpperCase())).filter(Boolean).join(', ');return role ? `${staffName} (${role})` : staffName;})()]
            ].map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>
            ))}
          </dl>
        </div>
        <div className="allocation-receipt-notes">
          <h4>Remarks / notes</h4>
          <p>{form.notes || 'No notes entered'}</p>
        </div>
      </aside>
    </div>

    <footer className="allocation-workspace-actions">
      <span>{isDraft ? 'Complete the details, then activate from the view popup.' : form.id ? 'Change vehicle status from the details popup.' : 'New vehicles start as Available. Save a draft to finish later.'}</span>
      <div>
        <button type="button" className="allocation-secondary" disabled={busy} onClick={onClose}>Cancel</button>
        {!form.id && <button type="button" className="allocation-secondary" disabled={busy || !hasInput} onClick={event=>submit(event,true)}>Save draft</button>}
        <button type="submit" className="allocation-primary" disabled={busy}>
          <Save size={15}/>{busy ? 'Saving...' : isDraft ? 'Save draft' : form.id ? 'Save changes' : 'Save Vehicle'}
        </button>
      </div>
    </footer>
  </form>
 );
}
