import {canWriteTab,hasPermission} from '../utils/moduleAccess';
import useModuleTab from '../hooks/useModuleTab';
import ErpTabs, {ErpTab} from '../components/ErpTabs';
import {Edit2} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import FilterSelect from '../components/FilterSelect';
import '../components/PurchasingAppearance.css';
import DateRangePicker, { matchesDateRange } from '../components/DateRangePicker';
import { printA4Report } from '../utils/printReport';

import { formatBusinessDate } from '../utils/invoiceMapping';
import { invoiceTotal } from '../utils/invoiceMapping';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { salesApi, salesReturnApi, pdfApi, customerApi, paymentApi, quotationApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useDataSync } from '../hooks/useDataSync';
import PosView from './PosView';
import OnholdBillEditor from './OnholdBillEditor';
import HeldBillDetails from '../components/HeldBillDetails';
import OnholdBillsTable from '../components/OnholdBillsTable';
import HeldBillPrintDialog from '../components/HeldBillPrintDialog';
import HeldInvoiceDialog from '../components/HeldInvoiceDialog';
import MergedHeldBills from '../components/MergedHeldBills';
import {usePurchasingStatusChange} from '../hooks/usePurchasingStatusChange';
import {printHeldWarehouseSheets} from '../utils/heldWarehousePrint';
import SalesReturnsView from './SalesReturnsView';
import { canEditModule } from '../utils/permissionUtils';
import {
  FileText,
  DollarSign,
  Tag,
  RotateCcw,
  Search,
  Sliders,
  Download,
  Calendar,
  Eye,
  Printer,
  Plus,
  X,
  RefreshCw,
  ShoppingCart,
  CheckCircle,
  Clock,
  ArrowRight,
  Filter,
  PauseCircle,
  PlayCircle,
  Building2,
  Package,
  User,
  AlertCircle,
  Truck,
  Send,
  Edit3,
  CheckSquare,
  Layers,
  ClipboardCheck,
  Check,
} from 'lucide-react';

