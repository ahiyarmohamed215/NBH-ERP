import React,{useEffect,useRef,useState} from 'react';
import {X,Save,LoaderCircle,Truck} from 'lucide-react';
import InternationalPhoneInput from './InternationalPhoneInput';
import {supplierErrors,phoneCountry,MAX_NOTES} from '../utils/purchasingValidation';
import './SupplierEditorModal.css';
import './AllocationWorkspace.css';
import StatusBadge from './StatusBadge';

export default function SupplierEditorModal({form,setForm,editing,saving,onClose,onSubmit}) {
  const [errors,setErrors]=useState({}),formRef=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement;
    formRef.current?.elements.namedItem('name')?.focus();
    return ()=>previous?.focus();
  },[]);
  const isDraft=editing && form.status==='DRAFT';
  const change=(field,value)=>{
    setForm(previous=>({...previous,[field]:value}));
    setErrors(previous=>({...previous,[field]:supplierErrors({...form,[field]:value},{draft:isDraft})[field] || ''}));
  };
  const blur=field=>setErrors(previous=>({...previous,[field]:supplierErrors(form,{draft:isDraft})[field] || ''}));
  const field=(name,label,{hint,wide,...props}={})=><label className={`supplier-editor-field${wide?' supplier-editor-wide':''}`} htmlFor={`supplier-${name}`}>
    <span>{label}{props.required ? <span className="supplier-required"> *</span> : null}</span>
    <input className="erp-field" id={`supplier-${name}`} name={name} value={form[name] || ''} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name]?`supplier-error-${name}`:hint?`supplier-hint-${name}`:undefined} onChange={event=>change(name,event.target.value)} onBlur={()=>blur(name)} {...props}/>
    {errors[name] ? <small id={`supplier-error-${name}`} className="supplier-field-error">{errors[name]}</small> : hint && <small id={`supplier-hint-${name}`} className="supplier-field-hint">{hint}</small>}
  </label>;
  const hasInput=['name','contactPerson','phone','email','address','remarks'].some(field=>String(form[field] || '').trim());
  const canDraft=hasInput && !Object.keys(supplierErrors(form,{draft:true})).length;
  const submit=(event,draft=isDraft)=>{
    event.preventDefault();
    if(saving)return;
    const next=supplierErrors(form,{draft});setErrors(next);
    if(draft && !hasInput)return;
    if(Object.keys(next).length){formRef.current.elements.namedItem(Object.keys(next)[0])?.focus();return;}
    onSubmit(event,draft?'DRAFT':undefined);
  };
  return <div className="supplier-workspace-shell purchasing-no-shadows"><div className="allocation-workspace supplier-editor supplier-workspace" aria-labelledby="supplier-editor-title" onKeyDown={event=>{
    if(event.key==='Escape' && !event.defaultPrevented && !saving){event.stopPropagation();onClose();}
  }}>
    <header className="allocation-workspace-header">
      <div className="allocation-workspace-title"><span className="allocation-title-icon"><Truck size={23}/></span><div><h2 className="erp-dialog-title" id="supplier-editor-title">{editing?'Edit Supplier':'New Supplier'}</h2>{editing && <p>{form.code || form.supplierCode}</p>}</div></div>
      <button type="button" className="purchase-inspection-close allocation-header-close" aria-label="Close supplier editor" disabled={saving} onClick={onClose}><X size={18}/></button>
    </header>
    <form ref={formRef} noValidate onSubmit={event=>submit(event)} aria-busy={saving}>
      <div className="allocation-workspace-body">
      <fieldset disabled={saving} className="supplier-editor-fields">
        {field('name','Supplier name',{required:!isDraft,minLength:2,maxLength:150,autoComplete:'organization',placeholder:'Supplier or company name'})}
        {field('contactPerson','Contact person',{maxLength:100,autoComplete:'name',placeholder:'Contact person name'})}
        {field('email','Email',{type:'email',maxLength:100,autoComplete:'email',placeholder:'name@example.com'})}
        <div className="supplier-editor-field"><span>Contact number</span><InternationalPhoneInput value={form.phone} country={form.phoneCountry || phoneCountry(form.phone)} error={errors.phone} onBlur={()=>blur('phone')} onChange={value=>change('phone',value)} onCountryChange={value=>{
          setForm(previous=>({...previous,phoneCountry:value}));
          setErrors(previous=>({...previous,phone:supplierErrors({...form,phoneCountry:value}).phone || ''}));
        }}/></div>
        <label className="supplier-editor-field" htmlFor="supplier-address"><span>Address</span>
          <textarea className="erp-field" id="supplier-address" name="address" value={form.address || ''} autoComplete="street-address" maxLength={MAX_NOTES} rows={2} aria-invalid={Boolean(errors.address)} aria-describedby={errors.address?'supplier-error-address':undefined} onChange={event=>change('address',event.target.value)} onBlur={()=>blur('address')} placeholder="Street, town and country"/>
          {errors.address && <small id="supplier-error-address" className="supplier-field-error">{errors.address}</small>}
        </label>
        <label className="supplier-editor-field" htmlFor="supplier-remarks"><span>Remarks</span>
          <textarea className="erp-field" id="supplier-remarks" name="remarks" value={form.remarks || ''} maxLength={MAX_NOTES} rows={2} aria-invalid={Boolean(errors.remarks)} onChange={event=>change('remarks',event.target.value)} onBlur={()=>blur('remarks')} placeholder="Additional supplier notes"/>
          {errors.remarks && <small className="supplier-field-error">{errors.remarks}</small>}
        </label>
      </fieldset>
      <aside className="allocation-receipt allocation-inline-review" aria-label="Supplier summary">
        <div className="allocation-receipt-heading"><span className="allocation-receipt-symbol"><Truck size={23}/></span><h3>Supplier summary</h3><p>Check the details before saving.</p></div>
        <div className="allocation-receipt-section"><h4>Supplier</h4><strong>{form.name || '—'}</strong><dl><div><dt>Status</dt><dd><StatusBadge status={editing ? form.status || ((form.isActive ?? form.active)?'ACTIVE':'INACTIVE') : 'ACTIVE'}/></dd></div>{editing && <div><dt>Supplier code</dt><dd>{form.code || form.supplierCode}</dd></div>}</dl></div>
        <div className="allocation-receipt-section"><h4>Contact details</h4><dl>{[['Contact person',form.contactPerson],['Phone',form.phone],['Email',form.email]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl></div>
        <div className="allocation-receipt-notes"><h4>Address</h4><p>{form.address || 'No address entered'}</p></div>
        <div className="allocation-receipt-notes"><h4>Remarks</h4><p>{form.remarks || '—'}</p></div>
      </aside></div>
      <footer className="allocation-workspace-actions"><span>{isDraft?'Complete the details, then activate from View.':'Supplier code is generated automatically.'}</span><div><button type="button" className="allocation-secondary" disabled={saving} onClick={onClose}>Cancel</button>{!editing && <button type="button" className="allocation-secondary" disabled={saving || !canDraft} onClick={event=>submit(event,true)}>Save draft</button>}<button type="submit" className="allocation-primary" disabled={saving || isDraft && !canDraft}>{saving?<LoaderCircle size={15} className="supplier-editor-spinner"/>:<Save size={15}/>} {saving?'Saving...':isDraft?'Save draft':'Save Supplier'}</button></div></footer>
    </form>
  </div></div>;
}
