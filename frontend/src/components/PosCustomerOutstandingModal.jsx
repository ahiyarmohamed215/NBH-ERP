import React, {useState, useEffect, useRef, useMemo} from 'react';
import {X, AlertCircle, Printer, Phone, RotateCcw, Receipt} from 'lucide-react';
import {useDataSync} from '../hooks/useDataSync';
import {createPortal} from 'react-dom';
import './PurchaseInspectionModal.css';
import CustomerRangeBadge from './CustomerRangeBadge';
import SearchBar from './SearchBar';
import FilterSelect from './FilterSelect';
import CustomerOutstandingTable from './CustomerOutstandingTable';
import {customerOutstandingInvoices,outstandingPaymentStatus} from '../utils/customerOutstanding';
import {salesApi} from '../api/apiClient';
import {posMoney} from './PosRangeProgress';
import {printCustomerStatementA4, printCustomerLedgerA4} from '../utils/customerPrintTemplates';
import './PosCustomerOutstandingModal.css';

export default function PosCustomerOutstandingModal({isOpen, customer, rangeInfo, onClose}) {
  const dialogRef = useRef(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [details, setDetails] = useState({});
  const [itemErrors, setItemErrors] = useState({});
  const [loadingItems, setLoadingItems] = useState(null);
  const customerRef = useRef(customer?.id);
  customerRef.current = customer?.id;
  useDataSync(() => {if(isOpen)setRevision(value=>value+1);}, ['erp:payments_updated','erp:sales_updated'], [isOpen], ['payments','sales','customers']);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    else if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !customer?.id) return;
    setStatus('ALL'); setSearch(''); setExpanded(null); setDetails({}); setItemErrors({});
  }, [isOpen, customer?.id]);

  useEffect(() => {
    if (!isOpen || !customer?.id) return;
    let alive = true;
    const load = async () => {
      setLoading(true); setError(''); setInvoices([]);
      try {
        let response;
        try { response = await salesApi.getCustomerOutstanding(customer.id, true); }
        catch { response = await salesApi.search({customerId:customer.id, size:200}); }
        const data = response.data?.data ?? response.data;
        const list = Array.isArray(data) ? data : data?.content || [];
        if (alive) setInvoices(customerOutstandingInvoices(list.map(invoice => {
          const netTotal = Number(invoice.netTotal ?? invoice.totalAmount ?? 0);
          const paidAmount = Number(invoice.paidAmount ?? 0);
          return {...invoice, netTotal, paidAmount, balanceAmount:Number(invoice.balanceAmount ?? Math.max(0, netTotal-paidAmount))};
        }),customer.id));
      } catch { if (alive) setError('Could not load invoices. Please try again.'); }
      finally { if (alive) setLoading(false); }
    };
    load();
    return () => { alive = false; };
  }, [isOpen, customer?.id, revision]);

  const outstanding = useMemo(() => customerOutstandingInvoices(invoices,customer?.id), [invoices,customer?.id]);
  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoices.filter(invoice => {
      if (status === 'ALL' && !outstanding.includes(invoice)) return false;
      if (status !== 'ALL' && outstandingPaymentStatus(invoice) !== status) return false;
      return !query || [invoice.invoiceNumber, invoice.invoiceDate, invoice.paymentType].some(value => String(value || '').toLowerCase().includes(query));
    });
  }, [invoices, outstanding, status, search]);
  const due = Number(customer?.currentBalance ?? outstanding.reduce((sum, invoice) => sum+invoice.balanceAmount, 0));
  const creditLimit = Number(customer?.creditLimit || 0);

  const toggleItems = async invoice => {
    if (expanded === invoice.id) { setExpanded(null); return; }
    setExpanded(invoice.id);
    if (invoice.items?.length || details[invoice.id]) return;
    const requestCustomer = customer?.id;
    setLoadingItems(invoice.id); setItemErrors(previous => ({...previous,[invoice.id]:''}));
    try {
      const response = await salesApi.getById(invoice.id);
      if (customerRef.current === requestCustomer) setDetails(previous => ({...previous,[invoice.id]:response.data?.data ?? response.data}));
    } catch { if (customerRef.current === requestCustomer) setItemErrors(previous => ({...previous,[invoice.id]:'Could not load products. Close this row and open it to retry.'})); }
    finally { if (customerRef.current === requestCustomer) setLoadingItems(null); }
  };
  const print = () => {
    try { printCustomerLedgerA4(customer,{invoices:displayed,payments:[]},{groupName:rangeInfo?.currentRangeName || 'Retail Customer'}); }
    catch { printCustomerStatementA4(customer,{invoices:displayed}); }
  };

  if (!isOpen) return null;
  return createPortal(<dialog ref={dialogRef} className="pos-outstanding-dialog purchase-inspection purchase-inspection-toolbar-layout" aria-labelledby="pos-out-modal-title" closedby="any"
    onCancel={event => {event.preventDefault();onClose();}}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <header className="purchase-inspection-header purchase-inspection-header-details">
      <div className="purchase-inspection-header-main">
        <div className="purchase-inspection-title"><div className="grn-inspection-symbol"><Receipt size={22} strokeWidth={1.7}/></div><h2 id="pos-out-modal-title" className="erp-dialog-title">Outstanding Balance</h2></div>
        <div className="purchase-inspection-header-controls"><button type="button" className="purchase-inspection-close" aria-label="Close dialog" onClick={onClose}><X size={18}/></button></div>
      </div>
    <section className="pos-out-summary purchase-inspection-details-card" aria-label="Customer account summary">
      <div className="pos-out-customer">
        <div className="pos-out-customer-name"><strong>{customer?.name}</strong><CustomerRangeBadge name={rangeInfo?.currentRangeName || 'Standard'} code={rangeInfo?.currentRangeCode}/></div>
        <div className="pos-out-customer-meta">{customer?.customerCode && <span>{customer.customerCode}</span>}{customer?.phone && <span><Phone size={12}/>{customer.phone}</span>}</div>
      </div>
      <dl className="pos-out-finances">
        <div><dt>Outstanding Due</dt><dd className={due > 0 ? 'pos-out-due' : ''}>{posMoney(due)}</dd></div>
        <div><dt>Credit Limit</dt><dd>{creditLimit>0?posMoney(creditLimit):'No limit'}</dd></div>
      </dl>
      <div className="purchase-inspection-detail-actions"><button type="button" className="btn btn-glass" onClick={print} disabled={loading || Boolean(error) || !displayed.length}><Printer size={14}/>Print Statement</button></div>
    </section>
    </header>
    <div className="pos-out-content purchase-inspection-items">
    <div className="pos-out-controls purchase-inspection-table-toolbar">
      <SearchBar value={search} onChange={event => setSearch(event.target.value)} onClear={() => setSearch('')} placeholder="Search outstanding invoice #..." ariaLabel="Search customer invoices" style={{minWidth:160}}/>
      <FilterSelect value={status} onChange={event => {setStatus(event.target.value);setExpanded(null);}} aria-label="Invoice status" searchable={false} style={{width:210}}>
        <option value="ALL">All Outstanding Invoices</option><option value="UNPAID">Unpaid</option><option value="PARTIAL">Partially Paid</option>
      </FilterSelect>
    </div>
    <div className="pos-out-body purchase-inspection-table erp-table-scroll erp-table-frame">
      <CustomerOutstandingTable invoices={loading || error ? [] : displayed} customerName={customer?.name} onView={toggleItems} showActions={false} expandedId={expanded}
        emptyContent={loading ? <div className="pos-out-message" role="status"><RotateCcw size={20} className="animate-spin"/>Loading invoices...</div>
          : error ? <div className="pos-out-message" role="alert"><AlertCircle size={22}/><p>{error}</p><button className="erp-button btn-glass" onClick={() => setRevision(value => value+1)}>Try again</button></div>
          : !displayed.length ? <div className="pos-out-message"><strong>{search || status !== 'ALL' ? 'No matching invoices' : 'No outstanding invoices'}</strong><span>{search ? 'Try another invoice number or date.' : 'This customer has no invoices needing payment in this view.'}</span></div> : undefined}
        renderExpanded={invoice=>{
        const detail=details[invoice.id] || invoice;
        const items=detail.items || [];
        return <div className="pos-out-items-tray">

            <div className="pos-out-items-heading"><strong>Invoice products</strong><span>{items.length} items{invoice.createdBy ? ` · ${invoice.createdBy}` : ''}</span></div>
            {loadingItems === invoice.id ? <p role="status">Loading products...</p> : itemErrors[invoice.id] ? <p role="alert">{itemErrors[invoice.id]}</p> : !items.length ? <p>No product details available.</p>
            : <table className="erp-table pos-out-subtable"><thead><tr><th>Product</th><th className="pos-out-number">Qty</th><th className="pos-out-number">Unit price (Rs.)</th><th className="pos-out-number">Discount (Rs.)</th><th className="pos-out-number">Total (Rs.)</th></tr></thead><tbody>{items.map((item,index) => <tr key={item.id || index}>
              <td><strong>{item.productName || item.name || 'Item'}</strong><small>{item.productSku || item.sku}</small></td><td className="pos-out-number">{item.quantity}</td><td className="pos-out-number">{posMoney(item.unitPrice || 0)}</td><td className="pos-out-number">{posMoney(item.discountAmount || 0)}</td><td className="pos-out-number">{posMoney(item.totalPrice ?? item.subtotal ?? (item.quantity*item.unitPrice))}</td>
            </tr>)}</tbody></table>}

        </div>;
      }}/>
    </div>
    </div>
  </dialog>, document.body);
}
