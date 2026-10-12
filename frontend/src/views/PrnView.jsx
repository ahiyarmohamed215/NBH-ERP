import FilterSelect from '../components/FilterSelect';
import '../components/PurchasingAppearance.css';
import DateRangePicker, {matchesDateRange} from '../components/DateRangePicker';
import { availableStock, loadPurchaseInventory } from '../utils/purchaseInventory';
import StatusBadge from '../components/StatusBadge';
import { printPurchaseList } from '../utils/purchasePrint';
import { printPrnDocument } from '../utils/prnPrint';
import PurchaseInspectionModal from '../components/PurchaseInspectionModal';
import PurchaseLines from '../components/PurchaseLines';
import { usePurchasingStatusChange } from '../hooks/usePurchasingStatusChange';

import React, { useState, useEffect } from 'react';
import { prnApi, warehouseApi, productApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  RotateCcw,
  Search,
  CheckCircle,
  RefreshCw,
  Edit2,
  Printer,
  Ban,
  RotateCw,
  X,
  Package,
} from 'lucide-react';

const PrnView = React.forwardRef(function PrnView(props, ref) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  useEffect(() => { props.onFormModeChange?.(showCreateForm); }, [showCreateForm, props.onFormModeChange]);
  const [prns, setPrns] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [returnSources, setReturnSources] = useState([]);
  const [intakeProduct, setIntakeProduct] = useState(null);
  const [editingPrnId, setEditingPrnId] = useState(null);
  const [editingPrnStatus, setEditingPrnStatus] = useState(null);
  const [originalStockCredit, setOriginalStockCredit] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fromDate,setFromDate]=useState('');
  const [toDate,setToDate]=useState('');
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
    reason: '',
    remarks: '',
    items: [],
  });

  // Inspection modal state for viewing an existing PRN
  const [selectedPrn, setSelectedPrn] = useState(null);

  const { addToast } = useToast();
  const {requestStatusChange,statusChangeDialog}=usePurchasingStatusChange();

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setIntakeProduct(null);setEditingPrnId(null);setEditingPrnStatus(null);setOriginalStockCredit({});

    setFormData({
      supplierId: '',
      warehouseId: '',
      originalGrnNumber: '',
      reason: '',
      remarks: '',
      items: [],
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [prnRes, whRes, prodRes, stockRows, sourceRes] = await Promise.all([
        prnApi.search({ size: 100 }),
        warehouseApi.getActive(),
        productApi.getProducts({ size: 250, activeOnly: false }),
        loadPurchaseInventory(),
        prnApi.getReturnSources(),
      ]);

      const pList = prnRes.data?.content || prnRes.data || [];
      const wList = whRes.data || [];
      const prodList = prodRes.data?.content || prodRes.data || [];

      setPrns(pList);
      setWarehouses(wList);
      setProducts(prodList);
      setInventory(stockRows);
      setReturnSources(sourceRes.data || []);

      if (formData.items.length === 0) {
        resetForm();
      }
    } catch (err) {
      addToast('Failed to load purchase returns: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const returnAvailable = (product, editing = null) => {
    if (!product) return 0;
    const warehouseId = product.warehouseId || formData.warehouseId;
    const stock = inventory.find(stock => String(stock.productId) === String(product.id) && String(stock.warehouseId) === String(warehouseId));
    const stockRemaining = Math.max(0, (stock ? availableStock(stock) : 0) + (originalStockCredit[`${warehouseId}:${product.id}`] || 0) - formData.items.reduce((sum, item, index) =>
      index !== editing && String(item.warehouseId || formData.warehouseId) === String(warehouseId) && String(item.productId) === String(product.id) ? sum + Number(item.quantityReturned || 0) : sum, 0));
    const receiptRemaining = product.sourceGrnId ? Math.max(0, Number(product.returnableQuantity || 0) - formData.items.reduce((sum,item,index)=>
      index !== editing && String(item.sourceGrnId) === String(product.sourceGrnId) && String(item.productId) === String(product.id) ? sum + Number(item.quantityReturned || 0) : sum,0)) : stockRemaining;
    return Math.min(stockRemaining, receiptRemaining);
  };
  const returnSearchProducts = inventory.flatMap(stock => {
    const product = products.find(product => String(product.id) === String(stock.productId));
    if (!product) return [];
    const result = { ...product, warehouseId: stock.warehouseId, defaultWarehouseId: stock.warehouseId,
      warehouseName: stock.warehouseName || warehouses.find(warehouse => String(warehouse.id) === String(stock.warehouseId))?.name,
      searchKey: `${stock.productId}:${stock.warehouseId}` };
    const sources = returnSources.filter(source=>String(source.productId) === String(stock.productId) && String(source.warehouseId) === String(stock.warehouseId));
    const choices = sources.length ? sources.map(source=>({...result,...source,id:source.productId,defaultWarehouseId:source.warehouseId,searchKey:`${stock.productId}:${stock.warehouseId}:${source.sourceGrnId}`})) : [result];
    return choices.filter(choice=>returnAvailable(choice)>0);
  });
  const selectReturnProduct = (product, item) => {
    if (!product) { setIntakeProduct(null);return; }
    const selected = item ? {...product,...item,id:item.productId,defaultWarehouseId:item.warehouseId,
      returnableQuantity:returnSources.find(source=>String(source.productId) === String(item.productId) && String(source.sourceGrnId) === String(item.sourceGrnId) && String(source.warehouseId) === String(item.warehouseId))?.returnableQuantity || 0} : product;
    setIntakeProduct(selected);
    setFormData(previous => ({ ...previous, supplierId:selected.supplierId || '', warehouseId:selected.warehouseId || '', sourceGrnId:selected.sourceGrnId || '', originalGrnNumber:selected.originalGrnNumber || '', reason:item?.reason || '', remarks:item?.remarks || '' }));
  };
  const validateReturnItem = (product, quantity, editing) => {
    if (!intakeProduct?.sourceGrnId) { addToast('This stock has no eligible original GRN to return against.', 'error');return false; }
    if (!formData.reason.trim()) { addToast('Enter a return reason before adding the item.', 'error');return false; }
    const available = returnAvailable(intakeProduct, editing);
    if (quantity > available) { addToast(`Insufficient stock. Available quantity: ${available}.`, 'error'); return false; }
    return true;
  };

  const calculateTotal = () => {
    return formData.items.reduce(
      (sum, item) => sum + (item.quantityReturned || 0) * (item.unitCost || 0),
      0
    );
  };

  const handleSavePrn = async (processImmediately = true, statusReason) => {
    if (formData.items.length === 0) {
      addToast('Add at least one item to return', 'error');
      return;
    }
    if(editingPrnId && processImmediately && editingPrnStatus !== 'PROCESSED' && !statusReason) {
      requestStatusChange({type:'PRN',number:prns.find(document=>document.id===editingPrnId)?.prnNumber || `PRN ${editingPrnId}`,current:editingPrnStatus,target:'PROCESSED',onConfirm:reason=>handleSavePrn(processImmediately,reason)});return;
    }

    try {
      setSaving(true);
      const payload = {
        statusReason,
        returnDate: formData.returnDate || (()=>{const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;})(),
        items: formData.items.map((it) => ({
          productId: Number(it.productId),
          quantityReturned: Number(it.quantityReturned),
          unitCost: Number(it.unitCost),
          sourceGrnId:Number(it.sourceGrnId),warehouseId:Number(it.warehouseId),reason:it.reason,remarks:it.remarks || null,
        })),
      };

      const res = editingPrnId ? await prnApi.update(editingPrnId,payload,processImmediately) : await prnApi.create(payload, processImmediately);
      const prnNum = res.data?.prnNumber || 'note';
      addToast(
        `Purchase Return ${prnNum} ${res.data?.status === 'PROCESSED' ? 'updated. Inventory adjusted.' : 'saved as draft.'}`,
        'success'
      );
      resetForm();
      loadData();
      setShowCreateForm(false);
      setSelectedPrn(res.data);
    } catch (err) {
      addToast(err.message || 'Failed to create PRN', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleProcessPrn = async (id, prnNumber, reason) => {
    if(!reason) {requestStatusChange({type:'PRN',number:prnNumber,current:selectedPrn?.status || 'DRAFT',target:'PROCESSED',description:'Processing this return deducts available stock and updates the supplier balance. Enter a reason for the audit log.',onConfirm:reason=>handleProcessPrn(id,prnNumber,reason)});return;}
    if (saving) return;
    setSaving(true);
    try {
      const res = await prnApi.process(id,reason);
      setSelectedPrn((current) => current?.id === id ? res.data : current);
      addToast(`Purchase Return ${prnNumber} processed! Inventory updated.`, 'success');
      loadData();
    } catch (err) {
      addToast(err.response?.data?.message || 'Processing failed: ' + err.message, 'error');
      return false;
    } finally {
      setSaving(false);
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
    if (p.status === 'CANCELLED') return;
    try {
      const [res,stockRows,sourceRes] = await Promise.all([prnApi.getById(p.id),loadPurchaseInventory(),prnApi.getReturnSources()]);
      const fullPrn = res.data;
      if (fullPrn.status === 'CANCELLED') return;
      const credits = {}, sources = sourceRes.data || [];
      if (fullPrn.status === 'PROCESSED') {
        for (const item of fullPrn.items || []) {
          const warehouseId=item.warehouseId || fullPrn.warehouseId, sourceGrnId=item.sourceGrnId || fullPrn.sourceGrnId;
          const quantity=Number(item.quantityReturned || 0);
          const stockKey=`${warehouseId}:${item.productId}`;credits[stockKey]=(credits[stockKey] || 0)+quantity;
          if (!stockRows.some(stock=>String(stock.warehouseId)===String(warehouseId) && String(stock.productId)===String(item.productId))) stockRows.push({warehouseId,productId:item.productId,warehouseName:item.warehouseName || fullPrn.warehouseName,quantity:0});
          const matching=sources.filter(source=>String(source.productId)===String(item.productId) && String(source.sourceGrnId)===String(sourceGrnId));
          for(const source of matching) source.returnableQuantity=Number(source.returnableQuantity)+quantity;
          if (!matching.some(source=>String(source.warehouseId)===String(warehouseId))) sources.push({...item,warehouseId,sourceGrnId,originalGrnNumber:item.originalGrnNumber || fullPrn.originalGrnNumber,supplierId:item.supplierId || fullPrn.supplierId,supplierName:item.supplierName || fullPrn.supplierName,warehouseName:item.warehouseName || fullPrn.warehouseName,costPrice:item.unitCost,returnableQuantity:matching[0]?.returnableQuantity || quantity});
        }
      }
      setInventory(stockRows);setReturnSources(sources);setOriginalStockCredit(credits);
      setEditingPrnId(fullPrn.id);setEditingPrnStatus(fullPrn.status);setIntakeProduct(null);
      setSelectedPrn(null);
      setFormData({
        returnDate:fullPrn.returnDate,
        supplierId: fullPrn.supplierId || '',
        warehouseId: fullPrn.warehouseId || '',
        originalGrnNumber: fullPrn.originalGrnNumber || '',
        reason: '',
        remarks: fullPrn.remarks || '',
        items: (fullPrn.items || []).map((it) => ({
          ...it,
          productId: it.productId,
          productCode: it.productSku || '',
          productName: it.productName || '',
          unitOfMeasure: it.unitOfMeasure || 'PCS',
          quantityReturned: Number(it.quantityReturned || 1),
          warehouseId:it.warehouseId || fullPrn.warehouseId,
          sourceGrnId:it.sourceGrnId || fullPrn.sourceGrnId,
          unitCost: Number(it.unitCost || 0),
          reason: it.reason || fullPrn.reason || '',
        })),
      });
      setShowCreateForm(true);
    } catch (err) {
      addToast('Failed to load PRN for editing: ' + err.message, 'error');
    }
  };

  const handlePrintPrn = async (p) => {
    try { const response = await prnApi.getById(p.id);printPrnDocument(response.data); }
    catch(error) { addToast(error.message || 'Failed to load PRN for printing','error'); }
  };

  const handleCancelPRN = async (reason) => {
    if(selectedPrn && !reason) {requestStatusChange({type:'PRN',number:selectedPrn.prnNumber,current:selectedPrn.status,target:'CANCELLED',description:selectedPrn.status === 'PROCESSED' ? 'Cancelling this processed PRN restores returned stock to its original warehouses and reverses the supplier credit. Enter the cancellation reason.' : 'Enter the reason for cancelling this PRN.',onConfirm:reason=>handleCancelPRN(reason)});return;}
    if (saving || !selectedPrn) return;
    setSaving(true);
    try {
      const response = await prnApi.cancel(selectedPrn.id,reason);
      setSelectedPrn(response.data);
      addToast('PRN cancelled successfully.', 'success');
      await loadData();
    } catch (error) { addToast(error.response?.data?.message || error.message || 'Cancellation failed', 'error');return false; }
    finally { setSaving(false); }
  };

  const filteredPrns = prns.filter((p) => {
    if(!matchesDateRange(p.returnDate || p.createdAt,fromDate,toDate)) return false;
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
      (statusFilter === 'DRAFT' && p.status === 'DRAFT') ||
      (statusFilter === 'CANCELLED' && p.status === 'CANCELLED');

    return matchSearch && matchStatus;
  });

  const handlePrintList = () => printPurchaseList('PRN', filteredPrns);

  const totalReturnVal = calculateTotal();

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
          <DateRangePicker documentType="PRN" from={fromDate} to={toDate} onChange={(from,to)=>{setFromDate(from);setToDate(to);}}/>
              <FilterSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{width:'140px'}}
          >
            <option value="ALL">All Statuses</option>
            <option value="PROCESSED">Processed</option>
                  <option value="CANCELLED">Cancelled</option>
            <option value="DRAFT">Draft</option>
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
            type="button" title="Print PRN list" aria-label="Print PRN list"
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

      {/* PRN Table (Fixed Table Frame, Sticky Header - Exact CustomerHub Look) */}
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
              <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      PRN NUMBER
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      SUPPLIER
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      WAREHOUSE
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>
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
                          {new Set((p.items || []).map(item=>item.productId)).size}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#475569', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.returnDate || p.createdAt?.slice(0,10) || '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <StatusBadge status={p.status} />
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#64748b' }}>
                          {p.notes || p.remarks || '—'}
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
                            {p.status !== 'CANCELLED' && (<button
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
                            </button>)}
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
        <div className="purchase-document prn-document">
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
                    {editingPrnId ? 'Edit Purchase Return (PRN)' : 'New Purchase Return (PRN)'}
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0 0' }}>
                    Issue vendor debit note and deduct returned inventory stock from warehouse
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { resetForm();loadData(); }}
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
                  onClick={() => { setShowCreateForm(false);resetForm();loadData(); }}
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
              <PurchaseLines key={editingPrnId || 'new'} products={products} items={formData.items} quantityField="quantityReturned" withCost={true}
                costReadOnly showCostField={false} initialQuantity="" intakeLayout="gtn" quantityLabel="Return quantity"
                quantityDetails={(product,editing)=><div className="prn-return-card">
                  <h4 title={product && intakeProduct?.warehouseName || undefined}>{product && intakeProduct?.warehouseName || 'Stocked warehouse'}</h4>
                  <div className="prn-return-card-reference">
                    <span title={product && intakeProduct?.originalGrnNumber || undefined}><small>Original GRN</small><b>{product && intakeProduct?.originalGrnNumber || '—'}</b></span>
                    <span title={product && intakeProduct?.supplierName || undefined}><small>Supplier</small><b>{product && intakeProduct?.supplierName || '—'}</b></span>
                  </div>
                  <div className="prn-return-card-metrics">
                    <div><span>Available to return</span><strong>{product && intakeProduct ? returnAvailable(intakeProduct,editing) : '—'}</strong></div>
                    <div><span>Unit price</span><b>{product && intakeProduct ? `LKR ${Number(intakeProduct.unitCost ?? intakeProduct.costPrice ?? 0).toFixed(2)}` : '—'}</b></div>
                  </div>
                </div>}
                resultDetails={product=>product.sourceGrnId ? `Supplier: ${product.supplierName} · GRN: ${product.originalGrnNumber}` : 'No eligible original GRN'}
                extraColumns={[
                  {label:'Original GRN',value:item=>item.originalGrnNumber || '—'},
                  {label:'Reason',value:item=>item.reason || '—'},
                ]}
                buildItemData={()=>({sourceGrnId:intakeProduct.sourceGrnId,originalGrnNumber:intakeProduct.originalGrnNumber,
                  supplierId:intakeProduct.supplierId,supplierName:intakeProduct.supplierName,warehouseName:intakeProduct.warehouseName,
                  reason:formData.reason.trim(),remarks:formData.remarks.trim()})}
                onItemAdded={()=>{setIntakeProduct(null);setFormData(previous=>({...previous,supplierId:'',warehouseId:'',sourceGrnId:'',originalGrnNumber:'',reason:'',remarks:''}));}}
                addDisabled={!intakeProduct?.sourceGrnId || !formData.reason.trim()}
                addHint={intakeProduct && !intakeProduct.sourceGrnId ? 'No eligible original GRN is available for this stock.' : undefined}
                searchProducts={returnSearchProducts} searchResultLimit={Infinity} resultQuantity={product=>returnAvailable(product)}
                onProductSelect={selectReturnProduct} validateItem={validateReturnItem} searchEmptyMessage="No matching inventory items with available stock."
                onChange={items=>setFormData(previous=>({...previous,items}))} documentFields={<div className="purchase-fields">
                  <label className="purchase-remarks">Return reason *<input type="text" maxLength={255} value={formData.reason} placeholder="Enter the reason for this return" onChange={event=>setFormData(previous=>({...previous,reason:event.target.value}))}/></label>
                  <label className="purchase-remarks">Remarks / notes<textarea rows={3} value={formData.remarks || ''} onChange={event=>setFormData(previous=>({...previous,remarks:event.target.value}))}/></label>
                </div>}
                actions={              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowCreateForm(false);resetForm();loadData(); }}
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
                {editingPrnStatus !== 'PROCESSED' && <button
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
                </button>}
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
                    boxShadow: 'none',
                  }}
                >
                  <CheckCircle size={16} style={{ display: 'inline', marginRight: '6px' }} />
                  {saving ? 'Saving...' : editingPrnStatus === 'PROCESSED' ? 'Save Changes' : 'Process Return & Debit Stock'}
                </button>
              </div>} />
            </div>
          </div>
        </div>
      )}

      {/* PRN Inspection Drawer / Modal */}
      {selectedPrn && <PurchaseInspectionModal type="PRN" number={selectedPrn.prnNumber} status={selectedPrn.status} rows={selectedPrn.items || []}
        onPrint={()=>printPrnDocument(selectedPrn)}
        details={[
          { label: 'Supplier name', value: selectedPrn.supplierName },
          { label: 'Return date', value: selectedPrn.returnDate || selectedPrn.createdAt?.slice(0, 10) },
          { label: 'Dispatch warehouse', value: selectedPrn.warehouseName },
          { label: 'Total value', value: 'LKR ' + Number(selectedPrn.totalAmount || 0).toFixed(2) },
          { label: 'Remarks', value: selectedPrn.notes || selectedPrn.remarks, wide: true },
        ]}
        onClose={() => setSelectedPrn(null)}
        actions={[
          ...(selectedPrn.status !== 'CANCELLED' ? [{label:'Edit PRN',icon:Edit2,disabled:saving,onClick:()=>handleEditPrn(selectedPrn)}] : []),
          ...(['DRAFT', 'PENDING', 'CANCELLED'].includes(selectedPrn.status) ? [{ label: selectedPrn.status === 'CANCELLED' ? 'Reprocess PRN' : 'Process PRN', icon: selectedPrn.status === 'CANCELLED' ? RotateCw : CheckCircle, disabled: saving, onClick: () => handleProcessPrn(selectedPrn.id, selectedPrn.prnNumber) }] : []),
          ...(selectedPrn.status !== 'CANCELLED' ? [{ label: 'Cancel PRN', icon: Ban, tone: 'danger', disabled: saving, onClick: ()=>handleCancelPRN() }] : []),
        ]}
        columns={[
          { label: 'Product code', value: item => item.productSku || '—' },
          { label: 'Product name', value: item => item.productName },
          { label: 'Supplier', value: item => item.supplierName || selectedPrn.supplierName },
          { label: 'Warehouse', value: item => item.warehouseName || selectedPrn.warehouseName },
          { label: 'Original GRN', value: item => item.originalGrnNumber || selectedPrn.originalGrnNumber || '—' },
          { label: 'Qty returned', numeric: true, value: item => item.quantityReturned },
          { label: 'Unit cost', numeric: true, value: item => 'LKR ' + Number(item.unitCost || 0).toFixed(2) },
          { label: 'Reason', value: item => item.reason || selectedPrn.reason },
          { label: 'Remarks', value: item => item.remarks || '—' },
        ]} />}

      {statusChangeDialog}
    </div>
  );
});

export default PrnView;
