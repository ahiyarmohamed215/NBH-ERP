import React,{useRef,useState,useEffect} from 'react';
import {X,Package,Building2,Award,LayoutGrid,Save} from 'lucide-react';
import FilterSelect from './FilterSelect';
import {recordStatus,hasMasterDraftInput} from '../utils/masterRecordLifecycle';
import {numberError} from '../utils/purchasingValidation';
import './AllocationWorkspace.css';
import './MasterWorkspace.css';
const kinds={products:{name:'Product',icon:Package},warehouses:{name:'Warehouse',icon:Building2},brands:{name:'Brand',icon:Award},categories:{name:'Category',icon:LayoutGrid}};
export default function MasterWorkspace({type,form,setForm,editing,saving,brands=[],categories=[],warehouses=[],onClose,onSave}) {
 const {name,icon:Icon}=kinds[type],product=type==='products',warehouse=type==='warehouses',brand=type==='brands',code=product?'sku':'code';
 const ref=useRef(null),[errors,setErrors]=useState({});
 useEffect(()=>{ref.current?.querySelector('input')?.focus();},[]);
 const change=(field,value)=>{setForm(previous=>({...previous,[field]:value,...(field==='contactNumber'?{phone:value}:{})}));setErrors(previous=>({...previous,[field]:''}));};
 const input=(field,label,props={})=><label>{label}{props.required?' *':''}<input className="erp-field" name={field} aria-label={label} value={form[field] ?? ''} onChange={event=>change(field,event.target.value)} aria-invalid={Boolean(errors[field])} {...props}/>{errors[field] && <small className="allocation-field-error">{errors[field]}</small>}</label>;
 const select=(field,label,options)=><label>{label} *<FilterSelect variant="field" aria-label={label} name={field} value={form[field] || ''} onChange={event=>change(field,event.target.value)}><option value="">Select {label.toLowerCase()}</option>{options.filter(option=>(option.isActive ?? option.active) || String(option.id)===String(form[field])).map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</FilterSelect>{errors[field] && <small className="allocation-field-error">{errors[field]}</small>}</label>;
 const resolve=(list,id)=>list.find(item=>String(item.id)===String(id))?.name || '—';
 const summary=product?[['Product code',form.sku],['Brand',resolve(brands,form.brandId)],['Category',resolve(categories,form.categoryId)],['Warehouse',resolve(warehouses,form.warehouseId)],['Unit of measure',form.unitOfMeasure || 'PCS'],['Minimum stock level',form.minStockLevel]]:warehouse?[['Warehouse code',form.code],['Contact number',form.contactNumber || form.phone],['Address',form.address]]:brand?[['Brand code',form.code],['MP%',form.markupPercent===''?'—':`${form.markupPercent ?? 0}%`]]:[['Category code',form.code]];
 const draftEditing=editing && recordStatus(editing)==='DRAFT';
 const canDraft=hasMasterDraftInput(type,form) && !saving;
 const submit=(event,requestedStatus)=>{
  event.preventDefault();if(saving)return;const next={};
  const draft=requestedStatus==='DRAFT' || draftEditing;
  if(draft && !canDraft)next.name='Fill at least one input before saving a draft.';
  if(!draft && !String(form[code] || '').trim())next[code]=`Enter a ${name.toLowerCase()} code.`;
  if(String(form[code] || '').trim() && ['warehouses','categories'].includes(type) && String(form[code] || '').trim().length===1)next[code]='Enter at least two characters.';
  if(!draft && !String(form.name || '').trim())next.name=`Enter a ${name.toLowerCase()} name.`;
  else if((!brand && String(form.name || '').trim() && form.name.trim().length<2))next.name='Enter at least two characters.';
  if(product){for(const key of ['brandId','categoryId','warehouseId'])if(!draft && !form[key])next[key]='Select an option.';const error=numberError(form.minStockLevel,'Minimum stock level',{decimals:0,max:2147483647});if(error && (!draft || String(form.minStockLevel ?? '').trim()))next.minStockLevel=error;}
  if(brand){const error=numberError(form.markupPercent,'MP%',{max:99999});if(error)next.markupPercent=error;}
  setErrors(next);if(Object.keys(next).length){ref.current?.querySelector(`[name="${Object.keys(next)[0]}"]`)?.focus();return;}onSave(event,draft?'DRAFT':undefined);
 };
 return <form ref={ref} className="allocation-workspace purchase-document master-workspace" aria-label={`${editing?'Edit':'New'} ${name.toLowerCase()}`} noValidate onSubmit={event=>submit(event)} onKeyDown={event=>{if(event.key==='Escape' && !event.defaultPrevented && !saving)onClose();}}>
  <header className="allocation-workspace-header"><div className="allocation-workspace-title"><span className="allocation-title-icon"><Icon size={23}/></span><div><h2 className="erp-dialog-title">{editing?'Edit':'New'} {name}</h2><p>Enter the details and check the summary before saving.</p></div></div><button type="button" className="allocation-header-close" aria-label={`Close ${name.toLowerCase()} editor`} disabled={saving} onClick={onClose}><X size={18}/></button></header>
  <div className="allocation-workspace-body"><fieldset disabled={saving} className="master-workspace-inputs">
   <div className="master-workspace-pair">{input(code,`${name} code`,{required:true,maxLength:product?50:brand?50:20,onChange:event=>change(code,event.target.value.toUpperCase())})}{input('name',`${name} name`,{required:true,maxLength:product?200:brand?150:100})}</div>
   {product && <><div className="master-workspace-pair">{select('brandId','Brand',brands)}{select('categoryId','Category',categories)}</div>{select('warehouseId','Warehouse',warehouses)}<div className="master-workspace-pair"><label>Unit of measure<FilterSelect variant="field" aria-label="Unit of measure" value={form.unitOfMeasure || 'PCS'} onChange={event=>change('unitOfMeasure',event.target.value)}>{['PCS','BOX','KG','LTR','MTR','PKT','DOZ','SET','BAG','ROLL'].map(unit=><option key={unit} value={unit}>{unit}</option>)}</FilterSelect></label>{input('minStockLevel','Minimum stock level',{type:'text',inputMode:'numeric',placeholder:'Enter quantity'})}</div></>}
   {brand && <>{input('markupPercent','MP% (Markup on cost)',{type:'text',inputMode:'decimal',placeholder:'Enter markup percentage'})}<small className="master-workspace-hint">Used to calculate selling prices when receiving this brand’s products.</small></>}
   {warehouse && <>{input('contactNumber','Contact number',{type:'tel',maxLength:30,placeholder:'+94 ...'})}<label>Address<textarea className="erp-field" aria-label="Address" name="address" value={form.address || ''} rows={3} onChange={event=>change('address',event.target.value)}/></label></>}
   {!warehouse && <label>Description / notes<textarea className="erp-field" aria-label="Description / notes" name="description" value={form.description || ''} rows={3} onChange={event=>change('description',event.target.value)}/></label>}
  </fieldset><aside className="allocation-receipt allocation-inline-review" aria-label={`${name} summary`}><div className="allocation-receipt-heading"><h3>{name} summary</h3><p>Details you have entered.</p></div><div className="allocation-receipt-section"><h4>{name}</h4><strong>{form.name || `${name} name not entered`}</strong><dl>{summary.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value==null || value===''?'—':value}</dd></div>)}</dl></div>{!warehouse && <div className="allocation-receipt-notes"><h4>Description / notes</h4><p>{form.description || 'No notes entered'}</p></div>}</aside></div>
  <footer className="allocation-workspace-actions"><span>{editing?'Update the details for this record.':'Check the details before saving.'}</span><div><button type="button" className="allocation-secondary" disabled={saving} onClick={onClose}>Cancel</button>{!editing && <button type="button" className="allocation-secondary" disabled={!canDraft} onClick={event=>submit(event,'DRAFT')}>Save draft</button>}<button type="submit" className="allocation-primary" disabled={saving || (draftEditing && !canDraft)}><Save size={15}/>{saving?'Saving...':draftEditing?'Save draft':editing?'Save changes':`Save ${name}`}</button></div></footer>
 </form>;
}
