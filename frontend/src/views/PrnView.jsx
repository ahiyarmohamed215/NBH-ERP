import PurchaseLines from '../components/PurchaseLines';
import { formatBusinessDate } from '../utils/invoiceMapping';
import React, { useState, useEffect } from 'react';
import { prnApi, supplierApi, warehouseApi, productApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  RotateCcw,
  Plus,
  Search,
  CheckCircle,
  RefreshCw,
  Edit2,
  Printer,
  X,
  Package,
  Download,
} from 'lucide-react';

const COMMON_REASONS = [
  'Defective batch / Damaged on arrival',
  'Incorrect items / wrong specification',
  'Quality inspection rejection',
  'Excess stock / over-supplied',
  'Near expiry / damaged packaging',
  'Other supplier return',
];

const PrnView = React.forwardRef(function PrnView(props, ref) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  useEffect(() => { props.onFormModeChange?.(showCreateForm); }, [showCreateForm, props.onFormModeChange]);
  const [prns, setPrns] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [saving, setSaving] = useState(false);

  React.useImperativeHandle(ref, () => ({
    openCreate: () => {
      resetForm();
      setShowCreateForm(true);
    },
    focusForm: () => {
      resetForm();
      setShowCreateForm(true);
    },
    refresh: loadData,
  }));

  // Split-view Left Panel Form State
  const [formData, setFormData] = useState({
    supplierId: '',
    warehouseId: '',
    originalGrnNumber: '',
    reason: COMMON_REASONS[0],
    remarks: '',
    items: [],
  });

  // Inspection modal state for viewing an existing PRN
  const [selectedPrn, setSelectedPrn] = useState(null);

  const { addToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = (supList = suppliers, whList = warehouses, prodList = products) => {
    const defaultSup = supList.length > 0 ? supList[0].id : '';
    const defaultWh = whList.length > 0 ? whList[0].id : '';

    setFormData({
      supplierId: defaultSup,
      warehouseId: defaultWh,
      originalGrnNumber: '',
      reason: COMMON_REASONS[0],
      remarks: '',
      items: [],
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [prnRes, supRes, whRes, prodRes] = await Promise.all([
        prnApi.search({ size: 100 }),
        supplierApi.getActive(),
        warehouseApi.getActive(),
        productApi.getProducts({ size: 250, activeOnly: true }),
      ]);

      const pList = prnRes.data?.content || prnRes.data || [];
      const sList = supRes.data || [];
      const wList = whRes.data || [];
      const prodList = prodRes.data?.content || prodRes.data || [];

      setPrns(pList);
      setSuppliers(sList);
      setWarehouses(wList);
      setProducts(prodList);

      if (formData.items.length === 0) {
        resetForm(sList, wList, prodList);
      }
    } catch (err) {
      addToast('Failed to load purchase returns: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return formData.items.reduce(
      (sum, item) => sum + (item.quantityReturned || 0) * (item.unitCost || 0),
      0
    );
  };

  const handleSavePrn = async (processImmediately = true) => {
    if (!formData.supplierId || !formData.warehouseId) {
      addToast('Please select both supplier and warehouse', 'error');
      return;
    }
    if (formData.items.length === 0) {
      addToast('Add at least one item to return', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        sourceGrnId: Number(formData.sourceGrnId),
        supplierId: Number(formData.supplierId),
        warehouseId: Number(formData.warehouseId),
        originalGrnNumber: formData.originalGrnNumber.trim() || null,
        reason: formData.reason,
        remarks: formData.remarks.trim() || null,
        items: formData.items.map((it) => ({
          productId: Number(it.productId),
          quantityReturned: Number(it.quantityReturned),
          unitCost: Number(it.unitCost),
        })),
      };

      const res = await prnApi.create(payload, processImmediately);
      const prnNum = res.data?.prnNumber || 'note';
      addToast(
        `Purchase Return ${prnNum} ${processImmediately ? 'processed! Stock deducted.' : 'saved as draft.'}`,
        'success'
      );
      resetForm();
      loadData();
      setShowCreateForm(false);
    } catch (err) {
      addToast(err.message || 'Failed to create PRN', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleProcessPrn = async (id, prnNumber) => {
    try {
      await prnApi.process(id);
      addToast(`Purchase Return ${prnNumber} processed! Inventory updated.`, 'success');
      loadData();
    } catch (err) {
      addToast('Processing failed: ' + err.message, 'error');
    }
  };

  const handleInspectPrn = async (id) => {
    try {
      const res = await prnApi.getById(id);
      setSelectedPrn(res.data);
    } catch (err) {
      addToast('Failed to load PRN details: ' + err.message, 'error');
    }
  };

  const handleEditPrn = async (p) => {
    if (p.status === 'PROCESSED' || p.status === 'COMPLETED') {
      addToast(`PRN ${p.prnNumber} is already processed. Cannot be modified.`, 'info');
      handleInspectPrn(p.id);
      return;
    }
    try {
      const res = await prnApi.getById(p.id);
      const fullPrn = res.data;
      setFormData({
        supplierId: fullPrn.supplierId || '',
        warehouseId: fullPrn.warehouseId || '',
        originalGrnNumber: fullPrn.originalGrnNumber || '',
        reason: fullPrn.reason || COMMON_REASONS[0],
        remarks: fullPrn.remarks || '',
        items: (fullPrn.items || []).map((it) => ({
          productId: it.productId,
          productCode: it.productSku || '',
          productName: it.productName || '',
          unitOfMeasure: it.unitOfMeasure || 'PCS',
          quantity: Number(it.quantity || 1),
          unitCost: Number(it.unitCost || 0),
          reason: it.reason || 'Defective batch / Damaged on arrival',
        })),
      });
      setShowCreateForm(true);
    } catch (err) {
      addToast('Failed to load PRN for editing: ' + err.message, 'error');
    }
  };

  const handlePrintPrn = (p) => {
    window.print();
  };

  const filteredPrns = prns.filter((p) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !q ||
      p.prnNumber?.toLowerCase().includes(q) ||
      p.supplierName?.toLowerCase().includes(q) ||
      p.warehouseName?.toLowerCase().includes(q) ||
      p.reason?.toLowerCase().includes(q) ||
      p.originalGrnNumber?.toLowerCase().includes(q);

    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PROCESSED' && p.status === 'PROCESSED') ||
      (statusFilter === 'PENDING' && (p.status === 'PENDING' || p.status === 'DRAFT'));

    return matchSearch && matchStatus;
  });

  const handleExportCSV = () => {
    if (filteredPrns.length === 0) {
      addToast('No PRN records to export', 'warning');
      return;
    }
    const headers = 'PRN Number,Supplier,Warehouse,Total Value,Reason,Status,Date\n';
    const rows = filteredPrns.map((p) =>
      `"${p.prnNumber || ''}","${p.supplierName || ''}","${p.warehouseName || ''}",${Number(p.totalAmount || 0).toFixed(2)},"${p.reason || ''}","${p.status || ''}","${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `prn_records_${formatBusinessDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('PRN records exported to CSV', 'success');
  };

  const totalReturnVal = calculateTotal();

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      {!showCreateForm && <>
      {/* Top Filter & Actions Bar (Sticky Toolbar Card) */}
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
          boxSizing: 'border-box',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
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
            placeholder="Search PRNs by #, supplier, warehouse, reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Right Controls: Filter, Reset, Export, Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              height: '38px',
              padding: '0 30px 0 12px',
              width: '140px',
              minWidth: '120px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.86rem',
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
              backgroundPosition: 'right 10px center',
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PROCESSED">Processed</option>
            <option value="PENDING">Pending / Draft</option>
          </select>

          {(statusFilter !== 'ALL' || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setSearchTerm('');
              }}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f1f5f9',
                color: '#64748b',
                fontSize: '0.85rem',
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

          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowCreateForm(true);
            }}
            style={{
              height: '38px',
              padding: '0 16px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.86rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxSizing: 'border-box',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.2)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
          >
            <Plus size={16} /> + New Purchase Return
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              height: '38px',
              padding: '0 14px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#334155',
              fontSize: '0.84rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxSizing: 'border-box',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
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
          >
            <Download size={15} /> Export CSV
          </button>

          <button
            type="button"
            onClick={loadData}
            style={{
              height: '38px',
              padding: '0 14px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#334155',
              fontSize: '0.84rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxSizing: 'border-box',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
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
            title="Refresh records"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* PRN Table (Fixed Table Frame, Sticky Header - Exact CustomerHub Look) */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              overflow: 'hidden',
              width: '100%',
              boxSizing: 'border-box',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ width: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      PRN #
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      SUPPLIER
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      WAREHOUSE
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>
                      TOTAL VALUE
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      REASON
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      STATUS
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      DATE
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        Loading purchase returns...
                      </td>
                    </tr>
                  ) : filteredPrns.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        No purchase returns recorded yet. Fill the form on the left to create a return.
                      </td>
                    </tr>
                  ) : (
                    filteredPrns.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => handleInspectPrn(p.id)}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        title="Click row to view return details"
                      >
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                            {p.prnNumber}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                          {p.supplierName}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#334155', fontSize: '0.84rem' }}>
                          {p.warehouseName}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a', textAlign: 'right', fontSize: '0.85rem' }}>
                          ${Number(p.totalAmount || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#475569', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.reason}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: p.status === 'PROCESSED' ? '#dcfce7' : '#fef3c7',
                              color: p.status === 'PROCESSED' ? '#16a34a' : '#d97706',
                              border: p.status === 'PROCESSED' ? '1px solid #bbf7d0' : '1px solid #fde68a',
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: p.status === 'PROCESSED' ? '#16a34a' : '#d97706',
                                display: 'inline-block',
                              }}
                            />
                            {p.status || 'DRAFT'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#64748b' }}>
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditPrn(p);
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
                              title="Edit PRN"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintPrn(p);
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
                              title="Print PRN"
                            >
                              <Printer size={13} />
                            </button>
                            {p.status !== 'PROCESSED' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleProcessPrn(p.id, p.prnNumber);
                                }}
                                style={{
                                  height: '30px',
                                  padding: '0 8px',
                                  background: '#ffffff',
                                  border: '1px solid #bbf7d0',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  color: '#16a34a',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0fdf4')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                                title="Process Return to Supplier"
                              >
                                <CheckCircle size={13} /> Process
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

      </>}
      {showCreateForm && (
        <div className="purchase-document">
          <div className="purchase-document-content">
            {/* Modal Header */}
            <div
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    New Purchase Return (PRN)
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0 0' }}>
                    Issue vendor debit note and deduct returned inventory stock from warehouse
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => resetForm()}
                  style={{
                    height: '34px',
                    padding: '0 12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <RotateCcw size={14} /> Reset
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
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
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="purchase-body">
              <div className="purchase-fields"><label>Supplier *<select value={formData.supplierId} onChange={e=>setFormData({...formData, supplierId:e.target.value})}>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Dispatch warehouse *<select value={formData.warehouseId} onChange={e=>setFormData({...formData, warehouseId:e.target.value})}>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>Original GRN ID *<input type="number" value={formData.sourceGrnId || ''} onChange={e=>setFormData({...formData, sourceGrnId:e.target.value})}/></label><label>GRN / invoice reference<input type="text" value={formData.originalGrnNumber || ''} onChange={e=>setFormData({...formData, originalGrnNumber:e.target.value})}/></label><label>Return reason *<select value={formData.reason} onChange={e=>setFormData({...formData, reason:e.target.value})}>{COMMON_REASONS.map(r=><option key={r} value={r}>{r}</option>)}</select></label><label>Remarks / notes<input type="text" value={formData.remarks || ''} onChange={e=>setFormData({...formData, remarks:e.target.value})}/></label></div>
              <PurchaseLines products={products} items={formData.items} quantityField="quantityReturned" withCost={true}
                onChange={items=>setFormData(previous=>({...previous,items}))} />
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: '1rem', color: '#334155', fontWeight: 700 }}>
                Total Return Debit Value: <strong style={{ color: '#dc2626', fontSize: '1.25rem', fontWeight: 900 }}>${totalReturnVal.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Back to list
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePrn(false)}
                  disabled={saving}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePrn(true)}
                  disabled={saving}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                  }}
                >
                  <CheckCircle size={16} style={{ display: 'inline', marginRight: '6px' }} />
                  {saving ? 'Processing...' : 'Process Return & Debit Stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRN Inspection Drawer / Modal */}
      {selectedPrn && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: 'min(1020px, 96vw)',
              maxWidth: '1020px',
              maxHeight: 'calc(100vh - 24px)',
              overflowY: 'auto',
              padding: '24px',
              background: '#ffffff',
              borderRadius: '14px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Purchase Return Details
                </span>
                <h2 style={{ fontSize: '1.3rem', color: '#0f172a', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={20} color="#2563eb" /> {selectedPrn.prnNumber}
                </h2>
              </div>
              <button
                onClick={() => setSelectedPrn(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>SUPPLIER</div>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{selectedPrn.supplierName}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>WAREHOUSE</div>
                <div style={{ fontWeight: 600, color: '#2563eb' }}>{selectedPrn.warehouseName}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>STATUS & DATE</div>
                <div>
                  <span className={`badge ${selectedPrn.status === 'PROCESSED' ? 'badge-success' : 'badge-warning'}`}>
                    {selectedPrn.status}
                  </span>{' '}
                  <span style={{ color: '#64748b', fontSize: '0.78rem' }}>
                    {selectedPrn.createdAt ? new Date(selectedPrn.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>TOTAL VALUE</div>
                <div style={{ fontWeight: 800, color: '#dc2626', fontSize: '1rem' }}>
                  ${Number(selectedPrn.totalAmount || 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px', fontSize: '0.85rem', color: '#475569' }}>
              <div><span style={{ fontWeight: 600 }}>Return Reason:</span> {selectedPrn.reason}</div>
              {selectedPrn.originalGrnNumber && (
                <div><span style={{ fontWeight: 600 }}>Original GRN #:</span> {selectedPrn.originalGrnNumber}</div>
              )}
              {selectedPrn.remarks && (
                <div><span style={{ fontWeight: 600 }}>Remarks:</span> {selectedPrn.remarks}</div>
              )}
            </div>

            <h3 style={{ fontSize: '0.95rem', color: '#0f172a', marginBottom: '8px' }}>Returned Item Lines</h3>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <table className="glass-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Cost</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPrn.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{it.productName}</td>
                      <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{it.productSku || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{it.quantityReturned}</td>
                      <td style={{ textAlign: 'right' }}>${Number(it.unitCost || 0).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        ${((it.quantityReturned || 0) * (it.unitCost || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-glass" onClick={() => setSelectedPrn(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default PrnView;
