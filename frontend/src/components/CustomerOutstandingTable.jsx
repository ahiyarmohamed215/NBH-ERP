import React from 'react';
import {Printer,CheckCircle} from 'lucide-react';
import StatusBadge from './StatusBadge';
import {historyDocumentReference} from '../utils/customerHistoryDetails';
import {outstandingPaymentStatus} from '../utils/customerOutstanding';
import './CustomerOutstandingTable.css';

const money=value=>`LKR ${Number(value || 0).toFixed(2)}`;
export default function CustomerOutstandingTable({invoices=[],customerName,onView,onPrint,expandedId,renderExpanded,emptyContent,showActions=true}) {
 return <table className="erp-table customer-outstanding-table">
  <thead><tr>{['Invoice #','Date','Payment type','Total amount','Paid amount','Outstanding balance','Status',...(showActions?['Actions']:[])].map((label,index)=><th key={label} className={`erp-table-heading${index>=3 && index<=5?' customer-outstanding-number':''}${index>=6?' customer-outstanding-action':''}`}>{label}</th>)}</tr></thead>
  <tbody>{!invoices.length ? <tr><td className="erp-table-cell customer-outstanding-empty" colSpan={showActions?8:7}>{emptyContent || <><CheckCircle size={30}/>All clear! No outstanding payments pending for {customerName || 'this customer'}.</>}</td></tr>
  : invoices.map(invoice=><React.Fragment key={invoice.id || invoice.invoiceNumber}>
   <tr tabIndex={0} aria-label={`View outstanding invoice ${historyDocumentReference(invoice)}`} aria-expanded={renderExpanded ? expandedId===invoice.id : undefined}
    className={expandedId===invoice.id?'customer-outstanding-row expanded':'customer-outstanding-row'}
    onClick={()=>onView?.(invoice)} onKeyDown={event=>{if(event.target===event.currentTarget && ['Enter',' '].includes(event.key)){event.preventDefault();onView?.(invoice);}}}>
    <td className="erp-table-cell erp-table-code">{invoice.invoiceNumber || invoice.id}</td>
    <td className="erp-table-cell customer-outstanding-date">{invoice.displayDate || invoice.invoiceDate || invoice.createdAt?.substring(0,10) || '—'}</td>
    <td className="erp-table-cell"><span className="customer-outstanding-payment">{invoice.paymentType || 'installment'}</span></td>
    <td className="erp-table-cell customer-outstanding-number">{money(invoice.netTotal ?? invoice.totalAmount)}</td>
    <td className="erp-table-cell customer-outstanding-number customer-outstanding-paid">{money(invoice.paidAmount)}</td>
    <td className="erp-table-cell customer-outstanding-number customer-outstanding-due">{money(invoice.balanceAmount)}</td>
    <td className="erp-table-cell customer-outstanding-action"><StatusBadge status={outstandingPaymentStatus(invoice)}/></td>
    {showActions && <td className="erp-table-cell erp-table-actions customer-outstanding-action"><button type="button" aria-label="Print outstanding invoice" title="Print outstanding invoice" className="erp-table-icon-action" onClick={event=>{event.stopPropagation();onPrint?.(invoice);}}><Printer size={14}/></button></td>}
   </tr>
   {expandedId===invoice.id && renderExpanded && <tr><td colSpan={showActions?8:7} className="customer-outstanding-expanded">{renderExpanded(invoice)}</td></tr>}
  </React.Fragment>)}</tbody>
 </table>;
}
