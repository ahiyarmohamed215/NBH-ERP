import PurchaseLines from '../components/PurchaseLines';
import { formatBusinessDate } from '../utils/invoiceMapping';
import React, { useState, useEffect } from 'react';
import { gtnApi, warehouseApi, productApi, pdfApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  ArrowRightLeft,
  Plus,
  Search,
  CheckCircle,
  RefreshCw,
  RotateCcw,
  Edit2,
  X,
  ArrowRight,
  Package,
  Printer,
  Download,
} from 'lucide-react';

const GtnView = React.forwardRef(function GtnView(props, ref) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  useEffect(() => { props.onFormModeChange?.(showCreateForm); }, [showCreateForm, props.onFormModeChange]);
  const [gtns, setGtns] = useState([]);
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
    sourceWarehouseId: '',
    destinationWarehouseId: '',
    remarks: '',
    items: [],
  });

  // Inspection modal state for viewing an existing transfer
  const [selectedGtn, setSelectedGtn] = useState(null);

  const { addToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = (whList = warehouses, prodList = products) => {
    const srcId = whList.length > 0 ? whList[0].id : '';
    const dstId = whList.length > 1 ? whList[1].id : (whList[0]?.id || '');

    setFormData({
      sourceWarehouseId: srcId,
      destinationWarehouseId: dstId,
      remarks: '',
      items: [],
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [gtnRes, whRes, prodRes] = await Promise.all([
        gtnApi.search({ size: 100 }),
        warehouseApi.getActive(),
        productApi.getProducts({ size: 250, activeOnly: true }),
      ]);

      const gList = gtnRes.data?.content || gtnRes.data || [];
      const whList = whRes.data || [];
      const prodList = prodRes.data?.content || prodRes.data || [];

      setGtns(gList);
      setWarehouses(whList);
      setProducts(prodList);

      if (formData.items.length === 0) {
        resetForm(whList, prodList);
      }
    } catch (err) {
      addToast('Failed to load GTN data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalUnits = () => {
    return formData.items.reduce((sum, it) => sum + (it.quantityTransferred || 0), 0);
  };

  const handleSaveGtn = async (transferImmediately = true) => {
    if (!formData.sourceWarehouseId || !formData.destinationWarehouseId) {
      addToast('Please select both source and destination warehouses', 'error');
      return;
    }
    if (Number(formData.sourceWarehouseId) === Number(formData.destinationWarehouseId)) {
      addToast('Source and destination warehouse cannot be the same', 'error');
      return;
    }
    if (formData.items.length === 0) {
      addToast('Add at least one product item to transfer', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        sourceWarehouseId: Number(formData.sourceWarehouseId),
        destinationWarehouseId: Number(formData.destinationWarehouseId),
        remarks: formData.remarks.trim() || null,
        items: formData.items.map((it) => ({
          productId: Number(it.productId),
          quantityTransferred: Number(it.quantityTransferred),
        })),
      };

      const res = await gtnApi.create(payload, transferImmediately);
      const gtnNum = res.data?.gtnNumber || 'transfer';
      addToast(
        `GTN ${gtnNum} created ${transferImmediately ? 'and dispatched to destination!' : 'as draft.'}`,
        'success'
      );
      resetForm();
      loadData();
      setShowCreateForm(false);
    } catch (err) {
      addToast(err.message || 'Failed to create GTN', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExecuteTransfer = async (id, gtnNumber) => {
    try {
      await gtnApi.transfer(id);
      addToast(`GTN ${gtnNumber} transferred! Stocks updated in both warehouses.`, 'success');
      loadData();
    } catch (err) {
      addToast('Transfer failed: ' + err.message, 'error');
    }
  };

  const handleInspectGtn = async (id) => {
    try {
      const res = await gtnApi.getById(id);
      setSelectedGtn(res.data);
    } catch (err) {
      addToast('Failed to load GTN details: ' + err.message, 'error');
    }
  };

  const handleEditGtn = async (g) => {
    if (g.status === 'TRANSFERRED' || g.status === 'COMPLETED') {
      addToast(`GTN ${g.gtnNumber} is already completed/transferred. Cannot be modified.`, 'info');
      handleInspectGtn(g.id);
      return;
    }
    try {
      const res = await gtnApi.getById(g.id);
      const fullGtn = res.data;
      setFormData({
        sourceWarehouseId: fullGtn.sourceWarehouseId || '',
        destinationWarehouseId: fullGtn.destinationWarehouseId || '',
        remarks: fullGtn.remarks || '',
        items: (fullGtn.items || []).map((it) => ({
          productId: it.productId,
          productCode: it.productSku || '',
          productName: it.productName || '',
          unitOfMeasure: it.unitOfMeasure || 'PCS',
          quantity: Number(it.quantity || 1),
        })),
      });
      setShowCreateForm(true);
    } catch (err) {
      addToast('Failed to load GTN for editing: ' + err.message, 'error');
    }
  };

  const filteredGtns = gtns.filter((g) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !q ||
      g.gtnNumber?.toLowerCase().includes(q) ||
      g.sourceWarehouseName?.toLowerCase().includes(q) ||
      g.destinationWarehouseName?.toLowerCase().includes(q) ||
      g.remarks?.toLowerCase().includes(q);

    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'TRANSFERRED' && g.status === 'TRANSFERRED') ||
      (statusFilter === 'PENDING' && g.status === 'PENDING') ||
      (statusFilter === 'CANCELLED' && g.status === 'CANCELLED');

    return matchSearch && matchStatus;
  });

  const handleExportCSV = () => {
    if (filteredGtns.length === 0) {
      addToast('No GTN records to export', 'warning');
      return;
    }
    const headers = 'GTN Number,Source Warehouse,Destination Warehouse,Status,Date,Remarks\n';
    const rows = filteredGtns.map((g) =>
      `"${g.gtnNumber || ''}","${g.sourceWarehouseName || ''}","${g.destinationWarehouseName || ''}","${g.status || ''}","${g.transferredAt || g.createdAt || ''}","${g.remarks || ''}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `gtn_records_${formatBusinessDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('GTN records exported to CSV', 'success');
  };

  const isSameWarehouse =
    formData.sourceWarehouseId &&
    formData.destinationWarehouseId &&
    Number(formData.sourceWarehouseId) === Number(formData.destinationWarehouseId);

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
                placeholder="Search GTNs by #, source, destination, remarks..."
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
                <option value="TRANSFERRED">Transferred</option>
                <option value="PENDING">Pending</option>
                <option value="CANCELLED">Cancelled</option>
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
                <Plus size={16} /> + New Stock Transfer
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
                title="Export GTNs to CSV"
              >
                <Download size={14} /> Export
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

          {/* GTN Table (Fixed Table Frame, Sticky Header - Exact CustomerHub Look) */}
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
              <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      GTN #
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      ROUTE (FROM → TO)
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      STATUS
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      DATE
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      REMARKS
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        Loading transfer notes...
                      </td>
                    </tr>
                  ) : filteredGtns.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        No transfer records found. Fill the form on the left to initiate a transfer.
                      </td>
                    </tr>
                  ) : (
                    filteredGtns.map((g) => (
                      <tr
                        key={g.id}
                        onClick={() => handleInspectGtn(g.id)}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        title="Click row to view transfer details"
                      >
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                            {g.gtnNumber}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}>
                            <span style={{ fontWeight: 600, color: '#334155' }}>{g.sourceWarehouseName}</span>
                            <ArrowRight size={13} color="#94a3b8" />
                            <span style={{ fontWeight: 600, color: '#0284c7' }}>{g.destinationWarehouseName}</span>
                          </div>
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
                              backgroundColor: g.status === 'TRANSFERRED' ? '#dcfce7' : g.status === 'PENDING' ? '#fef3c7' : '#fee2e2',
                              color: g.status === 'TRANSFERRED' ? '#16a34a' : g.status === 'PENDING' ? '#d97706' : '#dc2626',
                              border: g.status === 'TRANSFERRED' ? '1px solid #bbf7d0' : g.status === 'PENDING' ? '1px solid #fde68a' : '1px solid #fecaca',
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: g.status === 'TRANSFERRED' ? '#16a34a' : g.status === 'PENDING' ? '#d97706' : '#dc2626',
                                display: 'inline-block',
                              }}
                            />
                            {g.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#64748b' }}>
                          {g.transferredAt
                            ? new Date(g.transferredAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                            : g.createdAt
                            ? new Date(g.createdAt).toLocaleDateString()
                            : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#64748b', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {g.remarks || '—'}
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditGtn(g);
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
                              title="Edit GTN Transfer"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                pdfApi.printGtn(g.id);
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
                              title="Print GTN PDF"
                            >
                              <Printer size={13} />
                            </button>
                            {g.status === 'PENDING' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExecuteTransfer(g.id, g.gtnNumber);
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
                                title="Execute Transfer"
                              >
                                <CheckCircle size={13} /> Execute
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
                    backgroundColor: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    New Stock Transfer (GTN)
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0 0' }}>
                    Dispatch and transfer inventory movement between registered warehouse centers
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
              <div className="purchase-fields"><label>Source warehouse *<select value={formData.sourceWarehouseId} onChange={e=>setFormData({...formData, sourceWarehouseId:e.target.value})}>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>Destination warehouse *<select value={formData.destinationWarehouseId} onChange={e=>setFormData({...formData, destinationWarehouseId:e.target.value})}>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>Remarks / transfer reason<input type="text" value={formData.remarks || ''} onChange={e=>setFormData({...formData, remarks:e.target.value})}/></label></div>
              <PurchaseLines products={products} items={formData.items} quantityField="quantityTransferred" withCost={false}
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
                Total Transfer Quantity: <strong style={{ color: '#0284c7', fontSize: '1.25rem', fontWeight: 900 }}>{calculateTotalUnits()} units</strong>
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
                  onClick={() => handleSaveGtn(false)}
                  disabled={saving || isSameWarehouse}
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
                  onClick={() => handleSaveGtn(true)}
                  disabled={saving || isSameWarehouse}
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
                  {saving ? 'Processing...' : 'Direct Transfer & Dispatch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GTN Inspection Drawer / Modal */}
      {selectedGtn && (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '14px', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Goods Transfer Note Details
                </span>
                <h2 style={{ fontSize: '1.45rem', color: '#0f172a', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={24} color="#2563eb" /> {selectedGtn.gtnNumber}
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-glass btn-sm"
                  onClick={() => pdfApi.downloadGtn(selectedGtn.id, selectedGtn.gtnNumber)}
                  style={{ fontWeight: 700, color: '#15803d', borderColor: '#86efac', padding: '7px 12px' }}
                >
                  <Download size={15} color="#15803d" /> Download PDF
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => pdfApi.printGtn(selectedGtn.id)}
                  style={{ fontWeight: 700, padding: '7px 14px' }}
                >
                  <Printer size={15} /> Print Direct
                </button>
                <button
                  onClick={() => setSelectedGtn(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '18px', fontSize: '0.9rem' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>SOURCE WAREHOUSE</div>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>{selectedGtn.sourceWarehouseName}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>DESTINATION WAREHOUSE</div>
                <div style={{ fontWeight: 800, color: '#2563eb', fontSize: '1.05rem' }}>{selectedGtn.destinationWarehouseName}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>STATUS</div>
                <div>
                  <span className={`badge ${selectedGtn.status === 'TRANSFERRED' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.85rem' }}>
                    {selectedGtn.status}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>DATE & TIME</div>
                <div style={{ color: '#334155', fontWeight: 600 }}>
                  {selectedGtn.transferredAt ? new Date(selectedGtn.transferredAt).toLocaleString() : '—'}
                </div>
              </div>
            </div>

            {selectedGtn.remarks && (
              <div style={{ padding: '10px 14px', background: '#f1f5f9', borderRadius: '6px', marginBottom: '16px', fontSize: '0.86rem', color: '#475569' }}>
                <span style={{ fontWeight: 700 }}>Remarks:</span> {selectedGtn.remarks}
              </div>
            )}

            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Transferred Item Lines</h3>
            <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
              <table className="glass-table" style={{ margin: 0 }}>
                <thead style={{ background: '#f1f5f9' }}>
                  <tr>
                    <th style={{ padding: '10px 14px' }}>Product</th>
                    <th style={{ padding: '10px 14px' }}>SKU</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Qty Transferred</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedGtn.items?.map((it, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{it.productName}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#64748b' }}>{it.productSku || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#1d4ed8', fontSize: '0.95rem' }}>
                        {it.quantityTransferred}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-glass"
                onClick={() => pdfApi.downloadGtn(selectedGtn.id, selectedGtn.gtnNumber)}
                style={{ fontWeight: 700, color: '#15803d', borderColor: '#86efac' }}
              >
                <Download size={15} color="#15803d" /> Download PDF
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => pdfApi.printGtn(selectedGtn.id)}
                style={{ fontWeight: 700 }}
              >
                <Printer size={15} /> Print Direct
              </button>
              <button className="btn btn-glass" onClick={() => setSelectedGtn(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default GtnView;
