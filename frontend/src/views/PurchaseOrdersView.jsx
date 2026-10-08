import PurchaseLines from '../components/PurchaseLines';
import { formatBusinessDate } from '../utils/invoiceMapping';
import React, { useState, useEffect } from 'react';
import { supplierApi, warehouseApi, productApi, purchaseOrderApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  ShoppingBag,
  Plus,
  Search,
  CheckCircle,
  RefreshCw,
  Edit2,
  X,
  Printer,
  Download,
  Calendar,
  DollarSign,
  Package,
} from 'lucide-react';

const PurchaseOrdersView = React.forwardRef(function PurchaseOrdersView(props, ref) {
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [showCreateForm, setShowCreateForm] = useState(false);
  useEffect(() => { props.onFormModeChange?.(showCreateForm); }, [showCreateForm, props.onFormModeChange]);
  const [editingPoId, setEditingPoId] = useState(null);
  // Modal State for Inspecting PO
  const [selectedPo, setSelectedPo] = useState(null);

  const { addToast } = useToast();

  React.useImperativeHandle(ref, () => ({
    openCreate: () => {
      resetForm();
      setShowCreateForm(true);
    },
    refresh: loadData,
  }));

  // Create PO Form State
  const [formData, setFormData] = useState({
    supplierId: '',
    warehouseId: '',
    orderDate: formatBusinessDate(),
    expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    terms: 'Net 30 Days',
    notes: '',
    items: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [supRes, whRes, prodRes, poRes] = await Promise.all([
        supplierApi.getActive(),
        warehouseApi.getActive(),
        productApi.getProducts({ size: 300, activeOnly: true }),
        purchaseOrderApi.search(),
      ]);
      const sList = supRes.data || [];
      const wList = whRes.data || [];
      const pList = prodRes.data?.content || prodRes.data || [];

      setPurchaseOrders(poRes.data?.content || []);
      setSuppliers(sList);
      setWarehouses(wList);
      setProducts(pList);

      if (sList.length > 0 && !formData.supplierId) {
        setFormData((prev) => ({
          ...prev,
          supplierId: sList[0].id,
          warehouseId: wList.length > 0 ? wList[0].id : '',
        }));
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    const sId = suppliers.length > 0 ? suppliers[0].id : '';
    const wId = warehouses.length > 0 ? warehouses[0].id : '';

    setEditingPoId(null);
    setFormData({
      supplierId: sId,
      warehouseId: wId,
      orderDate: formatBusinessDate(),
      expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      terms: 'Net 30 Days',
      notes: '',
      items: [],
    });

  };

  const handleEditPo = (po) => {
    setEditingPoId(po.id);
    setFormData({
      supplierId: po.supplierId || '',
      warehouseId: po.warehouseId || '',
      orderDate: po.orderDate || formatBusinessDate(),
      expectedDate: po.expectedDate || '',
      terms: po.terms || 'Net 30 Days',
      notes: po.notes || '',
      items: po.items || [],
    });
    setShowCreateForm(true);
  };

  const calculateGrandTotal = () => {
    return formData.items.reduce((sum, it) => sum + (it.totalCost || 0), 0);
  };

  const handleSavePurchaseOrder = async (status = 'PENDING') => {
    if(!formData.supplierId || !formData.warehouseId || !formData.items.length) { addToast('Select supplier, warehouse and order lines', 'error'); return; }
    setLoading(true);
    try {
      const payload = { ...formData, status, supplierId: Number(formData.supplierId), warehouseId: Number(formData.warehouseId),
        items: formData.items.map(i => ({ productId: Number(i.productId), quantity: Number(i.quantity), unitCost: Number(i.unitCost) })) };
      if(editingPoId) await purchaseOrderApi.update(editingPoId, payload); else await purchaseOrderApi.create(payload);
      await loadData(); setShowCreateForm(false); resetForm(); addToast('Purchase order saved', 'success');
    } catch(e) { addToast(e.message, 'error'); } finally { setLoading(false); }
  };

  const handleExportCSV = () => {
    if (purchaseOrders.length === 0) {
      addToast('No purchase orders to export', 'warning');
      return;
    }
    const headers = 'PO Number,Supplier,Warehouse,Order Date,Expected Date,Status,Total Amount\n';
    const rows = filteredOrders
      .map(
        (po) =>
          `"${po.poNumber}","${po.supplierName}","${po.warehouseName}","${po.orderDate}","${po.expectedDate}","${po.status}",${Number(po.totalAmount || 0).toFixed(2)}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `purchase_orders_${formatBusinessDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Purchase orders exported to CSV', 'success');
  };

  const filteredOrders = purchaseOrders.filter((po) => {
    if (statusFilter !== 'ALL' && po.status !== statusFilter) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      po.poNumber?.toLowerCase().includes(term) ||
      po.supplierName?.toLowerCase().includes(term) ||
      po.warehouseName?.toLowerCase().includes(term) ||
      po.notes?.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      {!showCreateForm && <>
      {/* Top Filter & Actions Bar (Sticky Toolbar Card - Customer/Employee Style) */}
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
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        {/* Left Search Input */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
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
            placeholder="Search Purchase Orders by #, supplier, warehouse, notes..."
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
              title="Clear search text"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Right Controls: Filter, Reset, New PO, Export, Refresh */}
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
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="RECEIVED">Received</option>
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
            <Plus size={16} /> + Create Purchase Order
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
            title="Export POs to CSV"
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

      {/* Full-Width Purchase Orders Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          overflow: 'hidden',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                  PO NUMBER
                </th>
                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                  SUPPLIER
                </th>
                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                  DESTINATION WAREHOUSE
                </th>
                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                  ORDER DATE
                </th>
                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                  EXPECTED DELIVERY
                </th>
                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                  STATUS
                </th>
                <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>
                  TOTAL VALUE
                </th>
                <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                    No purchase orders found. Click <strong>+ Create Purchase Order</strong> to issue a new order.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((po) => (
                  <tr
                    key={po.id}
                    onClick={() => setSelectedPo(po)}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    title="Click row to inspect order details"
                  >
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                        {po.poNumber}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                      {po.supplierName}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#334155', fontSize: '0.84rem' }}>
                      {po.warehouseName}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#64748b' }}>
                      {po.orderDate}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#64748b' }}>
                      {po.expectedDate || '—'}
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
                          backgroundColor:
                            po.status === 'RECEIVED'
                              ? '#dcfce7'
                              : po.status === 'APPROVED'
                              ? '#eff6ff'
                              : po.status === 'PENDING'
                              ? '#fef3c7'
                              : '#fee2e2',
                          color:
                            po.status === 'RECEIVED'
                              ? '#16a34a'
                              : po.status === 'APPROVED'
                              ? '#2563eb'
                              : po.status === 'PENDING'
                              ? '#d97706'
                              : '#dc2626',
                          border:
                            po.status === 'RECEIVED'
                              ? '1px solid #bbf7d0'
                              : po.status === 'APPROVED'
                              ? '1px solid #bfdbfe'
                              : po.status === 'PENDING'
                              ? '1px solid #fde68a'
                              : '1px solid #fecaca',
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor:
                              po.status === 'RECEIVED'
                                ? '#16a34a'
                                : po.status === 'APPROVED'
                                ? '#2563eb'
                                : po.status === 'PENDING'
                                ? '#d97706'
                                : '#dc2626',
                            display: 'inline-block',
                          }}
                        />
                        {po.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a', textAlign: 'right', fontSize: '0.85rem' }}>
                      ${Number(po.totalAmount || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditPo(po);
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
                          title="Edit Purchase Order"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.print();
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
                          title="Print PO"
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
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {editingPoId ? 'Edit Purchase Order (PO)' : 'Create Purchase Order (PO)'}
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0 0' }}>
                    Generate procurement order with approved supplier and line items
                  </p>
                </div>
              </div>
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

            <div className="purchase-body">
              <div className="purchase-fields"><label>Supplier *<select value={formData.supplierId} onChange={e=>setFormData({...formData, supplierId:e.target.value})}>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Delivery warehouse *<select value={formData.warehouseId} onChange={e=>setFormData({...formData, warehouseId:e.target.value})}>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>Order date<input type="date" value={formData.orderDate || ''} onChange={e=>setFormData({...formData, orderDate:e.target.value})}/></label><label>Expected date<input type="date" value={formData.expectedDate || ''} onChange={e=>setFormData({...formData, expectedDate:e.target.value})}/></label><label>Payment terms<select value={formData.terms} onChange={e=>setFormData({...formData, terms:e.target.value})}>{['Net 30 Days','Net 15 Days','COD','Advance Payment','End of Month'].map(t=><option key={t} value={t}>{t}</option>)}</select></label><label>Remarks / notes<input type="text" value={formData.notes || ''} onChange={e=>setFormData({...formData, notes:e.target.value})}/></label></div>
              <PurchaseLines products={products} items={formData.items} quantityField="quantity" withCost={true}
                onChange={items=>setFormData(previous=>({...previous,items}))} />
            </div>

            {/* Modal Footer Actions */}
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
                Order Grand Total: <strong style={{ color: '#0284c7', fontSize: '1.25rem', fontWeight: 900 }}>${calculateGrandTotal().toFixed(2)}</strong>
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
                  onClick={() => handleSavePurchaseOrder('PENDING')}
                  disabled={loading}
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
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePurchaseOrder('APPROVED')}
                  disabled={loading}
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
                  Issue Purchase Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INSPECT PURCHASE ORDER MODAL */}
      {selectedPo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              width: 'min(960px, 96vw)',
              maxWidth: '960px',
              maxHeight: 'calc(100vh - 24px)',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                  Purchase Order: <span style={{ color: '#0284c7', fontFamily: 'monospace' }}>{selectedPo.poNumber}</span>
                </h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  Ordered on {selectedPo.orderDate} • Status: <strong>{selectedPo.status}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPo(null)}
                style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '18px' }}>
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>SUPPLIER / VENDOR</div>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem', marginTop: '2px' }}>{selectedPo.supplierName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>DESTINATION WAREHOUSE</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem', marginTop: '2px' }}>{selectedPo.warehouseName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>EXPECTED DELIVERY</div>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{selectedPo.expectedDate || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>PAYMENT TERMS</div>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{selectedPo.terms || 'Standard'}</div>
                </div>
              </div>

              {selectedPo.notes && (
                <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fef3c7', marginBottom: '16px', fontSize: '0.86rem', color: '#92400e' }}>
                  <strong>Notes:</strong> {selectedPo.notes}
                </div>
              )}

              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                Order Line Items ({selectedPo.items?.length || 0})
              </h4>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '10px 14px', fontSize: '0.74rem', color: '#475569' }}>#</th>
                      <th style={{ padding: '10px 14px', fontSize: '0.74rem', color: '#475569' }}>SKU</th>
                      <th style={{ padding: '10px 14px', fontSize: '0.74rem', color: '#475569' }}>Product Name</th>
                      <th style={{ padding: '10px 14px', fontSize: '0.74rem', color: '#475569', textAlign: 'right' }}>Qty</th>
                      <th style={{ padding: '10px 14px', fontSize: '0.74rem', color: '#475569', textAlign: 'right' }}>Unit Cost</th>
                      <th style={{ padding: '10px 14px', fontSize: '0.74rem', color: '#475569', textAlign: 'right' }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPo.items?.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontSize: '0.84rem', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{it.sku}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{it.productName}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800 }}>{it.quantity}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#334155' }}>${Number(it.unitCost).toFixed(2)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>${Number(it.totalCost).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                Total Order Value: <span style={{ color: '#0284c7', fontSize: '1.25rem' }}>${Number(selectedPo.totalAmount || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Printer size={15} style={{ display: 'inline', marginRight: '6px' }} /> Print PO
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPo(null)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', fontWeight: 600, cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default PurchaseOrdersView;