export default function InvoicingHub({ activeSubTab = 'sales', onSubTabChange }) {
  const { addToast } = useToast();
  const { user } = useAuth();
  const {requestStatusChange,statusChangeDialog}=usePurchasingStatusChange();
  const canEditSales = canEditModule(user, 'SALES');
  const canEditQuotation = canEditModule(user, 'QUOTATION');

  // Sub-tabs for Sales Hub:
  // sales, hold bills, sales return, quotation
  const INVOICING_TABS = [
    { id: 'sales', label: 'Sales Invoices', icon: FileText },
    { id: 'held-history', label: 'Held Bills', icon: Clock },
    { id: 'hold-bills', label: 'Onhold Bills', icon: PauseCircle },
    { id: 'refunds', label: 'Sales Returns', icon: RotateCcw },
    { id: 'quotations', label: 'Quotations', icon: FileText },
  ];

  const [currentTab, setCurrentTab] = useModuleTab('invoicing',activeSubTab,'sales',user);

  useEffect(() => {
    if (activeSubTab) {
      setSelectedHeldIds([]);setHeldStatusFilter('ALL');setEditingOnhold(null);
      setCurrentTab(activeSubTab);
    }
  }, [activeSubTab]);

  const handleTabClick = (tabId) => {
    setSelectedHeldIds([]);setHeldStatusFilter('ALL');setEditingOnhold(null);
    setCurrentTab(tabId);
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  // -------------------------------------------------------------
  // TAB 3: SALES (Commercial Invoices - Matching Screenshot)
  // -------------------------------------------------------------
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Filters matching screenshot
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [savingEditedInvoice, setSavingEditedInvoice] = useState(false);

  // Memoized line items for selected invoice preview (ensures items are always shown)
  const selectedInvoiceItems = useMemo(() => {
    if (!selectedInvoice) return [];
    if (Array.isArray(selectedInvoice.items) && selectedInvoice.items.length > 0) {
      return selectedInvoice.items;
    }
    return [];
  }, [selectedInvoice]);

  // Customise columns modal
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    invoiceNumber: true,
    customer: true,
    date: true,
    paymentType: true,
    paymentMethod: true,
    status: true,
    delivery: true,
    total: true,
    paid: true,
    balance: true,
  });

  // Load live invoices from backend
  const loadBackendInvoices = async () => {
    if(!hasPermission(user,'SALES_VIEW')){setInvoices([]);return;}
    try {
      setLoadingInvoices(true);
      const res = await salesApi.search({ size: 100 });
      const liveList = res.data?.content || res.data || [];
      const formattedLive = liveList.map((inv) => ({
        id: String(inv.id),
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName || (inv.customer ? inv.customer.name : 'Walk-in'),
        customerId: inv.customerId || (inv.customer ? inv.customer.id : null),
        deliveryStatus: inv.deliveryStatus || 'PENDING',
        deliveryNumber: inv.deliveryNumber || null,
        deliveryRouteName: inv.deliveryRouteName || null,
        invoiceDate: inv.invoiceDate ? inv.invoiceDate.split('T')[0] : '',
        displayDate: inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '',
        paymentType: inv.paymentType || (Number(inv.balanceAmount || 0) === 0 ? 'Full Payment' : 'Installment'),
        paymentMethod: inv.paymentMethod || 'Cash',
        paymentStatus: inv.paymentStatus || (Number(inv.balanceAmount || 0)===0?'PAID':Number(inv.paidAmount || 0)>0?'PARTIAL':'PENDING'),
        totalAmount: invoiceTotal(inv),
        paidAmount: Number(inv.paidAmount || 0),
        balanceAmount: Number(inv.balanceAmount || 0),
        status: inv.status || (Number(inv.balanceAmount || 0) === 0 ? 'PAID' : 'PARTIAL'),
        salesman: inv.salesman || inv.salesmanName || (inv.user ? inv.user.fullName : (user?.fullName || 'Sales Executive')),
        items: inv.items || inv.invoiceItems || inv.lines || [],
        sourceHeldNumbers: inv.sourceHeldNumbers || [],
        sourceHeldBills: inv.sourceHeldBills || [],
        packing: inv.packing,
        notes: inv.notes || '',
      }));
      setInvoices(formattedLive);
    } catch (err) {
      console.error('Failed to load backend invoices:', err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    loadBackendInvoices();
  }, [user]);

  useDataSync(loadBackendInvoices, ['erp:data_changed', 'erp:sales_updated']);

  // Quotations filtering & export
  const [quotationSearchQuery, setQuotationSearchQuery] = useState('');
  const [quotationStatusFilter, setQuotationStatusFilter] = useState('ALL');

  // Payments filtering & export
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');

  // Advance Payments filtering & export
  const [advanceSearchQuery, setAdvanceSearchQuery] = useState('');

  // Print Sales Invoices Directory (A4) like GRN
  const handlePrintInvoiceDirectory = () => {
    const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character]));
    printA4Report({
      title: 'Sales Invoices',
      metaItems: [
        { label: 'Search', value: escapeText(searchQuery) || 'All Invoices' },
        { label: 'Status', value: filterStatus === 'ALL' ? 'All' : filterStatus },
        { label: 'Payment Method', value: filterPaymentMethod === 'ALL' ? 'All' : filterPaymentMethod },
        { label: 'Date Range', value: (startDate || endDate) ? `${startDate || 'Start'} to ${endDate || 'End'}` : 'All Dates' },
      ],
      columns: [
        { header: 'Invoice #', accessor: 'number' },
        { header: 'Customer', accessor: 'customer' },
        { header: 'Date', accessor: 'date' },
        { header: 'Payment Method', accessor: 'method' },
        { header: 'Total (LKR)', accessor: 'total', align: 'right' },
        { header: 'Paid (LKR)', accessor: 'paid', align: 'right' },
        { header: 'Balance (LKR)', accessor: 'balance', align: 'right' },
        { header: 'Status', accessor: 'status' },
      ],
      data: filteredInvoices.map((inv) => ({
        number: escapeText(inv.invoiceNumber),
        customer: escapeText(inv.customerName),
        date: escapeText(inv.displayDate || inv.invoiceDate),
        method: escapeText(inv.paymentMethod || 'Cash'),
        total: Number(invoiceTotal(inv)).toFixed(2),
        paid: Number(inv.paidAmount || 0).toFixed(2),
        balance: Number(inv.balanceAmount || 0).toFixed(2),
        status: escapeText(inv.status || inv.paymentStatus),
      })),
    });
  };

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (filterStatus !== 'ALL') {
        const match = inv.status === filterStatus || inv.paymentStatus === filterStatus;
        if (!match) return false;
      }

      if (filterPaymentMethod !== 'ALL') {
        const normFilter = filterPaymentMethod.toUpperCase().replace(/\s+/g, '_');
        const methodNorm = (inv.paymentMethod || '').toUpperCase().replace(/\s+/g, '_');
        const typeNorm = (inv.paymentType || '').toUpperCase().replace(/\s+/g, '_');
        if (methodNorm !== normFilter && typeNorm !== normFilter) {
          return false;
        }
      }

      if (startDate || endDate) {
        if (!matchesDateRange(inv.invoiceDate, startDate, endDate)) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const num = (inv.invoiceNumber || '').toLowerCase();
        const cust = (inv.customerName || '').toLowerCase();
        const method = (inv.paymentMethod || '').toLowerCase();
        if (!num.includes(q) && !cust.includes(q) && !method.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, filterStatus, filterPaymentMethod, startDate, endDate, searchQuery]);

  // CSV Export matching top-right button in screenshot
  const handleExportCSV = () => {
    const headers = ['Invoice #', 'Customer', 'Delivery', 'Date', 'Payment Method', 'Total', 'Paid', 'Balance', 'Status'];
    const rows = filteredInvoices.map((inv) => [
      inv.invoiceNumber,
      `"${inv.customerName}"`,
      inv.deliveryStatus,
      inv.displayDate || inv.invoiceDate,
      inv.paymentMethod || 'Cash',
      inv.totalAmount,
      inv.paidAmount,
      inv.balanceAmount,
      inv.status || inv.paymentStatus,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Invoices_Export_${formatBusinessDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Invoices exported to CSV', 'success');
  };

  // Sales Invoices Action Handlers: Void, Edit, Print, Download PDF
  const handleDeleteInvoice = async (inv) => {
    if (!window.confirm(`Are you sure you want to void Invoice ${inv.invoiceNumber}? This will reverse stock and restore customer balances.`)) {
      return;
    }
    try {
      if (inv.id && !inv.id.startsWith('inv-')) {
        await salesApi.void(inv.id, 'Voided from Invoicing Hub');
      }
      addToast(`Invoice ${inv.invoiceNumber} voided successfully!`, 'success');
      await loadBackendInvoices();
    } catch (err) {
      console.error('Failed to void invoice:', err);
      addToast(err.response?.data?.message || 'Failed to void invoice', 'error');
    }
    if (selectedInvoice && (selectedInvoice.id === inv.id || selectedInvoice.invoiceNumber === inv.invoiceNumber)) {
      setSelectedInvoice(null);
    }
  };

  const handleOpenEditInvoice = async (inv) => {
    setEditingInvoice({
      ...inv,
      notes: inv.notes || '',
      items: inv.items || [],
      packing: inv.packing || null,
      sourceHeldNumbers: inv.sourceHeldNumbers || [],
      sourceHeldBills: inv.sourceHeldBills || [],
    });
    if (inv.id && !String(inv.id).startsWith('inv-')) {
      try {
        const res = await salesApi.getById(inv.id);
        const fresh = res.data?.data || res.data;
        if (fresh) {
          setEditingInvoice((prev) =>
            prev && String(prev.id) === String(inv.id)
              ? {
                  ...prev,
                  notes: fresh.notes ?? prev.notes ?? '',
                  items: (Array.isArray(fresh.items) && fresh.items.length > 0 ? fresh.items : prev.items) || [],
                  packing: fresh.packing || prev.packing,
                  sourceHeldBills: fresh.sourceHeldBills || prev.sourceHeldBills,
                  sourceHeldNumbers: fresh.sourceHeldNumbers || prev.sourceHeldNumbers,
                }
              : prev
          );
        }
      } catch (err) {
        console.warn('Unable to load full invoice details for edit:', err);
      }
    }
  };

  const handleSaveEditedInvoice = async () => {
    if (!editingInvoice) return;
    if (!canEditSales) {
      addToast('Permission denied: Only permissible staff can edit invoices', 'error');
      return;
    }
    setSavingEditedInvoice(true);
    try {
      if (editingInvoice.id && !String(editingInvoice.id).startsWith('inv-')) {
        await salesApi.update(editingInvoice.id, { notes: editingInvoice.notes });
      }
      addToast(`Invoice ${editingInvoice.invoiceNumber} updated successfully!`, 'success');
      await loadBackendInvoices();
      if (selectedInvoice && (selectedInvoice.id === editingInvoice.id || selectedInvoice.invoiceNumber === editingInvoice.invoiceNumber)) {
        setSelectedInvoice({ ...selectedInvoice, ...editingInvoice });
      }
      setEditingInvoice(null);
    } catch (err) {
      console.error('Failed to update invoice:', err);
      addToast(err.message || 'Failed to update invoice', 'error');
    } finally {
      setSavingEditedInvoice(false);
    }
  };

  const generateInvoicePrintHtml = (inv) => {
    const rawItems = (Array.isArray(inv?.items) && inv.items.length > 0)
      ? inv.items
      : [];

    const itemsRows = rawItems
      .map(
        (it, idx) => `
      <tr>
        <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #0284c7;">${it.code || it.productSku || it.sku || '-'}</td>
        <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${it.name || it.productName || 'Product'}</td>
        <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #0f172a;">${it.quantity || 1}</td>
        <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace;">LKR ${(Number(it.unitPrice) || 0).toFixed(2)}</td>
        <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; font-family: monospace; color: #0f172a;">LKR ${(Number(it.totalPrice || (it.quantity * it.unitPrice)) || 0).toFixed(2)}</td>
      </tr>
    `
      )
      .join('');

    const statusColor =
      inv.status === 'PAID' ? '#16a34a' : inv.status === 'PARTIAL' ? '#d97706' : '#dc2626';
    const statusBg =
      inv.status === 'PAID' ? '#dcfce7' : inv.status === 'PARTIAL' ? '#fef3c7' : '#fee2e2';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Invoice - ${inv.invoiceNumber}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              color: #0f172a;
              line-height: 1.45;
              margin: 0;
              padding: 24px;
              background: #ffffff;
            }
            .invoice-box {
              max-width: 820px;
              margin: auto;
              background: #fff;
            }
            .header {
              display: flex;
              justify-content: space-between;
              border-bottom: 2px solid #0284c7;
              padding-bottom: 16px;
              margin-bottom: 20px;
            }
            .company-name {
              font-size: 22px;
              font-weight: 900;
              color: #0f172a;
              letter-spacing: -0.3px;
            }
            .company-sub {
              font-size: 12px;
              color: #64748b;
              margin-top: 3px;
            }
            .invoice-title {
              font-size: 24px;
              font-weight: 900;
              color: #0284c7;
              letter-spacing: 0.5px;
              text-align: right;
            }
            .status-badge {
              display: inline-block;
              font-size: 11px;
              font-weight: 800;
              padding: 3px 12px;
              border-radius: 9999px;
              text-transform: uppercase;
              background: ${statusBg};
              color: ${statusColor};
              margin-top: 6px;
            }
            .meta-grid {
              display: flex;
              justify-content: space-between;
              margin-bottom: 22px;
              background: #f8fafc;
              padding: 16px 20px;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
              font-size: 13px;
            }
            .meta-col {
              flex: 1;
            }
            .meta-label {
              color: #64748b;
              font-size: 11px;
              text-transform: uppercase;
              font-weight: 700;
              letter-spacing: 0.5px;
            }
            .customer-title {
              font-weight: 800;
              font-size: 16px;
              color: #0f172a;
              margin: 3px 0 6px 0;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 13px;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              overflow: hidden;
            }
            .items-table th {
              background: #0284c7;
              color: #ffffff;
              padding: 10px;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .totals-container {
              display: flex;
              justify-content: space-between;
              margin-top: 15px;
              align-items: flex-start;
              gap: 20px;
            }
            .notes-box {
              flex: 1;
              font-size: 12px;
              color: #64748b;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 12px 16px;
            }
            .totals-table {
              width: 320px;
              border-collapse: collapse;
              font-size: 13px;
            }
            .totals-table td {
              padding: 6px 10px;
            }
            .net-row {
              background: #f0f9ff;
              font-weight: 800;
              font-size: 15px;
              color: #0369a1;
              border-top: 1px solid #0284c7;
              border-bottom: 1px solid #0284c7;
            }
            .footer-signatures {
              display: flex;
              justify-content: space-between;
              margin-top: 48px;
              padding-top: 20px;
            }
            .sig-block {
              text-align: center;
              font-size: 12px;
              color: #475569;
              width: 200px;
              border-top: 1px dashed #94a3b8;
              padding-top: 8px;
              font-weight: 600;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            <div class="header">
              <div>
                <div class="company-name">NBH AUTOMOTIVE & HARDWARE (PVT) LTD</div>
                <div class="company-sub">No. 45/A, Negombo Road, Colombo, Sri Lanka</div>
                <div class="company-sub">Tel: +94 11 234 5678 | Email: sales@nbhhardware.lk</div>
                <div class="company-sub">VAT Reg No: 10482910-7000</div>
              </div>
              <div style="text-align: right;">
                <div class="invoice-title">COMMERCIAL INVOICE</div>
                <div><span class="status-badge">${inv.status || 'PAID'}</span></div>
              </div>
            </div>

            <div class="meta-grid">
              <div class="meta-col">
                <div class="meta-label">Billed To:</div>
                <div class="customer-title">${inv.customerName || 'Walk-in Customer'}</div>
                <div style="color: #475569;">Payment Type: <strong>${inv.paymentType || 'Full Payment'}</strong></div>
                <div style="color: #475569; margin-top: 2px;">Payment Method: <strong>${inv.paymentMethod || 'Cash'}</strong></div>
              </div>
              <div class="meta-col" style="text-align: right;">
                <div class="meta-label">Invoice Details:</div>
                <div style="font-weight: 800; font-size: 16px; color: #0284c7; font-family: monospace; margin: 3px 0 6px 0;">${inv.invoiceNumber}</div>
                <div style="color: #475569;">Date: <strong>${inv.displayDate || inv.invoiceDate || new Date().toLocaleDateString()}</strong></div>
                <div style="color: #475569; margin-top: 2px;">Salesman: <strong>${inv.salesman || 'Sales Executive'}</strong></div>
                ${inv.odnNumber ? `<div style="color: #475569; margin-top: 2px;">ODN Ref: <strong>${inv.odnNumber}</strong></div>` : ''}
              </div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 36px; text-align: center;">#</th>
                  <th style="width: 120px; text-align: left;">Code / SKU</th>
                  <th style="text-align: left;">Item Description</th>
                  <th style="width: 60px; text-align: center;">Qty</th>
                  <th style="width: 120px; text-align: right;">Unit Price (LKR)</th>
                  <th style="width: 130px; text-align: right;">Total (LKR)</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <div class="totals-container">
              <div class="notes-box">
                <strong style="color: #0f172a;">Customer Terms & Conditions:</strong><br>
                1. All products sold subject to manufacturer guarantee and warranty terms.<br>
                2. Cheques are accepted subject to realization.<br>
                3. Thank you for your business with NBH Automotive & Hardware!
              </div>
              <table class="totals-table">
                <tr>
                  <td style="color: #64748b;">Gross Subtotal:</td>
                  <td style="text-align: right; font-weight: 600; font-family: monospace;">LKR ${(Number(inv.totalAmount) || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">Discount:</td>
                  <td style="text-align: right; font-weight: 600; font-family: monospace;">LKR 0.00</td>
                </tr>
                <tr class="net-row">
                  <td>NET TOTAL:</td>
                  <td style="text-align: right; font-family: monospace;">LKR ${(Number(inv.totalAmount) || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="color: #16a34a; font-weight: 600;">Amount Settled:</td>
                  <td style="text-align: right; color: #16a34a; font-weight: bold; font-family: monospace;">LKR ${(Number(inv.paidAmount) || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="color: ${Number(inv.balanceAmount) > 0 ? '#dc2626' : '#64748b'}; font-weight: 700;">Balance Due:</td>
                  <td style="text-align: right; color: ${Number(inv.balanceAmount) > 0 ? '#dc2626' : '#64748b'}; font-weight: 800; font-family: monospace;">LKR ${(Number(inv.balanceAmount) || 0).toFixed(2)}</td>
                </tr>
              </table>
            </div>

            <div class="footer-signatures">
              <div class="sig-block">Prepared / Authorized By</div>
              <div class="sig-block">Customer Acceptance</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;
  };

  const handlePrintInvoice = (inv) => {
    if (inv?.id && !inv.id.startsWith('inv-')) {
      pdfApi.printInvoice(inv.id);
    } else {
      const printableWindow = window.open('', '_blank');
      if (printableWindow) {
        printableWindow.document.write(generateInvoicePrintHtml(inv));
        printableWindow.document.close();
      } else {
        window.print();
      }
    }
  };

  const handleDownloadInvoicePdf = (inv) => {
    if (inv?.id && !inv.id.startsWith('inv-')) {
      pdfApi.downloadInvoice(inv.id, inv.invoiceNumber);
      addToast(`Downloading PDF for Invoice ${inv.invoiceNumber}...`, 'success');
    } else {
      const printableWindow = window.open('', '_blank');
      if (printableWindow) {
        printableWindow.document.write(generateInvoicePrintHtml(inv));
        printableWindow.document.close();
      } else {
        window.print();
      }
      addToast(`Printable document opened for ${inv.invoiceNumber}`, 'success');
    }
  };

  // -------------------------------------------------------------
  // HELD BILLS DATA & WORKFLOW ACTIONS (100% Backend REST API)
  // -------------------------------------------------------------
  const [heldBills, setHeldBills] = useState([]);
  const heldRequest=useRef(0),heldScope=useRef('');

  const [heldOwnerScope,setHeldOwnerScope]=useState('mine');
  const [creatingMergedInvoice,setCreatingMergedInvoice]=useState(false);
  const [heldWorkspace,setHeldWorkspace]=useState(null);
  const [loadingHeldBills, setLoadingHeldBills] = useState(false);
  const [heldSearchQuery, setHeldSearchQuery] = useState('');
  const [heldStatusFilter, setHeldStatusFilter] = useState('ALL');
  const showPosOnhold=currentTab==='held-history';
  heldScope.current=`${currentTab}:${heldOwnerScope}:${heldSearchQuery}`;
  const [selectedHeldDetail, setSelectedHeldDetail] = useState(null);
  const [editingOnhold,setEditingOnhold]=useState(null);
  const [printingOnholdId,setPrintingOnholdId]=useState(null);
  const [pendingHeldPrint,setPendingHeldPrint]=useState(null);

  // Workflow states: selection, warehouse adjustment, and dispatch note
  const [selectedHeldIds, setSelectedHeldIds] = useState([]);
  const [dispatchNoteData, setDispatchNoteData] = useState(null);
  const [heldMergeError,setHeldMergeError]=useState('');

  // Modal states for creating / recording items
  const [showCreateQuotationModal, setShowCreateQuotationModal] = useState(false);
  const [quotationForm, setQuotationForm] = useState({
    customerName: '',
    quotationDate: formatBusinessDate(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    totalAmount: '',
    notes: '',
  });

  const loadHeldBills = async () => {
    const request=++heldRequest.current,scope=heldScope.current;
    try {
      setLoadingHeldBills(true);
      const res = await (showPosOnhold?salesApi.getHeldOriginals:salesApi.getHeldWorkspace)({scope:heldOwnerScope,query:heldSearchQuery,history:currentTab==='held-history'});
      if(request!==heldRequest.current || scope!==heldScope.current)return;
      const workspace=res.data?.data || res.data;
      setHeldWorkspace(workspace);setHeldBills(workspace?.bills || []);
    } catch (err) {
      if(request!==heldRequest.current || scope!==heldScope.current)return;
      console.error('Failed to load held bills:', err);
      setHeldBills([]);addToast(err.message || 'Unable to load held bills. Refresh to try again.','error');
    } finally {
      if(request===heldRequest.current && scope===heldScope.current)setLoadingHeldBills(false);
    }
  };

  useEffect(() => {
    if(!['hold-bills','held-history'].includes(currentTab))return;
    const timer=setTimeout(loadHeldBills,200);
    return()=>{clearTimeout(timer);};
  },[currentTab,heldOwnerScope,heldSearchQuery]);
  useDataSync(() => ['hold-bills','held-history'].includes(currentTab) ? loadHeldBills() : undefined,
    ['erp:sales_updated'], [], ['sales']);


  useEffect(()=>{
    if(!['hold-bills','held-history'].includes(currentTab) || !heldBills.some(b=>b.status==='YET_TO_PRINT'))return;
    const timer=setInterval(loadHeldBills,5000);return()=>clearInterval(timer);
  },[currentTab,heldBills,heldOwnerScope,heldSearchQuery]);

  // Workflow Action 1: Send bill to warehouse
  const handleSendToWarehouse = async (heldBill) => {
    try { await salesApi.sendHeld(heldBill.id, { expectedVersion:heldBill.recordVersion }); await loadHeldBills();
      addToast(`Bill ${heldBill.heldNumber} sent for warehouse verification`, 'success');
    } catch (err) { addToast(err.message, 'error'); }
  };

  // Workflow Action 2: Open warehouse stock adjustment modal
  const handleOpenStockAdjustment = async heldBill => {
    try {const res=await salesApi.getById(heldBill.id);const fresh=res.data?.data || res.data;
      if(fresh.status!=='SENT_TO_WAREHOUSE')throw new Error('Print every warehouse sheet before editing this onhold bill.');
      setSelectedHeldDetail(null);setEditingOnhold(fresh);
    }catch(error){addToast(error.message,'error');}
  };
  const handlePrintOnhold = async bill => {
    if(printingOnholdId)return;
    if(bill.status==='YET_TO_PRINT'){setPendingHeldPrint(bill);return;}setPrintingOnholdId(bill.id);
    try{
      printHeldWarehouseSheets(bill);
      try{await salesApi.printHeld(bill.id);}catch(_){}
      await loadHeldBills();
      addToast('Warehouse sheets opened for printing.','success');
    }
    catch(error){addToast(error.message,'error');}finally{setPrintingOnholdId(null);}
  };

  const handleCancelOnhold = bill => requestStatusChange({type:'Onhold Bill',number:bill.heldNumber,current:bill.status,target:'CANCELLED',
    description:['MERGED','INVOICE_CREATED'].includes(bill.status)?'Remove this bill from its invoice and restore its sold stock. Payment and delivery must both be pending. Cancelling the last bill voids the invoice. Enter the reason.':'Cancel this saved bill and release its reserved stock. The original POS copy remains available. Enter the reason for cancellation.',
    onConfirm:async reason=>{await salesApi.cancelHeld(bill.id,{reason,expectedVersion:bill.recordVersion});setSelectedHeldDetail(null);setSelectedHeldIds(ids=>ids.filter(id=>id!==bill.id));await Promise.all([loadHeldBills(),loadBackendInvoices()]);if(selectedInvoice){const res=await salesApi.getById(selectedInvoice.id);const fresh=res.data?.data || res.data;setSelectedInvoice(previous=>({...previous,...fresh,totalAmount:invoiceTotal(fresh)}));}addToast('Onhold bill cancelled. Stock and invoice totals updated.','success');}});

  // Workflow Action 4: Merge multiple bills & open dispatch note
  const openHeldMergePreview = async (ids) => {
    try {
      const response=await salesApi.previewHeldMerge(ids);
      setHeldMergeError('');setDispatchNoteData(response.data?.data || response.data);
    } catch(error) {addToast(error.message || 'Unable to prepare the selected held bills.','error');}
  };
  const handleOpenMergeDispatchModal = () => openHeldMergePreview(selectedHeldIds);
  const handleOpenSingleDispatchModal = (bill) => {setSelectedHeldIds([bill.id]);openHeldMergePreview([bill.id]);};

  // Workflow Action 5: Confirm Dispatch Note, mark bills as Dispatched, create Commercial Invoice
  const handleConfirmDispatch = async (packing) => {
    if (!dispatchNoteData || creatingMergedInvoice) return;
    setCreatingMergedInvoice(true);
    const targetIds = dispatchNoteData.sourceBillIds || [];

    try {
      const response=await salesApi.completeHeld(targetIds,dispatchNoteData.expectedVersions,packing);
      const created=(response.data?.data || response.data)?.[0];
      addToast(`Invoice ${created?.invoiceNumber || ''} created from the selected held bills. Assign its delivery in Delivery.`, 'success');
      setSelectedHeldIds([]);
      setDispatchNoteData(null);
      await Promise.all([loadHeldBills(), loadBackendInvoices()]);
      setCurrentTab('sales');
    } catch (err) {
      setHeldMergeError(err.response?.data?.message || err.message || 'Unable to create invoice. Please try again.');
    } finally {setCreatingMergedInvoice(false);}
  };

  const filteredHeldBills = useMemo(() => {
    return heldBills.filter((b) => {
      if (heldStatusFilter !== 'ALL' && b.status !== heldStatusFilter) return false;
      if (heldSearchQuery.trim()) {
        const q = heldSearchQuery.toLowerCase();
        const num = (b.heldNumber || '').toLowerCase();
        const cust = (b.customerName || '').toLowerCase();
        const salesman = (b.salesman || b.salesmanName || b.createdBy || '').toLowerCase();
        const wh = (b.warehouseCode || '').toLowerCase();
        if (!num.includes(q) && !cust.includes(q) && !salesman.includes(q) && !wh.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [heldBills, heldSearchQuery, heldStatusFilter]);

  const handleExportHeldBillsCSV = () => {
    if (filteredHeldBills.length === 0) {
      addToast('No held bills to export', 'error');
      return;
    }
    const headers = ['Held #', 'Customer', 'Date / Time', 'Warehouse', 'Items Count', 'Cashier', 'Status', 'Total Amount'];
    const rows = filteredHeldBills.map((b) => [
      `"${b.heldNumber || ''}"`,
      `"${b.customerName || 'Walk-in'}"`,
      `"${b.invoiceDate ? new Date(b.invoiceDate).toLocaleString() : ''}"`,
      `"${b.warehouseCode || ''}"`,
      b.items?.length || 1,
      `"${b.createdBy || ''}"`,
      `"${b.status || 'HELD'}"`,
      Number(b.netTotal || b.totalAmount || 0).toFixed(2),
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Held_Bills_Export_${formatBusinessDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Onhold Bills exported to CSV', 'success');
  };

  // -------------------------------------------------------------
  // OTHER TABS DATA (Quotations, Payments, Advances, Outstanding)
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // OTHER TABS DATA (Quotations)
  // -------------------------------------------------------------
  const [quotations, setQuotations] = useState([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);

  const loadBackendQuotations = async () => {
    try {
      setLoadingQuotations(true);
      const res = await quotationApi.search({ size: 100 });
      const liveList = res.data?.content || res.data || [];
      const formatted = liveList.map((q) => ({
        id: q.id,
        quotationNo: q.quotationNumber || q.quotationNo,
        quotationNumber: q.quotationNumber,
        customerName: q.customerName || 'Customer',
        customerId: q.customerId,
        date: q.quotationDate || q.date,
        validUntil: q.validUntil,
        totalAmount: Number(q.totalAmount || 0),
        status: q.status || 'PENDING',
        notes: q.notes,
        items: q.items || [],
      }));
      setQuotations(formatted);
    } catch (err) {
      console.error('Failed to load quotations:', err);
    } finally {
      setLoadingQuotations(false);
    }
  };

  useEffect(() => {
    if (currentTab === 'quotations') loadBackendQuotations();
  }, [currentTab]);
  useDataSync(() => currentTab === 'quotations' ? loadBackendQuotations() : undefined,
    ['erp:sales_updated'], [], ['quotations']);

  const resolveCustomerId = async (name) => {
    const res = await customerApi.search(name);
    const matches = (res.data || []).filter(c => c.name.toLowerCase() === name.trim().toLowerCase());
    if(matches.length !== 1) throw new Error('Enter one exact, unique customer name');
    return matches[0].id;
  };

  const handleSaveQuotation = async (e) => {
    e.preventDefault();
    if (!quotationForm.customerName || !quotationForm.totalAmount) {
      addToast('Please provide customer name and quotation amount', 'error');
      return;
    }
    const amt = parseFloat(quotationForm.totalAmount) || 0;
    try {
      const payload = {
        customerName: quotationForm.customerName,
        quotationDate: quotationForm.quotationDate || formatBusinessDate(),
        validUntil: quotationForm.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        totalAmount: amt,
        notes: quotationForm.notes || '',
      };
      const res = await quotationApi.create(payload);
      const created = res.data?.data || res.data;
      addToast(`Quotation ${created?.quotationNumber || created?.quotationNo || 'created'} successfully!`, 'success');
      setShowCreateQuotationModal(false);
      setQuotationForm({
        customerName: '',
        quotationDate: formatBusinessDate(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        totalAmount: '',
        notes: '',
      });
      await loadBackendQuotations();
    } catch (err) {
      console.error('Failed to create quotation:', err);
      addToast(err.response?.data?.message || 'Failed to create quotation', 'error');
    }
  };

  const handleConvertQuotationToInvoice = async (qt) => {
    try {
      const res = await quotationApi.convertToInvoice(qt.id);
      const inv = res.data?.data || res.data;
      addToast(`Quotation ${qt.quotationNo || qt.quotationNumber} converted to Commercial Invoice ${inv?.invoiceNumber}!`, 'success');
      await Promise.all([loadBackendQuotations(), loadBackendInvoices()]);
    } catch (err) {
      console.error('Failed to convert quotation to invoice:', err);
      addToast(err.response?.data?.message || 'Failed to convert quotation', 'error');
    }
  };

  const handleDeleteQuotation = async (qt) => {
    if (!window.confirm(`Are you sure you want to delete quotation ${qt.quotationNo || qt.quotationNumber}?`)) return;
    try {
      await quotationApi.delete(qt.id);
      addToast(`Quotation ${qt.quotationNo || qt.quotationNumber} deleted successfully`, 'success');
      await loadBackendQuotations();
    } catch (err) {
      console.error('Failed to delete quotation:', err);
      addToast(err.response?.data?.message || 'Failed to delete quotation', 'error');
    }
  };

  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      if (quotationStatusFilter !== 'ALL' && q.status !== quotationStatusFilter) return false;
      if (quotationSearchQuery.trim()) {
        const query = quotationSearchQuery.toLowerCase();
        return (
          (q.quotationNo || '').toLowerCase().includes(query) ||
          (q.customerName || '').toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [quotations, quotationSearchQuery, quotationStatusFilter]);

  const handleExportQuotationsCSV = () => {
    const headers = ['Quotation #', 'Customer', 'Date', 'Valid Until', 'Total Amount', 'Status'];
    const rows = filteredQuotations.map((q) => [
      `"${q.quotationNo || ''}"`,
      `"${q.customerName || ''}"`,
      `"${q.date || ''}"`,
      `"${q.validUntil || ''}"`,
      q.totalAmount,
      `"${q.status || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Quotations_Export_${formatBusinessDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Quotations exported to CSV', 'success');
  };



  if(editingOnhold)return <OnholdBillEditor key={editingOnhold.id} bill={editingOnhold} user={user}
    onBack={()=>{setEditingOnhold(null);loadHeldBills();}}
    onSaved={()=>{setEditingOnhold(null);setSelectedHeldIds([]);loadHeldBills();addToast('Warehouse review saved.','success');}}/>;

  // Dedicated POS Full-Screen Mode (No navigation, no header, pure POS desk)
  if (currentTab === 'pos') {
    return (
      <div style={{ flex: 1, minHeight: 0, height: '100vh', maxHeight: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
        <PosView
          onExitPos={() => {
            handleTabClick('sales');
          }}
        />
      </div>
    );
  }

  return (
    <div className="erp-page"
      style={{
        padding: '24px 32px',
        flex: 1,
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Page Header (Fixed / Sticky at Top) - Matching InventoryHub / EmployeesHub */}
      <div className="erp-page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <h1 className="erp-page-title"

          >
            Sales Management
          </h1>
          <p className="erp-page-description">
            Create and manage commercial invoices, quotations, held bills, and sales returns.
          </p>
        </div>

        {/* Action Button matching current active tab - Matching InventoryHub */}
        {currentTab === 'quotations' ? (
          <button disabled={!canWriteTab(user,'invoicing',currentTab)} className="erp-button erp-button-primary"
            type="button"
            onClick={() => setShowCreateQuotationModal(true)}
            style={{
              padding: '9px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <Plus size={17} /> New Quotation
          </button>
        ) : (
          <button disabled={!hasPermission(user,'SALES_CREATE')} className="erp-button"
            type="button"
            onClick={() => handleTabClick('pos')}
            style={{
              backgroundColor: 'var(--erp-accent)',
              color: '#ffffff',
              padding: '9px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <ShoppingCart size={17} /> Open POS
          </button>
        )}
      </div>

      {/* Subtabs Bar (Underline Style matching InventoryHub - Fixed / Sticky) */}
      <ErpTabs module="invoicing"
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
        }}
      >
        {INVOICING_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <ErpTab tabId={tab.id} data-active={isActive} aria-pressed={isActive}
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}

            >
              <Icon size={16} />
              {tab.label}
            </ErpTab>
          );
        })}
      </ErpTabs>

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: SALES (Commercial Invoices - Standardized Inventory Structure) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'sales' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          {/* Search Bar & Action Controls (GRN Style Theme) */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              flexWrap: 'nowrap',
              flexShrink: 0,
            }}
          >
            {/* Left Control: Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search
                size={17}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '11px',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              />
              <input className="erp-field"
                type="text"
                placeholder="Search by invoice number, customer, payment method..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                  boxShadow: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0284c7';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '10px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: '2px',
                  }}
                  title="Clear search text"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Right Controls: Filters, Print, Refresh (GRN Theme) */}
            <div className="purchase-date-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
              <DateRangePicker documentType="INVOICE" from={startDate} to={endDate} onChange={(from, to) => { setStartDate(from); setEndDate(to); }} />

              <FilterSelect
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ width: '140px' }}
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Partial</option>
                <option value="PENDING">Pending</option>
                <option value="COMPLETED">Completed</option>
                <option value="VOIDED">Voided</option>
                <option value="CANCELLED">Cancelled</option>
              </FilterSelect>

              <FilterSelect
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                style={{ width: '160px' }}
              >
                <option value="ALL">All Payment Methods</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="ONLINE">Online</option>
                <option value="CREDIT">Credit</option>
              </FilterSelect>

              {(filterStatus !== 'ALL' || filterPaymentMethod !== 'ALL' || searchQuery || startDate || endDate) && (
                <button className="erp-button"
                  type="button"
                  onClick={() => {
                    setFilterStatus('ALL');
                    setFilterPaymentMethod('ALL');
                    setStartDate('');
                    setEndDate('');
                    setSearchQuery('');
                  }}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                  title="Reset all filters to default"
                >
                  <X size={13} /> Reset
                </button>
              )}

              <button
                type="button"
                onClick={handlePrintInvoiceDirectory}
                style={{
                  height: '38px',
                  width: '38px',
                  minWidth: '38px',
                  padding: 0,
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#334155',
                  fontSize: 'var(--erp-text-body)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: 'none',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#334155';
                }}
                title="Print Sales Invoices Directory (A4)"
                aria-label="Print Sales Invoices Directory (A4)"
              >
                <Printer size={15} />
              </button>

              <button
                type="button"
                onClick={loadBackendInvoices}
                style={{
                  height: '38px',
                  width: '38px',
                  minWidth: '38px',
                  padding: 0,
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#334155',
                  fontSize: 'var(--erp-text-body)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: 'none',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#334155';
                }}
                title="Refresh invoice records"
                aria-label="Refresh invoice records"
                disabled={loadingInvoices}
              >
                <RefreshCw size={15} className={loadingInvoices ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Invoices Table Card (Fixed Table Frame, Sticky Header, Internal Scroll for Data Rows Only - GRN Theme) */}
          <div className="erp-table-frame"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              overflow: 'hidden',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              boxShadow: 'none',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div className="erp-table-scroll" style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table className="erp-table" style={{ width: '100%', minWidth: '920px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    {visibleColumns.invoiceNumber && (
                      <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                        INVOICE #
                      </th>
                    )}
                    {visibleColumns.customer && (
                      <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                        CUSTOMER
                      </th>
                    )}
                    {visibleColumns.date && (
                      <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                        DATE
                      </th>
                    )}
                    {visibleColumns.paymentMethod && (
                      <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                        PAYMENT METHOD
                      </th>
                    )}
                    {visibleColumns.total && (
                      <th className="erp-table-heading" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                        TOTAL
                      </th>
                    )}
                    {visibleColumns.paid && (
                      <th className="erp-table-heading" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                        PAID
                      </th>
                    )}
                    {visibleColumns.balance && (
                      <th className="erp-table-heading" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                        BALANCE
                      </th>
                    )}
                    {visibleColumns.status && (
                      <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                        STATUS
                      </th>
                    )}
                    {visibleColumns.delivery && (
                      <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                        DELIVERY
                      </th>
                    )}
                    <th className="erp-table-heading erp-table-actions" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingInvoices ? (
                    <tr>
                      <td className="erp-table-cell" colSpan="10" style={{ textAlign: 'center', color: '#64748b' }}>
                        Loading invoices...
                      </td>
                    </tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td className="erp-table-cell" colSpan="10" style={{ textAlign: 'center', color: '#64748b' }}>
                        No invoices match the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv, idx) => (
                      <tr
                        key={inv.id || idx}
                        onClick={async () => {
                          try {
                            const res = await salesApi.getById(inv.id);
                            setSelectedInvoice({ ...inv, ...(res.data?.data || res.data) });
                          } catch (e) {
                            addToast(e.message, 'error');
                          }
                        }}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        title="Click row to view complete invoice details"
                      >
                        {/* Invoice # */}
                        {visibleColumns.invoiceNumber && (
                          <td className="erp-table-cell">
                            <span className="erp-table-code" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                              {inv.invoiceNumber}
                            </span>
                          </td>
                        )}

                        {/* Customer */}
                        {visibleColumns.customer && (
                          <td className="erp-table-cell" style={{ fontWeight: 600, color: '#0f172a' }}>
                            {inv.customerName}
                          </td>
                        )}

                        {/* Date */}
                        {visibleColumns.date && (
                          <td className="erp-table-cell erp-table-date" style={{ color: '#475569', whiteSpace: 'nowrap' }}>
                            {inv.displayDate || inv.invoiceDate || '—'}
                          </td>
                        )}

                        {/* Payment Method */}
                        {visibleColumns.paymentMethod && (
                          <td className="erp-table-cell" style={{ color: '#334155' }}>
                            {inv.paymentMethod || 'Cash'}
                          </td>
                        )}

                        {/* Total */}
                        {visibleColumns.total && (
                          <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                            LKR {Number(invoiceTotal(inv)).toFixed(2)}
                          </td>
                        )}

                        {/* Paid */}
                        {visibleColumns.paid && (
                          <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a', fontFamily: 'monospace' }}>
                            LKR {Number(inv.paidAmount || 0).toFixed(2)}
                          </td>
                        )}

                        {/* Balance */}
                        {visibleColumns.balance && (
                          <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 700, color: Number(inv.balanceAmount || 0) > 0 ? '#dc2626' : '#64748b', fontFamily: 'monospace' }}>
                            LKR {Number(inv.balanceAmount || 0).toFixed(2)}
                          </td>
                        )}

                        {/* Status */}
                        {visibleColumns.status && (
                          <td className="erp-table-cell">
                            <StatusBadge status={inv.status || inv.paymentStatus || 'PENDING'} />
                          </td>
                        )}

                        {/* Delivery Status */}
                        {visibleColumns.delivery && (
                          <td className="erp-table-cell">
                            <StatusBadge status={inv.deliveryStatus || 'PENDING'} label={inv.deliveryStatus === 'OUT_FOR_DELIVERY' ? `ON ROUTE${inv.deliveryNumber ? ` (${inv.deliveryNumber})` : ''}` : inv.deliveryStatus === 'DELIVERED' ? 'DELIVERED' : 'PENDING DELIVERY'}/>
                          </td>
                        )}

                        {/* Actions (GRN Theme) */}
                        <td className="erp-table-cell erp-table-actions" style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <button aria-label="View Invoice" className="erp-table-icon-action"
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const res = await salesApi.getById(inv.id);
                                  setSelectedInvoice({ ...inv, ...(res.data?.data || res.data) });
                                } catch (err) {
                                  addToast(err.message, 'error');
                                }
                              }}
                              style={{
                                width: '30px',
                                height: '30px',
                                background: '#ffffff',
                                border: '1px solid #bae6fd',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#0284c7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                              title="View Invoice Details"
                            >
                              <Eye size={13} />
                            </button>
                            {canEditSales && (
                              <button aria-label="Edit Invoice" className="erp-table-icon-action"
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditInvoice(inv);
                                }}
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  background: '#ffffff',
                                  border: '1px solid #bae6fd',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  color: '#0284c7',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                                title="Edit Invoice"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            <button aria-label="Print Invoice PDF" className="erp-table-icon-action"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintInvoice(inv);
                              }}
                              style={{
                                width: '30px',
                                height: '30px',
                                background: '#ffffff',
                                border: '1px solid #bae6fd',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#0284c7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                              title="Print Invoice PDF"
                            >
                              <Printer size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB: HOLD BILLS (Standardized Inventory Structure) */}
      {/* ------------------------------------------------------------- */}
      {['hold-bills','held-history'].includes(currentTab) && <OnholdBillsTable bills={heldBills} loading={loadingHeldBills} user={user}
        scope={heldOwnerScope} onScopeChange={value=>{setHeldOwnerScope(value);setSelectedHeldIds([]);}}
        query={heldSearchQuery} onQueryChange={setHeldSearchQuery} status={heldStatusFilter} onStatusChange={setHeldStatusFilter}
        onRefresh={loadHeldBills} onView={setSelectedHeldDetail} onPrint={handlePrintOnhold} onEdit={handleOpenStockAdjustment} onCancel={handleCancelOnhold}
        selected={selectedHeldIds} onSelect={setSelectedHeldIds} onMerge={handleOpenMergeDispatchModal} merging={creatingMergedInvoice}
        archive={showPosOnhold} history={currentTab==='held-history'} workspace={heldWorkspace}
/>}

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: QUOTATIONS (Standardized Inventory Structure) */}
      {/* ------------------------------------------------------------- */}
      {/* TAB 3: REFUNDS (Sales Returns) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'refunds' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SalesReturnsView embedded={true} />
        </div>
      )}



      {/* ------------------------------------------------------------- */}
      {/* TAB 7: QUOTATIONS (Draft Quotations & Proposals) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'quotations' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          {/* Toolbar Card */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              flexWrap: 'nowrap',
              flexShrink: 0,
            }}
          >
            {/* Left Control: Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search
                size={17}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '11px',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              />
              <input className="erp-field"
                type="text"
                placeholder="Search quotations by quotation # or customer name..."
                value={quotationSearchQuery}
                onChange={(e) => setQuotationSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0284c7';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(2, 132, 199, 0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.02)';
                }}
              />
              {quotationSearchQuery && (
                <button
                  type="button"
                  onClick={() => setQuotationSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '10px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: '2px',
                  }}
                  title="Clear search text"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Right Controls: Status filter, Reset, Export CSV */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'nowrap' }}>
              <select className="erp-field"
                value={quotationStatusFilter}
                onChange={(e) => setQuotationStatusFilter(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 26px 0 10px',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
              </select>

              {(quotationSearchQuery || quotationStatusFilter !== 'ALL') && (
                <button className="erp-button"
                  type="button"
                  onClick={() => {
                    setQuotationSearchQuery('');
                    setQuotationStatusFilter('ALL');
                  }}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Reset filters"
                >
                  <X size={13} /> Reset
                </button>
              )}

              {/* Export CSV */}
              <button
                type="button"
                onClick={handleExportQuotationsCSV}
                style={{
                  height: '38px',
                  width: '38px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: 0,
                  color: '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                }}
                title="Export quotations to CSV"
              >
                <Download size={15} />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="erp-table-frame"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div className="erp-table-scroll" style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--erp-text-field)' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>QUOTATION #</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>QUOTATION DATE</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>VALID UNTIL</th>
                    <th className="erp-table-heading" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>TOTAL</th>
                    <th className="erp-table-heading" style={{ textAlign: 'center', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                    <th className="erp-table-heading erp-table-actions" style={{ textAlign: 'center', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotations.map((qt) => (
                    <tr
                      key={qt.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td className="erp-table-cell erp-table-code" style={{ fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                        {qt.quotationNo}
                      </td>
                      <td className="erp-table-cell" style={{ fontWeight: 600, color: '#0f172a' }}>{qt.customerName}</td>
                      <td className="erp-table-cell" style={{ color: '#64748b' }}>
                        {qt.date ? new Date(qt.date).toLocaleDateString() : 'â€”'}
                      </td>
                      <td className="erp-table-cell" style={{ color: '#64748b' }}>
                        {qt.validUntil ? new Date(qt.validUntil).toLocaleDateString() : 'â€”'}
                      </td>
                      <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                        LKR {Number(qt.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="erp-table-cell" style={{ textAlign: 'center' }}>
                        <StatusBadge status={qt.status} />
                      </td>
                      <td className="erp-table-cell erp-table-actions" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {qt.status !== 'ACCEPTED' && (
                            <button aria-label="Convert to commercial invoice" className="erp-button erp-table-icon-action"
                              type="button"
                              onClick={() => handleConvertQuotationToInvoice(qt)}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                              }}
                              title="Convert to commercial invoice"
                            ><CheckCircle size={12} /></button>
                          )}
                          <button aria-label="Print quotation"
                            type="button"
                            className="btn btn-glass btn-sm erp-button erp-table-icon-action"
                            onClick={() => {
                              addToast(`Quotation ${qt.quotationNo} printed`, 'info');
                              window.print();
                            }}
                            style={{ padding: '4px 7px' }}
                            title="Print quotation"
                          >
                            <Printer size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredQuotations.length === 0 && (
                    <tr>
                      <td className="erp-table-cell" colSpan={7} style={{ textAlign: 'center', color: '#64748b' }}>
                        No quotations found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Customise Columns */}
      {/* ------------------------------------------------------------- */}
      {showColumnModal && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1050, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '24px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--erp-text-section)', color: '#0f172a' }}>Customise Invoicing Columns</h3>
              <button
                type="button"
                onClick={() => setShowColumnModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: 'var(--erp-text-field)' }}>
              {Object.keys(visibleColumns).map((colKey) => (
                <label
                  key={colKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[colKey]}
                    onChange={(e) =>
                      setVisibleColumns({
                        ...visibleColumns,
                        [colKey]: e.target.checked,
                      })
                    }
                  />
                  <span style={{ textTransform: 'capitalize', color: '#334155', fontWeight: 500 }}>
                    {colKey.replace(/([A-Z])/g, ' $1')}
                  </span>
                </label>
              ))}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary erp-button erp-button-primary"
                onClick={() => setShowColumnModal(false)}
                style={{ borderColor: '#0284c7', padding: '6px 16px' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: View Invoice Details */}
      {/* ------------------------------------------------------------- */}
      {selectedInvoice && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1200, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: 'min(calc(780px + 3in), 96vw)',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              borderRadius: '16px',
              backgroundColor: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Title and Close button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '2px solid #0284c7', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 'var(--erp-text-dialog)', fontWeight: 800, color: '#0f172a' }}>COMMERCIAL INVOICE</h3>
                    <div style={{ fontSize: 'var(--erp-text-field)', color: '#0284c7', fontWeight: 700, fontFamily: 'monospace', marginTop: '2px' }}>
                      {selectedInvoice.invoiceNumber}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <StatusBadge status={['VOIDED','CANCELLED'].includes(selectedInvoice.status)?selectedInvoice.status:selectedInvoice.paymentStatus || 'PENDING'} label={selectedInvoice.paymentStatus==='PENDING'?'PAYMENT PENDING':undefined}/>
                <StatusBadge status={selectedInvoice.deliveryStatus || 'PENDING'} label={(!selectedInvoice.deliveryStatus || selectedInvoice.deliveryStatus==='PENDING')?'DELIVERY PENDING':undefined}/>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Invoice Meta Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', backgroundColor: '#f8fafc', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '22px' }}>
              <div>
                <span style={{ fontSize: 'var(--erp-text-caption)', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>Billed Customer</span>
                <div style={{ fontWeight: 800, fontSize: 'var(--erp-text-nav)', color: '#0f172a', marginTop: '3px' }}>
                  {selectedInvoice.customerName || 'Walk-in Customer'}
                </div>
                <div style={{ fontSize: 'var(--erp-text-body)', color: '#64748b', marginTop: '2px' }}>
                  Payment: <strong style={{ color: '#334155' }}>{selectedInvoice.paymentType || 'Full Payment'} ({selectedInvoice.paymentMethod || 'Cash'})</strong>
                </div>
              </div>
              <div>
                <span style={{ fontSize: 'var(--erp-text-caption)', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>Invoice Date & Time</span>
                <div style={{ fontWeight: 700, fontSize: 'var(--erp-text-nav)', color: '#0f172a', marginTop: '3px' }}>
                  {selectedInvoice.displayDate || selectedInvoice.invoiceDate || new Date().toLocaleDateString()}
                </div>
                <div style={{ fontSize: 'var(--erp-text-body)', color: '#64748b', marginTop: '2px' }}>
                  Salesman: <strong style={{ color: '#334155' }}>{selectedInvoice.salesman || 'Sales Executive'}</strong>
                </div>
              </div>
              {selectedInvoice.odnNumber && (
                <div>
                  <span style={{ fontSize: 'var(--erp-text-caption)', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>Dispatch Reference</span>
                  <div style={{ fontWeight: 700, fontSize: 'var(--erp-text-nav)', color: '#0284c7', fontFamily: 'monospace', marginTop: '3px' }}>
                    {selectedInvoice.odnNumber}
                  </div>
                  <div style={{ fontSize: 'var(--erp-text-body)', color: '#16a34a', fontWeight: 600, marginTop: '2px' }}>
                    Dispatched & Delivered
                  </div>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: 'var(--erp-text-nav)', color: '#0f172a', fontWeight: 700 }}>
                  INVOICED LINE ITEMS ({selectedInvoiceItems.length})
                </h4>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                {selectedInvoice.packing && <p className="onhold-directory-help">Packing: Box {selectedInvoice.packing.boxes || 0} · Bag {selectedInvoice.packing.bags || 0} · P. Bag {selectedInvoice.packing.pBags || 0} · Others {selectedInvoice.packing.others || 0}</p>}
                {selectedInvoice.sourceHeldBills?.length>0 ? <MergedHeldBills bills={selectedInvoice.sourceHeldBills} user={user} onView={async bill=>{try{const res=await salesApi.getById(bill.id);setSelectedHeldDetail(res.data?.data || res.data);}catch(e){addToast(e.message,'error');}}} onCancel={handleCancelOnhold}/> : selectedInvoice.sourceHeldNumbers?.length>0 && <p>Merged held bills: {selectedInvoice.sourceHeldNumbers.join(', ')}</p>}
            <div className="erp-table-frame erp-table-scroll"><table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--erp-text-field)' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                      <th className="erp-table-heading" style={{ width: '38px', textAlign: 'center' }}>#</th>
                      <th className="erp-table-heading" style={{ width: '130px' }}>SKU / CODE</th>
                      <th className="erp-table-heading">PRODUCT / DESCRIPTION</th>
                      <th className="erp-table-heading" style={{ width: '60px', textAlign: 'center' }}>QTY</th>
                      <th className="erp-table-heading" style={{ width: '110px', textAlign: 'right' }}>UNIT PRICE</th>
                      <th className="erp-table-heading" style={{ width: '120px', textAlign: 'right' }}>SUBTOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoiceItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td className="erp-table-cell" style={{ textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                        <td className="erp-table-cell erp-table-code" style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0284c7' }}>
                          {item.code || item.productSku || item.sku || '-'}
                        </td>
                        <td className="erp-table-cell" style={{ fontWeight: 600, color: '#1e293b' }}>
                          {item.name || item.productName || 'Product item'}
                        </td>
                        <td className="erp-table-cell" style={{ textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                          {item.quantity || 1}
                        </td>
                        <td className="erp-table-cell" style={{ textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                          LKR {(Number(item.unitPrice) || 0).toFixed(2)}
                        </td>
                        <td className="erp-table-cell" style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                          LKR {(Number(item.totalPrice || (item.quantity * item.unitPrice)) || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            </div>

            {/* Financial Summary */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
              <div style={{ width: '100%', maxWidth: '340px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--erp-text-button)' }}>
                  <span style={{ color: '#64748b' }}>Gross Total</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                    LKR {Number(selectedInvoice.totalAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--erp-text-button)' }}>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>Amount Settled</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#16a34a' }}>
                    LKR {Number(selectedInvoice.paidAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0 0', marginTop: '6px', borderTop: '1px dashed #cbd5e1', fontSize: 'var(--erp-text-nav)' }}>
                  <span style={{ color: Number(selectedInvoice.balanceAmount || 0) > 0 ? '#dc2626' : '#64748b', fontWeight: 700 }}>
                    Balance Outstanding
                  </span>
                  <span style={{ fontWeight: 800, fontFamily: 'monospace', color: Number(selectedInvoice.balanceAmount || 0) > 0 ? '#dc2626' : '#64748b' }}>
                    LKR {Number(selectedInvoice.balanceAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions: Edit, Print, Download PDF, and Close */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', paddingTop: '18px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-glass erp-button"
                  onClick={() => {
                    const invToEdit = { ...selectedInvoice };
                    setSelectedInvoice(null);
                    handleOpenEditInvoice(invToEdit);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0284c7' }}
                  title="Edit invoice details"
                >
                  <Edit3 size={15} /> Edit
                </button>

                <button
                  type="button"
                  className="btn btn-glass erp-button"
                  onClick={() => handlePrintInvoice(selectedInvoice)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  title="Print invoice"
                >
                  <Printer size={15} /> Print
                </button>

                <button
                  type="button"
                  className="btn btn-glass erp-button"
                  onClick={() => handleDownloadInvoicePdf(selectedInvoice)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#16a34a' }}
                  title="Download invoice as PDF"
                >
                  <Download size={15} /> Download PDF
                </button>
              </div>

              <button
                type="button"
                className="btn btn-primary erp-button erp-button-primary"
                onClick={() => setSelectedInvoice(null)}
                style={{ borderColor: '#0284c7', padding: '7px 22px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Edit Commercial Invoice */}
      {/* ------------------------------------------------------------- */}
      {editingInvoice && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1200,
            overflowY: 'auto',
          }}
          onClick={() => setEditingInvoice(null)}
        >
          <div
            className="glass-modal erp-edit-invoice-modal purchasing-no-shadows"
            style={{
              width: '100%',
              maxWidth: 'min(calc(780px + 3in), 96vw)',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 24px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0284c7',
                    flexShrink: 0,
                  }}
                >
                  <Edit3 size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>
                      Edit Invoice: <span className="erp-table-code" style={{ fontSize: '0.95rem' }}>{editingInvoice.invoiceNumber}</span>
                    </h3>
                    <StatusBadge status={editingInvoice.status || 'PENDING'} />
                    {editingInvoice.deliveryStatus && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          backgroundColor: editingInvoice.deliveryStatus === 'DELIVERED' ? '#dcfce7' : '#e0f2fe',
                          color: editingInvoice.deliveryStatus === 'DELIVERED' ? '#166534' : '#0369a1',
                          border: `1px solid ${editingInvoice.deliveryStatus === 'DELIVERED' ? '#86efac' : '#bae6fd'}`,
                        }}
                      >
                        <Truck size={12} /> {editingInvoice.deliveryStatus.replaceAll('_', ' ')}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                    Issued on {editingInvoice.displayDate || editingInvoice.invoiceDate || 'Today'} · Sales Rep: {editingInvoice.salesman || 'Sales Staff'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                aria-label="Close edit invoice"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body & Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEditedInvoice();
              }}
              style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}
            >
              <div
                style={{
                  padding: '20px 24px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  flex: 1,
                }}
              >
                {/* Audit & Compliance Notice */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 14px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '10px',
                    color: '#1e40af',
                    fontSize: '0.82rem',
                    lineHeight: 1.4,
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#0284c7' }} />
                  <span>
                    Financial entries, tax calculations, and item lines are locked for regulatory and accounting audit integrity. You can update invoice notes, delivery remarks, and instructions below.
                  </span>
                </div>

                {/* 3-Column Info Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
                  {/* Card 1: Customer */}
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 700 }}>
                      Billed Customer
                    </span>
                    <strong style={{ fontSize: '0.92rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {editingInvoice.customerName || 'Walk-in Customer'}
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                      Terms: <strong style={{ color: '#334155' }}>{editingInvoice.paymentType || 'Full Payment'}</strong>
                    </span>
                  </div>

                  {/* Card 2: Payment & Sales */}
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 700 }}>
                      Payment Details
                    </span>
                    <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>
                      {editingInvoice.paymentMethod || 'Cash'}
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                      Salesman: <strong style={{ color: '#334155' }}>{editingInvoice.salesman || 'Sales Staff'}</strong>
                    </span>
                  </div>

                  {/* Card 3: Financial Summary */}
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 700 }}>
                      Financial Summary
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Total:</span>
                      <strong style={{ fontSize: '0.88rem', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                        LKR {Number(editingInvoice.totalAmount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Balance:</span>
                      <strong
                        style={{
                          fontSize: '0.88rem',
                          fontVariantNumeric: 'tabular-nums',
                          color: Number(editingInvoice.balanceAmount || 0) > 0 ? '#dc2626' : '#16a34a',
                        }}
                      >
                        LKR {Number(editingInvoice.balanceAmount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Source Onhold Bills & Packing (if present) */}
                {(editingInvoice.sourceHeldNumbers?.length > 0 || editingInvoice.sourceHeldBills?.length > 0 || editingInvoice.packing) && (
                  <div
                    style={{
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    {(editingInvoice.sourceHeldNumbers?.length > 0 || editingInvoice.sourceHeldBills?.length > 0) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Layers size={13} /> Merged Onhold Bills:
                        </span>
                        {(editingInvoice.sourceHeldBills?.length > 0
                          ? editingInvoice.sourceHeldBills.map((b) => b.number || b.heldNumber)
                          : editingInvoice.sourceHeldNumbers || []
                        ).map((num) => (
                          <span
                            key={num}
                            style={{
                              padding: '2px 8px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #86efac',
                              borderRadius: '6px',
                              fontFamily: 'monospace',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              color: '#15803d',
                            }}
                          >
                            {num}
                          </span>
                        ))}
                      </div>
                    )}
                    {editingInvoice.packing && (
                      <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>
                        Packing: Box {editingInvoice.packing.boxes || 0} · Bag {editingInvoice.packing.bags || 0} · P. Bag {editingInvoice.packing.pBags || 0} · Others {editingInvoice.packing.others || 0}
                      </div>
                    )}
                  </div>
                )}

                {/* Line Items Preview */}
                {Array.isArray(editingInvoice.items) && editingInvoice.items.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      Invoiced Line Items ({editingInvoice.items.length})
                    </span>
                    <div
                      className="erp-table-frame erp-table-scroll"
                      style={{
                        maxHeight: '170px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        overflowY: 'auto',
                      }}
                    >
                      <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                            <th className="erp-table-heading" style={{ width: '36px', textAlign: 'center' }}>#</th>
                            <th className="erp-table-heading" style={{ width: '120px' }}>SKU</th>
                            <th className="erp-table-heading">Product Name</th>
                            <th className="erp-table-heading" style={{ width: '70px', textAlign: 'right' }}>Qty</th>
                            <th className="erp-table-heading" style={{ width: '105px', textAlign: 'right' }}>Unit Price</th>
                            <th className="erp-table-heading" style={{ width: '110px', textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editingInvoice.items.map((it, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td className="erp-table-cell" style={{ textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                              <td className="erp-table-cell erp-table-code" style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0284c7' }}>
                                {it.code || it.productSku || it.sku || '-'}
                              </td>
                              <td className="erp-table-cell" style={{ fontWeight: 600, color: '#1e293b' }}>
                                {it.name || it.productName || 'Product item'}
                              </td>
                              <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                {it.quantity || 1}
                              </td>
                              <td className="erp-table-cell" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#475569' }}>
                                Rs. {(Number(it.unitPrice) || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#0f172a' }}>
                                Rs. {(Number(it.totalPrice || (it.quantity * it.unitPrice)) || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Editable Notes Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label
                      htmlFor="edit-invoice-notes"
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: '#1e293b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                      }}
                    >
                      Invoice Notes, Delivery Instructions & Remarks
                    </label>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {(editingInvoice.notes || '').length} / 500 characters
                    </span>
                  </div>
                  <textarea
                    id="edit-invoice-notes"
                    rows={4}
                    className="erp-field"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fbff',
                      color: '#0f172a',
                      fontSize: '0.88rem',
                      fontFamily: 'inherit',
                      lineHeight: 1.5,
                      resize: 'vertical',
                    }}
                    placeholder="Add delivery instructions, special handling, customer purchase order notes, or remarks..."
                    value={editingInvoice.notes || ''}
                    maxLength={500}
                    disabled={savingEditedInvoice}
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, notes: e.target.value })}
                  />
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    These remarks will appear on printed invoices, delivery dispatch notes, and customer statements.
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px 24px',
                  backgroundColor: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  className="erp-button btn-glass"
                  disabled={savingEditedInvoice}
                  onClick={() => setEditingInvoice(null)}
                  style={{ padding: '8px 16px', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="erp-button erp-button-primary"
                  disabled={savingEditedInvoice}
                  style={{
                    padding: '8px 20px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                  }}
                >
                  {savingEditedInvoice ? (
                    'Saving…'
                  ) : (
                    <>
                      <Check size={16} /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Held Bill Inspection */}
      {/* ------------------------------------------------------------- */}
      {statusChangeDialog}
      {pendingHeldPrint && <HeldBillPrintDialog bill={pendingHeldPrint} onClose={()=>setPendingHeldPrint(null)} onPrinted={async()=>{setPendingHeldPrint(null);await loadHeldBills();addToast('All warehouse sheets printed. Bill sent to warehouse.','success');}}/>}
      {selectedHeldDetail && <HeldBillDetails key={selectedHeldDetail.id} bill={selectedHeldDetail} user={user} onClose={()=>setSelectedHeldDetail(null)} onChanged={loadHeldBills} onEdit={handleOpenStockAdjustment} onCancel={handleCancelOnhold}/>}


      {/* ------------------------------------------------------------- */}
      {/* MODAL: Warehouse Stock Adjustment */}
      {/* ------------------------------------------------------------- */}
      {/* ------------------------------------------------------------- */}
      {dispatchNoteData && <HeldInvoiceDialog preview={dispatchNoteData} busy={creatingMergedInvoice} error={heldMergeError} onClose={()=>setDispatchNoteData(null)} onConfirm={handleConfirmDispatch}/>}



      {/* ------------------------------------------------------------- */}
      {/* MODAL: Create Quotation */}
      {/* ------------------------------------------------------------- */}
      {showCreateQuotationModal && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--erp-text-section)', color: '#0f172a', fontWeight: 800 }}>Create New Quotation</h3>
              <button
                type="button"
                onClick={() => setShowCreateQuotationModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveQuotation} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Quotation #</label>
                  <input className="erp-field"
                    type="text"
                    readOnly
                    value="[Auto-generated by backend]"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Date</label>
                  <input className="erp-field"
                    type="date"
                    value={quotationForm.quotationDate}
                    onChange={(e) => setQuotationForm({ ...quotationForm, quotationDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Customer Name *</label>
                <input className="erp-field"
                  type="text"
                  required
                  placeholder="e.g. AutoCare Services"
                  value={quotationForm.customerName}
                  onChange={(e) => setQuotationForm({ ...quotationForm, customerName: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Total Amount (LKR) *</label>
                  <input className="erp-field"
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={quotationForm.totalAmount}
                    onChange={(e) => setQuotationForm({ ...quotationForm, totalAmount: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Valid Until</label>
                  <input className="erp-field"
                    type="date"
                    value={quotationForm.validUntil}
                    onChange={(e) => setQuotationForm({ ...quotationForm, validUntil: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Notes</label>
                <textarea className="erp-field"
                  rows={2}
                  placeholder="Payment terms, delivery conditions..."
                  value={quotationForm.notes}
                  onChange={(e) => setQuotationForm({ ...quotationForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-glass erp-button"
                  onClick={() => setShowCreateQuotationModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary erp-button erp-button-primary"
                  style={{ borderColor: '#0284c7' }}
                >
                  Create Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
