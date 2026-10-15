import React,{useEffect,useRef} from 'react';
import {SlidersHorizontal,Save,X} from 'lucide-react';
import FilterSelect from './FilterSelect';
import './AllocationWorkspace.css';
import './MasterWorkspace.css';

export default function AdjustmentWorkspace({form,onChange,warehouses,products,balances,canSeeCost,editing,busy,onSave,onClose}) {
 const ref=useRef(null);
 useEffect(()=>{ref.current?.querySelector('[role="combobox"]')?.focus();},[]);
 const change=(field,value)=>onChange(previous=>({...previous,[field]:value}));
 const product=products.find(p=>String(p.id)===String(form.productId)),warehouse=warehouses.find(w=>String(w.id)===String(form.warehouseId));
 const current=Number(balances.find(b=>String(b.productId)===String(form.productId) && String(b.warehouseId)===String(form.warehouseId))?.quantity || 0);
 const quantity=Number(form.quantity || 0),after=form.type==='Reduction'?Math.max(0,current-quantity):current+quantity;
 const reasons=form.type==='Reduction'?['Stock count variance','Damaged stock','Expired stock','Internal consumption','Physical cycle audit','Other adjustment']:['Opening stock correction','Found stock','Stock count variance','Physical cycle audit','Other adjustment'];
 const select=(name,label,children,onSelect=value=>change(name,value))=><label>{label} *<FilterSelect variant="field" name={name} aria-label={label} value={form[name] || ''} disabled={busy} onChange={event=>onSelect(event.target.value)}>{children}</FilterSelect></label>;
 return <form ref={ref} className="allocation-workspace purchase-document master-workspace adjustment-workspace" aria-label={`${editing?'Edit':'New'} stock adjustment`} onSubmit={onSave} onKeyDown={event=>{if(event.key==='Escape' && !event.defaultPrevented && !busy)onClose();}}>
  <header className="allocation-workspace-header"><div className="allocation-workspace-title"><span className="allocation-title-icon"><SlidersHorizontal size={23}/></span><div><h2 className="erp-dialog-title">{editing?'Edit':'New'} Stock Adjustment</h2><p>{editing?.recordNo || 'Enter the adjustment and check the stock summary.'}</p></div></div><button type="button" className="allocation-header-close" aria-label="Close stock adjustment editor" disabled={busy} onClick={onClose}><X size={18}/></button></header>
  <div className="allocation-workspace-body"><fieldset disabled={busy} className="master-workspace-inputs">
   <div className="master-workspace-pair">
    {select('type','Adjustment action',<><option value="">Select action</option><option value="Addition">Add stock</option><option value="Reduction">Reduce stock</option></>,value=>onChange(previous=>({...previous,type:value,reason:value==='Addition'?'Opening stock correction':'Stock count variance'})))}
    {select('warehouseId','Warehouse',<><option value="">Select warehouse</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</>)}
   </div>
   {select('productId','Product',<><option value="">Select product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}</>,value=>onChange(previous=>({...previous,productId:value,costPrice:String(products.find(p=>String(p.id)===value)?.costPrice ?? previous.costPrice ?? '0.00')})))}
   <div className="master-workspace-pair"><label>Quantity *<input className="erp-field" name="quantity" aria-label="Adjustment quantity" type="number" min="1" step="1" required value={form.quantity} onChange={event=>change('quantity',event.target.value)}/></label>
    {canSeeCost && form.type==='Addition' && <label>Cost price per unit *<input className="erp-field" name="costPrice" aria-label="Cost price per unit" type="number" min="0" step="0.000001" required value={form.costPrice} onChange={event=>change('costPrice',event.target.value)}/></label>}
   </div>
   {select('reason','Reason',<><option value="">Select reason</option>{reasons.map(reason=><option key={reason} value={reason}>{reason}</option>)}</>)}
   <label>Remarks<textarea className="erp-field" aria-label="Remarks" name="remarks" rows={3} maxLength={5000} value={form.remarks || ''} onChange={event=>change('remarks',event.target.value)}/></label>
  </fieldset><aside className="allocation-receipt allocation-inline-review" aria-label="Stock adjustment summary"><div className="allocation-receipt-heading"><h3>Adjustment summary</h3><p>Review the change before saving.</p></div><div className="allocation-receipt-section"><h4>{form.type==='Reduction'?'Reduce stock':form.type==='Addition'?'Add stock':'Select an action'}</h4><strong>{product?.name || 'Product not selected'}</strong><dl>{[['Product code',product?.sku],['Warehouse',warehouse?.name],['Current quantity',product && warehouse?current:null],['Adjustment quantity',form.quantity?`${form.type==='Reduction'?'-':'+'}${quantity}`:null],['Quantity after adjustment',product && warehouse && form.type?after:null],['Reason',form.reason]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value==null || value===''?'—':value}</dd></div>)}</dl></div><div className="allocation-receipt-notes"><h4>Remarks</h4><p>{form.remarks || '—'}</p></div></aside></div>
  <footer className="allocation-workspace-actions"><span>Check the stock change before saving.</span><div><button type="button" className="allocation-secondary" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="allocation-primary" disabled={busy || !form.type}><Save size={15}/>{busy?'Saving...':form.type==='Reduction'?'Reduce Stock':form.type==='Addition'?'Add Stock':'Save Adjustment'}</button></div></footer>
 </form>;
}
