import {purchaseSellingPrice} from '../utils/purchaseSellingPrice';
import {newestFirst} from '../utils/recordOrder';
import {documentErrors,numberError} from '../utils/purchasingValidation';
import FilterSelect from '../components/FilterSelect';
import '../components/PurchasingAppearance.css';
import { availableStock, loadPurchaseInventory } from '../utils/purchaseInventory';
import StatusBadge from '../components/StatusBadge';
import DateRangePicker from '../components/DateRangePicker';
import { printPurchaseOrder, printPurchaseOrders, purchaseOrderDate } from '../utils/poPrint';
import PurchaseInspectionModal from '../components/PurchaseInspectionModal';
import PurchaseLines from '../components/PurchaseLines';
import { usePurchasingStatusChange } from '../hooks/usePurchasingStatusChange';
import React, { useState, useEffect, useRef } from 'react';
import { supplierApi, warehouseApi, productApi, purchaseOrderApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  ShoppingBag,
  Search,
  CheckCircle,
  RefreshCw,
  Edit2,
  X,
  Printer,
  RotateCw,
  Ban,
  Calendar,
  DollarSign,
  Package,
} from 'lucide-react';

const PurchaseOrdersView = React.forwardRef(function PurchaseOrdersView(props, ref) {
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [inventoryLoaded,setInventoryLoaded]=useState(false);
  const [intakeProduct,setIntakeProduct]=useState(null);
  const [loading, setLoading] = useState(false);
  const loadGeneration = useRef(0);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fromDate,setFromDate]=useState('');
  const [toDate,setToDate]=useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  useEffect(() => { props.onFormModeChange?.(showCreateForm); }, [showCreateForm, props.onFormModeChange]);
  const [editingPoId, setEditingPoId] = useState(null);
  const [editingPoStatus,setEditingPoStatus]=useState('DRAFT');
  // Modal State for Inspecting PO
  const [selectedPo, setSelectedPo] = useState(null);

  const { addToast } = useToast();
  const {requestStatusChange,statusChangeDialog}=usePurchasingStatusChange();

  React.useImperativeHandle(ref, () => ({
    openCreate: () => {
      resetForm();
      setShowCreateForm(true);
    },
    refresh: () => loadData({force:true}),
  }));

  // Create PO Form State
  const [formData, setFormData] = useState({
    supplierId: '',
    warehouseId: '',
    notes: '',
    items: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async ({force=false} = {}) => {
    const generation = ++loadGeneration.current;
    const config = force ? {skipCache:true,skipDedupe:true} : {};
    setLoading(true);
    const apply = setter => response => {
      if (generation === loadGeneration.current) setter(response);
    };
    const requests = [
      ['purchase orders', () => purchaseOrderApi.search({},config), response => setPurchaseOrders(response.data?.content || (Array.isArray(response.data) ? response.data : []))],
      ['suppliers', () => supplierApi.getActive(config), response => setSuppliers(response.data || [])],
      ['warehouses', () => warehouseApi.getActive(config), response => setWarehouses(response.data || [])],
      ['products', () => productApi.getProducts({size:300,activeOnly:false},config), response => setProducts(response.data?.content || response.data || [])],
      ['stock quantities', () => loadPurchaseInventory(config), rows => {setInventory(rows);setInventoryLoaded(true);}],
    ];
    const results = await Promise.allSettled(requests.map(([,fetch,update]) => Promise.resolve().then(fetch).then(apply(update))));
    if (generation !== loadGeneration.current) return;
    setLoading(false);
    if (results[4].status === 'rejected') setInventoryLoaded(false);
    if (results[0].status === 'rejected') {
      const error = results[0].reason;
      addToast(error.response?.data?.message || error.message || 'Unable to refresh purchase orders.','error');
      return;
    }
    const failed = requests.filter((_,index) => results[index].status === 'rejected').map(([name]) => name);
    if (failed.length) addToast(`Purchase orders loaded; could not refresh ${failed.join(', ')}.`,'warning');
  };

  const resetForm = () => {
    setEditingPoId(null);setEditingPoStatus('DRAFT');setIntakeProduct(null);
    setFormData({
      supplierId: '',
      warehouseId: '',
        notes: '',
      items: [],
    });

  };

  const handlePoStatus = async (status, reason) => {
    if (!selectedPo || saving) return;
    if (!reason) {requestStatusChange({type:'PO',number:selectedPo.poNumber,current:selectedPo.status,target:status,onConfirm:reason=>handlePoStatus(status,reason)});return;}
    setSaving(true);
    try {
      const response = await purchaseOrderApi.changeStatus(selectedPo.id,status,reason);
      setSelectedPo(response.data);
      addToast(status === 'INFORM_TO_ORDER' ? 'PO marked Inform to Order. Ready to print.' : status === 'CANCELLED' ? 'PO cancelled.' : 'PO returned to draft.', 'success');
      await loadData();
    } catch (error) {addToast(error.response?.data?.message || error.message || 'Unable to update PO','error');return false;}
    finally {setSaving(false);}
  };

  const handleEditPo = (po) => {
    setEditingPoId(po.id);setEditingPoStatus(po.status);setIntakeProduct(null);
    setFormData({
      supplierId: po.supplierId || '',
      warehouseId: po.warehouseId || '',
      notes: po.notes || '',
      items: (po.items || []).map(item=>({...item,warehouseId:item.warehouseId || po.warehouseId,warehouseName:item.warehouseName || po.warehouseName,supplierId:item.supplierId || po.supplierId,supplierName:item.supplierName || po.supplierName})),
    });
    setShowCreateForm(true);
  };

  const calculateGrandTotal = () => {
    return formData.items.reduce((sum, it) => sum + (it.totalCost || 0), 0);
  };
  const productWarehouse=product=>product?.defaultWarehouseId || product?.warehouseId;
  const productWarehouseName=product=>warehouses.find(warehouse=>String(warehouse.id)===String(productWarehouse(product)))?.name || product?.defaultWarehouseName || product?.warehouseName;
  const stockQuantity=product=>inventory.filter(stock=>String(stock.productId)===String(product.id)).reduce((sum,stock)=>sum+availableStock(stock),0);
  const orderSearchProducts=products.map(product=>({...product,warehouseName:productWarehouseName(product)}));
  const selectOrderProduct=(product,item)=>{
    setIntakeProduct(product ? item ? {...product,...item,defaultWarehouseId:item.warehouseId,id:item.productId} : product : null);
    if(item) setFormData(previous=>({...previous,supplierId:item.supplierId || ''}));
  };
  const canOrderProduct=product=>product && product.isActive!==false && product.active!==false && warehouses.some(warehouse=>String(warehouse.id)===String(productWarehouse(product)));
  const validateOrderItem=(product,quantity,editing)=>{
    if(!canOrderProduct(intakeProduct)) {addToast('Select an active product with an active delivery warehouse configured in Inventory.','error');return false;}
    if(!formData.supplierId) {addToast('Select a supplier for this product.','error');return false;}
    if(formData.items.some((item,index)=>index!==editing && String(item.productId)===String(product.id) && String(item.supplierId)===String(formData.supplierId))) {addToast('This product is already ordered from that supplier. Use its edit icon to update quantity.','error');return false;}
    return true;
  };

  const handleSavePurchaseOrder = async (status = 'DRAFT', statusReason) => {
    const validationErrors=documentErrors('PO',formData);if(validationErrors.length){addToast(validationErrors[0],'error');return;}
    if(!formData.items.length || formData.items.some(item=>!item.supplierId)) { addToast('Choose a supplier for each product and add order lines', 'error'); return; }
    if(formData.items.some(item=>!item.warehouseId)) {addToast('Every product needs its configured delivery warehouse.','error');return;}
    if(editingPoId && status!==editingPoStatus && !statusReason) {requestStatusChange({type:'PO',number:purchaseOrders.find(document=>document.id===editingPoId)?.poNumber || `PO ${editingPoId}`,current:editingPoStatus,target:status,onConfirm:reason=>handleSavePurchaseOrder(status,reason)});return;}
    setLoading(true);
    try {
      const payload = { ...formData, status, statusReason, supplierId: Number(formData.items[0].supplierId),warehouseId:Number(formData.items[0].warehouseId),expectedDate:null,
        items: formData.items.map(i => ({ productId: Number(i.productId), quantity: Number(i.quantity), unitCost: Number(i.unitCost),warehouseId:Number(i.warehouseId),supplierId:Number(i.supplierId) })) };
      const response = editingPoId ? await purchaseOrderApi.update(editingPoId, payload) : await purchaseOrderApi.create(payload);
      if(status === 'INFORM_TO_ORDER') setSelectedPo(response.data);
      await loadData(); setShowCreateForm(false); resetForm(); addToast('Purchase order saved', 'success');
    } catch(e) { addToast(e.message, 'error');return false; } finally { setLoading(false); }
  };

  const handlePrintList = () => {if(!filteredOrders.length) {addToast('No purchase orders match these filters.','info');return;}printPurchaseOrders(filteredOrders);};

  const filteredOrders = newestFirst(purchaseOrders).filter((po) => {
    const date=purchaseOrderDate(po);
    if(fromDate && (!date || date<fromDate)) return false;
    if(toDate && (!date || date>toDate)) return false;
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
    <div className="purchasing-no-shadows" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
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
              title="Clear search text"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Right Controls: Filter, Reset, Print, Refresh */}
        <div className="purchase-date-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
          <DateRangePicker from={fromDate} to={toDate} onChange={(from,to)=>{setFromDate(from);setToDate(to);}}/>
          <FilterSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{width:'140px'}}
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="INFORM_TO_ORDER">Inform to Order</option>
            <option value="CANCELLED">Cancelled</option>
          </FilterSelect>

          {(statusFilter !== 'ALL' || searchTerm || fromDate || toDate) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setSearchTerm('');setFromDate('');setToDate('');
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
            title="Print PO list" aria-label="Print PO list"
          >
            <Printer size={15} />
          </button>

          <button
            type="button"
            onClick={() => loadData({force:true})} disabled={loading} aria-busy={loading}
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
            <RefreshCw size={15} className={loading ? 'animate-spin' : undefined} />
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
          boxShadow: 'none',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
          <table aria-busy={loading} style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{position:'sticky',top:0,zIndex:10}}><tr>{['PO NUMBER','SUPPLIER','DESTINATION WAREHOUSE','TOTAL PRODUCTS','DATE','STATUS','REMARKS','ACTIONS'].map(label=><th key={label} style={{padding:'12px 14px',fontSize:'.74rem',fontWeight:600,color:'#475569',background:'#fafbfc',borderBottom:'1px solid #e2e8f0'}}>{label}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="8" style={{textAlign:'center',padding:'48px 20px',color:'#64748b'}}><span role="status">Loading purchase orders...</span></td></tr> : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                    No purchase orders found. Click <strong>+ New Purchase Order</strong> to issue a new order.
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
                    <td style={{padding:'12px 14px'}}>{new Set((po.items || []).map(item=>item.productId)).size}</td>
                    <td style={{padding:'12px 14px',fontSize:'.82rem',color:'#64748b'}}>{purchaseOrderDate(po)}</td>
                    <td style={{padding:'12px 14px'}}><StatusBadge status={po.status}/></td>
                    <td style={{padding:'12px 14px',fontSize:'.82rem',color:'#475569',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={po.notes || ''}>{po.notes || '—'}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                        {['DRAFT','INFORM_TO_ORDER'].includes(po.status) && (<button
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
                        </button>)}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            printPurchaseOrder(po);
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
        <div className="purchase-document po-document">
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
                    {editingPoId ? 'Edit Purchase Order (PO)' : 'New Purchase Order (PO)'}
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0 0' }}>
                    Save a draft, or create an order to print and hand over
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
              <PurchaseLines products={products} items={formData.items} quantityField="quantity" withCost={true}
                costReadOnly showCostField={false} initialQuantity="" intakeLayout="gtn" searchPriceField="sellingPrice" showSellingPrice inlineIntakeFields quantityLabel="Qty"
                searchProducts={orderSearchProducts} searchResultLimit={Infinity} resultQuantity={inventoryLoaded ? stockQuantity : undefined}
                resultDetails={product=>product.isActive===false || product.active===false ? 'Inactive product' : !productWarehouse(product) ? 'No delivery warehouse' : null}
                quantityDetails={product=><div className="prn-return-card po-product-card">
                  <small className="po-card-caption">Delivery warehouse</small><h4 title={product && intakeProduct ? productWarehouseName(intakeProduct) : undefined}>{product && intakeProduct ? productWarehouseName(intakeProduct) || 'Not configured' : 'Select a product'}</h4>
                  <div className="prn-return-card-metrics"><div><span>Selling price</span><b>{product && intakeProduct ? `LKR ${purchaseSellingPrice(intakeProduct,products).toFixed(2)}` : '—'}</b></div>
                    <div><span>Stock in system</span><b>{product && intakeProduct && inventoryLoaded ? stockQuantity(intakeProduct) : '—'}</b></div></div>
                </div>}
                intakeFields={<label className="po-supplier-field">Supplier *<FilterSelect variant="field" aria-label="Supplier" value={formData.supplierId} onChange={event=>setFormData(previous=>({...previous,supplierId:event.target.value}))}><option value="">Choose supplier</option>{suppliers.map(supplier=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</FilterSelect></label>}
                onProductSelect={selectOrderProduct} validateItem={validateOrderItem} addDisabled={!canOrderProduct(intakeProduct) || !formData.supplierId}
                addHint={intakeProduct && !canOrderProduct(intakeProduct) ? 'Ordering needs an active product with a delivery warehouse set in Inventory.' : undefined}
                buildItemData={()=>({warehouseName:productWarehouseName(intakeProduct),supplierId:Number(formData.supplierId),supplierName:suppliers.find(supplier=>String(supplier.id)===String(formData.supplierId))?.name})} onItemAdded={()=>{setIntakeProduct(null);setFormData(previous=>({...previous,supplierId:''}));}}
                extraColumns={[{label:'Supplier name',value:item=>item.supplierName || '—'}]}
                onChange={items=>setFormData(previous=>({...previous,items}))} documentFields={<div className="purchase-fields"><label className="purchase-remarks">Remarks / notes<textarea maxLength={5000} rows={3} value={formData.notes || ''} onChange={event=>setFormData(previous=>({...previous,notes:event.target.value}))}/></label></div>}
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
                  onClick={() => handleSavePurchaseOrder(editingPoStatus)}
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
                  {editingPoId ? 'Save Changes' : 'Save as Draft'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePurchaseOrder('INFORM_TO_ORDER')}
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
                    boxShadow: 'none',
                  }}
                >
                  {editingPoId ? 'Save & Inform to Order' : 'Inform to Order'}
                </button>
              </div>} />
            </div>
          </div>
        </div>
      )}

      {/* INSPECT PURCHASE ORDER MODAL */}
      {selectedPo && <PurchaseInspectionModal tableToolbar type="PO" number={selectedPo.poNumber} status={selectedPo.status} rows={selectedPo.items || []}
        details={[
          { label: 'Supplier name', value: selectedPo.supplierName },
          { label: 'Created date', value: purchaseOrderDate(selectedPo) },
          { label: 'Delivery warehouse', value: selectedPo.warehouseName },
          { label: 'Remarks', value: selectedPo.notes, wide: true },
        ]}
        onClose={() => setSelectedPo(null)}
        onPrint={() => printPurchaseOrder(selectedPo)}
        actions={[
          ...(['DRAFT','INFORM_TO_ORDER'].includes(selectedPo.status) ? [{label:'Edit PO',icon:Edit2,disabled:saving,onClick:()=>{const po=selectedPo;setSelectedPo(null);handleEditPo(po);}}] : []),
          ...(selectedPo.status === 'CANCELLED' ? [{label:'Inform to Order',icon:CheckCircle,tone:'success',disabled:saving,onClick:()=>handlePoStatus('INFORM_TO_ORDER')}] : []),
          ...(['DRAFT','INFORM_TO_ORDER'].includes(selectedPo.status) ? [{label:'Cancel PO',icon:Ban,tone:'danger',disabled:saving,onClick:()=>handlePoStatus('CANCELLED')}] : []),
        ]}
        columns={[
          { label: 'Product code', value: item => item.sku || item.productSku || '—' },
          { label: 'Product name', value: item => item.productName },
          { label: 'Supplier name', value:item=>item.supplierName || selectedPo.supplierName },
          { label: 'Delivery warehouse', value:item=>item.warehouseName || selectedPo.warehouseName },
          { label: 'Qty', numeric: true, value: item => item.quantity },
          { label: 'Selling price', numeric: true, value: item => 'LKR ' + purchaseSellingPrice(item,products).toFixed(2) },
          { label: 'Line total', numeric: true, value: item => 'LKR ' + (Number(item.quantity || 0)*purchaseSellingPrice(item,products)).toFixed(2) },
        ]} />}

      {statusChangeDialog}
    </div>
  );
});

export default PurchaseOrdersView;
