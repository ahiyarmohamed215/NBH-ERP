import React,{useEffect,useState} from 'react';
import {ArrowLeft,Trash2,RotateCcw,Save} from 'lucide-react';
import {salesApi} from '../api/apiClient';
import {hasPermission} from '../utils/moduleAccess';
import {warehouseGroups} from '../utils/heldWarehousePrint';
import {onholdReviewMaximum} from '../utils/onholdReviewMaximum';
import StatusBadge from '../components/StatusBadge';
import SearchBar from '../components/SearchBar';
import FilterSelect from '../components/FilterSelect';
import './OnholdBillEditor.css';

export default function OnholdBillEditor({bill,user,onBack,onSaved}) {
  const [lines,setLines]=useState(()=>bill.items.map(i=>({...i,approvedQuantity:String(i.quantity),physicalStock:''})));
  const [warehouse,setWarehouse]=useState(''),[query,setQuery]=useState(''),[remarks,setRemarks]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [reviewLimits,setReviewLimits]=useState(null),[loadingLimits,setLoadingLimits]=useState(true),[limitError,setLimitError]=useState('');
  useEffect(()=>{let alive=true;setLoadingLimits(true);setLimitError('');salesApi.getHeldReviewLimits(bill.id).then(response=>{if(alive)setReviewLimits(response.data?.data || response.data);}).catch(()=>{if(alive)setLimitError('Unable to load allocation and warehouse stock limits. Reopen this bill to try again.');}).finally(()=>{if(alive)setLoadingLimits(false);});return()=>{alive=false;};},[bill.id,bill.recordVersion]);
  const maximum=line=>onholdReviewMaximum(line,lines,reviewLimits,bill.warehouseId);
  const canCount=hasPermission(user,'INVENTORY_ADJUST'),groups=warehouseGroups(bill);
  const update=(id,field,value)=>setLines(previous=>previous.map(i=>i.id===id?{...i,[field]:value}:i));
  const shown=lines.filter(i=>(!warehouse || String(i.warehouseId || bill.warehouseId)===warehouse) && `${i.productSku} ${i.productName}`.toLowerCase().includes(query.toLowerCase()));
  const totalLine=i=>Number(i.approvedQuantity)*(Number(i.unitPrice)-Number(i.discountAmount || 0)/Number(i.quantity));
  const subtotal=lines.reduce((sum,i)=>sum+totalLine(i),0),total=(subtotal-Number(bill.discountAmount || 0))*(1+Number(bill.taxRate || 0)/100);
  const invalid=lines.some(i=>i.approvedQuantity==='' || !Number.isFinite(Number(i.approvedQuantity)) || Number(i.approvedQuantity)<0 || Number(i.approvedQuantity)>maximum(i) || (i.physicalStock!=='' && (!Number.isFinite(Number(i.physicalStock)) || Number(i.physicalStock)<0))) || !lines.some(i=>Number(i.approvedQuantity)>0);
  const hasChanges=lines.some(i=>Number(i.approvedQuantity)!==Number(i.quantity) || i.physicalStock!=='');
  const save=async()=>{
    if(busy || loadingLimits || limitError || invalid || (hasChanges && !remarks.trim()))return;setBusy(true);setError('');
    try{const res=await salesApi.reviewHeld(bill.id,{expectedVersion:bill.recordVersion,remarks:remarks.trim() || 'Reviewed with no changes.',items:lines.map(i=>({itemId:i.id,approvedQuantity:Number(i.approvedQuantity),physicalStock:i.physicalStock===''?null:Number(i.physicalStock)}))});onSaved(res.data?.data || res.data);}
    catch(e){setError(e.response?.data?.message || e.message || 'Unable to save the onhold bill.');}finally{setBusy(false);}
  };
  return <section className="erp-page onhold-editor" data-focused="true" aria-labelledby="onhold-editor-title">
    <header className="erp-page-header"><div><h1 className="erp-page-title" id="onhold-editor-title">Edit Onhold Bill {bill.heldNumber}</h1><p className="erp-page-description">{bill.customerName}</p></div><div className="onhold-editor-header-actions"><StatusBadge status={bill.status}/><button type="button" className="erp-button" disabled={busy} onClick={onBack}><ArrowLeft size={16}/> Onhold Bills</button></div></header>
    {(error || limitError) && <p role="alert" className="held-error">{error || limitError}</p>}
    <div className="onhold-editor-toolbar"><SearchBar value={query} onChange={e=>setQuery(e.target.value)} onClear={()=>setQuery('')} placeholder="Search product code or name..." ariaLabel="Search review products"/><div className="onhold-editor-filters"><FilterSelect value={warehouse} onChange={e=>setWarehouse(e.target.value)} aria-label="Review warehouse filter" style={{width:190}}><option value="">All warehouses</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</FilterSelect><span>{shown.length} of {lines.length} products</span></div></div>
    <div className="erp-table-frame erp-table-scroll onhold-editor-lines"><table className="erp-table"><thead><tr>{['Product','Warehouse','Selling qty','Approved quantity','Total physical stock','Approved total','Actions'].map(t=><th className={`erp-table-heading${['Selling qty','Approved quantity','Total physical stock','Approved total'].includes(t)?' onhold-editor-number':t==='Actions'?' erp-table-actions':''}`} key={t}>{t}</th>)}</tr></thead><tbody>{shown.map(i=>{
      const removed=i.approvedQuantity!=='' && Number(i.approvedQuantity)===0;
      return <tr key={i.id} data-removed={removed}><td className="erp-table-cell onhold-editor-product"><strong>{i.productName}</strong><small>{i.productSku}{removed?' · Removed from bill':''}</small></td><td className="erp-table-cell">{i.warehouseName || bill.warehouseName}</td><td className="erp-table-cell onhold-editor-number">{i.quantity} {i.unitOfMeasure}</td>
        <td className="erp-table-cell onhold-editor-number"><input aria-label={`Approved quantity ${i.productSku}`} className="erp-field" type="number" min="0" step="0.01" max={maximum(i)} aria-invalid={Number(i.approvedQuantity)>maximum(i)} disabled={busy || loadingLimits || Boolean(limitError)} value={i.approvedQuantity} onChange={e=>update(i.id,'approvedQuantity',e.target.value)}/><small>{loadingLimits?'Checking limits…':`Max ${maximum(i).toLocaleString('en-LK',{maximumFractionDigits:2})}`}</small></td>
        <td className="erp-table-cell onhold-editor-number"><input aria-label={`Physical stock ${i.productSku}`} className="erp-field" type="number" min="0" step="0.01" disabled={busy || !canCount} value={i.physicalStock} onChange={e=>update(i.id,'physicalStock',e.target.value)} placeholder="Unchanged"/></td>
        <td className="erp-table-cell onhold-editor-number">LKR {totalLine(i).toFixed(2)}</td><td className="erp-table-cell erp-table-actions"><button className="erp-table-icon-action" disabled={busy} data-tone={removed?undefined:'danger'} aria-label={`${removed?'Restore':'Remove'} ${i.productSku}`} title={removed?'Restore product':'Remove product from bill'} onClick={()=>update(i.id,'approvedQuantity',removed?String(i.quantity):'0')}>{removed?<RotateCcw size={15}/>:<Trash2 size={15}/>}</button></td></tr>;
    })}{!shown.length && <tr><td colSpan={7} className="erp-table-cell">No products match this filter.</td></tr>}</tbody></table></div>
    <div className="onhold-editor-summary"><label htmlFor="onhold-review-remarks">Warehouse review remarks{hasChanges?' (required)':' (optional)'}<textarea id="onhold-review-remarks" className="erp-field" maxLength={1000} disabled={busy} value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Add remarks"/></label><div className="onhold-editor-total"><span>Approved bill total</span><strong>LKR {total.toFixed(2)}</strong></div></div>
    <footer><button className="erp-button" disabled={busy} onClick={onBack}>Cancel</button><button className="erp-button erp-button-primary" disabled={busy || loadingLimits || Boolean(limitError) || invalid || (hasChanges && !remarks.trim()) || bill.status!=='SENT_TO_WAREHOUSE'} onClick={save}><Save size={16}/>{busy?'Saving…':'Save review'}</button></footer>
  </section>;
}
