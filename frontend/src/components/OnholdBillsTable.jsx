import React,{useState} from 'react';

import {Edit2,Printer,RefreshCw,X,Layers} from 'lucide-react';

import SearchBar from './SearchBar';

import FilterSelect from './FilterSelect';

import DateRangePicker,{matchesDateRange} from './DateRangePicker';

import StatusBadge from './StatusBadge';

import {hasPermission} from '../utils/moduleAccess';

import {printA4Report} from '../utils/printReport';
import {posRemarks} from '../utils/billRemarks';
import {printHeldBill} from '../utils/heldBillPrint';

import './OnholdBillsTable.css';



export default function OnholdBillsTable({bills=[],loading,user,scope,onScopeChange,query,onQueryChange,status,onStatusChange,onRefresh,onView,onPrint,onEdit,onCancel,

  selected=[],onSelect,onMerge,merging=false,archive=false,history=false,posOnly=false,workspace}) {

  const [from,setFrom]=useState(''),[to,setTo]=useState('');

  const copyStatus=b=>['CANCELLED','INVOICE_CANCELLED','VOIDED'].includes(b.status)?'CANCELLED':'BILLED';

  const displayStatus=b=>archive?copyStatus(b):b.status==='MERGED'?'INVOICE_CREATED':b.status;

  const visible=bills.filter(b=>Boolean(b.originalCopy)===archive && b.status!=='HELD' && (status==='ALL' || displayStatus(b)===status) && matchesDateRange(b.createdAt || b.invoiceDate,from,to));


  const printDirectory=()=>{

    const escape=value=>String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

    const statusLabel=value=>value==='BILLED'?'Billed':value==='STOCK_ADJUSTED'?'Warehouse Reviewed':value.replaceAll('_',' ');

    printA4Report({title:archive?'Held Bills':'Onhold Bills',

      metaItems:[{label:'Search',value:escape(query) || 'All bills'},{label:'Owner',value:scope==='mine'?'My bills':scope==='others'?'Other bills':'All held bills'},

        {label:'Status',value:status==='ALL'?'All':escape(statusLabel(status))},{label:'Date range',value:escape(from || 'Any date')+' to '+escape(to || 'Any date')}],

      columns:[{header:'Onhold bill number',accessor:'number'},{header:'Customer',accessor:'customer'},{header:'Bill date',accessor:'date'},

        {header:'Staff',accessor:'staff'},{header:'Total products',accessor:'products',align:'right'},{header:'Total (LKR)',accessor:'total',align:'right'},{header:'Status',accessor:'status'},...(showRemarks?[{header:'Remarks',accessor:'remarks'}]:[])],

      data:visible.map(b=>({number:escape(b.heldNumber),customer:escape(b.customerName),date:escape((b.createdAt || b.invoiceDate)?.slice(0,10)),staff:escape([b.createdByName || b.createdBy,b.createdByEmployeeCode].filter(Boolean).join(' · ')),

        products:b.items?.length || 0,total:Number(b.netTotal || 0).toFixed(2),status:escape(statusLabel(displayStatus(b))),remarks:escape(posRemarks(b) || '—')})),

      summaryItems:[{label:'Total bills',value:String(visible.length)},{label:'Total (LKR)',value:visible.reduce((sum,b)=>sum+Number(b.netTotal || 0),0).toFixed(2)}],

    });

  };

  const editable=b=>!archive && !history && (b.canResume!==false || hasPermission(user,'SALES_EDIT'));



  const showRemarks=!archive;
  const showSelection=!archive && !history && !posOnly && status==='STOCK_ADJUSTED';
  const changeStatus=value=>{onSelect?.([]);onStatusChange(value);};

  const selectedBills=bills.filter(b=>selected.includes(b.id));

  const sameCustomer=new Set(selectedBills.map(b=>b.customerId)).size<=1;

  return <div className="onhold-directory purchasing-no-shadows">


    <div className="onhold-directory-toolbar">

      <SearchBar value={query} onChange={e=>onQueryChange(e.target.value)} onClear={()=>onQueryChange('')} placeholder="Search bill number, customer or staff..." ariaLabel="Search onhold bills"/>

      <div className="purchase-date-controls onhold-directory-controls">



        <DateRangePicker documentType="Onhold bills" from={from} to={to} onChange={(start,end)=>{setFrom(start);setTo(end);}}/>

        <FilterSelect value={scope} onChange={e=>onScopeChange(e.target.value)} aria-label="Onhold bill owner"><option value="mine">My bills</option><option value="others">Other bills</option><option value="all">All held bills</option></FilterSelect>

        <FilterSelect value={status} onChange={e=>changeStatus(e.target.value)} aria-label="Onhold bill status">

          <option value="ALL">All Statuses</option>

          {archive?<option value="BILLED">Billed</option>:<>

          <option value="YET_TO_PRINT">Yet to Print</option>

          <option value="SENT_TO_WAREHOUSE">Sent to Warehouse</option>

          <option value="STOCK_ADJUSTED">Warehouse Reviewed</option>

          <option value="INVOICE_CREATED">Invoice Created</option>

          <option value="INVOICE_CANCELLED">Invoice Cancelled</option>

          </>}

          <option value="CANCELLED">{archive?'Cancelled':'Onhold Bill Cancelled'}</option>

        </FilterSelect>

        {(query || status!=='ALL' || from || to || scope!=='mine') && <button type="button" className="erp-button onhold-reset" title="Reset all filters to default" onClick={()=>{onQueryChange('');changeStatus('ALL');onScopeChange('mine');setFrom('');setTo('');}}><X size={13}/>Reset</button>}



        <button type="button" className="onhold-toolbar-icon" aria-label="Print bill directory (A4)" title="Print bill directory (A4)" onClick={printDirectory} disabled={loading}><Printer size={15}/></button>

        <button type="button" className="onhold-toolbar-icon" aria-label="Refresh onhold bills" title="Refresh records" onClick={onRefresh} disabled={loading}><RefreshCw size={15} className={loading?'animate-spin':undefined}/></button>

      </div>

    </div>

    {showSelection && selected.length>0 && <div className="onhold-selection"><span>{selected.length} warehouse-reviewed bills selected{!sameCustomer?' · Select one customer only':''}</span><button className="erp-button erp-button-primary" disabled={merging || !sameCustomer} onClick={onMerge}><Layers size={15}/>Create Invoice</button></div>}

    <div className="erp-table-frame erp-table-scroll onhold-directory-table"><table className="erp-table"><thead><tr>

      {showSelection && <th className="erp-table-heading">Select</th>}

      {['Onhold bill number','Customer','Bill date','Staff','Total products','Total','Status',...(showRemarks?['Remarks']:[]),'Actions'].map(label=><th key={label} className={`erp-table-heading ${label==='Actions'?'erp-table-actions':['Total products','Total'].includes(label)?'onhold-money':''}`}>{label}</th>)}

    </tr></thead><tbody>

      {visible.map(b=><tr key={b.id} tabIndex={0} aria-label={`View onhold bill ${b.heldNumber}`} onClick={()=>onView(b)} onKeyDown={e=>{if(e.target===e.currentTarget && ['Enter',' '].includes(e.key)){e.preventDefault();onView(b);}}}>

        {showSelection && <td className="erp-table-cell" onClick={e=>e.stopPropagation()}><input type="checkbox" aria-label={`Select ${b.heldNumber}`} disabled={!editable(b) || b.status!=='STOCK_ADJUSTED'} checked={selected.includes(b.id)} onChange={e=>onSelect(e.target.checked?[...selected,b.id]:selected.filter(id=>id!==b.id))}/></td>}

        <td className="erp-table-cell erp-table-code">{b.heldNumber}</td><td className="erp-table-cell onhold-customer-name">{b.customerName}</td><td className="erp-table-cell erp-table-date">{(b.createdAt || b.invoiceDate)?.slice(0,10)}</td>

        <td className="erp-table-cell onhold-staff"><span>{b.createdByName || b.createdBy}</span>{b.createdByEmployeeCode && <small>{b.createdByEmployeeCode}</small>}</td><td className="erp-table-cell onhold-money">{b.items?.length || 0}</td>

        <td className="erp-table-cell onhold-money">LKR {Number(b.netTotal || 0).toLocaleString('en-LK',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>

        <td className="erp-table-cell"><StatusBadge status={displayStatus(b)} label={!archive && displayStatus(b)==='CANCELLED'?'ONHOLD BILL CANCELLED':undefined}/></td>

        {showRemarks && <td className="erp-table-cell onhold-remarks" title={posRemarks(b)}>{posRemarks(b) || '—'}</td>}


        <td className="erp-table-cell erp-table-actions" onClick={e=>e.stopPropagation()}><div>

          {(archive || b.status!=='CANCELLED') && <button type="button" className="erp-table-icon-action" aria-label={`Print ${b.heldNumber}`} title={archive?'Print held bill':'Print warehouse sheets'} disabled={!archive && b.canResume===false} onClick={()=>archive?printHeldBill(b):onPrint(b)}><Printer size={13}/></button>}

          {editable(b) && !posOnly && b.status==='SENT_TO_WAREHOUSE' && hasPermission(user,'SALES_EDIT') && <button type="button" className="erp-table-icon-action" aria-label={`Adjust ${b.heldNumber}`} title="Warehouse Review" onClick={()=>onEdit(b)}><Edit2 size={13}/></button>}



        </div></td>

      </tr>)}

      {!visible.length && <tr><td className="erp-table-cell" colSpan={8+(showRemarks?1:0)+(showSelection?1:0)}>{loading?'Loading onhold bills…':'No onhold bills match these filters.'}</td></tr>}

    </tbody></table></div>

    <p className="onhold-directory-help">{visible.length} bills · LKR {visible.reduce((sum,b)=>sum+Number(b.netTotal || 0),0).toLocaleString('en-LK',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>

  </div>;

}

