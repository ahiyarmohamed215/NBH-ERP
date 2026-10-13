import {newestFirst} from '../utils/recordOrder';
import {documentErrors,numberError} from '../utils/purchasingValidation';
import FilterSelect from '../components/FilterSelect';
import '../components/PurchasingAppearance.css';
import DateRangePicker, {matchesDateRange} from '../components/DateRangePicker';
import { gtnWarehouseSummary, itemSourceId, itemDestinationId } from '../utils/gtnRoutes';
import GtnStatusDialog from '../components/GtnStatusDialog';
import { usePurchasingStatusChange } from '../hooks/usePurchasingStatusChange';
import StaffSearch from '../components/StaffSearch';
import { availableStock, loadPurchaseInventory } from '../utils/purchaseInventory';
import StatusBadge from '../components/StatusBadge';
import { printPurchaseList } from '../utils/purchasePrint';
import PurchaseInspectionModal from '../components/PurchaseInspectionModal';
import PurchaseLines from '../components/PurchaseLines';

import React, { useState, useEffect } from 'react';
import { gtnApi, warehouseApi, productApi, pdfApi, inventoryApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  ArrowRightLeft,
  Search,
  CheckCircle,
  RefreshCw,
  RotateCcw,
  Edit2,
  X,
  Package,
  Printer,
  Ban,
  RotateCw,
} from 'lucide-react';

