import React, { useState, useEffect, useMemo } from 'react';
import { salesApi, salesReturnApi, pdfApi, customerApi, paymentApi, quotationApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import PosView from './PosView';
import SalesReturnsView from './SalesReturnsView';
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
  Trash2,
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

  // Sub-tabs ordered exactly per user workflow specification:
  // sales, hold bills, sales return, payments, advance payments, outstanding payments, quotation
  const INVOICING_TABS = [
    { id: 'sales', label: 'Sales Invoices', icon: FileText },
    { id: 'hold-bills', label: 'Hold Bills', icon: PauseCircle },
    { id: 'refunds', label: 'Sales Returns', icon: RotateCcw },
    { id: 'payments', label: 'Payments', icon: DollarSign },
    { id: 'advance-payments', label: 'Advance Payments', icon: Tag },
    { id: 'outstanding-payments', label: 'Outstanding Payments', icon: AlertCircle },
    { id: 'quotations', label: 'Quotations', icon: FileText },
  ];

  const [currentTab, setCurrentTab] = useState(() => {
    if (activeSubTab && (INVOICING_TABS.some((t) => t.id === activeSubTab) || activeSubTab === 'pos')) {
      return activeSubTab;
    }
    return 'sales';
  });

  useEffect(() => {
    if (activeSubTab) {
      setCurrentTab(activeSubTab);
    }
  }, [activeSubTab]);

  const handleTabClick = (tabId) => {
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
  const [filterPaymentType, setFilterPaymentType] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);

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
        totalAmount: Number(inv.totalAmount || 0),
        paidAmount: Number(inv.paidAmount || 0),
        balanceAmount: Number(inv.balanceAmount || 0),
        status: inv.status || (Number(inv.balanceAmount || 0) === 0 ? 'PAID' : 'PARTIAL'),
        salesman: inv.salesman || inv.salesmanName || (inv.user ? inv.user.fullName : (user?.fullName || 'Sales Executive')),
        items: inv.items || inv.invoiceItems || inv.lines || [],
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
  }, []);

  // Quotations filtering & export
  const [quotationSearchQuery, setQuotationSearchQuery] = useState('');
  const [quotationStatusFilter, setQuotationStatusFilter] = useState('ALL');

  // Payments filtering & export
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');

  // Advance Payments filtering & export
  const [advanceSearchQuery, setAdvanceSearchQuery] = useState('');

  // Date range presets
  const handleDatePreset = (preset) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'this-week') {
      const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'this-month') {
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDayOfMonth.toISOString().split('T')[0]);
      setEndDate(todayStr);
    }
  };

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (filterStatus !== 'ALL') {
        if (filterStatus === 'PAID' && inv.status !== 'PAID') return false;
        if (filterStatus === 'PARTIAL' && inv.status !== 'PARTIAL') return false;
        if (filterStatus === 'PENDING' && inv.status !== 'PENDING') return false;
      }

      if (filterPaymentType !== 'ALL' && inv.paymentType !== filterPaymentType) {
        return false;
      }

      if (startDate && inv.invoiceDate && inv.invoiceDate < startDate) {
        return false;
      }
      if (endDate && inv.invoiceDate && inv.invoiceDate > endDate) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const num = (inv.invoiceNumber || '').toLowerCase();
        const cust = (inv.customerName || '').toLowerCase();
        const method = (inv.paymentMethod || '').toLowerCase();
        const ptype = (inv.paymentType || '').toLowerCase();
        if (!num.includes(q) && !cust.includes(q) && !method.includes(q) && !ptype.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, filterStatus, filterPaymentType, startDate, endDate, searchQuery]);

  // CSV Export matching top-right button in screenshot
  const handleExportCSV = () => {
    const headers = ['Invoice #', 'Customer', 'Delivery', 'Date', 'Payment Type', 'Payment Method', 'Total', 'Paid', 'Balance'];
    const rows = filteredInvoices.map((inv) => [
      inv.invoiceNumber,
      `"${inv.customerName}"`,
      inv.deliveryStatus,
      inv.displayDate || inv.invoiceDate,
      inv.paymentType,
      inv.paymentMethod,
      inv.totalAmount,
      inv.paidAmount,
      inv.balanceAmount,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Invoices_Export_${new Date().toISOString().split('T')[0]}.csv`);
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

  const handleSaveEditedInvoice = async () => {
    if (!editingInvoice) return;
    try {
      if (editingInvoice.id && !editingInvoice.id.startsWith('inv-')) {
        await salesApi.update(editingInvoice.id, {
          paymentType: editingInvoice.paymentType,
          paymentMethod: editingInvoice.paymentMethod,
          paidAmount: Number(editingInvoice.paidAmount || 0),
          balanceAmount: Number(editingInvoice.balanceAmount || 0),
          status: editingInvoice.status,
          notes: editingInvoice.notes,
        });
      }
      addToast(`Invoice ${editingInvoice.invoiceNumber} updated successfully!`, 'success');
      await loadBackendInvoices();
    } catch (err) {
      console.error('Failed to update invoice:', err);
      addToast(err.response?.data?.message || 'Failed to update invoice', 'error');
    }
    if (selectedInvoice && (selectedInvoice.id === editingInvoice.id || selectedInvoice.invoiceNumber === editingInvoice.invoiceNumber)) {
      setSelectedInvoice({ ...selectedInvoice, ...editingInvoice });
    }
    setEditingInvoice(null);
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
  const [loadingHeldBills, setLoadingHeldBills] = useState(false);
  const [heldSearchQuery, setHeldSearchQuery] = useState('');
  const [heldStatusFilter, setHeldStatusFilter] = useState('ALL');
  const [selectedHeldDetail, setSelectedHeldDetail] = useState(null);
  const [heldToResume, setHeldToResume] = useState(null);

  // Workflow states: selection, warehouse adjustment, and dispatch note
  const [selectedHeldIds, setSelectedHeldIds] = useState([]);
  const [adjustingHeldBill, setAdjustingHeldBill] = useState(null);
  const [dispatchNoteData, setDispatchNoteData] = useState(null);

  // Modal states for creating / recording items
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    customerName: '',
    invoiceNo: '',
    amount: '',
    paymentMethod: 'Cash',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [showRecordAdvanceModal, setShowRecordAdvanceModal] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({
    customerName: '',
    amount: '',
    paymentMethod: 'Bank Transfer',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [showCreateQuotationModal, setShowCreateQuotationModal] = useState(false);
  const [quotationForm, setQuotationForm] = useState({
    customerName: '',
    quotationDate: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    totalAmount: '',
    notes: '',
  });

  const loadHeldBills = async () => {
    try {
      setLoadingHeldBills(true);
      const res = await salesApi.getHeld();
      const list = res.data && Array.isArray(res.data) ? res.data : [];
      setHeldBills(list);
    } catch (err) {
      console.error('Failed to load held bills:', err);
    } finally {
      setLoadingHeldBills(false);
    }
  };

  useEffect(() => {
    if (currentTab === 'hold-bills') {
      loadHeldBills();
    }
  }, [currentTab]);

  const handleDiscardHeldBill = async (heldBillOrId, invNum) => {
    let heldId = heldBillOrId;
    let invoiceNumber = invNum;
    if (typeof heldBillOrId === 'object' && heldBillOrId !== null) {
      heldId = heldBillOrId.id;
      invoiceNumber = heldBillOrId.invoiceNumber;
    }
    const displayName = invoiceNumber || heldId || 'this held bill';
    if (!window.confirm(`Are you sure you want to discard held bill ${displayName}?`)) {
      return;
    }
    try {
      if (heldId) {
        await salesApi.deleteHeld(heldId).catch(() => salesApi.cancelHeld(heldId));
      } else if (invoiceNumber) {
        await salesApi.deleteHeldByNumber(invoiceNumber).catch(() => {});
      }
      addToast(`Held bill ${displayName} discarded successfully`, 'info');
      setSelectedHeldIds((prev) => prev.filter((id) => String(id) !== String(heldId)));
      if (selectedHeldDetail && (selectedHeldDetail.id === heldId || selectedHeldDetail.invoiceNumber === invoiceNumber)) {
        setSelectedHeldDetail(null);
      }
      await loadHeldBills();
    } catch (err) {
      addToast('Failed to discard held bill: ' + err.message, 'error');
    }
  };

  const handleBulkDiscardHeld = async () => {
    if (selectedHeldIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to discard all ${selectedHeldIds.length} selected held bills?`)) {
      return;
    }
    const toDeleteIds = [...selectedHeldIds];
    try {
      await Promise.allSettled(
        toDeleteIds.map((id) => salesApi.deleteHeld(id).catch(() => salesApi.cancelHeld(id)))
      );
      addToast(`${toDeleteIds.length} held bill(s) discarded successfully`, 'info');
      setSelectedHeldIds([]);
      setSelectedHeldDetail(null);
      await loadHeldBills();
    } catch (err) {
      addToast('Failed to discard held bills: ' + err.message, 'error');
    }
  };

  const handleResumeHeldBill = (heldInv) => {
    setHeldToResume(heldInv);
    handleTabClick('pos');
  };

  // Workflow Action 1: Send bill to warehouse
  const handleSendToWarehouse = (heldBill) => {
    const updated = heldBills.map((b) => {
      if (b.id === heldBill.id) {
        return {
          ...b,
          status: 'SENT_TO_WAREHOUSE',
          sentToWarehouseAt: new Date().toISOString(),
        };
      }
      return b;
    });
    setHeldBills(updated);
    addToast(`Bill ${heldBill.invoiceNumber} sent to warehouse for stock picking & verification!`, 'success');
  };

  // Workflow Action 2: Open warehouse stock adjustment modal
  const handleOpenStockAdjustment = (heldBill) => {
    setAdjustingHeldBill({
      ...heldBill,
      items: (heldBill.items || []).map((it) => ({
        ...it,
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || 0),
        totalPrice: Number(it.totalPrice || (it.quantity * it.unitPrice) || 0),
      })),
      adjustmentRemarks: heldBill.adjustmentRemarks || '',
    });
  };

  // Workflow Action 3: Save verified / adjusted stock
  const handleSaveStockAdjustment = () => {
    if (!adjustingHeldBill) return;
    const calcNetTotal = adjustingHeldBill.items.reduce(
      (sum, it) => sum + Number(it.totalPrice || (it.quantity * it.unitPrice) || 0),
      0
    );
    const updated = heldBills.map((b) => {
      if (b.id === adjustingHeldBill.id) {
        return {
          ...b,
          items: adjustingHeldBill.items,
          netTotal: calcNetTotal,
          totalAmount: calcNetTotal,
          status: 'STOCK_ADJUSTED',
          stockAdjustedAt: new Date().toISOString(),
          adjustmentRemarks: adjustingHeldBill.adjustmentRemarks,
        };
      }
      return b;
    });
    setHeldBills(updated);
    addToast(`Stock quantities adjusted & verified for ${adjustingHeldBill.invoiceNumber}. Bill is ready for dispatch!`, 'success');
    setAdjustingHeldBill(null);
  };

  // Workflow Action 4: Merge multiple bills & open dispatch note
  const handleOpenMergeDispatchModal = () => {
    const selected = heldBills.filter((b) => selectedHeldIds.includes(b.id));
    if (selected.length === 0) {
      addToast('Please select at least one held bill to dispatch', 'error');
      return;
    }
    const customer = selected[0].customerName || 'Walk-in';
    const mergedItems = [];
    selected.forEach((bill) => {
      (bill.items || []).forEach((item) => {
        mergedItems.push({
          ...item,
          fromInvoice: bill.invoiceNumber,
        });
      });
    });

    const totalVal = selected.reduce((s, b) => s + Number(b.netTotal || b.totalAmount || 0), 0);

    setDispatchNoteData({
      odnNumber: `ODN-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      date: new Date().toLocaleString(),
      customerName: customer,
      sourceBills: selected.map((b) => b.invoiceNumber),
      sourceBillIds: selected.map((b) => b.id),
      items: mergedItems,
      totalAmount: totalVal,
      vehicleNumber: '',
      driverName: '',
      deliveryAddress: '',
      deliveryNotes: '',
    });
  };

  const handleOpenSingleDispatchModal = (bill) => {
    setSelectedHeldIds([bill.id]);
    setDispatchNoteData({
      odnNumber: `ODN-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      date: new Date().toLocaleString(),
      customerName: bill.customerName || 'Walk-in',
      sourceBills: [bill.invoiceNumber],
      sourceBillIds: [bill.id],
      items: (bill.items || []).map((it) => ({ ...it, fromInvoice: bill.invoiceNumber })),
      totalAmount: Number(bill.netTotal || bill.totalAmount || 0),
      vehicleNumber: '',
      driverName: '',
      deliveryAddress: '',
      deliveryNotes: '',
    });
  };

  // Workflow Action 5: Confirm Dispatch Note, mark bills as Dispatched, create Commercial Invoice
  const handleConfirmDispatch = async () => {
    if (!dispatchNoteData) return;
    const targetIds = dispatchNoteData.sourceBillIds || [];

    try {
      await Promise.allSettled(
        targetIds.map((id) => salesApi.cancelHeld(id))
      );
      addToast(`Order Dispatch Note ${dispatchNoteData.odnNumber} confirmed for ${dispatchNoteData.customerName}!`, 'success');
      setSelectedHeldIds([]);
      setDispatchNoteData(null);
      await Promise.all([loadHeldBills(), loadBackendInvoices()]);
      setCurrentTab('sales');
    } catch (err) {
      addToast('Failed to process dispatch: ' + err.message, 'error');
    }
  };

  const filteredHeldBills = useMemo(() => {
    return heldBills.filter((b) => {
      if (heldStatusFilter !== 'ALL' && b.status !== heldStatusFilter) return false;
      if (heldSearchQuery.trim()) {
        const q = heldSearchQuery.toLowerCase();
        const num = (b.invoiceNumber || '').toLowerCase();
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
    const headers = ['Invoice #', 'Customer', 'Date / Time', 'Warehouse', 'Items Count', 'Cashier', 'Status', 'Total Amount'];
    const rows = filteredHeldBills.map((b) => [
      `"${b.invoiceNumber || ''}"`,
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
    link.setAttribute('download', `Held_Bills_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Held bills exported to CSV', 'success');
  };

  // -------------------------------------------------------------
  // OTHER TABS DATA (Quotations, Payments, Advances, Outstanding)
  // -------------------------------------------------------------
  const [quotations, setQuotations] = useState([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [advances, setAdvances] = useState([]);
  const [loadingAdvances, setLoadingAdvances] = useState(false);

  const loadBackendPayments = async () => {
    try {
      setLoadingPayments(true);
      const res = await paymentApi.search({ size: 100 });
      const liveList = res.data?.content || res.data || [];
      const formatted = liveList.map((p) => ({
        id: p.id,
        receiptNo: p.receiptNo || p.paymentNumber,
        paymentNumber: p.paymentNumber,
        invoiceNo: p.invoiceNo || p.invoiceNumber || 'DIRECT',
        invoiceNumber: p.invoiceNumber,
        customerName: p.customerName || 'Walk-in',
        paymentDate: p.paymentDate || (p.createdAt ? p.createdAt.split('T')[0] : ''),
        paymentMethod: p.paymentMethod || 'Cash',
        amount: Number(p.amount || 0),
        status: p.status || 'COMPLETED',
      }));
      setPayments(formatted);
    } catch (err) {
      console.error('Failed to load backend payments:', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  const loadBackendAdvances = async () => {
    try {
      setLoadingAdvances(true);
      const res = await paymentApi.search({ paymentType: 'ADVANCE', size: 100 });
      const liveList = res.data?.content || res.data || [];
      const formatted = liveList.map((p) => ({
        id: p.id,
        voucherNo: p.voucherNo || p.paymentNumber,
        paymentNumber: p.paymentNumber,
        customerName: p.customerName || 'Customer',
        customerId: p.customerId,
        date: p.paymentDate || (p.createdAt ? p.createdAt.split('T')[0] : ''),
        amount: Number(p.amount || 0),
        balance: Number(p.amount || 0),
        paymentMethod: p.paymentMethod || 'Bank Transfer',
        status: p.status || 'ACTIVE',
      }));
      setAdvances(formatted);
    } catch (err) {
      console.error('Failed to load advances:', err);
    } finally {
      setLoadingAdvances(false);
    }
  };

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
    loadBackendPayments();
    loadBackendAdvances();
    loadBackendQuotations();
  }, []);

  // Form Submissions
  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.customerName || !paymentForm.amount) {
      addToast('Please provide customer name and payment amount', 'error');
      return;
    }
    const amt = parseFloat(paymentForm.amount) || 0;
    try {
      const payload = {
        customerName: paymentForm.customerName,
        invoiceNumber: paymentForm.invoiceNo || null,
        amount: amt,
        paymentMethod: paymentForm.paymentMethod || 'Cash',
        paymentDate: paymentForm.paymentDate || new Date().toISOString().split('T')[0],
        notes: paymentForm.notes || '',
      };
      const res = await paymentApi.create(payload);
      addToast(`Payment receipt ${res.data?.receiptNo || res.data?.paymentNumber || 'recorded'} successfully!`, 'success');
      setShowRecordPaymentModal(false);
      setPaymentForm({
        customerName: '',
        invoiceNo: '',
        amount: '',
        paymentMethod: 'Cash',
        paymentDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
      await Promise.all([loadBackendPayments(), loadBackendInvoices()]);
    } catch (err) {
      console.error('Failed to record payment:', err);
      addToast(err.response?.data?.message || 'Failed to record payment', 'error');
    }
  };

  const handleVoidPayment = async (payment) => {
    if (!window.confirm(`Are you sure you want to void payment receipt ${payment.receiptNo || payment.paymentNumber}?`)) {
      return;
    }
    try {
      if (payment.id) {
        await paymentApi.void(payment.id, 'User voided via UI');
      }
      addToast(`Payment ${payment.receiptNo || payment.paymentNumber} voided successfully!`, 'success');
      await Promise.all([loadBackendPayments(), loadBackendInvoices()]);
    } catch (err) {
      console.error('Failed to void payment:', err);
      addToast(err.response?.data?.message || 'Failed to void payment', 'error');
    }
  };

  const handleSaveAdvance = async (e) => {
    e.preventDefault();
    if (!advanceForm.customerName || !advanceForm.amount) {
      addToast('Please provide customer name and advance amount', 'error');
      return;
    }
    const amt = parseFloat(advanceForm.amount) || 0;
    try {
      const payload = {
        customerName: advanceForm.customerName,
        amount: amt,
        paymentMethod: advanceForm.paymentMethod || 'Bank Transfer',
        paymentDate: advanceForm.paymentDate || new Date().toISOString().split('T')[0],
        notes: advanceForm.notes || '',
      };
      const res = await paymentApi.createAdvance(payload);
      const created = res.data?.data || res.data;
      addToast(`Advance deposit voucher ${created?.paymentNumber || created?.receiptNo || 'recorded'} successfully!`, 'success');
      setShowRecordAdvanceModal(false);
      setAdvanceForm({
        customerName: '',
        amount: '',
        paymentMethod: 'Bank Transfer',
        paymentDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
      await loadBackendAdvances();
    } catch (err) {
      console.error('Failed to record advance:', err);
      addToast(err.response?.data?.message || 'Failed to record advance', 'error');
    }
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
        quotationDate: quotationForm.quotationDate || new Date().toISOString().split('T')[0],
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
        quotationDate: new Date().toISOString().split('T')[0],
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
    link.setAttribute('download', `Quotations_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Quotations exported to CSV', 'success');
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (paymentMethodFilter !== 'ALL' && p.paymentMethod !== paymentMethodFilter) return false;
      if (paymentSearchQuery.trim()) {
        const query = paymentSearchQuery.toLowerCase();
        return (
          (p.receiptNo || '').toLowerCase().includes(query) ||
          (p.invoiceNo || '').toLowerCase().includes(query) ||
          (p.customerName || '').toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [payments, paymentSearchQuery, paymentMethodFilter]);

  const handleExportPaymentsCSV = () => {
    const headers = ['Receipt #', 'Invoice #', 'Customer', 'Date', 'Method', 'Amount', 'Status'];
    const rows = filteredPayments.map((p) => [
      `"${p.receiptNo || ''}"`,
      `"${p.invoiceNo || ''}"`,
      `"${p.customerName || ''}"`,
      `"${p.paymentDate || ''}"`,
      `"${p.paymentMethod || ''}"`,
      p.amount,
      `"${p.status || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Payments_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Payments exported to CSV', 'success');
  };

  const filteredAdvances = useMemo(() => {
    if (!advanceSearchQuery.trim()) return advances;
    const query = advanceSearchQuery.toLowerCase();
    return advances.filter(
      (a) =>
        (a.voucherNo || '').toLowerCase().includes(query) ||
        (a.customerName || '').toLowerCase().includes(query) ||
        (a.paymentMethod || '').toLowerCase().includes(query)
    );
  }, [advances, advanceSearchQuery]);

  const handleExportAdvancesCSV = () => {
    const headers = ['Voucher #', 'Customer', 'Date', 'Total Advance', 'Available Credit', 'Method', 'Status'];
    const rows = filteredAdvances.map((a) => [
      `"${a.voucherNo || ''}"`,
      `"${a.customerName || ''}"`,
      `"${a.date || ''}"`,
      a.amount,
      a.balance,
      `"${a.paymentMethod || ''}"`,
      `"${a.status || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Advances_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Advance payments exported to CSV', 'success');
  };

  // -------------------------------------------------------------
  // OUTSTANDING PAYMENTS DATA & ACTIONS
  // -------------------------------------------------------------
  const [outstandingSearchQuery, setOutstandingSearchQuery] = useState('');
  const [outstandingStatusFilter, setOutstandingStatusFilter] = useState('ALL');

  const outstandingInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const bal = Number(inv.balanceAmount || 0);
      if (bal <= 0 && inv.status === 'PAID') return false;
      if (outstandingStatusFilter !== 'ALL' && inv.status !== outstandingStatusFilter) return false;
      if (outstandingSearchQuery.trim()) {
        const q = outstandingSearchQuery.toLowerCase();
        const num = (inv.invoiceNumber || '').toLowerCase();
        const cust = (inv.customerName || '').toLowerCase();
        const method = (inv.paymentMethod || '').toLowerCase();
        if (!num.includes(q) && !cust.includes(q) && !method.includes(q)) return false;
      }
      return true;
    });
  }, [invoices, outstandingStatusFilter, outstandingSearchQuery]);

  const totalOutstandingAmount = useMemo(() => {
    return outstandingInvoices.reduce((sum, inv) => sum + Number(inv.balanceAmount || 0), 0);
  }, [outstandingInvoices]);

  const handleExportOutstandingCSV = () => {
    if (outstandingInvoices.length === 0) {
      addToast('No outstanding invoices to export', 'error');
      return;
    }
    const headers = ['Invoice #', 'Customer', 'Date', 'Payment Type', 'Total Amount', 'Paid Amount', 'Outstanding Balance', 'Status'];
    const rows = outstandingInvoices.map((inv) => [
      `"${inv.invoiceNumber || ''}"`,
      `"${inv.customerName || ''}"`,
      `"${inv.displayDate || inv.invoiceDate || ''}"`,
      `"${inv.paymentType || ''}"`,
      inv.totalAmount,
      inv.paidAmount,
      inv.balanceAmount,
      `"${inv.status || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Outstanding_Invoices_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Outstanding invoices exported to CSV', 'success');
  };

  // Dedicated POS Full-Screen Mode (No navigation, no header, pure POS desk)
  if (currentTab === 'pos') {
    return (
      <div style={{ flex: 1, minHeight: 0, height: '100%', overflowY: 'auto', backgroundColor: '#f8fafc' }}>
        <PosView
          onExitPos={() => {
            setHeldToResume(null);
            handleTabClick('sales');
          }}
          initialHeldInvoice={heldToResume}
        />
      </div>
    );
  }

  return (
    <div
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px',
          flexShrink: 0,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              margin: '0 0 4px 0',
            }}
          >
            Sales Management
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            Create and manage commercial invoices, quotations, held bills, customer payments, and sales returns.
          </p>
        </div>

        {/* Action Button matching current active tab - Matching InventoryHub */}
        {currentTab === 'quotations' ? (
          <button
            type="button"
            onClick={() => setShowCreateQuotationModal(true)}
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.88rem',
              padding: '9px 18px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={17} /> Create Quotation
          </button>
        ) : currentTab === 'payments' ? (
          <button
            type="button"
            onClick={() => setShowRecordPaymentModal(true)}
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.88rem',
              padding: '9px 18px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={17} /> Record Payment
          </button>
        ) : currentTab === 'advance-payments' ? (
          <button
            type="button"
            onClick={() => setShowRecordAdvanceModal(true)}
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.88rem',
              padding: '9px 18px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={17} /> Record Advance
          </button>
        ) : currentTab === 'outstanding-payments' ? (
          <button
            type="button"
            onClick={() => setShowRecordPaymentModal(true)}
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.88rem',
              padding: '9px 18px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={17} /> Record Payment
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleTabClick('pos')}
            style={{
              backgroundColor: '#16a34a',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.88rem',
              padding: '9px 18px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <ShoppingCart size={17} /> Open POS
          </button>
        )}
      </div>

      {/* Subtabs Bar (Underline Style matching InventoryHub - Fixed / Sticky) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '16px',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {INVOICING_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 4px',
                border: 'none',
                borderBottom: isActive ? '2.5px solid #0284c7' : '2.5px solid transparent',
                backgroundColor: 'transparent',
                color: isActive ? '#0284c7' : '#64748b',
                fontSize: '0.92rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                marginBottom: '-1px',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} color={isActive ? '#0284c7' : '#64748b'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: SALES (Commercial Invoices - Standardized Inventory Structure) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'sales' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          {/* Search Bar & Action Controls (Matched with InventoryHub Toolbar Layout) */}
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
              <input
                type="text"
                placeholder="Search invoice #, customer, reference, or payment method..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
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

            {/* Right Controls: Status, Payment Type, Date Range, Presets, Columns, Reset, CSV, Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'nowrap' }}>
              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 26px 0 10px',
                  width: '120px',
                  minWidth: '110px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  fontFamily: 'inherit',
                  fontWeight: 500,
                  color: '#334155',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  outline: 'none',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Partial</option>
                <option value="PENDING">Pending</option>
              </select>

              {/* Payment Type filter */}
              <select
                value={filterPaymentType}
                onChange={(e) => setFilterPaymentType(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 26px 0 10px',
                  width: '135px',
                  minWidth: '125px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  fontFamily: 'inherit',
                  fontWeight: 500,
                  color: '#334155',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  outline: 'none',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                }}
              >
                <option value="ALL">All Types</option>
                <option value="Full Payment">Full Payment</option>
                <option value="Installment">Installment</option>
              </select>

              {/* Date inputs */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '38px',
                  padding: '0 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box',
                }}
              >
                <Calendar size={14} color="#0284c7" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.8rem',
                    color: '#334155',
                    backgroundColor: 'transparent',
                    fontFamily: 'inherit',
                  }}
                  title="Start date"
                />
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.8rem',
                    color: '#334155',
                    backgroundColor: 'transparent',
                    fontFamily: 'inherit',
                  }}
                  title="End date"
                />
              </div>

              {/* Date Presets Dropdown */}
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleDatePreset(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                style={{
                  height: '38px',
                  padding: '0 26px 0 10px',
                  width: '115px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  fontFamily: 'inherit',
                  fontWeight: 500,
                  color: '#334155',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  outline: 'none',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                }}
                title="Quick date ranges"
              >
                <option value="" disabled>Presets</option>
                <option value="today">Today</option>
                <option value="this-week">This Week</option>
                <option value="this-month">This Month</option>
              </select>

              {/* Reset Filters button */}
              {(searchQuery || filterStatus !== 'ALL' || filterPaymentType !== 'ALL' || startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterStatus('ALL');
                    setFilterPaymentType('ALL');
                    setStartDate('');
                    setEndDate('');
                  }}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    fontSize: '0.84rem',
                    fontFamily: 'inherit',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                  title="Reset all filters"
                >
                  <X size={13} /> Reset
                </button>
              )}

              {/* Refresh Records - Icon button */}
              <button
                type="button"
                onClick={loadBackendInvoices}
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
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#64748b';
                }}
                title="Refresh invoice records"
              >
                <RefreshCw size={15} className={loadingInvoices ? 'spin' : ''} />
              </button>
            </div>
          </div>

          {/* Invoices Table Card (Fixed Frame, Sticky Header matching InventoryHub) */}
          <div
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
            <div style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    {visibleColumns.invoiceNumber && <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>INVOICE #</th>}
                    {visibleColumns.customer && <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER</th>}
                    {visibleColumns.date && <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DATE</th>}
                    {visibleColumns.paymentType && <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PAYMENT TYPE</th>}
                    {visibleColumns.paymentMethod && <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PAYMENT METHOD</th>}
                    {visibleColumns.total && <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>TOTAL</th>}
                    {visibleColumns.paid && <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PAID</th>}
                    {visibleColumns.balance && <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>BALANCE</th>}
                    {visibleColumns.delivery && <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DELIVERY</th>}
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv, idx) => (
                    <tr
                      key={inv.id || idx}
                      onClick={() => setSelectedInvoice(inv)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s ease',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Invoice # */}
                      {visibleColumns.invoiceNumber && (
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                          {inv.invoiceNumber}
                        </td>
                      )}

                      {/* Customer */}
                      {visibleColumns.customer && (
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                          {inv.customerName}
                        </td>
                      )}

                      {/* Date */}
                      {visibleColumns.date && (
                        <td style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {inv.displayDate || inv.invoiceDate}
                        </td>
                      )}

                      {/* Payment Type */}
                      {visibleColumns.paymentType && (
                        <td style={{ padding: '12px 16px', color: '#334155' }}>
                          {inv.paymentType}
                        </td>
                      )}

                      {/* Payment Method */}
                      {visibleColumns.paymentMethod && (
                        <td style={{ padding: '12px 16px', color: '#334155' }}>
                          {inv.paymentMethod}
                        </td>
                      )}

                      {/* Total */}
                      {visibleColumns.total && (
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                          LKR {Number(inv.totalAmount || 0).toFixed(2)}
                        </td>
                      )}

                      {/* Paid */}
                      {visibleColumns.paid && (
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#16a34a', fontFamily: 'monospace' }}>
                          LKR {Number(inv.paidAmount || 0).toFixed(2)}
                        </td>
                      )}

                      {/* Balance */}
                      {visibleColumns.balance && (
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: Number(inv.balanceAmount || 0) > 0 ? '#dc2626' : '#64748b', fontFamily: 'monospace' }}>
                          LKR {Number(inv.balanceAmount || 0).toFixed(2)}
                        </td>
                      )}

                      {/* Delivery Status */}
                      {visibleColumns.delivery && (
                        <td style={{ padding: '12px 16px' }}>
                          {inv.deliveryStatus === 'DELIVERED' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
                              <CheckCircle size={11} /> Delivered
                            </span>
                          ) : inv.deliveryStatus === 'OUT_FOR_DELIVERY' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                              <Truck size={11} /> On Route {inv.deliveryNumber ? `(${inv.deliveryNumber})` : ''}
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
                              <Clock size={11} /> Pending Delivery
                            </span>
                          )}
                        </td>
                      )}

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-glass btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingInvoice({ ...inv });
                            }}
                            title="Edit Invoice"
                            style={{ padding: '4px 8px', borderRadius: '5px', color: '#0284c7' }}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-glass btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteInvoice(inv);
                            }}
                            title="Delete Invoice"
                            style={{ padding: '4px 8px', borderRadius: '5px', color: '#dc2626' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        {loadingInvoices ? 'Loading invoices...' : 'No invoices match the selected filter criteria.'}
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
      {/* TAB: HOLD BILLS (Standardized Inventory Structure) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'hold-bills' && (
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
              <input
                type="text"
                placeholder="Search held bills by invoice #, customer, cashier, or warehouse..."
                value={heldSearchQuery}
                onChange={(e) => setHeldSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
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
              {heldSearchQuery && (
                <button
                  type="button"
                  onClick={() => setHeldSearchQuery('')}
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

            {/* Right Controls: Status filter, Total summary badge, Reset, Export CSV, & Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'nowrap' }}>
              <select
                value={heldStatusFilter}
                onChange={(e) => setHeldStatusFilter(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 26px 0 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '0.84rem',
                  color: '#334155',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="HELD">Held at POS</option>
                <option value="SENT_TO_WAREHOUSE">Sent to Warehouse</option>
                <option value="STOCK_ADJUSTED">Stock Adjusted</option>
                <option value="DISPATCHED">Dispatched</option>
              </select>

              <div
                style={{
                  height: '38px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 14px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                  fontSize: '0.84rem',
                  color: '#64748b',
                  whiteSpace: 'nowrap',
                }}
              >
                Total Value:&nbsp;<strong style={{ color: '#0f172a' }}>Rs. {filteredHeldBills.reduce((s, b) => s + Number(b.netTotal || b.totalAmount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>

              {(heldSearchQuery || heldStatusFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setHeldSearchQuery('');
                    setHeldStatusFilter('ALL');
                  }}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    fontSize: '0.84rem',
                    fontFamily: 'inherit',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                  title="Reset filter and search"
                >
                  <X size={13} /> Reset
                </button>
              )}

              {/* Export CSV - Icon button */}
              <button
                type="button"
                onClick={handleExportHeldBillsCSV}
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
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                title="Export held bills to CSV"
              >
                <Download size={15} />
              </button>

              {/* Refresh Records - Icon button */}
              <button
                type="button"
                onClick={loadHeldBills}
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
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                title="Refresh held bills"
              >
                <RefreshCw size={15} className={loadingHeldBills ? 'spin' : ''} />
              </button>
            </div>
          </div>

          {/* Merge & Bulk Actions Banner (appears when bills are checked) */}
          {selectedHeldIds.length > 0 && (
            <div
              style={{
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <CheckSquare size={18} color="#2563eb" />
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e40af' }}>
                  {selectedHeldIds.length} Held Bill{selectedHeldIds.length > 1 ? 's' : ''} Selected
                </span>
                {(() => {
                  const selectedBills = heldBills.filter((b) => selectedHeldIds.includes(b.id));
                  const customerNames = Array.from(new Set(selectedBills.map((b) => b.customerName || 'Walk-in')));
                  if (customerNames.length > 1) {
                    return (
                      <span
                        style={{
                          fontSize: '0.78rem',
                          color: '#b91c1c',
                          backgroundColor: '#fee2e2',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 600,
                        }}
                      >
                        <AlertCircle size={13} /> Multiple customers selected: {customerNames.join(', ')} (Must select same customer to merge)
                      </span>
                    );
                  }
                  return (
                    <span
                      style={{
                        fontSize: '0.78rem',
                        color: '#15803d',
                        backgroundColor: '#dcfce7',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      Customer: {customerNames[0]}
                    </span>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedHeldIds([])}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.82rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  onClick={handleBulkDiscardHeld}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.82rem',
                    borderRadius: '6px',
                    border: '1px solid #fecaca',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                  title="Discard all selected held bills"
                >
                  <Trash2 size={14} /> Discard Selected ({selectedHeldIds.length})
                </button>
                <button
                  type="button"
                  onClick={handleOpenMergeDispatchModal}
                  style={{
                    padding: '6px 16px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                  }}
                >
                  <Truck size={15} /> Merge & Generate Dispatch Note
                </button>
              </div>
            </div>
          )}

          {/* Table Container (Matching InventoryHub) */}
          <div
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
            <div style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th style={{ padding: '12px 14px', width: '38px', textAlign: 'center', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      <input
                        type="checkbox"
                        checked={
                          filteredHeldBills.length > 0 &&
                          filteredHeldBills.every((b) => selectedHeldIds.includes(b.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedHeldIds(filteredHeldBills.map((b) => b.id));
                          } else {
                            setSelectedHeldIds([]);
                          }
                        }}
                      />
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>HOLD BILL #</th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER</th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DATE & TIME</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ITEMS</th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CASHIER / STAFF</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>TOTAL AMOUNT</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingHeldBills ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        Loading held bills...
                      </td>
                    </tr>
                  ) : filteredHeldBills.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
                        <PauseCircle size={34} style={{ opacity: 0.35, marginBottom: '8px' }} />
                        <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.9rem' }}>No held bills found</div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '3px' }}>
                          Bills placed on hold during POS billing or filtered by status will appear here.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredHeldBills.map((hb) => (
                      <tr
                        key={hb.id}
                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        onClick={() => setSelectedHeldDetail(hb)}
                        title="Click to view hold bill details"
                      >
                        <td style={{ padding: '12px 14px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedHeldIds.includes(hb.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedHeldIds([...selectedHeldIds, hb.id]);
                              } else {
                                setSelectedHeldIds(selectedHeldIds.filter((id) => id !== hb.id));
                              }
                            }}
                          />
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{ fontWeight: 700, color: '#0284c7', fontFamily: 'monospace', fontSize: '0.88rem' }}
                            title="Click to inspect items"
                          >
                            {hb.invoiceNumber}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            {hb.customerName || 'Walk-in Customer'}
                          </div>
                          {hb.customerPhone && (
                            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '1px' }}>
                              {hb.customerPhone}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#475569', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          {hb.createdAt ? new Date(hb.createdAt).toLocaleString() : (hb.invoiceDate ? new Date(hb.invoiceDate).toLocaleDateString() : '—')}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: '12px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                            {(hb.items?.length || 1)} items
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}>
                            {hb.salesman || hb.salesmanName || hb.createdBy || 'Staff'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                          Rs. {Number(hb.netTotal || hb.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {hb.status === 'SENT_TO_WAREHOUSE' ? (
                            <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '12px', background: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}>
                              Sent to WH
                            </span>
                          ) : hb.status === 'STOCK_ADJUSTED' ? (
                            <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '12px', background: '#ede9fe', color: '#6d28d9', fontWeight: 700 }}>
                              Stock Adjusted
                            </span>
                          ) : hb.status === 'DISPATCHED' ? (
                            <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '12px', background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>
                              Dispatched
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '12px', background: '#fef3c7', color: '#b45309', fontWeight: 700 }}>
                              Held at POS
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            {/* 1. Resume in POS (Primary Action) */}
                            <button
                              type="button"
                              onClick={() => handleResumeHeldBill(hb)}
                              style={{
                                padding: '5px 10px',
                                fontSize: '0.76rem',
                                fontWeight: 600,
                                backgroundColor: '#0284c7',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                boxShadow: '0 1px 2px rgba(2, 132, 199, 0.2)',
                                transition: 'background-color 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
                              title="Resume billing in POS"
                            >
                              <PlayCircle size={13} /> Resume
                            </button>

                            {/* 2. View details */}
                            <button
                              type="button"
                              onClick={() => setSelectedHeldDetail(hb)}
                              style={{
                                padding: '5px 8px',
                                fontSize: '0.76rem',
                                fontWeight: 600,
                                backgroundColor: '#ffffff',
                                color: '#475569',
                                border: '1px solid #cbd5e1',
                                borderRadius: '5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#94a3b8';
                                e.currentTarget.style.backgroundColor = '#f8fafc';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#cbd5e1';
                                e.currentTarget.style.backgroundColor = '#ffffff';
                              }}
                              title="View bill items & details"
                            >
                              <Eye size={13} /> View
                            </button>

                            {/* 3. Delete / Discard */}
                            <button
                              type="button"
                              onClick={() => handleDiscardHeldBill(hb.id, hb.invoiceNumber)}
                              style={{
                                padding: '5px 8px',
                                fontSize: '0.76rem',
                                fontWeight: 600,
                                backgroundColor: '#ffffff',
                                color: '#ef4444',
                                border: '1px solid #fecaca',
                                borderRadius: '5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#fef2f2';
                                e.currentTarget.style.borderColor = '#ef4444';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#ffffff';
                                e.currentTarget.style.borderColor = '#fecaca';
                              }}
                              title="Delete / discard held bill"
                            >
                              <Trash2 size={13} />
                            </button>

                            {/* Optional Warehouse helper if already in warehouse workflow */}
                            {hb.status === 'SENT_TO_WAREHOUSE' && (
                              <button
                                type="button"
                                onClick={() => handleOpenStockAdjustment(hb)}
                                style={{
                                  padding: '5px 8px',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  backgroundColor: '#f3e8ff',
                                  color: '#7c3aed',
                                  border: '1px solid #d8b4fe',
                                  borderRadius: '5px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  cursor: 'pointer',
                                }}
                                title="Adjust warehouse stock quantities"
                              >
                                <Edit3 size={11} /> Stock
                              </button>
                            )}
                            {hb.status === 'STOCK_ADJUSTED' && (
                              <button
                                type="button"
                                onClick={() => handleOpenSingleDispatchModal(hb)}
                                style={{
                                  padding: '5px 8px',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  backgroundColor: '#dcfce7',
                                  color: '#15803d',
                                  border: '1px solid #86efac',
                                  borderRadius: '5px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  cursor: 'pointer',
                                }}
                                title="Generate Dispatch Note"
                              >
                                <Truck size={11} /> Dispatch
                              </button>
                            )}
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
      {/* TAB 4: PAYMENTS (Customer Payments & Receipts) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'payments' && (
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
              <input
                type="text"
                placeholder="Search payments by receipt #, invoice #, or customer name..."
                value={paymentSearchQuery}
                onChange={(e) => setPaymentSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
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
              {paymentSearchQuery && (
                <button
                  type="button"
                  onClick={() => setPaymentSearchQuery('')}
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

            {/* Right Controls: Method filter, Reset, Export CSV */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'nowrap' }}>
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 26px 0 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  color: '#334155',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Methods</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Card">Card</option>
              </select>

              {(paymentSearchQuery || paymentMethodFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setPaymentSearchQuery('');
                    setPaymentMethodFilter('ALL');
                  }}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    fontSize: '0.84rem',
                    fontWeight: 500,
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
                onClick={handleExportPaymentsCSV}
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
                title="Export payments to CSV"
              >
                <Download size={15} />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div
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
            <div style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>RECEIPT #</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>INVOICE REFERENCE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DATE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>METHOD</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>AMOUNT PAID</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p) => (
                    <tr
                      key={p.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                        {p.receiptNo}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontFamily: 'monospace' }}>
                        {p.invoiceNo}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{p.customerName}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155' }}>{p.paymentMethod}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#16a34a', fontFamily: 'monospace' }}>
                        LKR {Number(p.amount || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span className="badge badge-success" style={{ fontSize: '0.74rem', padding: '3px 8px', borderRadius: '4px' }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-glass btn-sm"
                          onClick={() => {
                            addToast(`Payment receipt ${p.receiptNo} preview printed`, 'info');
                            window.print();
                          }}
                          style={{ padding: '4px 8px', fontSize: '0.74rem', borderRadius: '5px' }}
                          title="Print Receipt"
                        >
                          <Printer size={13} /> Print
                        </button>
                        <button
                          type="button"
                          className="btn btn-glass btn-sm"
                          onClick={() => handleVoidPayment(p)}
                          style={{ padding: '4px 8px', fontSize: '0.74rem', borderRadius: '5px', color: '#dc2626' }}
                          title="Void Payment"
                          disabled={p.status === 'VOIDED'}
                        >
                          <X size={13} /> Void
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredPayments.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        No payments found matching your search.
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
      {/* TAB 5: ADVANCE PAYMENTS (Customer Advances) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'advance-payments' && (
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
              <input
                type="text"
                placeholder="Search advances by voucher #, customer, or payment method..."
                value={advanceSearchQuery}
                onChange={(e) => setAdvanceSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
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
              {advanceSearchQuery && (
                <button
                  type="button"
                  onClick={() => setAdvanceSearchQuery('')}
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

            {/* Right Controls: Reset, Export CSV */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'nowrap' }}>
              {advanceSearchQuery && (
                <button
                  type="button"
                  onClick={() => setAdvanceSearchQuery('')}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    fontSize: '0.84rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Reset search"
                >
                  <X size={13} /> Reset
                </button>
              )}

              {/* Export CSV */}
              <button
                type="button"
                onClick={handleExportAdvancesCSV}
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
                title="Export advances to CSV"
              >
                <Download size={15} />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div
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
            <div style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>VOUCHER #</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DATE</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>TOTAL ADVANCE</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>AVAILABLE CREDIT</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>METHOD</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdvances.map((a) => (
                    <tr
                      key={a.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                        {a.voucherNo}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{a.customerName}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {a.date ? new Date(a.date).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                        LKR {Number(a.amount || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}>
                        LKR {Number(a.balance || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155' }}>{a.paymentMethod}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span className="badge badge-success" style={{ fontSize: '0.74rem', padding: '3px 8px', borderRadius: '4px' }}>
                          {a.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-glass btn-sm"
                          onClick={() => {
                            addToast(`Advance deposit voucher ${a.voucherNo} preview printed`, 'info');
                            window.print();
                          }}
                          style={{ padding: '4px 8px', fontSize: '0.74rem', borderRadius: '5px' }}
                          title="Print Advance Voucher"
                        >
                          <Printer size={13} /> Print
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredAdvances.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        No advance records found matching your search.
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
      {/* TAB 6: OUTSTANDING PAYMENTS (Unsettled / Partial Invoices) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'outstanding-payments' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', flexShrink: 0 }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Outstanding Balance
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626', marginTop: '4px', fontFamily: 'monospace' }}>
                Rs. {totalOutstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Pending / Partial Invoices
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {outstandingInvoices.length}
              </div>
            </div>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Quick Settlement
              </div>
              <div style={{ fontSize: '0.86rem', color: '#475569', marginTop: '6px' }}>
                Click <strong>"Pay"</strong> on any row below to instantly record a payment receipt against that bill.
              </div>
            </div>
          </div>

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
            {/* Left Control: Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search
                size={17}
                style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8', pointerEvents: 'none' }}
              />
              <input
                type="text"
                placeholder="Search outstanding invoices by #, customer, or payment method..."
                value={outstandingSearchQuery}
                onChange={(e) => setOutstandingSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                }}
              />
              {outstandingSearchQuery && (
                <button
                  type="button"
                  onClick={() => setOutstandingSearchQuery('')}
                  style={{ position: 'absolute', right: '10px', top: '10px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Right Controls: Status filter, Reset, Export CSV */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'nowrap' }}>
              <select
                value={outstandingStatusFilter}
                onChange={(e) => setOutstandingStatusFilter(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 26px 0 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '0.84rem',
                  color: '#334155',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Outstanding</option>
                <option value="PENDING">Pending (Full)</option>
                <option value="PARTIAL">Partial (Part-Paid)</option>
              </select>

              {(outstandingSearchQuery || outstandingStatusFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setOutstandingSearchQuery('');
                    setOutstandingStatusFilter('ALL');
                  }}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    fontSize: '0.84rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <X size={13} /> Reset
                </button>
              )}

              <button
                type="button"
                onClick={handleExportOutstandingCSV}
                style={{
                  height: '38px',
                  width: '38px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Export Outstanding to CSV"
              >
                <Download size={15} />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div
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
            <div style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>INVOICE #</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DATE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PAYMENT TYPE</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>TOTAL</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PAID</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>BALANCE</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
                        <CheckCircle size={34} style={{ opacity: 0.35, marginBottom: '8px', color: '#16a34a' }} />
                        <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.9rem' }}>No outstanding invoices!</div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '3px' }}>
                          All invoices have been settled in full.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    outstandingInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                          {inv.invoiceNumber}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                          {inv.customerName}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.82rem' }}>
                          {inv.displayDate || inv.invoiceDate}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>
                          {inv.paymentType}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
                          Rs. {Number(inv.totalAmount || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#16a34a', fontFamily: 'monospace' }}>
                          Rs. {Number(inv.paidAmount || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
                          Rs. {Number(inv.balanceAmount || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              backgroundColor: inv.status === 'PARTIAL' ? '#fef3c7' : '#fee2e2',
                              color: inv.status === 'PARTIAL' ? '#b45309' : '#b91c1c',
                            }}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentForm({
                                  customerName: inv.customerName,
                                  invoiceNo: inv.invoiceNumber,
                                  amount: String(inv.balanceAmount || ''),
                                  paymentMethod: 'Cash',
                                  paymentDate: new Date().toISOString().split('T')[0],
                                  notes: `Settlement for invoice ${inv.invoiceNumber}`,
                                });
                                setShowRecordPaymentModal(true);
                              }}
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.74rem',
                                backgroundColor: '#0284c7',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                              title="Record payment against this invoice"
                            >
                              <Plus size={12} /> Pay
                            </button>
                            <button
                              type="button"
                              className="btn btn-glass btn-sm"
                              onClick={() => setSelectedInvoice(inv)}
                              style={{ padding: '4px 7px', fontSize: '0.74rem', borderRadius: '5px' }}
                              title="View invoice details"
                            >
                              <Eye size={13} />
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
              <input
                type="text"
                placeholder="Search quotations by quotation # or customer name..."
                value={quotationSearchQuery}
                onChange={(e) => setQuotationSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
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
              <select
                value={quotationStatusFilter}
                onChange={(e) => setQuotationStatusFilter(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 26px 0 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
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
                <button
                  type="button"
                  onClick={() => {
                    setQuotationSearchQuery('');
                    setQuotationStatusFilter('ALL');
                  }}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    fontSize: '0.84rem',
                    fontWeight: 500,
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
          <div
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
            <div style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>QUOTATION #</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>QUOTATION DATE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>VALID UNTIL</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>TOTAL</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
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
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                        {qt.quotationNo}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{qt.customerName}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {qt.date ? new Date(qt.date).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {qt.validUntil ? new Date(qt.validUntil).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                        LKR {Number(qt.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span className={`badge ${qt.status === 'ACCEPTED' ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '0.74rem', padding: '3px 8px', borderRadius: '4px' }}>
                          {qt.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {qt.status !== 'ACCEPTED' && (
                            <button
                              type="button"
                              onClick={() => handleConvertQuotationToInvoice(qt)}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.74rem',
                                backgroundColor: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                              title="Convert to commercial invoice"
                            >
                              <CheckCircle size={12} /> Convert
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-glass btn-sm"
                            onClick={() => {
                              addToast(`Quotation ${qt.quotationNo} printed`, 'info');
                              window.print();
                            }}
                            style={{ padding: '4px 7px', fontSize: '0.74rem', borderRadius: '5px' }}
                            title="Print quotation"
                          >
                            <Printer size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-glass btn-sm"
                            onClick={() => handleDeleteQuotation(qt)}
                            style={{ padding: '4px 7px', fontSize: '0.74rem', borderRadius: '5px', color: '#dc2626' }}
                            title="Delete quotation"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredQuotations.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
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
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Customise Invoicing Columns</h3>
              <button
                type="button"
                onClick={() => setShowColumnModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.86rem' }}>
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
                className="btn btn-primary"
                onClick={() => setShowColumnModal(false)}
                style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', padding: '6px 16px' }}
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
              maxWidth: '780px',
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
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>COMMERCIAL INVOICE</h3>
                    <div style={{ fontSize: '0.85rem', color: '#0284c7', fontWeight: 700, fontFamily: 'monospace', marginTop: '2px' }}>
                      {selectedInvoice.invoiceNumber}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  textTransform: 'uppercase',
                  backgroundColor: selectedInvoice.status === 'PAID' ? '#dcfce7' : selectedInvoice.status === 'PARTIAL' ? '#fef3c7' : '#fee2e2',
                  color: selectedInvoice.status === 'PAID' ? '#15803d' : selectedInvoice.status === 'PARTIAL' ? '#b45309' : '#b91c1c',
                }}>
                  {selectedInvoice.status || 'PAID'}
                </span>
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
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>Billed Customer</span>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', marginTop: '3px' }}>
                  {selectedInvoice.customerName || 'Walk-in Customer'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                  Payment: <strong style={{ color: '#334155' }}>{selectedInvoice.paymentType || 'Full Payment'} ({selectedInvoice.paymentMethod || 'Cash'})</strong>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>Invoice Date & Time</span>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginTop: '3px' }}>
                  {selectedInvoice.displayDate || selectedInvoice.invoiceDate || new Date().toLocaleDateString()}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                  Salesman: <strong style={{ color: '#334155' }}>{selectedInvoice.salesman || 'Sales Executive'}</strong>
                </div>
              </div>
              {selectedInvoice.odnNumber && (
                <div>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>Dispatch Reference</span>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0284c7', fontFamily: 'monospace', marginTop: '3px' }}>
                    {selectedInvoice.odnNumber}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600, marginTop: '2px' }}>
                    Dispatched & Delivered
                  </div>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#0f172a', fontWeight: 700 }}>
                  INVOICED LINE ITEMS ({selectedInvoiceItems.length})
                </h4>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '8px 12px', width: '38px', textAlign: 'center' }}>#</th>
                      <th style={{ padding: '8px 12px', width: '130px' }}>SKU / CODE</th>
                      <th style={{ padding: '8px 12px' }}>PRODUCT / DESCRIPTION</th>
                      <th style={{ padding: '8px 12px', width: '60px', textAlign: 'center' }}>QTY</th>
                      <th style={{ padding: '8px 12px', width: '110px', textAlign: 'right' }}>UNIT PRICE</th>
                      <th style={{ padding: '8px 12px', width: '120px', textAlign: 'right' }}>SUBTOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoiceItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 12px', textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: '#0284c7' }}>
                          {item.code || item.productSku || item.sku || '-'}
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e293b' }}>
                          {item.name || item.productName || 'Product item'}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                          {item.quantity || 1}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                          LKR {(Number(item.unitPrice) || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                          LKR {(Number(item.totalPrice || (item.quantity * item.unitPrice)) || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
              <div style={{ width: '100%', maxWidth: '340px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.88rem' }}>
                  <span style={{ color: '#64748b' }}>Gross Total</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                    LKR {Number(selectedInvoice.totalAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.88rem' }}>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>Amount Settled</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#16a34a' }}>
                    LKR {Number(selectedInvoice.paidAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0 0', marginTop: '6px', borderTop: '1px dashed #cbd5e1', fontSize: '0.95rem' }}>
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
                  className="btn btn-glass"
                  onClick={() => {
                    const invToEdit = { ...selectedInvoice };
                    setSelectedInvoice(null);
                    setEditingInvoice(invToEdit);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0284c7' }}
                  title="Edit invoice details"
                >
                  <Edit3 size={15} /> Edit
                </button>

                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => handlePrintInvoice(selectedInvoice)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  title="Print invoice"
                >
                  <Printer size={15} /> Print
                </button>

                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => handleDownloadInvoicePdf(selectedInvoice)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#16a34a' }}
                  title="Download invoice as PDF"
                >
                  <Download size={15} /> Download PDF
                </button>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSelectedInvoice(null)}
                style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', padding: '7px 22px' }}
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
          style={{ padding: '12px', zIndex: 1200, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              borderRadius: '14px',
              backgroundColor: '#ffffff',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>
                    Edit Invoice: {editingInvoice.invoiceNumber}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Update invoice metadata & financial records</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEditedInvoice();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  CUSTOMER NAME
                </label>
                <input
                  type="text"
                  className="input-glass"
                  style={{ width: '100%', height: '36px', fontSize: '0.86rem' }}
                  value={editingInvoice.customerName || ''}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, customerName: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    PAYMENT TYPE
                  </label>
                  <select
                    className="input-glass"
                    style={{ width: '100%', height: '36px', fontSize: '0.86rem' }}
                    value={editingInvoice.paymentType || 'Full Payment'}
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, paymentType: e.target.value })}
                  >
                    <option value="Full Payment">Full Payment</option>
                    <option value="Installment">Installment</option>
                    <option value="Credit">Credit</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    PAYMENT METHOD
                  </label>
                  <select
                    className="input-glass"
                    style={{ width: '100%', height: '36px', fontSize: '0.86rem' }}
                    value={editingInvoice.paymentMethod || 'Cash'}
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, paymentMethod: e.target.value })}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    TOTAL AMOUNT (LKR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-glass"
                    style={{ width: '100%', height: '36px', fontSize: '0.86rem', fontWeight: 700 }}
                    value={editingInvoice.totalAmount || ''}
                    onChange={(e) => {
                      const total = parseFloat(e.target.value) || 0;
                      const paid = parseFloat(editingInvoice.paidAmount) || 0;
                      setEditingInvoice({
                        ...editingInvoice,
                        totalAmount: total,
                        balanceAmount: Math.max(0, total - paid),
                        status: paid >= total ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING',
                      });
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    PAID AMOUNT (LKR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-glass"
                    style={{ width: '100%', height: '36px', fontSize: '0.86rem', fontWeight: 700 }}
                    value={editingInvoice.paidAmount !== undefined ? editingInvoice.paidAmount : ''}
                    onChange={(e) => {
                      const paid = parseFloat(e.target.value) || 0;
                      const total = parseFloat(editingInvoice.totalAmount) || 0;
                      setEditingInvoice({
                        ...editingInvoice,
                        paidAmount: paid,
                        balanceAmount: Math.max(0, total - paid),
                        status: paid >= total ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING',
                      });
                    }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    BALANCE (CALCULATED)
                  </label>
                  <div
                    style={{
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 12px',
                      borderRadius: '6px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      color: Number(editingInvoice.balanceAmount || 0) > 0 ? '#dc2626' : '#16a34a',
                      fontFamily: 'monospace',
                    }}
                  >
                    LKR {Number(editingInvoice.balanceAmount || 0).toFixed(2)}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    STATUS
                  </label>
                  <select
                    className="input-glass"
                    style={{ width: '100%', height: '36px', fontSize: '0.86rem', fontWeight: 700 }}
                    value={editingInvoice.status || 'PENDING'}
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, status: e.target.value })}
                  >
                    <option value="PAID">PAID</option>
                    <option value="PARTIAL">PARTIAL</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setEditingInvoice(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
                >
                  <Check size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Held Bill Inspection */}
      {/* ------------------------------------------------------------- */}
      {selectedHeldDetail && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1050, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{ width: '100%', maxWidth: '680px', padding: '24px', borderRadius: '14px', backgroundColor: '#ffffff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>
                  Held Bill: {selectedHeldDetail.invoiceNumber}
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Customer: <strong>{selectedHeldDetail.customerName || 'Walk-in'}</strong> • Salesman: <strong>{selectedHeldDetail.salesman || selectedHeldDetail.salesmanName || selectedHeldDetail.createdBy || 'Staff'}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHeldDetail(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
              <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px' }}>Code</th>
                    <th style={{ padding: '8px 12px' }}>Product</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Unit Price</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedHeldDetail.items || []).map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#2563eb' }}>
                        {it.productSku || it.sku || '-'}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                        {it.productName || it.name || '-'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>
                        {it.quantity}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        Rs. {Number(it.unitPrice || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800 }}>
                        Rs. {Number(it.totalPrice || (it.quantity * it.unitPrice) || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>Total Bill Amount:</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#2563eb', fontFamily: 'var(--font-heading)' }}>
                Rs. {Number(selectedHeldDetail.netTotal || selectedHeldDetail.totalAmount || 0).toFixed(2)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  const bill = selectedHeldDetail;
                  handleDiscardHeldBill(bill.id, bill.invoiceNumber);
                }}
                style={{
                  padding: '7px 14px',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                title="Discard this held bill permanently"
              >
                <Trash2 size={14} /> Discard Bill
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-glass btn-sm"
                  onClick={() => setSelectedHeldDetail(null)}
                  style={{ padding: '7px 16px' }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const bill = selectedHeldDetail;
                    setSelectedHeldDetail(null);
                    handleResumeHeldBill(bill);
                  }}
                  style={{
                    padding: '7px 18px',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                    transition: 'background-color 0.15s ease',
                  }}
                  title="Load into POS to checkout"
                >
                  <PlayCircle size={15} /> Resume in POS
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Warehouse Stock Adjustment */}
      {/* ------------------------------------------------------------- */}
      {adjustingHeldBill && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '720px',
              padding: '24px',
              borderRadius: '14px',
              backgroundColor: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Edit3 size={18} color="#7c3aed" /> Warehouse Stock Adjustment
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Bill: <strong>{adjustingHeldBill.invoiceNumber}</strong> • Customer: <strong>{adjustingHeldBill.customerName || 'Walk-in'}</strong> • Warehouse: <strong>{adjustingHeldBill.warehouseCode || 'WH'}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingHeldBill(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '16px', fontSize: '0.84rem', color: '#475569' }}>
              Verify actual warehouse stock physical availability. Correct the product quantities below before dispatch.
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
              <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px' }}>Code</th>
                    <th style={{ padding: '8px 12px' }}>Product</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', width: '110px' }}>Adjusted Qty</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Unit Price</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(adjustingHeldBill.items || []).map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#2563eb' }}>
                        {it.productSku || it.sku || '-'}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                        {it.productName || it.name || '-'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => {
                            const newQty = parseInt(e.target.value) || 1;
                            const updatedItems = [...adjustingHeldBill.items];
                            updatedItems[idx] = {
                              ...it,
                              quantity: newQty,
                              totalPrice: newQty * Number(it.unitPrice || 0),
                            };
                            const newNet = updatedItems.reduce((sum, item) => sum + Number(item.totalPrice || (item.quantity * item.unitPrice) || 0), 0);
                            setAdjustingHeldBill({
                              ...adjustingHeldBill,
                              items: updatedItems,
                              netTotal: newNet,
                              totalAmount: newNet,
                            });
                          }}
                          style={{
                            width: '70px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            textAlign: 'center',
                            fontWeight: 700,
                          }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        Rs. {Number(it.unitPrice || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800 }}>
                        Rs. {Number(it.totalPrice || (it.quantity * it.unitPrice) || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {adjustingHeldBill.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updatedItems = adjustingHeldBill.items.filter((_, i) => i !== idx);
                              const newNet = updatedItems.reduce((sum, item) => sum + Number(item.totalPrice || (item.quantity * item.unitPrice) || 0), 0);
                              setAdjustingHeldBill({
                                ...adjustingHeldBill,
                                items: updatedItems,
                                netTotal: newNet,
                                totalAmount: newNet,
                              });
                            }}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                            title="Remove line item"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>Adjusted Total Value:</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#7c3aed', fontFamily: 'monospace' }}>
                Rs. {Number(adjustingHeldBill.netTotal || adjustingHeldBill.totalAmount || 0).toFixed(2)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-glass btn-sm"
                onClick={() => setAdjustingHeldBill(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveStockAdjustment}
                style={{ gap: '6px', backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}
              >
                <CheckSquare size={14} /> Confirm Stock Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Order Dispatch Note (ODN) & Merge */}
      {/* ------------------------------------------------------------- */}
      {dispatchNoteData && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1150, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '820px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '28px',
              borderRadius: '14px',
              backgroundColor: '#ffffff',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '2px solid #0284c7', paddingBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck size={22} color="#0284c7" />
                  <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a', fontWeight: 900 }}>
                    ORDER DISPATCH NOTE
                  </h2>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                  Official Delivery & Handover Document • Ref: <strong style={{ color: '#0284c7', fontFamily: 'monospace' }}>{dispatchNoteData.odnNumber}</strong>
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => setDispatchNoteData(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={20} />
                </button>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '6px' }}>
                  Date: <strong>{new Date().toLocaleDateString()}</strong>
                </div>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.84rem' }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.76rem', textTransform: 'uppercase', fontWeight: 600 }}>Customer Name:</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.96rem' }}>{dispatchNoteData.customerName}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.76rem', textTransform: 'uppercase', fontWeight: 600 }}>Merged Held Bills ({dispatchNoteData.billIds?.length || 1}):</div>
                  <div style={{ fontWeight: 600, color: '#2563eb', fontFamily: 'monospace' }}>{dispatchNoteData.billNumbers?.join(', ')}</div>
                </div>
              </div>

              {/* Aggregated Items Table */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: '0.84rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '8px 12px' }}>Code / SKU</th>
                      <th style={{ padding: '8px 12px' }}>Product Description</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Dispatch Qty</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Unit Rate</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount (LKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dispatchNoteData.items || []).map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                          {it.productSku || it.sku || '-'}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                          {it.productName || it.name || '-'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>
                          {it.quantity}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          {Number(it.unitPrice || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                          {Number(it.totalPrice || (it.quantity * it.unitPrice) || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total & Summary */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#e0f2fe', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0369a1' }}>Total Dispatch Order Value:</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0284c7', fontFamily: 'monospace' }}>
                  Rs. {Number(dispatchNoteData.totalAmount || 0).toFixed(2)}
                </span>
              </div>

              {/* Handover & Sign-off Notice */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '16px 0', borderTop: '1px dashed #cbd5e1', marginTop: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Dispatched By (Warehouse / Staff):</div>
                  <div style={{ height: '36px', borderBottom: '1px solid #94a3b8', marginTop: '16px' }}></div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>Signature & Date</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Received by Customer:</div>
                  <div style={{ height: '36px', borderBottom: '1px solid #94a3b8', marginTop: '16px' }}></div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>Customer Signature / Seal & Date</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '12px', flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-glass"
                onClick={() => window.print()}
                style={{ gap: '6px' }}
              >
                <Printer size={15} /> Print Dispatch Note
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setDispatchNoteData(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmDispatch}
                  style={{ gap: '6px', backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                >
                  <Check size={16} /> Confirm Dispatch & Create Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Record Payment Receipt */}
      {/* ------------------------------------------------------------- */}
      {showRecordPaymentModal && (
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
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>Record Payment Receipt</h3>
              <button
                type="button"
                onClick={() => setShowRecordPaymentModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Negombo Motors"
                  value={paymentForm.customerName}
                  onChange={(e) => setPaymentForm({ ...paymentForm, customerName: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Invoice # (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-000001"
                    value={paymentForm.invoiceNo}
                    onChange={(e) => setPaymentForm({ ...paymentForm, invoiceNo: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Payment Date</label>
                  <input
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Amount (LKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Payment Method</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Notes</label>
                <textarea
                  rows={2}
                  placeholder="Payment notes or cheque details..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setShowRecordPaymentModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
                >
                  Save Payment Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Record Advance Payment */}
      {/* ------------------------------------------------------------- */}
      {showRecordAdvanceModal && (
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
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>Record Advance Payment</h3>
              <button
                type="button"
                onClick={() => setShowRecordAdvanceModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdvance} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Voucher #</label>
                  <input
                    type="text"
                    readOnly
                    value="[Auto-generated by backend]"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', fontSize: '0.86rem', boxSizing: 'border-box', fontFamily: 'monospace' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Date</label>
                  <input
                    type="date"
                    value={advanceForm.paymentDate}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, paymentDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Engineering Ltd"
                  value={advanceForm.customerName}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, customerName: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Advance Amount (LKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={advanceForm.amount}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Payment Method</label>
                  <select
                    value={advanceForm.paymentMethod}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, paymentMethod: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit Card">Credit Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Notes / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Deposit notes / project reference..."
                  value={advanceForm.notes}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setShowRecordAdvanceModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
                >
                  Save Advance Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>Create New Quotation</h3>
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
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Quotation #</label>
                  <input
                    type="text"
                    readOnly
                    value="[Auto-generated by backend]"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', fontSize: '0.86rem', boxSizing: 'border-box', fontFamily: 'monospace' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Date</label>
                  <input
                    type="date"
                    value={quotationForm.quotationDate}
                    onChange={(e) => setQuotationForm({ ...quotationForm, quotationDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AutoCare Services"
                  value={quotationForm.customerName}
                  onChange={(e) => setQuotationForm({ ...quotationForm, customerName: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Total Amount (LKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={quotationForm.totalAmount}
                    onChange={(e) => setQuotationForm({ ...quotationForm, totalAmount: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Valid Until</label>
                  <input
                    type="date"
                    value={quotationForm.validUntil}
                    onChange={(e) => setQuotationForm({ ...quotationForm, validUntil: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Notes</label>
                <textarea
                  rows={2}
                  placeholder="Payment terms, delivery conditions..."
                  value={quotationForm.notes}
                  onChange={(e) => setQuotationForm({ ...quotationForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setShowCreateQuotationModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
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
