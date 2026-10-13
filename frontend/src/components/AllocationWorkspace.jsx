import {staffCode} from '../utils/staffCode';
import React,{useState} from 'react';
import {Search,ShieldCheck,CheckCircle,Package,ChevronRight,X} from 'lucide-react';
import {numberError} from '../utils/purchasingValidation';
import './AllocationWorkspace.css';

export default function AllocationWorkspace({form,onChange,editing,products,staff,productResults,staffResults,productQuery,onProductQuery,staffQuery,onStaffQuery,stockInfo,getStock,loadingStock,saving,onSave,onCancel}) {
  const [touched,setTouched]=useState(false),[productOpen,setProductOpen]=useState(false),[staffOpen,setStaffOpen]=useState(false);
  const product=products.find(product=>String(product.id)===String(form.productId));
  const person=staff.find(person=>String(person.id)===String(form.userId));
  const productName=product?.name || editing?.productName;
  const staffName=person?.fullName || person?.username || editing?.userFullName || editing?.username;
  const available=Number(stockInfo?.availableStock ?? getStock(form.productId).available ?? 0);
  const unit=stockInfo?.unit || product?.unitOfMeasure || 'Units';
  const error=numberError(form.allocatedQuantity,'Allocated quantity',{positive:true,decimals:2,max:9999999999.99});
  const exceeds=!error && Number(form.allocatedQuantity)>available;
  const canSave=form.productId && form.userId && !error && !exceeds && available>0 && !loadingStock && !saving && (form.notes || '').length<=255;
  const isDraftEdit=editing?.status==='DRAFT';
  const identityLocked=Boolean(editing && !isDraftEdit);
  const hasDraftInput=Boolean(form.productId || form.userId || String(form.allocatedQuantity || '').trim() || (form.notes || '').trim());
  const canDraft=hasDraftInput && (!form.allocatedQuantity || !error) && !saving && (form.notes || '').length<=255 && (!editing || isDraftEdit);
  const change=(field,value)=>onChange(previous=>({...previous,[field]:value}));
  const chooseProduct=product=>{change('productId',String(product.id));onProductQuery('');setProductOpen(false);};
  const chooseStaff=person=>{change('userId',String(person.id));onStaffQuery('');setStaffOpen(false);};
  const closeOnBlur=(event,setOpen)=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);};
  return <form className="allocation-workspace purchase-document" aria-label={editing?'Edit inventory allocation':'New inventory allocation'} onSubmit={event=>{event.preventDefault();if(editing?.status==='DRAFT'){if(canDraft)onSave(event,'DRAFT');else setTouched(true);return;}if(!canSave){setTouched(true);return;}setProductOpen(false);setStaffOpen(false);onSave(event);}}>
    <header className="allocation-workspace-header">
      <div className="allocation-workspace-title"><span className="allocation-title-icon"><ShieldCheck size={23}/></span><div><span className="allocation-eyebrow">Inventory management</span><h2>{editing?'Edit inventory allocation':'New inventory allocation'}</h2><p>Select a product, assign staff and enter the allocation details.</p></div></div>
      <button type="button" className="purchase-inspection-close allocation-header-close" aria-label="Close allocation" title="Close" disabled={saving} onClick={onCancel}><X size={18}/></button>
    </header>
    <div className="allocation-workspace-body allocation-inputs-only" >
      <section className="allocation-intake-panel" aria-label="Allocation inputs">
        <div className="allocation-selector" onBlur={event=>closeOnBlur(event,setProductOpen)}>
          <label>Product *<div className="allocation-search"><Search size={16}/><input type="search" aria-label="Search allocation products" placeholder="Search product code, name or barcode..." disabled={identityLocked} value={productOpen?productQuery:(productName?`${product?.sku || editing?.productSku || ''} — ${productName}`:productQuery)} onFocus={()=>{setProductOpen(true);setStaffOpen(false);}} onChange={event=>{onProductQuery(event.target.value);setProductOpen(true);}} onKeyDown={event=>{if(event.key==='Escape')setProductOpen(false);if(event.key==='Enter'){event.preventDefault();const first=productResults.find(product=>!getStock(product.id).isOutOfStock);if(first)chooseProduct(first);}}}/></div></label>
          {productOpen && !identityLocked && <div className="allocation-search-results" aria-label="Allocation product results">
            {productResults.map(product=>{const stock=getStock(product.id);const selected=String(product.id)===String(form.productId);return <button key={product.id} type="button" className={selected?'is-selected':''} aria-label={`Select product ${product.sku || product.name}`} aria-pressed={selected} onMouseDown={event=>event.preventDefault()} onClick={()=>chooseProduct(product)}>
              <span className="allocation-result-main"><small>{product.sku || '—'}</small><strong>{product.name}</strong><span>{[product.brandName,product.categoryName].filter(Boolean).join(' · ')}</span></span>
              <span className="allocation-result-stock"><small>Available</small><strong>{Number(stock.available).toLocaleString()} <small>{stock.unit}</small></strong></span>{selected && <CheckCircle size={16}/>}</button>;})}
            {!productResults.length && <p>No matching products found.</p>}
          </div>}
        </div>
        <div className="allocation-stock-inline"><Package size={16}/><span>Available stock</span><strong>{form.productId?(loadingStock?'Checking...':`${available.toLocaleString()} ${unit}`):'Select a product'}</strong></div>
        <div className="allocation-selector" onBlur={event=>closeOnBlur(event,setStaffOpen)}>
          <label>Assign staff *<div className="allocation-search"><Search size={16}/><input type="search" aria-label="Search allocation staff" disabled={identityLocked} placeholder="Search staff name, code or email..." value={staffOpen?staffQuery:(staffName || staffQuery)} onFocus={()=>{setStaffOpen(true);setProductOpen(false);}} onChange={event=>{onStaffQuery(event.target.value);setStaffOpen(true);}} onKeyDown={event=>{if(event.key==='Escape')setStaffOpen(false);if(event.key==='Enter'){event.preventDefault();if(staffResults[0])chooseStaff(staffResults[0]);}}}/></div></label>
          {staffOpen && !identityLocked && <div className="allocation-search-results" aria-label="POS staff">
            {staffResults.map(person=><button key={person.id} type="button" aria-label={`Assign ${person.fullName || person.username}`} aria-pressed={String(person.id)===String(form.userId)} onMouseDown={event=>event.preventDefault()} onClick={()=>chooseStaff(person)}><span className="allocation-result-main"><strong>{person.fullName || person.username}</strong><small>{[staffCode(person),person.phone || person.email].filter(Boolean).join(' · ')}</small></span><ChevronRight size={15}/></button>)}
            {!staffResults.length && <p>No matching POS staff found.</p>}
          </div>}
        </div>
        <label>Allocated quantity *<div className="allocation-quantity-input"><input type="text" inputMode="decimal" aria-label="Allocated quantity" required value={form.allocatedQuantity} placeholder="Enter quantity" onChange={event=>change('allocatedQuantity',event.target.value)} onBlur={()=>setTouched(true)} aria-invalid={Boolean(exceeds || touched && error)}/><span>{unit}</span></div>{(exceeds || touched && error) && <small className="allocation-field-error">{error || `Only ${available.toLocaleString()} ${unit} are available.`}</small>}</label>
        <label>Remarks / notes<textarea aria-label="Allocation notes" rows={4} maxLength={255} value={form.notes} placeholder="Optional notes for this allocation" onChange={event=>change('notes',event.target.value)}/><small className="allocation-notes-count">{(form.notes || '').length}/255</small></label>
        {identityLocked && <p className="allocation-input-hint">Product and staff remain assigned when editing this allocation.</p>}
      </section>

      <div className="allocation-receipt allocation-inline-review" aria-label="Allocation review receipt">
        <div className="allocation-receipt-heading"><span className="allocation-receipt-symbol"><ShieldCheck size={23}/></span><h3>Allocation summary</h3><p>Check your selections before confirming.</p></div>
        <div className="allocation-receipt-section"><h4>Product</h4><strong>{productName || 'Select a product'}</strong><dl>
          <div><dt>Product code</dt><dd>{product?.sku || editing?.productSku || '—'}</dd></div>
          <div><dt>Brand / category</dt><dd>{[product?.brandName,product?.categoryName].filter(Boolean).join(' / ') || '—'}</dd></div>
          <div><dt>Available quantity</dt><dd>{available.toLocaleString()} {unit}</dd></div>
        </dl></div>
        <div className="allocation-receipt-section"><h4>Allocated to</h4><strong>{staffName || 'Select staff'}</strong><dl>
          <div><dt>Staff code</dt><dd>{staffCode(person || {id:form.userId})}</dd></div>
          <div><dt>Contact</dt><dd>{person?.phone || person?.email || '—'}</dd></div>
        </dl></div>
        <div className="allocation-receipt-quantity"><span>Quantity to allocate</span><strong>{form.allocatedQuantity || '—'} <small>{unit}</small></strong></div>
        <div className="allocation-receipt-notes"><h4>Remarks / notes</h4><p>{form.notes || 'No notes added'}</p></div>

      </div>    </div>
    <footer className="allocation-workspace-actions" ><span><ShieldCheck size={14}/>{form.userId ? `Assigned to ${staffName || 'selected staff'}` : 'Select a product and staff member to continue.'}</span><div><button type="button" className="allocation-secondary" disabled={saving} onClick={onCancel}>Cancel</button>{!editing && <button type="button" className="allocation-secondary" disabled={!canDraft} onClick={event=>onSave(event,'DRAFT')}>Save draft</button>}<button type="submit" className="allocation-primary" disabled={editing?.status==='DRAFT'?!canDraft:!canSave}>{saving?'Saving...':editing?.status==='DRAFT'?'Save draft':editing?'Save changes':'Allocate'}</button></div></footer>

  </form>;
}
