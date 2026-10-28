import React,{useEffect,useState} from 'react';
import {ArrowLeft,Trash2,RotateCcw,Save,X} from 'lucide-react';
import {salesApi} from '../api/apiClient';
import {warehouseGroups} from '../utils/heldWarehousePrint';
import {onholdReviewMaximum} from '../utils/onholdReviewMaximum';
import {packingFields,emptyPacking,validPacking,packingTotals} from '../utils/invoicePacking';
import StatusBadge from '../components/StatusBadge';
import SearchBar from '../components/SearchBar';
import FilterSelect from '../components/FilterSelect';
import './OnholdBillEditor.css';

export default function OnholdBillEditor({bill,user,onBack,onSaved}) {
  const [lines,setLines]=useState(()=>bill.items.map(i=>({...i,approvedQuantity:String(i.quantity)})));
  const [warehousePacking,setWarehousePacking]=useState(()=>Object.fromEntries(warehouseGroups(bill).map(group=>[group.id,bill.warehousePacking?.[group.id] || emptyPacking()])));
  const [warehouse,setWarehouse]=useState(''),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [reviewLimits,setReviewLimits]=useState(null),[loadingLimits,setLoadingLimits]=useState(true),[limitError,setLimitError]=useState('');
  useEffect(()=>{let alive=true;setLoadingLimits(true);setLimitError('');salesApi.getHeldReviewLimits(bill.id).then(response=>{if(alive)setReviewLimits(response.data?.data || response.data);}).catch(()=>{if(alive)setLimitError('Unable to load allocation and warehouse stock limits. Reopen this bill to try again.');}).finally(()=>{if(alive)setLoadingLimits(false);});return()=>{alive=false;};},[bill.id,bill.recordVersion]);
  const maximum=line=>onholdReviewMaximum(line,lines,reviewLimits,bill.warehouseId);
  const groups=warehouseGroups(bill);
  const packingTotal=packingTotals(warehousePacking);
  const invalidPacking=Object.values(warehousePacking).some(row=>!validPacking(row)) || !validPacking(packingTotal) || groups.some(group=>!lines.some(line=>String(line.warehouseId || bill.warehouseId)===group.id && Number(line.approvedQuantity)>0) && packingFields.some(([key])=>Number(warehousePacking[group.id][key])>0));
  const update=(id,field,value)=>setLines(previous=>previous.map(i=>i.id===id?{...i,[field]:value}:i));
  const shown=lines.filter(i=>(!warehouse || String(i.warehouseId || bill.warehouseId)===warehouse) && `${i.productSku} ${i.productName}`.toLowerCase().includes(query.toLowerCase()));
  const totalLine=i=>(Number(i.approvedQuantity) || 0)*(Number(i.unitPrice)-Number(i.discountAmount || 0)/Number(i.quantity));
  const subtotal=lines.reduce((sum,i)=>sum+totalLine(i),0),total=(subtotal-Number(bill.discountAmount || 0))*(1+Number(bill.taxRate || 0)/100);
  const invalid=lines.some(i=>i.approvedQuantity==='' || !Number.isFinite(Number(i.approvedQuantity)) || Number(i.approvedQuantity)<0 || Number(i.approvedQuantity)>maximum(i)) || !lines.some(i=>Number(i.approvedQuantity)>0);
  const hasChanges=lines.some(i=>Number(i.approvedQuantity)!==Number(i.quantity));
  const save=async()=>{
    if(busy || loadingLimits || limitError || invalid || invalidPacking)return;setBusy(true);setError('');
    try{const res=await salesApi.reviewHeld(bill.id,{expectedVersion:bill.recordVersion,remarks:hasChanges?'Warehouse review completed.':'Reviewed with no changes.',warehousePacking:Object.fromEntries(Object.entries(warehousePacking).map(([id,value])=>[id,Object.fromEntries(packingFields.map(([key])=>[key,Number(value[key])]))])),items:lines.map(i=>({itemId:i.id,approvedQuantity:Number(i.approvedQuantity)}))});onSaved(res.data?.data || res.data);}
    catch(e){setError(e.response?.data?.message || e.message || 'Unable to save the onhold bill.');}finally{setBusy(false);}
  };
  return <section className="erp-page onhold-editor" data-focused="true" aria-labelledby="onhold-editor-title">
    <header className="erp-page-header"><div><h1 className="erp-page-title" id="onhold-editor-title">Warehouse Review</h1><p className="erp-page-description">{bill.heldNumber} · {bill.customerName}</p></div><div className="onhold-editor-header-actions"><StatusBadge status={bill.status}/><button type="button" className="erp-button" disabled={busy} onClick={onBack}><ArrowLeft size={16}/> Onhold Bills</button></div></header>
    {(error || limitError) && <p role="alert" className="held-error">{error || limitError}</p>}
    <div className="onhold-editor-toolbar"><SearchBar value={query} onChange={e=>setQuery(e.target.value)} onClear={()=>setQuery('')} placeholder="Search product code or name..." ariaLabel="Search review products"/><div className="onhold-editor-filters"><FilterSelect value={warehouse} onChange={e=>setWarehouse(e.target.value)} aria-label="Review warehouse filter" style={{width:190}}><option value="">All warehouses</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</FilterSelect>{(query || warehouse) && <button type="button" className="erp-button onhold-editor-reset" title="Reset product filters" onClick={()=>{setQuery('');setWarehouse('');}}><X size={13}/>Reset</button>}</div></div>
    <div className="erp-table-frame erp-table-scroll onhold-editor-lines"><table className="erp-table"><thead><tr>{['Product','Warehouse','Selling qty','Approved quantity','Approved total','Actions'].map(t=><th className={`erp-table-heading${['Selling qty','Approved quantity','Approved total'].includes(t)?' onhold-editor-number':t==='Actions'?' erp-table-actions':''}`} key={t}>{t}</th>)}</tr></thead><tbody>{shown.map(i=>{
      const removed=i.approvedQuantity!=='' && Number(i.approvedQuantity)===0;
      return <tr key={i.id} data-removed={removed}><td className="erp-table-cell onhold-editor-product"><strong>{i.productName}</strong><small>{i.productSku}{removed?' · Removed from bill':''}</small></td><td className="erp-table-cell">{i.warehouseName || bill.warehouseName}</td><td className="erp-table-cell onhold-editor-number">{i.quantity} {i.unitOfMeasure}</td>
        <td className="erp-table-cell onhold-editor-number"><input aria-label={`Approved quantity ${i.productSku}`} className="erp-field onhold-quantity-input" type="text" inputMode="decimal" data-max={maximum(i)} aria-invalid={i.approvedQuantity==='' || !Number.isFinite(Number(i.approvedQuantity)) || Number(i.approvedQuantity)>maximum(i)} disabled={busy || loadingLimits || Boolean(limitError)} value={i.approvedQuantity} onFocus={e=>e.target.select()} onChange={e=>{if(/^\d*(?:\.\d{0,2})?$/.test(e.target.value))update(i.id,'approvedQuantity',e.target.value);}}/><small>{loadingLimits?'Checking limits…':`Max ${maximum(i).toLocaleString('en-LK',{maximumFractionDigits:2})}`}</small></td>
        <td className="erp-table-cell onhold-editor-number">LKR {totalLine(i).toFixed(2)}</td><td className="erp-table-cell erp-table-actions"><button className="erp-table-icon-action" disabled={busy} data-tone={removed?undefined:'danger'} aria-label={`${removed?'Restore':'Remove'} ${i.productSku}`} title={removed?'Restore product':'Remove product from bill'} onClick={()=>update(i.id,'approvedQuantity',removed?String(i.quantity):'0')}>{removed?<RotateCcw size={15}/>:<Trash2 size={15}/>}</button></td></tr>;
    })}{!shown.length && <tr><td colSpan={6} className="erp-table-cell">No products match this filter.</td></tr>}</tbody></table></div>
    <section className="onhold-review-packing" aria-labelledby="review-packing-title">
      <h2 id="review-packing-title">Warehouse packing</h2><p>Enter the counts written on each warehouse sheet. Use 0 for unused types. These counts will be added together on the invoice.</p>
      {groups.filter(group=>!warehouse || group.id===warehouse).map(group=><fieldset key={group.id} disabled={busy}><legend>{group.name || `Warehouse ${group.id}`}</legend><div className="onhold-review-packing-fields">{packingFields.map(([key,label])=><label key={key}>{label}<input className="erp-field" type="text" inputMode="numeric" aria-label={`${label} count ${group.name || group.id}`} aria-invalid={!/^\d+$/.test(String(warehousePacking[group.id][key])) || Number(warehousePacking[group.id][key])>1000000} value={warehousePacking[group.id][key]} onChange={event=>{const value=event.target.value;if(/^\d*$/.test(value))setWarehousePacking(previous=>({...previous,[group.id]:{...previous[group.id],[key]:value}}));}}/></label>)}</div></fieldset>)}
      <p className="onhold-review-packing-total">Bill packing total · {packingFields.map(([key,label])=>`${label} ${packingTotal[key]}`).join(' · ')}</p>
      {invalidPacking && <p role="alert" className="held-error">Enter whole numbers from 0 to 1,000,000. Keep each bill total within this limit and use 0 for warehouses with no approved products.</p>}
    </section>
    <footer className="onhold-editor-footer"><div className="onhold-editor-total"><span>{lines.filter(i=>Number(i.approvedQuantity)>0).length} products · Approved bill total</span><strong>LKR {total.toFixed(2)}</strong></div><div className="onhold-editor-actions"><button type="button" className="erp-button" disabled={busy} onClick={onBack}>Cancel</button><button type="button" className="erp-button erp-button-primary" disabled={busy || loadingLimits || Boolean(limitError) || invalid || invalidPacking || bill.status!=='SENT_TO_WAREHOUSE'} onClick={save}><Save size={16}/>{busy?'Saving…':'Save review'}</button></div></footer>
  </section>;
}
