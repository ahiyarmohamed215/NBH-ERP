import React,{useEffect,useRef,useState} from 'react';
import {X,Save,LoaderCircle} from 'lucide-react';
import InternationalPhoneInput from './InternationalPhoneInput';
import {supplierErrors,phoneCountry,MAX_NOTES} from '../utils/purchasingValidation';
import './SupplierEditorModal.css';

export default function SupplierEditorModal({form,setForm,editing,saving,onClose,onSubmit}) {
  const [errors,setErrors]=useState({}),formRef=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement;
    formRef.current?.elements.namedItem('name')?.focus();
    return ()=>previous?.focus();
  },[]);
  const change=(field,value)=>{
    setForm(previous=>({...previous,[field]:value}));
    setErrors(previous=>({...previous,[field]:supplierErrors({...form,[field]:value})[field] || ''}));
  };
  const blur=field=>setErrors(previous=>({...previous,[field]:supplierErrors(form)[field] || ''}));
  const field=(name,label,{hint,...props}={})=><label className="supplier-editor-field" htmlFor={`supplier-${name}`}>
    <span>{label}{props.required ? <span className="supplier-required"> *</span> : null}</span>
    <input id={`supplier-${name}`} name={name} value={form[name] || ''} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name]?`supplier-error-${name}`:hint?`supplier-hint-${name}`:undefined} onChange={event=>change(name,event.target.value)} onBlur={()=>blur(name)} {...props}/>
    {errors[name] ? <small id={`supplier-error-${name}`} className="supplier-field-error">{errors[name]}</small> : hint && <small id={`supplier-hint-${name}`} className="supplier-field-hint">{hint}</small>}
  </label>;
  const submit=event=>{
    event.preventDefault();
    if(saving)return;
    const next=supplierErrors(form);setErrors(next);
    if(Object.keys(next).length){formRef.current.elements.namedItem(Object.keys(next)[0])?.focus();return;}
    onSubmit(event);
  };
  return <div className="modal-backdrop purchasing-no-shadows supplier-editor-backdrop"><div className="glass-modal supplier-editor" role="dialog" aria-modal="true" aria-labelledby="supplier-editor-title" onKeyDown={event=>{
    if(event.key==='Escape' && !event.defaultPrevented && !saving){event.stopPropagation();onClose();}
  }}>
    <header className="supplier-editor-header">
      <h2 id="supplier-editor-title">{editing?'Edit Supplier':'New Supplier'}</h2>
      <button type="button" aria-label="Close supplier editor" disabled={saving} onClick={onClose}><X size={18}/></button>
    </header>
    <form ref={formRef} noValidate onSubmit={submit} aria-busy={saving}>
      <fieldset disabled={saving} className="supplier-editor-fields">
        <div className="supplier-editor-field"><span>Supplier code</span><output className="supplier-auto-code">{editing?(form.code || form.supplierCode):'Auto-generated on save'}</output></div>
        {field('name','Supplier name',{required:true,minLength:2,maxLength:150,autoComplete:'organization',placeholder:'Supplier or company name'})}
        {field('contactPerson','Contact person',{maxLength:100,autoComplete:'name',placeholder:'Contact person name'})}
        {field('email','Email',{type:'email',maxLength:100,autoComplete:'email',placeholder:'name@example.com'})}
        <div className="supplier-editor-field supplier-editor-wide"><span>Contact number</span><InternationalPhoneInput value={form.phone} country={form.phoneCountry || phoneCountry(form.phone)} error={errors.phone} onBlur={()=>blur('phone')} onChange={value=>change('phone',value)} onCountryChange={value=>{
          setForm(previous=>({...previous,phoneCountry:value}));
          setErrors(previous=>({...previous,phone:supplierErrors({...form,phoneCountry:value}).phone || ''}));
        }}/></div>
        <label className="supplier-editor-field supplier-editor-wide" htmlFor="supplier-address"><span>Address</span>
          <textarea id="supplier-address" name="address" value={form.address || ''} autoComplete="street-address" maxLength={MAX_NOTES} rows={2} aria-invalid={Boolean(errors.address)} aria-describedby={errors.address?'supplier-error-address':undefined} onChange={event=>change('address',event.target.value)} onBlur={()=>blur('address')} placeholder="Street, town and country"/>
          {errors.address && <small id="supplier-error-address" className="supplier-field-error">{errors.address}</small>}
        </label>
      </fieldset>
      <footer><button type="button" className="btn btn-glass" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?<LoaderCircle size={15} className="supplier-editor-spinner"/>:<Save size={15}/>} {saving?'Saving...':'Save Supplier'}</button></footer>
    </form>
  </div></div>;
}
