import React,{useEffect,useState} from 'react';
import {Ban,Edit2,Printer} from 'lucide-react';
import {salesApi} from '../api/apiClient';
import {hasPermission} from '../utils/moduleAccess';
import {warehouseGroups,printHeldWarehouseSheets} from '../utils/heldWarehousePrint';
import PurchaseInspectionModal from './PurchaseInspectionModal';
import SearchBar from './SearchBar';
import HeldBillPrintDialog from './HeldBillPrintDialog';
import FilterSelect from './FilterSelect';
import {posRemarks,isCancelledBill} from '../utils/billRemarks';
import {printHeldBill} from '../utils/heldBillPrint';
import './HeldBillDetails.css';

export default function HeldBillDetails({bill:initialBill,user,onClose,onChanged=()=>{},onEdit,onCancel,posOnly=false}) {
  const [bill,setBill]=useState(initialBill),[warehouse,setWarehouse]=useState(''),[query,setQuery]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [showPrint,setShowPrint]=useState(false);
  const original=Boolean(initialBill.originalCopy),groups=warehouseGroups(bill);
  const canOperate=initialBill.canResume!==false || bill.createdBy===user?.username || hasPermission(user,'SALES_EDIT') || hasPermission(user,'SALES_VIEW_ALL');
  const canPrint=original || (canOperate && (hasPermission(user,'SALES_CREATE') || hasPermission(user,'SALES_EDIT')) && bill.status!=='CANCELLED');
  const canEdit=!original && !posOnly && canOperate && hasPermission(user,'SALES_EDIT') && bill.status==='SENT_TO_WAREHOUSE';
  const visible=(bill.items || []).filter(line=>(!warehouse || String(line.warehouseId || bill.warehouseId)===warehouse) && (!query.trim() || `${line.productSku} ${line.productName}`.toLowerCase().includes(query.trim().toLowerCase())));
  const load=async()=>{
    if(!canOperate || original)return;
    const details=await salesApi.getById(bill.id);
    const latest=details.data?.data || details.data;
    if(latest?.status)setBill(previous=>({...previous,...latest}));
  };
  useEffect(()=>{
    if(original || !canOperate)return;
    let alive=true;
    const refresh=async()=>{try{
      const details=await salesApi.getById(initialBill.id);
      if(!alive)return;const latest=details.data?.data || details.data;
      if(latest?.status)setBill(previous=>({...previous,...latest}));
    }catch(e){if(alive)setError(e.message || 'Unable to refresh the bill.');}};
    refresh();const timer=setInterval(refresh,5000);return()=>{alive=false;clearInterval(timer);};
  },[initialBill.id,original,canOperate]);
  const run=async action=>{if(busy)return;setBusy(true);setError('');setNotice('');try{await action();}catch(e){setError(e.response?.data?.message || e.message || 'Unable to complete this action.');}finally{setBusy(false);}};
  const print=()=>{if(original){printHeldBill(bill);return;}if(bill.status==='YET_TO_PRINT'){setShowPrint(true);return;}return run(async()=>{
    printHeldWarehouseSheets(bill,warehouse || undefined);
    try{await salesApi.printHeld(bill.id,warehouse || undefined);}catch(_){}
    setNotice('Warehouse sheets opened for printing.');
    await load();
    onChanged();
  });};
  const actions=[];
  if(canEdit && onEdit)actions.push({label:'Warehouse Review',icon:Edit2,onClick:()=>onEdit(bill),disabled:busy});
  if(!original && onCancel && canOperate && (hasPermission(user,'SALES_EDIT') || (hasPermission(user,'SALES_CREATE') && !['MERGED','INVOICE_CREATED'].includes(bill.status))) && ['YET_TO_PRINT','SENT_TO_WAREHOUSE','STOCK_ADJUSTED','MERGED','INVOICE_CREATED'].includes(bill.status))actions.push({label:'Cancel Onhold Bill',icon:Ban,onClick:()=>onCancel(bill),disabled:busy,tone:'danger'});
  return <PurchaseInspectionModal className="onhold-inspection" type={original?"POS Onhold Bill":"Onhold Bill"} number={bill.heldNumber} status={original?(['CANCELLED','INVOICE_CANCELLED','VOIDED'].includes(bill.status)?'CANCELLED':'BILLED'):bill.status==='MERGED'?'INVOICE_CREATED':bill.status}
    ariaLabel={`${original?'POS Onhold Bill':'Onhold bill'} ${bill.heldNumber}`} closeAriaLabel="Close held bill" onClose={onClose}
    detailsPosition="header" actionsPosition="bottom" showHeaderClose tableToolbar closeLabel="Close" detailActions={actions}
    details={[
      {label:'Customer',value:bill.customerName},{label:'Bill date',value:(bill.createdAt || bill.invoiceDate)?.slice(0,10)},
      {label:'Created by',value:[bill.createdByName || bill.createdBy,bill.createdByEmployeeCode].filter(Boolean).join(' · ')},
      {label:original?'Original bill total':'Bill total',value:`LKR ${Number(bill.netTotal || 0).toFixed(2)}`},
      {label:'Remarks',value:posRemarks(bill) || '—',wide:true},
      ...(isCancelledBill(bill)?[{label:'Cancellation reason',value:bill.cancellationReason || '—',wide:true}]:[]),
    ]}
    content={<div className="onhold-inspection-content">
      {showPrint && <HeldBillPrintDialog bill={bill} onClose={()=>setShowPrint(false)} onPrinted={async()=>{setShowPrint(false);setBill(previous=>({...previous,status:'SENT_TO_WAREHOUSE'}));await load();onChanged();}}/>}
      <div className="purchase-inspection-table-toolbar">
        <SearchBar value={query} onChange={e=>setQuery(e.target.value)} onClear={()=>setQuery('')} placeholder="Search product code or name..." ariaLabel="Search onhold products"/>
        <FilterSelect value={warehouse} onChange={e=>setWarehouse(e.target.value)} aria-label="Warehouse filter" style={{width:190}}><option value="">All Warehouses</option>{groups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</FilterSelect>
        <button type="button" className="purchase-inspection-table-print" disabled={busy || !canPrint} aria-label={original?'Print held bill':'Print warehouse sheets'} onClick={print}><Printer size={15}/>Print</button>
      </div>
      {error && <p role="alert" className="onhold-message onhold-error">{error}</p>}{notice && <p role="status" className="onhold-message">{notice}</p>}
      <div className="purchase-inspection-table erp-table-frame erp-table-scroll"><table className="erp-table"><thead><tr>{['Product','Unit price','Selling qty','Sub line total','Discount %','Discount Rs.','Line total'].map((label,index)=><th className={`erp-table-heading${index?' purchase-inspection-number':''}`} key={label}>{label}</th>)}</tr></thead><tbody>
        {visible.map(line=>{
          const gross=Math.round(Number(line.quantity || 0)*Number(line.unitPrice || 0)*100)/100;
          const rate=Number(line.discountRate || 0);
          const discount=line.discountAmount!=null?Number(line.discountAmount):Math.round(gross*rate)/100;
          const effectiveRate=rate || (gross>0?discount/gross*100:0);
          const lineTotal=line.totalPrice!=null?Number(line.totalPrice):gross-discount;
          return <tr key={line.id}><td className="erp-table-cell onhold-product"><span className="onhold-product-name">{line.productName}</span><span className="onhold-product-code">{line.productSku}</span></td>
            <td className="erp-table-cell purchase-inspection-number">{Number(line.unitPrice || 0).toFixed(2)}</td><td className="erp-table-cell purchase-inspection-number">{line.quantity}</td>
            <td className="erp-table-cell purchase-inspection-number">{gross.toFixed(2)}</td><td className="erp-table-cell purchase-inspection-number">{effectiveRate.toFixed(2)}%</td>
            <td className="erp-table-cell purchase-inspection-number">{discount.toFixed(2)}</td><td className="erp-table-cell purchase-inspection-number">{lineTotal.toFixed(2)}</td></tr>;
        })}
        {!visible.length && <tr><td className="erp-table-cell" colSpan={7}>No products match these filters.</td></tr>}
      </tbody></table></div>
    </div>}/>
}