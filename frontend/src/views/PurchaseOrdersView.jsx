import React, { useState, useEffect } from 'react';
import { supplierApi, warehouseApi, productApi } from '../api/apiClient';
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

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPoId, setEditingPoId] = useState(null);
  // Modal State for Inspecting PO
  const [selectedPo, setSelectedPo] = useState(null);

  const { addToast } = useToast();

  React.useImperativeHandle(ref, () => ({
    openCreate: () => {
      resetForm();
      setShowCreateModal(true);
    },
    refresh: loadData,
  }));

  // Create PO Form State
  const [formData, setFormData] = useState({
    supplierId: '',
    warehouseId: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    terms: 'Net 30 Days',
    notes: '',
    items: [],
  });

  const [stagingItem, setStagingItem] = useState({
    productId: '',
    quantity: 10,
    unitCost: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const persistOrders = (orders) => {
    setPurchaseOrders(orders);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [supRes, whRes, prodRes] = await Promise.all([
        supplierApi.getActive(),
        warehouseApi.getActive(),
        productApi.getProducts({ size: 300, activeOnly: true }),
      ]);
      const sList = supRes.data || [];
      const wList = whRes.data || [];
      const pList = prodRes.data?.content || prodRes.data || [];

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
      if (pList.length > 0 && !stagingItem.productId) {
        setStagingItem({
          productId: pList[0].id,
          quantity: 10,
          unitCost: pList[0].costPrice || 0,
        });
      }
    } catch (err) {
      console.error('Failed to load master data for POs:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    const sId = suppliers.length > 0 ? suppliers[0].id : '';
    const wId = warehouses.length > 0 ? warehouses[0].id : '';
    const p = products.length > 0 ? products[0] : null;

    setEditingPoId(null);
    setFormData({
      supplierId: sId,
      warehouseId: wId,
      orderDate: new Date().toISOString().split('T')[0],
      expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      terms: 'Net 30 Days',
      notes: '',
      items: [],
    });

    if (p) {
      setStagingItem({
        productId: p.id,
        quantity: 10,
        unitCost: p.costPrice || 0,
      });
    }
  };

  const handleEditPo = (po) => {
    setEditingPoId(po.id);
    setFormData({
      supplierId: po.supplierId || '',
      warehouseId: po.warehouseId || '',
      orderDate: po.orderDate || new Date().toISOString().split('T')[0],
      expectedDate: po.expectedDate || '',
      terms: po.terms || 'Net 30 Days',
      notes: po.notes || '',
      items: po.items || [],
    });
    setShowCreateModal(true);
  };

  const handleProductSelectChange = (productId) => {
    const p = products.find((prod) => String(prod.id) === String(productId));
    setStagingItem({
      productId,
      quantity: stagingItem.quantity || 10,
      unitCost: p ? p.costPrice || 0 : 0,
    });
  };

  const handleAddItemToPo = () => {
    if (!stagingItem.productId) {
      addToast('Please choose a product to order', 'error');
      return;
    }
    const p = products.find((prod) => String(prod.id) === String(stagingItem.productId));
    if (!p) return;

    const qty = Number(stagingItem.quantity) || 1;
    const cost = Number(stagingItem.unitCost) || 0;

    const newItem = {
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      quantity: qty,
      unitCost: cost,
      totalCost: qty * cost,
    };

    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));

    addToast(`Added ${p.name} to order lines`, 'success');
  };

  const handleRemoveItem = (index) => {
    setFormData((prev) => {
      const copy = [...prev.items];
      copy.splice(index, 1);
      return { ...prev, items: copy };
    });
  };

  const calculateGrandTotal = () => {
    return formData.items.reduce((sum, it) => sum + (it.totalCost || 0), 0);
  };

  const handleSavePurchaseOrder = (status = 'PENDING') => {
    if (!formData.supplierId) {
      addToast('Please select a supplier', 'error');
      return;
    }
    if (!formData.warehouseId) {
      addToast('Please select a destination warehouse', 'error');
      return;
    }
    if (formData.items.length === 0) {
      addToast('Add at least one product item to the purchase order', 'error');
      return;
    }

    if (editingPoId) {
      const updated = purchaseOrders.map((p) =>
        p.id === editingPoId
          ? {
              ...p,
              supplierId: formData.supplierId,
              supplierName: sup ? sup.name : p.supplierName,
              warehouseId: formData.warehouseId,
              warehouseName: wh ? wh.name : p.warehouseName,
              orderDate: formData.orderDate,
              expectedDate: formData.expectedDate,
              terms: formData.terms,
              notes: formData.notes,
              status: status,
              totalAmount: calculateGrandTotal(),
              items: formData.items,
            }
          : p
      );
      persistOrders(updated);
      addToast(`Purchase Order updated successfully!`, 'success');
      setShowCreateModal(false);
      resetForm();
      return;
    }

    const sup = suppliers.find((s) => String(s.id) === String(formData.supplierId));
    const wh = warehouses.find((w) => String(w.id) === String(formData.warehouseId));
    const nextNum = `PO-2026-${String(purchaseOrders.length + 1).padStart(3, '0')}`;

    const newOrder = {
      id: `PO-${Date.now()}`,
      poNumber: nextNum,
      supplierId: formData.supplierId,
      supplierName: sup ? sup.name : 'Vendor',
      warehouseId: formData.warehouseId,
      warehouseName: wh ? wh.name : 'Warehouse',
      orderDate: formData.orderDate,
      expectedDate: formData.expectedDate,
      terms: formData.terms,
      notes: formData.notes,
      status: status,
      totalAmount: calculateGrandTotal(),
      items: formData.items,
      createdAt: new Date().toISOString(),
    };

    const updated = [newOrder, ...purchaseOrders];
    persistOrders(updated);
    addToast(`Purchase Order ${nextNum} created successfully!`, 'success');
    setShowCreateModal(false);
    resetForm();
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
    link.setAttribute('download', `purchase_orders_${new Date().toISOString().split('T')[0]}.csv`);
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
              setShowCreateModal(true);
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

      {/* FULL-WIDTH & FULL-HEIGHT CREATE PO MODAL POPUP */}
      {showCreateModal && (
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
              width: 'min(1380px, 98vw)',
              maxWidth: '1380px',
              height: 'min(95vh, calc(100vh - 24px))',
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
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 24px',
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
                onClick={() => setShowCreateModal(false)}
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

            {/* Modal Body (Scrollable Workstation) */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* SECTION 1: Order Details & Destination */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  1. Order & Supplier Information
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      SUPPLIER / VENDOR *
                    </label>
                    <select
                      value={formData.supplierId}
                      onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.88rem', fontWeight: 600 }}
                    >
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code || 'Vendor'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      DELIVERY WAREHOUSE *
                    </label>
                    <select
                      value={formData.warehouseId}
                      onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.88rem', fontWeight: 600 }}
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      ORDER DATE
                    </label>
                    <input
                      type="date"
                      value={formData.orderDate}
                      onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.88rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      EXPECTED DELIVERY DATE
                    </label>
                    <input
                      type="date"
                      value={formData.expectedDate}
                      onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.88rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      PAYMENT TERMS
                    </label>
                    <select
                      value={formData.terms}
                      onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.88rem' }}
                    >
                      <option value="Net 30 Days">Net 30 Days</option>
                      <option value="Net 15 Days">Net 15 Days</option>
                      <option value="COD">Cash on Delivery (COD)</option>
                      <option value="Advance Payment">Advance Payment</option>
                      <option value="End of Month">End of Month</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      REMARKS / PO NOTES
                    </label>
                    <input
                      type="text"
                      placeholder="Special delivery instructions, contact info..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.88rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Add Line Items */}
              <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #0284c7', borderRadius: '10px', padding: '20px', boxShadow: '0 4px 14px rgba(2, 132, 199, 0.08)' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0284c7', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  2. Select Item & Add to Purchase Order
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr auto', gap: '14px', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      SELECT PRODUCT (SKU / TRADE NAME)
                    </label>
                    <select
                      value={stagingItem.productId}
                      onChange={(e) => handleProductSelectChange(e.target.value)}
                      style={{ width: '100%', height: '40px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.88rem', fontWeight: 600 }}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} — {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      ORDER QUANTITY
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={stagingItem.quantity}
                      onChange={(e) => setStagingItem({ ...stagingItem, quantity: e.target.value })}
                      style={{ width: '100%', height: '40px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.95rem', fontWeight: 700 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      EXPECTED UNIT COST ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={stagingItem.unitCost}
                      onChange={(e) => setStagingItem({ ...stagingItem, unitCost: e.target.value })}
                      style={{ width: '100%', height: '40px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.95rem', fontWeight: 700 }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItemToPo}
                    style={{
                      height: '40px',
                      padding: '0 20px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                    }}
                  >
                    <Plus size={16} /> Add Item
                  </button>
                </div>
              </div>

              {/* SECTION 3: Line Items Table */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Ordered Line Items ({formData.items.length})
                  </h3>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0284c7' }}>
                    Estimated Total: ${calculateGrandTotal().toFixed(2)}
                  </span>
                </div>

                {formData.items.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1.5px dashed #cbd5e1', color: '#64748b', fontSize: '0.88rem' }}>
                    No items added to this purchase order yet. Select a product above and click <strong>"+ Add Item"</strong>.
                  </div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead style={{ backgroundColor: '#fafbfc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                          <th style={{ padding: '10px 14px', fontSize: '0.74rem', color: '#475569', fontWeight: 700 }}>#</th>
                          <th style={{ padding: '10px 14px', fontSize: '0.74rem', color: '#475569', fontWeight: 700 }}>SKU</th>
                          <th style={{ padding: '10px 14px', fontSize: '0.74rem', color: '#475569', fontWeight: 700 }}>PRODUCT NAME</th>
                          <th style={{ padding: '10px 14px', fontSize: '0.74rem', color: '#475569', fontWeight: 700, textAlign: 'right' }}>ORDER QTY</th>
                          <th style={{ padding: '10px 14px', fontSize: '0.74rem', color: '#475569', fontWeight: 700, textAlign: 'right' }}>UNIT COST</th>
                          <th style={{ padding: '10px 14px', fontSize: '0.74rem', color: '#475569', fontWeight: 700, textAlign: 'right' }}>LINE TOTAL</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.map((it, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 14px', fontSize: '0.84rem', color: '#64748b' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7', fontSize: '0.85rem' }}>{it.sku}</td>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>{it.productName}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{it.quantity}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#334155', fontSize: '0.88rem' }}>${Number(it.unitCost).toFixed(2)}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#0284c7', fontSize: '0.92rem' }}>${Number(it.totalCost).toFixed(2)}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                                title="Remove line item"
                              >
                                <X size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                padding: '14px 24px',
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
                  onClick={() => setShowCreateModal(false)}
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
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePurchaseOrder('PENDING')}
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