const GtnView = React.forwardRef(function GtnView(props, ref) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  useEffect(() => { props.onFormModeChange?.(showCreateForm); }, [showCreateForm, props.onFormModeChange]);
  const [gtns, setGtns] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [editingGtnId, setEditingGtnId] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusReason, setStatusReason] = useState('');
  const [editingGtnStatus, setEditingGtnStatus] = useState(null);
  const [originalGtnStock, setOriginalGtnStock] = useState({});
  const [signedCopyReceived, setSignedCopyReceived] = useState(false);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fromDate,setFromDate]=useState('');
  const [toDate,setToDate]=useState('');
  const [saving, setSaving] = useState(false);
  const [warehouseStock, setWarehouseStock] = useState(null);
  const [stockError, setStockError] = useState(false);
  const [intakeProduct, setIntakeProduct] = useState(null);

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
    responsibleStaffId: '',
    remarks: '',
    items: [],
  });

  // Inspection modal state for viewing an existing transfer
  const [selectedGtn, setSelectedGtn] = useState(null);

  const { addToast } = useToast();
  const {requestStatusChange,statusChangeDialog}=usePurchasingStatusChange();

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = (whList = warehouses, prodList = products) => {
    const srcId = '';
    setIntakeProduct(null);
    setEditingGtnId(null); setEditingGtnStatus(null); setOriginalGtnStock({});
    const dstId = '';

    setFormData({
      sourceWarehouseId: srcId,
      destinationWarehouseId: dstId,
      responsibleStaffId: '',
      remarks: '',
      items: [],
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [gtnRes, whRes, prodRes, stockRows, staffRes] = await Promise.all([
        gtnApi.search({ size: 100 }),
        warehouseApi.getActive(),
        productApi.getProducts({ size: 250, activeOnly: true }),
        loadPurchaseInventory(),
        gtnApi.getResponsibleStaff(),
      ]);

      const gList = gtnRes.data?.content || gtnRes.data || [];
      const whList = whRes.data || [];
      const prodList = prodRes.data?.content || prodRes.data || [];

      setGtns(gList);
      setWarehouses(whList);
      setProducts(prodList);
      setInventory(stockRows);
      setStaff(staffRes.data || []);

      if (formData.items.length === 0) {
        resetForm(whList, prodList);
      }
    } catch (err) {
      addToast('Failed to load GTN data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const productWarehouse = product => product?.defaultWarehouseId || product?.warehouseId;
  const stockWarehouseId = productWarehouse(intakeProduct) || formData.sourceWarehouseId;
  useEffect(() => {
    let current = true;
    setWarehouseStock(null); setStockError(false);
    if (stockWarehouseId) {
      inventoryApi.getWarehouseStock(stockWarehouseId).then(response => {
        if (current) setWarehouseStock(Object.fromEntries((response.data || []).map(stock => [stock.productId,
          Math.max(0, Number(stock.availableQuantity ?? (Number(stock.quantity || 0) - Number(stock.reservedQuantity || 0))))])));
      }).catch(() => { if (current) setStockError(true); });
    }
    return () => { current = false; };
  }, [stockWarehouseId, intakeProduct]);

  const selectTransferProduct = (product, item) => {
    setIntakeProduct(product || null);
    const source = productWarehouse(product);
    setFormData(previous => ({ ...previous, sourceWarehouseId: source || '',
      destinationWarehouseId: item ? item.destinationWarehouseId || '' : String(previous.destinationWarehouseId) === String(source) ? '' : previous.destinationWarehouseId }));
  };
  const originalStockCredit = (productId, warehouseId) => editingGtnStatus === 'TRANSFERRED' ? originalGtnStock[`${warehouseId}:${productId}`] || 0 : 0;
  const remainingStock = (product, editing) => !product || warehouseStock === null ? null : Math.max(0,
    (warehouseStock[product.id] || 0) + originalStockCredit(product.id, stockWarehouseId) - formData.items.reduce((sum, item, index) =>
      index !== editing && String(itemSourceId(item)) === String(stockWarehouseId) && String(item.productId) === String(product.id) ? sum + Number(item.quantityTransferred || 0) : sum, 0));
  const transferSearchProducts = inventory.flatMap(stock => {
    const product = products.find(product => String(product.id) === String(stock.productId));
    if (!product) return [];
    const quantity = availableStock(stock) + originalStockCredit(stock.productId, stock.warehouseId) - formData.items.reduce((sum, item) => String(itemSourceId(item)) === String(stock.warehouseId) && String(item.productId) === String(stock.productId) ? sum + Number(item.quantityTransferred || 0) : sum, 0);
    return quantity > 0 ? [{ ...product, defaultWarehouseId: stock.warehouseId, warehouseName: stock.warehouseName,
      availableQuantity: quantity, searchKey: `${stock.productId}:${stock.warehouseId}` }] : [];
  });
  const validateTransferItem = (product, quantity, editing) => {
    if (!formData.destinationWarehouseId || isSameWarehouse) { addToast('Select a destination warehouse before adding products.', 'error'); return false; }
    const source = productWarehouse(product);
    if (!source) { addToast('This product has no source warehouse. Set its warehouse in Inventory first.', 'error'); return false; }
    const available = remainingStock(product, editing);
    if (stockError || available === null) { addToast('Available stock could not be checked yet. Please select the product again.', 'error'); return false; }
    if (quantity > available) { addToast(`Insufficient stock. Available quantity: ${available}.`, 'error'); return false; }
    return true;
  };

  const calculateTotalUnits = () => {
    return formData.items.reduce((sum, it) => sum + (it.quantityTransferred || 0), 0);
  };

  const handleSaveGtn = async (submitPending = true, statusReason) => {
    const validationErrors=documentErrors('GTN',formData);if(validationErrors.length){addToast(validationErrors[0],'error');return;}
    if (formData.items.some(item=>!itemSourceId(item) || !itemDestinationId(item) || String(itemSourceId(item))===String(itemDestinationId(item)))) {
      addToast('Every item must have different source and destination warehouses.', 'error'); return;
    }
    if (formData.items.length === 0) {
      addToast('Add at least one product item to transfer', 'error');
      return;
    }

    if ((submitPending || editingGtnStatus === 'TRANSFERRED') && !formData.responsibleStaffId) { addToast('Select a responsible staff member before saving the GTN.', 'error'); return; }
    if(editingGtnId && editingGtnStatus==='DRAFT' && submitPending && !statusReason) {
      requestStatusChange({type:'GTN',number:gtns.find(document=>document.id===editingGtnId)?.gtnNumber || `GTN ${editingGtnId}`,current:'DRAFT',target:'PENDING',onConfirm:reason=>handleSaveGtn(submitPending,reason)});return;
    }
    try {
      setSaving(true);
      const payload = {
        statusReason,
        notes: formData.remarks.trim() || null,
        responsibleStaffId: Number(formData.responsibleStaffId) || null,
        status: editingGtnStatus === 'TRANSFERRED' ? 'TRANSFERRED' : editingGtnStatus === 'PENDING' ? 'PENDING' : submitPending ? 'PENDING' : 'DRAFT',
        ...(formData.dispatchDate ? { dispatchDate: formData.dispatchDate } : {}),
        items: formData.items.map((it) => ({
          productId: Number(it.productId),
          sourceWarehouseId: Number(itemSourceId(it)),
          destinationWarehouseId: Number(itemDestinationId(it)),
          quantityTransferred: Number(it.quantityTransferred),
        })),
      };

      const res = editingGtnId ? await gtnApi.update(editingGtnId, payload) : await gtnApi.create(payload, false);
      const gtnNum = res.data?.gtnNumber || 'transfer';
      addToast(
        `GTN ${gtnNum} ${editingGtnStatus === 'TRANSFERRED' ? 'updated. Inventory adjusted for the changes.' : res.data?.status === 'PENDING' ? 'saved as pending. Inventory will move after office confirmation.' : 'saved as draft.'}`,
        'success'
      );
      resetForm();
      await loadData();
      setShowCreateForm(false);
      if (submitPending && res.data?.status === 'PENDING') {
        setSelectedGtn(res.data);
        setSignedCopyReceived(false);
        try { await pdfApi.printGtn(res.data.id); } catch { addToast('GTN saved as pending, but printing failed. Use Print in the view popup to retry.', 'warning'); }
      }
    } catch (err) {
      addToast(err.message || 'Failed to create GTN', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openStatusChange = target => { setStatusTarget(target); setStatusReason(''); setSignedCopyReceived(false); };
  const handleStatusChange = async () => {
    if (saving || !selectedGtn || !statusTarget || !statusReason.trim()) return;
    if (statusTarget === 'TRANSFERRED' && !signedCopyReceived) return;
    setSaving(true);
    try {
      const response = await gtnApi.changeStatus(selectedGtn.id, { status: statusTarget, reason: statusReason.trim(), signedCopyReceived });
      setSelectedGtn(response.data); setStatusTarget(null); setSignedCopyReceived(false);
      await loadData(); addToast(`GTN status changed to ${response.data.status.toLowerCase()}.`, 'success');
    } catch (error) { addToast(error.response?.data?.message || error.message || 'Status change failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleInspectGtn = async (id) => {
    try {
      const res = await gtnApi.getById(id);
      setSelectedGtn(res.data);
      setSignedCopyReceived(false);
    } catch (err) {
      addToast('Failed to load GTN details: ' + err.message, 'error');
    }
  };

  const handleEditGtn = async (g) => {
    if (!['DRAFT', 'PENDING', 'TRANSFERRED'].includes(g.status)) {
      addToast(`GTN ${g.gtnNumber} is already completed/transferred. Cannot be modified.`, 'info');
      handleInspectGtn(g.id);
      return;
    }
    try {
      const res = await gtnApi.getById(g.id);
      const fullGtn = res.data;
      setEditingGtnId(fullGtn.id); setEditingGtnStatus(fullGtn.status);
      setOriginalGtnStock((fullGtn.items || []).reduce((stock,item)=>{const key=`${itemSourceId(item,fullGtn)}:${item.productId}`;return {...stock,[key]:(stock[key] || 0)+Number(item.quantityTransferred ?? item.quantity ?? 0)};},{}));
      setSelectedGtn(null);
      setFormData({
        sourceWarehouseId: '',
        destinationWarehouseId: '',
        remarks: fullGtn.notes || fullGtn.remarks || '',
        responsibleStaffId: fullGtn.responsibleStaffId || '',
        dispatchDate: fullGtn.dispatchDate,
        items: (fullGtn.items || []).map((it) => ({
          productId: it.productId,
          warehouseId: itemSourceId(it, fullGtn),
          sourceWarehouseId: itemSourceId(it, fullGtn),
          sourceWarehouseName: it.sourceWarehouseName || fullGtn.sourceWarehouseName,
          destinationWarehouseId: itemDestinationId(it, fullGtn),
          destinationWarehouseName: it.destinationWarehouseName || fullGtn.destinationWarehouseName,
          productCode: it.productSku || '',
          productName: it.productName || '',
          unitOfMeasure: it.unitOfMeasure || 'PCS',
          quantityTransferred: Number(it.quantityTransferred ?? it.quantity ?? 1),
        })),
      });
      setShowCreateForm(true);
    } catch (err) {
      addToast('Failed to load GTN for editing: ' + err.message, 'error');
    }
  };

  const filteredGtns = newestFirst(gtns).filter((g) => {
    if(!matchesDateRange(g.dispatchDate || g.createdAt,fromDate,toDate)) return false;
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !q ||
      g.gtnNumber?.toLowerCase().includes(q) ||
      [...gtnWarehouseSummary(g).sources,...gtnWarehouseSummary(g).destinations].some(name=>name.toLowerCase().includes(q)) ||
      g.notes?.toLowerCase().includes(q) || g.remarks?.toLowerCase().includes(q);

    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'TRANSFERRED' && ['RECEIVED', 'TRANSFERRED', 'COMPLETED'].includes(g.status)) ||
      (statusFilter === 'PENDING' && g.status === 'PENDING') ||
      (statusFilter === 'DRAFT' && g.status === 'DRAFT') ||
      (statusFilter === 'CANCELLED' && g.status === 'CANCELLED');

    return matchSearch && matchStatus;
  });

  const handlePrintList = () => printPurchaseList('GTN', filteredGtns);

  const isSameWarehouse =
    formData.sourceWarehouseId &&
    formData.destinationWarehouseId &&
    Number(formData.sourceWarehouseId) === Number(formData.destinationWarehouseId);

  return (
    <div className="purchasing-no-shadows" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
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

            {/* Right Controls: Filter, Reset, Print, Refresh */}
            <div className="purchase-date-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
              <DateRangePicker documentType="GTN" from={fromDate} to={toDate} onChange={(from,to)=>{setFromDate(from);setToDate(to);}}/>
              <FilterSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{width:'140px'}}
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING">Pending</option>
                <option value="TRANSFERRED">Transferred</option>
                <option value="CANCELLED">Cancelled</option>
              </FilterSelect>

              {(statusFilter !== 'ALL' || searchTerm || fromDate || toDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');setFromDate('');setToDate('');
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
                onClick={handlePrintList}
                style={{
                  height: '38px',
                  padding: '0', width: '38px', justifyContent: 'center',
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
                title="Print GTN list" aria-label="Print GTN list"
              >
                <Printer size={15} />
              </button>

              <button
                type="button"
                onClick={loadData}
                style={{
                  height: '38px',
                  padding: '0', width: '38px', justifyContent: 'center',
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
                title="Refresh records" aria-label="Refresh records"
              >
                <RefreshCw size={15} />
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
              boxShadow: 'none',
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
                      GTN NUMBER
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      WAREHOUSE
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      TOTAL PRODUCTS
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      DATE
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      STATUS
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
                      <td colSpan="7" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        Loading transfer notes...
                      </td>
                    </tr>
                  ) : filteredGtns.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
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
                          <div title={`Sources: ${gtnWarehouseSummary(g).sources.join(', ')}; Destinations: ${gtnWarehouseSummary(g).destinations.join(', ')}`}>
                            <strong style={{fontSize:'.82rem',color:'#334155'}}>{gtnWarehouseSummary(g).text}</strong>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '.84rem', fontWeight: 600, color: '#334155' }}>
                          {new Set((g.items || []).map(item=>item.productId)).size}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#64748b' }}>
                          {g.dispatchDate || g.createdAt?.slice(0, 10) || '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <StatusBadge status={g.status} />
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#64748b', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {g.notes || g.remarks || '—'}
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
                            {['DRAFT', 'PENDING', 'TRANSFERRED'].includes(g.status) && (<button
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
                            </button>)}
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
                    {editingGtnId ? 'Edit Stock Transfer (GTN)' : 'New Stock Transfer (GTN)'}
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0 0' }}>
                    Create a pending transfer, print for handover, then confirm receipt.
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
              <PurchaseLines products={products} items={formData.items} quantityField="quantityTransferred" withCost={false} intakeLayout="gtn" searchPriceField="sellingPrice"
                onProductSelect={selectTransferProduct}
                onItemAdded={()=>{setIntakeProduct(null);setFormData(previous=>({...previous,sourceWarehouseId:''}));}}
                buildItemData={product=>({sourceWarehouseId:productWarehouse(product),sourceWarehouseName:warehouses.find(warehouse=>String(warehouse.id)===String(productWarehouse(product)))?.name || product.warehouseName,
                  destinationWarehouseId:formData.destinationWarehouseId,destinationWarehouseName:warehouses.find(warehouse=>String(warehouse.id)===String(formData.destinationWarehouseId))?.name})}
                extraColumns={[{label:'Source',value:item=>item.sourceWarehouseName || '—'},{label:'Destination',value:item=>item.destinationWarehouseName || '—'}]} validateItem={validateTransferItem} quantityLabel="Transfer qty"
                addDisabled={!formData.destinationWarehouseId || Boolean(isSameWarehouse)} addHint={!formData.destinationWarehouseId ? 'Select the destination warehouse before adding products.' : undefined}
                searchProducts={transferSearchProducts} resultQuantity={product=>product.availableQuantity} searchEmptyMessage="No matching products with available stock."
                quantityDetails={(product, editing) => <><span>Available qty</span><strong>{!product ? '—' : stockError ? 'Unavailable' : remainingStock(product, editing) ?? 'Loading...'}</strong></>}
                onChange={items=>setFormData(previous=>({...previous,items}))} intakeFields={<><div className="purchase-fields gtn-warehouse-fields"><label>Source warehouse<input readOnly value={warehouses.find(w=>String(w.id)===String(formData.sourceWarehouseId))?.name || 'Select a product to fill automatically'}/></label><label>Destination warehouse *<FilterSelect variant="field" aria-label="Destination warehouse" value={formData.destinationWarehouseId} onChange={e=>setFormData({...formData, destinationWarehouseId:e.target.value})}><option value="">Select destination warehouse</option>{warehouses.filter(w=>String(w.id)!==String(formData.sourceWarehouseId)).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</FilterSelect></label></div><StaffSearch staff={staff} value={formData.responsibleStaffId} onChange={responsibleStaffId=>setFormData(previous=>({...previous,responsibleStaffId}))}/></>} documentFields={<div className="purchase-fields"><label className="purchase-remarks">Remarks / transfer reason<textarea maxLength={5000} rows={3} value={formData.remarks || ''} onChange={e=>setFormData({...formData, remarks:e.target.value})}/></label></div>}
                actions={              <div style={{ display: 'flex', gap: '10px' }}>
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
                  {editingGtnStatus === 'TRANSFERRED' || editingGtnStatus === 'PENDING' ? 'Save Changes' : 'Save Draft'}
                </button>
{editingGtnStatus !== 'TRANSFERRED' && (                <button
                  type="button"
                  onClick={() => handleSaveGtn(true)}
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
                    boxShadow: 'none',
                  }}
                >
                  <CheckCircle size={16} style={{ display: 'inline', marginRight: '6px' }} />
                  {saving ? 'Saving...' : editingGtnId ? 'Save Pending & Print' : 'Create Pending & Print'}
                </button>)}
              </div>} />
            </div>
          </div>
        </div>
      )}

      {/* GTN Inspection Drawer / Modal */}
      {selectedGtn && <PurchaseInspectionModal tableToolbar type="GTN" number={selectedGtn.gtnNumber} status={selectedGtn.status} rows={selectedGtn.items || []}
        details={[
          { label: 'Source warehouses', value: gtnWarehouseSummary(selectedGtn).sources.join(', ') },
          { label: 'Destination warehouses', value: gtnWarehouseSummary(selectedGtn).destinations.join(', ') },
          { label: 'Responsible staff', value: selectedGtn.responsibleStaffName || staff.find(member=>String(member.id)===String(selectedGtn.responsibleStaffId))?.fullName },
          { label: 'Dispatch date', value: selectedGtn.dispatchDate || (selectedGtn.transferredAt || selectedGtn.createdAt)?.slice(0, 10) },
          ...(selectedGtn.receiveDate ? [{ label: 'Confirmed received', value: selectedGtn.receiveDate }] : []),
          ...(selectedGtn.lastStatusReason ? [{ label: 'Last status change reason', value: selectedGtn.lastStatusReason, wide: true }] : []),
          { label: 'Remarks', value: selectedGtn.notes || selectedGtn.remarks, wide: true },
        ]}
        onClose={() => setSelectedGtn(null)} onPrint={() => pdfApi.printGtn(selectedGtn.id)}
        actions={[
          ...(['DRAFT','PENDING','TRANSFERRED'].includes(selectedGtn.status) ? [{ label: 'Edit GTN', icon: Edit2, disabled: saving, onClick:()=>handleEditGtn(selectedGtn) }] : []),
          ...(['DRAFT','CANCELLED','TRANSFERRED'].includes(selectedGtn.status) ? [{ label: 'Change to Pending', icon: RotateCw, disabled: saving, onClick:()=>openStatusChange('PENDING') }] : []),
          ...(['PENDING','CANCELLED'].includes(selectedGtn.status) ? [{ label: 'Mark Transferred', icon: CheckCircle, tone: 'success', disabled: saving, onClick:()=>openStatusChange('TRANSFERRED') }] : []),
          ...(selectedGtn.status !== 'CANCELLED' ? [{ label: 'Cancel GTN', icon: Ban, tone: 'danger', disabled: saving, onClick:()=>openStatusChange('CANCELLED') }] : []),
        ]}
        columns={[
          { label: 'Product code', value: item => item.productSku || '—' },
          { label: 'Product name', value: item => item.productName },
          { label: 'Source', value:item=>item.sourceWarehouseName || selectedGtn.sourceWarehouseName || '—' },
          { label: 'Destination', value:item=>item.destinationWarehouseName || selectedGtn.destinationWarehouseName || '—' },
          { label: 'Transfer qty', numeric: true, value: item => item.quantityTransferred ?? item.quantity },
        ]} />}

      {selectedGtn && statusTarget && <GtnStatusDialog document={selectedGtn} target={statusTarget} reason={statusReason} onReasonChange={setStatusReason}
        confirmed={signedCopyReceived} onConfirmChange={setSignedCopyReceived} busy={saving} onClose={()=>setStatusTarget(null)} onSave={handleStatusChange}/>}
      {statusChangeDialog}
    </div>
  );
});

export default GtnView;
