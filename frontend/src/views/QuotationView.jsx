import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Printer,
  CheckCircle,
  RefreshCw,
  RotateCcw,
  X,
  Calendar,
  Edit2,
  Trash2,
  Eye,
  AlertTriangle,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { quotationApi, customerApi, productApi, inventoryApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { canEditModule } from '../utils/permissionUtils';
import { usePurchasingStatusChange } from '../hooks/usePurchasingStatusChange';
import { formatBusinessDate } from '../utils/invoiceMapping';
import { readNumericInput } from '../utils/numericInput';
import { printA4Report } from '../utils/printReport';
import DateRangePicker, { matchesDateRange } from '../components/DateRangePicker';
import DatePicker from '../components/DatePicker';
import FilterSelect from '../components/FilterSelect';
import StatusBadge from '../components/StatusBadge';
import PurchaseProductSearch from '../components/PurchaseProductSearch';
import CustomerSearch from '../components/CustomerSearch';
import QuotationDetailsModal from '../components/QuotationDetailsModal';
import './QuotationView.css';
import '../components/PurchasingAppearance.css';

const INITIAL_STAGING_ITEM = {
  productId: '',
  productCode: '',
  productName: '',
  unitOfMeasure: 'PCS',
  quantity: 1,
  currentQuantity: null,
  stockLoading: false,
  unitPrice: 0,
  currentSellingPrice: null,
  costPrice: null,
  discountRate: 0,
  discountAmount: 0,
  lineTotal: 0,
};

const INITIAL_FORM_DATA = {
  quotationNumber: '',
  quotationDate: formatBusinessDate(),
  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  customerId: '',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  status: 'PENDING',
  notes: '',
  terms: '',
  items: [],
};

const QuotationView = React.forwardRef(function QuotationView(props, ref) {
  const { user } = useAuth();
  const canManage = canEditModule(user, 'QUOTATION') || (user?.permissions || []).includes('QUOTATION_MANAGE') || (user?.permissions || []).includes('SALES_CREATE');

  const [showQuotationForm, setShowQuotationForm] = useState(false);
  useEffect(() => {
    props.onFormModeChange?.(showQuotationForm);
  }, [showQuotationForm, props.onFormModeChange]);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [quotations, setQuotations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingQuotationId, setEditingQuotationId] = useState(null);
  const [editingQuotationStatus, setEditingQuotationStatus] = useState(null);

  // Staging line workstation
  const [stagingItem, setStagingItem] = useState({ ...INITIAL_STAGING_ITEM });
  const [editingLineIndex, setEditingLineIndex] = useState(null);
  const [productQuery, setProductQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productSearchRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({ ...INITIAL_FORM_DATA });

  // Inspection modal
  const [selectedQuotation, setSelectedQuotation] = useState(null);

  const { addToast } = useToast();
  const { requestStatusChange, statusChangeDialog } = usePurchasingStatusChange();

  const resetStagingItem = () => {
    setEditingLineIndex(null);
    setStagingItem({ ...INITIAL_STAGING_ITEM });
    setProductQuery('');
    setShowProductDropdown(false);
  };

  const resetAllForm = () => {
    setEditingQuotationId(null);
    setEditingQuotationStatus(null);
    setFormData({
      ...INITIAL_FORM_DATA,
      quotationDate: formatBusinessDate(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: [],
    });
    resetStagingItem();
  };

  React.useImperativeHandle(ref, () => ({
    openCreate: () => {
      resetAllForm();
      setShowQuotationForm(true);
    },
    openList: () => setShowQuotationForm(false),
    refresh: loadData,
  }));

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (productSearchRef.current && !productSearchRef.current.contains(e.target)) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [quotRes, custRes, prodRes] = await Promise.all([
        quotationApi.search({ size: 200 }),
        customerApi.getActive().catch(() => ({ data: [] })),
        productApi.getProducts({ size: 300, activeOnly: true }).catch(() => ({ data: [] })),
      ]);

      const qList = quotRes.data?.content || quotRes.data || [];
      const cList = custRes.data || [];
      const pList = prodRes.data?.content || prodRes.data || [];

      setQuotations(qList);
      setCustomers(cList);
      setProducts(pList);
    } catch (err) {
      console.error('Failed to load quotation data:', err);
      addToast('Failed to load quotations: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtered products for search
  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter((p) => {
      const sku = (p.sku || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      return sku.includes(query) || name.includes(query) || barcode.includes(query);
    });
  }, [products, productQuery]);

  // Select product for staging
  const selectProductForStaging = async (product) => {
    setProductQuery(product.name);
    setShowProductDropdown(false);

    const unitPrice = Number(product.sellingPrice || 0);
    const costPrice = product.costPrice != null ? Number(product.costPrice) : null;
    const qty = stagingItem.quantity > 0 ? stagingItem.quantity : 1;
    const gross = qty * unitPrice;
    const discAmt = stagingItem.discountRate > 0 ? (gross * stagingItem.discountRate) / 100 : stagingItem.discountAmount;
    const lineTotal = Math.max(0, gross - discAmt);

    setStagingItem((prev) => ({
      ...prev,
      productId: product.id,
      productCode: product.sku || '',
      productName: product.name,
      unitOfMeasure: product.unitOfMeasure || 'PCS',
      quantity: qty,
      unitPrice: unitPrice,
      currentSellingPrice: unitPrice,
      costPrice: costPrice,
      currentQuantity: product.availableQuantity ?? product.stockQuantity ?? 0,
      discountAmount: discAmt,
      lineTotal: lineTotal,
    }));
  };

  // Staging change handlers
  const handleStagingChange = (field, val) => {
    setStagingItem((prev) => {
      const updated = { ...prev, [field]: val };
      const qty = field === 'quantity' ? Number(val || 0) : Number(prev.quantity || 0);
      const price = field === 'unitPrice' ? Number(val || 0) : Number(prev.unitPrice || 0);
      const gross = qty * price;

      let discRate = prev.discountRate;
      let discAmt = prev.discountAmount;

      if (field === 'discountRate') {
        discRate = Number(val || 0);
        discAmt = (gross * discRate) / 100;
      } else if (field === 'discountAmount') {
        discAmt = Number(val || 0);
        discRate = gross > 0 ? (discAmt / gross) * 100 : 0;
      } else {
        // Recalculate discount amount based on current discount rate
        discAmt = (gross * Number(discRate || 0)) / 100;
      }

      const total = Math.max(0, gross - discAmt);

      return {
        ...updated,
        quantity: qty,
        unitPrice: price,
        discountRate: Number(discRate.toFixed(2)),
        discountAmount: Number(discAmt.toFixed(2)),
        lineTotal: Number(total.toFixed(2)),
      };
    });
  };

  // Add / Update item in quotation
  const handleAddItemToQuotation = () => {
    if (!stagingItem.productId && !stagingItem.productName) {
      addToast('Please select a product first', 'warning');
      return;
    }
    if (stagingItem.quantity <= 0) {
      addToast('Quantity must be greater than 0', 'warning');
      return;
    }

    const newItem = {
      productId: stagingItem.productId || null,
      productSku: stagingItem.productCode || '—',
      productName: stagingItem.productName || 'Quoted Product',
      quantity: stagingItem.quantity,
      unitPrice: stagingItem.unitPrice,
      discountRate: stagingItem.discountRate || 0,
      discountAmount: stagingItem.discountAmount || 0,
      totalPrice: stagingItem.lineTotal,
    };

    setFormData((prev) => {
      const items = [...prev.items];
      if (editingLineIndex !== null) {
        items[editingLineIndex] = newItem;
      } else {
        const existingIdx = items.findIndex((it) => it.productId && it.productId === newItem.productId);
        if (existingIdx >= 0) {
          const existing = items[existingIdx];
          const newQty = existing.quantity + newItem.quantity;
          const gross = newQty * newItem.unitPrice;
          const disc = (gross * (newItem.discountRate || 0)) / 100;
          items[existingIdx] = {
            ...existing,
            quantity: newQty,
            unitPrice: newItem.unitPrice,
            discountRate: newItem.discountRate,
            discountAmount: disc,
            totalPrice: Math.max(0, gross - disc),
          };
        } else {
          items.push(newItem);
        }
      }
      return { ...prev, items };
    });

    resetStagingItem();
  };

  const handleEditItem = (index) => {
    const item = formData.items[index];
    if (!item) return;
    setEditingLineIndex(index);
    setStagingItem({
      productId: item.productId || '',
      productCode: item.productSku || '',
      productName: item.productName || '',
      unitOfMeasure: 'PCS',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      currentSellingPrice: item.unitPrice,
      costPrice: null,
      currentQuantity: null,
      stockLoading: false,
      discountRate: item.discountRate || 0,
      discountAmount: item.discountAmount || 0,
      lineTotal: item.totalPrice,
    });
    setProductQuery(item.productName || '');
  };

  const handleRemoveItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
    if (editingLineIndex === index) {
      resetStagingItem();
    }
  };

  // Customer selection
  const handleCustomerChange = (customerId) => {
    const cust = customers.find((c) => String(c.id) === String(customerId));
    setFormData((prev) => ({
      ...prev,
      customerId: customerId || '',
      customerName: cust ? cust.name : prev.customerName,
      customerPhone: cust ? cust.phone : prev.customerPhone,
      customerEmail: cust ? cust.email : prev.customerEmail,
    }));
  };

  const handleSelectCustomer = (customer) => {
    if (customer) {
      setFormData((prev) => ({
        ...prev,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone || '',
        customerEmail: customer.email || '',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        customerId: '',
      }));
    }
  };

  // Calculations for total cards
  const totals = useMemo(() => {
    const subtotal = formData.items.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
    const discountAmount = formData.items.reduce((acc, it) => acc + Number(it.discountAmount || 0), 0);
    const netTotal = Math.max(0, subtotal - discountAmount);
    const totalUnits = formData.items.reduce((acc, it) => acc + Number(it.quantity || 0), 0);
    return {
      subtotal,
      discountAmount,
      netTotal,
      totalUnits,
    };
  }, [formData.items]);

  // Save Quotation (Create or Update)
  const handleSaveQuotation = async () => {
    if (!formData.customerId && !formData.customerName.trim()) {
      addToast('Please select or specify a customer', 'warning');
      return;
    }
    if (formData.items.length === 0) {
      addToast('Please add at least one line item to the quotation', 'warning');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        customerId: formData.customerId ? Number(formData.customerId) : null,
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone || null,
        customerEmail: formData.customerEmail || null,
        quotationDate: formData.quotationDate || formatBusinessDate(),
        validUntil: formData.validUntil || null,
        discountAmount: totals.discountAmount,
        totalAmount: totals.netTotal,
        status: formData.status || 'PENDING',
        notes: formData.notes || null,
        terms: formData.terms || null,
        items: formData.items.map((it) => ({
          productId: it.productId ? Number(it.productId) : null,
          productSku: it.productSku,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountRate: it.discountRate || 0,
          discountAmount: it.discountAmount || 0,
          totalPrice: it.totalPrice,
        })),
      };

      if (editingQuotationId) {
        await quotationApi.update(editingQuotationId, payload);
        addToast(`Quotation updated successfully!`, 'success');
      } else {
        const res = await quotationApi.create(payload);
        const created = res.data?.data || res.data;
        addToast(`Quotation ${created.quotationNumber || created.quotationNo || ''} created successfully!`, 'success');
      }

      setShowQuotationForm(false);
      resetAllForm();
      await loadData();
    } catch (err) {
      console.error('Failed to save quotation:', err);
      addToast(err.response?.data?.message || 'Failed to save quotation', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Edit existing quotation
  const handleEditQuotation = (quotation) => {
    if (quotation.status === 'CANCELLED' || quotation.status === 'CONVERTED') {
      addToast(`Cannot edit a ${quotation.status.toLowerCase()} quotation`, 'warning');
      return;
    }
    setEditingQuotationId(quotation.id);
    setEditingQuotationStatus(quotation.status);
    setFormData({
      quotationNumber: quotation.quotationNumber || quotation.quotationNo || '',
      quotationDate: quotation.quotationDate || quotation.date || formatBusinessDate(),
      validUntil: quotation.validUntil || '',
      customerId: quotation.customerId || '',
      customerName: quotation.customerName || '',
      customerPhone: quotation.customerPhone || '',
      customerEmail: quotation.customerEmail || '',
      status: quotation.status || 'PENDING',
      notes: quotation.notes || '',
      terms: quotation.terms || '',
      items: (quotation.items || []).map((it) => ({
        productId: it.productId,
        productSku: it.productSku || '—',
        productName: it.productName || 'Quoted Item',
        quantity: it.quantity || 1,
        unitPrice: Number(it.unitPrice || 0),
        discountRate: Number(it.discountRate || 0),
        discountAmount: Number(it.discountAmount || 0),
        totalPrice: Number(it.totalPrice || (it.quantity * it.unitPrice)),
      })),
    });
    resetStagingItem();
    setSelectedQuotation(null);
    setShowQuotationForm(true);
  };

  // Convert to Invoice
  const handleConvertToInvoice = async (quotation) => {
    if (quotation.status === 'CANCELLED') {
      addToast('Cannot convert cancelled quotation', 'warning');
      return;
    }
    try {
      const res = await quotationApi.convertToInvoice(quotation.id);
      const invoice = res.data?.data || res.data;
      addToast(`Quotation ${quotation.quotationNumber || quotation.quotationNo} converted to Invoice ${invoice?.invoiceNumber}!`, 'success');
      setSelectedQuotation(null);
      await loadData();
      props.onConvertToInvoice?.(invoice);
    } catch (err) {
      console.error('Failed to convert quotation:', err);
      addToast(err.response?.data?.message || 'Failed to convert quotation to invoice', 'error');
    }
  };

  // Cancel Quotation with mandatory reason
  const handleCancelQuotation = (quotation) => {
    if (quotation.status === 'CANCELLED') {
      addToast('Quotation is already cancelled', 'info');
      return;
    }
    if (quotation.status === 'CONVERTED') {
      addToast('Cannot cancel quotation that has already been converted to an invoice', 'warning');
      return;
    }

    requestStatusChange({
      type: 'Quotation',
      number: quotation.quotationNumber || quotation.quotationNo,
      current: quotation.status,
      target: 'CANCELLED',
      description: 'Enter the reason for cancelling this quotation. This will be permanently recorded in the audit log.',
      onConfirm: async (reason) => {
        await quotationApi.cancel(quotation.id, { reason });
        addToast(`Quotation ${quotation.quotationNumber || quotation.quotationNo} has been cancelled`, 'success');
        setSelectedQuotation(null);
        await loadData();
      },
    });
  };

  // Filtered quotations for directory
  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      if (statusFilter !== 'ALL' && q.status !== statusFilter) return false;
      const dateVal = q.quotationDate || q.date;
      if (fromDate && toDate && dateVal && !matchesDateRange(dateVal, fromDate, toDate)) return false;
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const number = (q.quotationNumber || q.quotationNo || '').toLowerCase();
        const cust = (q.customerName || '').toLowerCase();
        const phone = (q.customerPhone || '').toLowerCase();
        return number.includes(query) || cust.includes(query) || phone.includes(query);
      }
      return true;
    });
  }, [quotations, statusFilter, fromDate, toDate, searchTerm]);

  // A4 print single quotation
  const handlePrintQuotation = (qt) => {
    const escapeText = (value) =>
      String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[char]));

    printA4Report({
      title: `Customer Quotation ${escapeText(qt.quotationNumber || qt.quotationNo)}`,
      metaItems: [
        { label: 'Status', value: escapeText(qt.status) },
        { label: 'Customer', value: escapeText(qt.customerName || 'Walk-in') },
        { label: 'Quotation Date', value: escapeText(qt.quotationDate || qt.date || '—') },
        { label: 'Valid Until', value: escapeText(qt.validUntil || '—') },
        { label: 'Total Amount', value: `LKR ${Number(qt.totalAmount || 0).toFixed(2)}` },
      ],
      columns: [
        { header: '#', accessor: 'num', align: 'center' },
        { header: 'Product Code', accessor: 'code', align: 'left' },
        { header: 'Product Name', accessor: 'name', align: 'left' },
        { header: 'Qty', accessor: 'qty', align: 'right' },
        { header: 'Unit Price', accessor: 'price', align: 'right' },
        { header: 'Discount', accessor: 'discount', align: 'right' },
        { header: 'Total (LKR)', accessor: 'total', align: 'right' },
      ],
      data: (qt.items || []).map((item, idx) => ({
        num: String(idx + 1),
        code: escapeText(item.productSku || '—'),
        name: escapeText(item.productName || '—'),
        qty: String(item.quantity || 1),
        price: Number(item.unitPrice || 0).toFixed(2),
        discount:
          Number(item.discountAmount || 0) > 0
            ? Number(item.discountAmount).toFixed(2)
            : item.discountRate
            ? item.discountRate + '%'
            : '0.00',
        total: Number(item.totalPrice || 0).toFixed(2),
      })),
    });
  };

  // A4 print directory
  const handlePrintDirectory = () => {
    printA4Report({
      title: 'Quotations Directory',
      metaItems: [
        { label: 'Total Quotations', value: String(filteredQuotations.length) },
        { label: 'Filter', value: statusFilter },
        { label: 'Date', value: new Date().toLocaleDateString() },
      ],
      columns: [
        { header: 'Quotation #', accessor: 'quotationNumber', align: 'left' },
        { header: 'Customer', accessor: 'customerName', align: 'left' },
        { header: 'Date', accessor: 'date', align: 'center' },
        { header: 'Valid Until', accessor: 'validUntil', align: 'center' },
        { header: 'Status', accessor: 'status', align: 'center' },
        { header: 'Total (LKR)', accessor: 'totalAmount', align: 'right' },
      ],
      data: filteredQuotations.map((q) => ({
        quotationNumber: q.quotationNumber || q.quotationNo,
        customerName: q.customerName || 'Walk-in',
        date: q.quotationDate || q.date || '—',
        validUntil: q.validUntil || '—',
        status: q.status,
        totalAmount: Number(q.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      })),
    });
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
      {!showQuotationForm ? (
        <>
          {/* GRN-Style Quotation Toolbar */}
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
            {/* Search Input */}
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
                className="erp-field"
                type="text"
                placeholder="Search quotations by quotation # or customer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
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

            {/* Date Range, Status Filter & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'nowrap' }}>
              <DateRangePicker
                from={fromDate}
                to={toDate}
                onChange={(from, to) => {
                  setFromDate(from);
                  setToDate(to);
                }}
                documentType="Quotations"
              />

              <FilterSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter quotations by status"
                style={{ width: '140px' }}
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
                <option value="CONVERTED">Converted</option>
                <option value="CANCELLED">Cancelled</option>
              </FilterSelect>

              {(searchTerm || statusFilter !== 'ALL' || fromDate || toDate) && (
                <button
                  className="erp-button"
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('ALL');
                    setFromDate('');
                    setToDate('');
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
                  <RotateCcw size={13} /> Reset
                </button>
              )}

              <button
                type="button"
                onClick={handlePrintDirectory}
                style={{
                  height: '38px',
                  width: '38px',
                  minWidth: '38px',
                  padding: 0,
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Print Quotations Directory (A4)"
                aria-label="Print Quotations Directory (A4)"
              >
                <Printer size={15} />
              </button>

              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                style={{
                  height: '38px',
                  width: '38px',
                  minWidth: '38px',
                  padding: 0,
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Refresh records"
                aria-label="Refresh records"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Directory Table matching GRN View */}
          <div
            className="erp-table-frame"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              overflow: 'hidden',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div className="erp-table-scroll" style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table className="erp-table" style={{ width: '100%', minWidth: '840px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>QUOTATION NUMBER</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>TOTAL PRODUCTS</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DATE</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>VALID UNTIL</th>
                    <th className="erp-table-heading" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>TOTAL AMOUNT</th>
                    <th className="erp-table-heading" style={{ textAlign: 'center', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                    <th className="erp-table-heading erp-table-actions" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="erp-table-cell" colSpan={8} style={{ textAlign: 'center', color: '#64748b' }}>
                        Loading quotation records...
                      </td>
                    </tr>
                  ) : filteredQuotations.length === 0 ? (
                    <tr>
                      <td className="erp-table-cell" colSpan={8} style={{ textAlign: 'center', color: '#64748b' }}>
                        No quotations found. Click <strong>+ New Quotation</strong> to create a new quotation.
                      </td>
                    </tr>
                  ) : (
                    filteredQuotations.map((qt) => (
                      <tr
                        key={qt.id}
                        onClick={() => setSelectedQuotation(qt)}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td className="erp-table-cell erp-table-code" style={{ fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                          {qt.quotationNumber || qt.quotationNo}
                        </td>
                        <td className="erp-table-cell" style={{ fontWeight: 600, color: '#0f172a' }}>
                          {qt.customerName || 'Walk-in'}
                        </td>
                        <td className="erp-table-cell" style={{ color: '#475569' }}>
                          {(qt.items || []).length} items
                        </td>
                        <td className="erp-table-cell" style={{ color: '#64748b' }}>
                          {qt.quotationDate || qt.date || '—'}
                        </td>
                        <td className="erp-table-cell" style={{ color: '#64748b' }}>
                          {qt.validUntil || '—'}
                        </td>
                        <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                          LKR {Number(qt.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="erp-table-cell" style={{ textAlign: 'center' }}>
                          <StatusBadge status={qt.status} />
                        </td>
                        <td className="erp-table-cell erp-table-actions" style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              className="erp-table-icon-action"
                              onClick={() => setSelectedQuotation(qt)}
                              title="Inspect quotation"
                              aria-label="Inspect quotation"
                            >
                              <Eye size={14} />
                            </button>

                            {canManage && qt.status !== 'CANCELLED' && qt.status !== 'CONVERTED' && (
                              <button
                                type="button"
                                className="erp-table-icon-action"
                                onClick={() => handleEditQuotation(qt)}
                                title="Edit quotation"
                                aria-label="Edit quotation"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}

                            <button
                              type="button"
                              className="erp-table-icon-action"
                              onClick={() => handlePrintQuotation(qt)}
                              title="Print quotation PDF"
                              aria-label="Print quotation PDF"
                            >
                              <Printer size={14} />
                            </button>

                            {canManage && qt.status !== 'CANCELLED' && qt.status !== 'CONVERTED' && (
                              <button
                                type="button"
                                className="erp-table-icon-action"
                                style={{ color: '#16a34a' }}
                                onClick={() => handleConvertToInvoice(qt)}
                                title="Convert to Commercial Invoice"
                                aria-label="Convert to Commercial Invoice"
                              >
                                <CheckCircle size={14} />
                              </button>
                            )}

                            {canManage && qt.status !== 'CANCELLED' && qt.status !== 'CONVERTED' && (
                              <button
                                type="button"
                                className="erp-table-icon-action"
                                data-tone="danger"
                                onClick={() => handleCancelQuotation(qt)}
                                title="Cancel quotation"
                                aria-label="Cancel quotation"
                              >
                                <RotateCcw size={14} />
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
        </>
      ) : (
        /* GRN-Style Create / Edit Quotation Workstation */
        <div className="quotation-page grn-page">
          <div className="quotation-page-content grn-page-content">
            {/* Header */}
            <div
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                flexShrink: 0,
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="erp-dialog-title" style={{ color: '#0f172a', margin: 0 }}>
                    {editingQuotationId
                      ? `Edit Customer Quotation — ${formData.quotationNumber}`
                      : 'New Customer Quotation'}
                  </h2>
                  <p style={{ fontSize: 'var(--erp-text-small)', color: '#64748b', margin: '1px 0 0 0' }}>
                    Customer quotation workstation — line-item staging, pricing, discounts & invoice conversion
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowQuotationForm(false)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                  }}
                  title="Close workstation"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Workstation Body */}
            <div className="quotation-form-body grn-form-body">
              <div className="quotation-form-content grn-form-content">
                <div className="quotation-workspace grn-workspace">
                  {/* Left Workstation: Line Item Entry & Document Header */}
                  <div
                    className="quotation-entry grn-entry"
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      boxShadow: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {/* Product Search */}
                    <div ref={productSearchRef} className="purchase-search-group">
                      <PurchaseProductSearch
                        query={productQuery}
                        onQueryChange={setProductQuery}
                        results={filteredProducts.slice(0, 50)}
                        onSelect={selectProductForStaging}
                        selected={Boolean(stagingItem.productId)}
                        editing={editingLineIndex !== null}
                        open={showProductDropdown}
                        onOpenChange={setShowProductDropdown}
                        showWarehouse={false}
                        priceField="sellingPrice"
                        resultDetails={(p) => `Selling price: LKR ${Number(p.sellingPrice || 0).toFixed(2)}`}
                        resultQuantity={(p) => `${p.availableQuantity ?? p.stockQuantity ?? 0}`}
                        onClear={() => {
                          setProductQuery('');
                          resetStagingItem();
                        }}
                      />
                    </div>

                    {/* Product Summary Banner */}
                    {stagingItem.productId && (
                      <div className="quotation-product-summary grn-product-summary" aria-live="polite">
                        <div>
                          <span>Cost price</span>
                          <strong>
                            {stagingItem.costPrice == null
                              ? 'Unavailable'
                              : 'LKR ' + Number(stagingItem.costPrice).toFixed(2)}
                          </strong>
                        </div>
                        <div>
                          <span>Available stock</span>
                          <strong>
                            {stagingItem.currentQuantity == null
                              ? '0 PCS'
                              : stagingItem.currentQuantity + ' ' + stagingItem.unitOfMeasure}
                          </strong>
                        </div>
                        <div>
                          <span>Selling price</span>
                          <strong>
                            {'LKR ' + Number(stagingItem.currentSellingPrice || 0).toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    )}

                    {/* Line Item Inputs */}
                    <div className="quotation-line-fields grn-line-fields">
                      <label>
                        QUOTED QTY *
                        <input
                          className="input-glass erp-field"
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          onFocus={(e) => e.target.select()}
                          value={stagingItem.quantity}
                          onChange={(e) => handleStagingChange('quantity', readNumericInput(e))}
                        />
                      </label>

                      <label>
                        UNIT PRICE (LKR) *
                        <input
                          className="input-glass erp-field"
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          onFocus={(e) => e.target.select()}
                          value={stagingItem.unitPrice}
                          onChange={(e) => handleStagingChange('unitPrice', readNumericInput(e))}
                        />
                      </label>

                      <label>
                        DISCOUNT %
                        <input
                          className="input-glass erp-field"
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          inputMode="decimal"
                          onFocus={(e) => e.target.select()}
                          value={stagingItem.discountRate}
                          onChange={(e) => handleStagingChange('discountRate', readNumericInput(e))}
                        />
                      </label>

                      <label>
                        DISCOUNT (LKR)
                        <input
                          className="input-glass erp-field"
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          onFocus={(e) => e.target.select()}
                          value={stagingItem.discountAmount}
                          onChange={(e) => handleStagingChange('discountAmount', readNumericInput(e))}
                        />
                      </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0' }}>
                      <span style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b', fontWeight: 600 }}>LINE TOTAL</span>
                      <strong style={{ fontSize: 'var(--erp-text-body)', color: '#0284c7', fontFamily: 'monospace' }}>
                        LKR {Number(stagingItem.lineTotal || 0).toFixed(2)}
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary quotation-add-item grn-add-item erp-button"
                      disabled={!stagingItem.productId && !stagingItem.productName}
                      onClick={handleAddItemToQuotation}
                    >
                      {editingLineIndex === null ? <Plus size={16} /> : <Edit2 size={16} />}
                      {editingLineIndex === null ? 'Add to Quotation' : 'Update Line Item'}
                    </button>

                    {editingLineIndex !== null && (
                      <button type="button" className="btn btn-glass erp-button" onClick={resetStagingItem}>
                        Cancel line edit
                      </button>
                    )}

                    {/* Quotation Header Fields */}
                    <div className="quotation-header-fields grn-header-fields">
                      <CustomerSearch
                        customers={customers}
                        value={formData.customerId}
                        onChange={handleCustomerChange}
                        onSelectCustomer={handleSelectCustomer}
                        label="Customer *"
                        ariaLabel="Customer"
                        placeholder="Search active customer..."
                      />

                      <DatePicker
                        value={formData.quotationDate}
                        onChange={(date) => setFormData((prev) => ({ ...prev, quotationDate: date }))}
                        required
                        ariaLabel="Quotation date"
                        label="Quotation date *"
                        className="input-glass"
                      />

                      <DatePicker
                        value={formData.validUntil}
                        onChange={(date) => setFormData((prev) => ({ ...prev, validUntil: date }))}
                        ariaLabel="Valid until"
                        label="Valid until"
                        className="input-glass"
                      />

                      {editingQuotationId && (
                        <label>
                          Quotation Status
                          <select
                            className="input-glass erp-field"
                            value={formData.status}
                            onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="ACCEPTED">ACCEPTED</option>
                            <option value="REJECTED">REJECTED</option>
                          </select>
                        </label>
                      )}

                      <label className="quotation-entry-remarks grn-entry-remarks">
                        Remarks / Payment terms
                        <textarea
                          className="input-glass erp-field"
                          name="notes"
                          maxLength={5000}
                          rows={3}
                          placeholder="Quotation notes, warranty terms, delivery timeline..."
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Right Workstation: Quoted Items Table */}
                  <div className="quotation-items grn-items">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: 'var(--erp-text-body)', fontWeight: 800, color: '#1e293b' }}>
                        Quoted items ({formData.items.length})
                      </span>
                      <span
                        style={{
                          fontSize: 'var(--erp-text-small)',
                          color: '#475569',
                          fontWeight: 600,
                          background: '#f1f5f9',
                          padding: '3px 10px',
                          borderRadius: '6px',
                        }}
                      >
                        Quoted units: <strong style={{ color: '#0284c7' }}>{totals.totalUnits}</strong>
                      </span>
                    </div>

                    <div className="quotation-table-scroll grn-table-scroll erp-table-scroll erp-table-frame">
                      <table className="glass-table erp-table" style={{ margin: 0, minWidth: '640px', width: '100%' }}>
                        <thead>
                          <tr>
                            <th className="erp-table-heading">Product code</th>
                            <th className="erp-table-heading">Product name</th>
                            <th className="quotation-number grn-number erp-table-heading">Qty</th>
                            <th className="quotation-number grn-number erp-table-heading">Unit price</th>
                            <th className="quotation-number grn-number erp-table-heading">Discount</th>
                            <th className="quotation-number grn-number erp-table-heading">Line total</th>
                            <th className="quotation-number grn-number erp-table-heading erp-table-actions">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.items.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="quotation-empty grn-empty erp-table-cell">
                                Search a product and add it to the quotation.
                              </td>
                            </tr>
                          ) : (
                            formData.items.map((item, index) => (
                              <tr
                                key={item.productId || index}
                                className={editingLineIndex === index ? 'quotation-editing-row grn-editing-row' : ''}
                              >
                                <td className="erp-table-cell">
                                  <strong className="quotation-product-code grn-product-code">{item.productSku}</strong>
                                </td>
                                <td className="erp-table-cell">{item.productName || '—'}</td>
                                <td className="quotation-number grn-number erp-table-cell">{item.quantity}</td>
                                <td className="quotation-number grn-number erp-table-cell">
                                  LKR {Number(item.unitPrice || 0).toFixed(2)}
                                </td>
                                <td className="quotation-number grn-number erp-table-cell">
                                  {Number(item.discountAmount || 0) > 0
                                    ? 'LKR ' + Number(item.discountAmount).toFixed(2)
                                    : Number(item.discountRate || 0) > 0
                                    ? Number(item.discountRate) + '%'
                                    : '—'}
                                </td>
                                <td className="quotation-number grn-number erp-table-cell" style={{ fontWeight: 700, color: '#0f172a' }}>
                                  LKR {Number(item.totalPrice || 0).toFixed(2)}
                                </td>
                                <td className="quotation-number grn-number erp-table-cell erp-table-actions">
                                  <div className="quotation-row-actions grn-row-actions">
                                    <button
                                      className="erp-table-icon-action"
                                      type="button"
                                      title="Edit line"
                                      aria-label={`Edit item ${index + 1}`}
                                      onClick={() => handleEditItem(index)}
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      className="erp-table-icon-action"
                                      data-tone="danger"
                                      type="button"
                                      title="Remove line"
                                      aria-label={`Remove item ${index + 1}`}
                                      onClick={() => handleRemoveItem(index)}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Financial Summary Cards */}
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px 16px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: 'var(--erp-text-body)' }}>
                        <div>
                          <span style={{ color: '#64748b' }}>Subtotal: </span>
                          <strong style={{ color: '#0f172a' }}>LKR {totals.subtotal.toFixed(2)}</strong>
                        </div>
                        {totals.discountAmount > 0 && (
                          <div>
                            <span style={{ color: '#64748b' }}>Discount: </span>
                            <strong style={{ color: '#e11d48' }}>- LKR {totals.discountAmount.toFixed(2)}</strong>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 'var(--erp-text-section)', fontWeight: 800, color: '#0284c7' }}>
                        Net Total: LKR {totals.netTotal.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Workstation Footer Actions */}
                  <div
                    className="quotation-form-actions grn-form-actions"
                    style={{
                      padding: '12px 0 0 0',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <button
                      className="erp-button"
                      type="button"
                      onClick={() => setShowQuotationForm(false)}
                      style={{
                        padding: '8px 16px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      Back to Quotations
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveQuotation}
                      disabled={saving || formData.items.length === 0}
                      className="erp-button erp-button-primary"
                      style={{
                        padding: '8px 22px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#0284c7',
                        color: '#ffffff',
                        fontSize: 'var(--erp-text-button)',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {saving
                        ? 'Saving...'
                        : editingQuotationId
                        ? 'Update Quotation'
                        : 'Create Quotation'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inspection Modal */}
      {selectedQuotation && (
        <QuotationDetailsModal
          quotation={selectedQuotation}
          onClose={() => setSelectedQuotation(null)}
          onPrint={() => handlePrintQuotation(selectedQuotation)}
          onEdit={() => handleEditQuotation(selectedQuotation)}
          onConvert={() => handleConvertToInvoice(selectedQuotation)}
          onCancel={() => handleCancelQuotation(selectedQuotation)}
          canManage={canManage}
        />
      )}

      {/* Status Change / Cancellation Reason Dialog */}
      {statusChangeDialog}
    </div>
  );
});

export default QuotationView;
