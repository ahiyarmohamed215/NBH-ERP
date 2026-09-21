import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import MastersView from './MastersView';
import {
  warehouseApi,
  productApi,
  adjustmentApi,
  inventoryApi,
  categoryApi,
} from '../api/apiClient';
import {
  SlidersHorizontal,
  Building2,
  Package,
  LayoutGrid,
  Search,
  Plus,
  X,
  RefreshCw,
  Eye,
  Trash2,
  Edit2,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Filter,
  Download,
  ListFilter,
  Boxes,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  ArrowRightLeft,
  Award,
} from 'lucide-react';

const STORAGE_KEY_ADJUSTMENTS = 'erp_inventory_adjustments_records_v1';

// Seeded adjustments matching user screenshot
const INITIAL_ADJUSTMENTS = [
  {
    id: 'SA-MB-7',
    recordNo: 'SA-MB-7',
    date: '8/21/2026',
    type: 'Addition',
    warehouse: 'Warehouse 1',
    warehouseId: '1',
    sku: '—',
    productName: 'Board A',
    batch: 'BN-20260821-71',
    quantity: 5,
    reason: 'Opening stock correction',
    status: 'COMPLETED',
  },
  {
    id: 'SA-MB-6',
    recordNo: 'SA-MB-6',
    date: '7/23/2026',
    type: 'Reduction',
    warehouse: 'Warehouse 1',
    warehouseId: '1',
    sku: '001',
    productName: 'තිරිඟු 100g',
    batch: 'BN-20260723-67',
    quantity: -55,
    reason: 'Stock count variance',
    status: 'COMPLETED',
  },
  {
    id: 'SA-MB-5',
    recordNo: 'SA-MB-5',
    date: '7/23/2026',
    type: 'Reduction',
    warehouse: 'Warehouse 1',
    warehouseId: '1',
    sku: '001',
    productName: 'තිරිඟු 100g',
    batch: 'BN-20260723-67',
    quantity: -45,
    reason: 'Expired stock',
    status: 'COMPLETED',
  },
  {
    id: 'SA-MB-4',
    recordNo: 'SA-MB-4',
    date: '7/23/2026',
    type: 'Reduction',
    warehouse: 'Warehouse 1',
    warehouseId: '1',
    sku: '001',
    productName: 'තිරිඟු 100g',
    batch: 'BN-20260723-67',
    quantity: -100,
    reason: 'Damaged stock',
    status: 'COMPLETED',
  },
  {
    id: 'SA-MB-3',
    recordNo: 'SA-MB-3',
    date: '7/23/2026',
    type: 'Addition',
    warehouse: 'Warehouse 1',
    warehouseId: '1',
    sku: '001',
    productName: 'තිරිඟු 100g',
    batch: 'BN-20260723-67',
    quantity: 200,
    reason: 'Found stock',
    status: 'COMPLETED',
  },
];

export default function InventoryHub({ activeSubTab = 'inventory-list', onSubTabChange, onNavigate }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const mastersRef = useRef(null);

  const INVENTORY_TABS = [
    { id: 'inventory-list', label: 'Inventory List', icon: Boxes },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'brands', label: 'Brands', icon: Award },
    { id: 'categories', label: 'Categories', icon: LayoutGrid },
    { id: 'warehouses', label: 'Warehouses', icon: Building2 },
    { id: 'adjustments', label: 'Stock Adjustment', icon: SlidersHorizontal },
  ];

  const [currentTab, setCurrentTab] = useState(() => {
    if (activeSubTab && INVENTORY_TABS.some((t) => t.id === activeSubTab)) {
      return activeSubTab;
    }
    return 'inventory-list';
  });

  // Sync subTab prop
  useEffect(() => {
    if (activeSubTab && INVENTORY_TABS.some((t) => t.id === activeSubTab)) {
      setCurrentTab(activeSubTab);
    }
  }, [activeSubTab]);

  const handleTabClick = (tabId) => {
    setCurrentTab(tabId);
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  const handleHeaderAdd = () => {
    mastersRef.current?.openAdd();
  };

  // -------------------------------------------------------------
  // STOCK ADJUSTMENTS TAB STATE & LOGIC (Matching user screenshot)
  // -------------------------------------------------------------
  const [adjustmentRecords, setAdjustmentRecords] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ADJUSTMENTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_ADJUSTMENTS;
  });

  const [warehousesList, setWarehousesList] = useState([]);
  const [productsList, setProductsList] = useState([]);

  // Filters matching screenshot
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'Addition' | 'Reduction'
  const [filterWarehouse, setFilterWarehouse] = useState('ALL');
  const [filterReason, setFilterReason] = useState('ALL');

  // Create Record Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [createForm, setCreateForm] = useState({
    type: 'Addition',
    warehouseId: '',
    productId: '',
    batch: '',
    quantity: '',
    reason: 'Opening stock correction',
    remarks: '',
  });
  const [submittingRecord, setSubmittingRecord] = useState(false);
  const [viewingRecord, setViewingRecord] = useState(null);

  // -------------------------------------------------------------
  // INVENTORY LIST (LIVE BALANCES) TAB STATE & LOGIC
  // -------------------------------------------------------------
  const [inventoryBalances, setInventoryBalances] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [categoriesList, setCategoriesList] = useState([]);
  const [invSearchQuery, setInvSearchQuery] = useState('');
  const [invWarehouseFilter, setInvWarehouseFilter] = useState('ALL');
  const [invCategoryFilter, setInvCategoryFilter] = useState('ALL');
  const [invStatusFilter, setInvStatusFilter] = useState('ALL'); // 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  const [viewingStockItem, setViewingStockItem] = useState(null);

  // Load warehouses, products, categories, and inventory balances
  const loadInventoryBalances = async () => {
    try {
      setInventoryLoading(true);
      const [balRes, prodRes, whRes, catRes] = await Promise.allSettled([
        inventoryApi.getBalances({ size: 300 }),
        productApi.getProducts({ size: 300 }),
        warehouseApi.getAll(),
        categoryApi.getActive(),
      ]);

      const fetchedBalances = balRes.status === 'fulfilled' ? (balRes.value.data?.content || balRes.value.data || []) : [];
      const fetchedProducts = prodRes.status === 'fulfilled' ? (prodRes.value.data?.content || prodRes.value.data || []) : [];
      const fetchedWarehouses = whRes.status === 'fulfilled' ? (whRes.value.data || []) : [];
      const fetchedCategories = catRes.status === 'fulfilled' ? (catRes.value.data || []) : [];

      if (whRes.status === 'fulfilled') setWarehousesList(fetchedWarehouses);
      if (prodRes.status === 'fulfilled') setProductsList(fetchedProducts);
      if (catRes.status === 'fulfilled') setCategoriesList(fetchedCategories);

      const primaryWh = fetchedWarehouses[0] || { id: 1, name: 'Warehouse 1', code: 'WH-01' };

      let items = [];

      if (fetchedBalances.length > 0) {
        items = fetchedBalances.map((b) => {
          const prod = fetchedProducts.find((p) => p.id === b.productId || p.sku === b.productSku);
          const qty = Number(b.quantity ?? 0);
          const reserved = Number(b.reservedQuantity ?? 0);
          const avail = Number(b.availableQuantity ?? (qty - reserved));
          const cost = Number(b.costPrice ?? prod?.costPrice ?? 0);
          const sell = Number(b.sellingPrice ?? prod?.sellingPrice ?? 0);
          const min = Number(b.minStockLevel ?? prod?.minStockLevel ?? 5);
          return {
            id: b.id || `bal-${b.productId}-${b.warehouseId}`,
            warehouseId: b.warehouseId || primaryWh.id,
            warehouseName: b.warehouseName || primaryWh.name,
            warehouseCode: b.warehouseCode || primaryWh.code,
            productId: b.productId || prod?.id,
            sku: b.productSku || prod?.sku || '—',
            productName: b.productName || prod?.name || 'Unknown Product',
            categoryName: prod?.categoryName || 'General',
            unitOfMeasure: b.unitOfMeasure || prod?.unitOfMeasure || 'PCS',
            quantity: qty,
            reservedQuantity: reserved,
            availableQuantity: avail,
            costPrice: cost,
            sellingPrice: sell,
            totalCostValue: Number(b.totalCostValue ?? (qty * cost)),
            minStockLevel: min,
            isLowStock: qty <= min && qty > 0,
            isOutOfStock: qty <= 0,
          };
        });
      }

      // If any products are not in balances, synthesize rows so user sees all products in inventory
      const existingProductIds = new Set(items.map((it) => it.productId));
      fetchedProducts.forEach((prod) => {
        if (!existingProductIds.has(prod.id)) {
          const matchingAdjs = adjustmentRecords.filter((a) => a.sku === prod.sku || a.productName === prod.name);
          const netAdjQty = matchingAdjs.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
          const qty = Math.max(0, netAdjQty);
          const cost = Number(prod.costPrice || 0);
          const sell = Number(prod.sellingPrice || 0);
          const min = Number(prod.minStockLevel || 5);
          items.push({
            id: `prod-bal-${prod.id}`,
            warehouseId: primaryWh.id,
            warehouseName: primaryWh.name,
            warehouseCode: primaryWh.code,
            productId: prod.id,
            sku: prod.sku || '—',
            productName: prod.name || 'Unnamed Product',
            categoryName: prod.categoryName || 'General',
            unitOfMeasure: prod.unitOfMeasure || 'PCS',
            quantity: qty,
            reservedQuantity: 0,
            availableQuantity: qty,
            costPrice: cost,
            sellingPrice: sell,
            totalCostValue: qty * cost,
            minStockLevel: min,
            isLowStock: qty <= min && qty > 0,
            isOutOfStock: qty <= 0,
          });
        }
      });

      setInventoryBalances(items);
    } catch (err) {
      console.error(err);
      addToast('Failed to load inventory balances: ' + err.message, 'error');
    } finally {
      setInventoryLoading(false);
    }
  };

  useEffect(() => {
    loadInventoryBalances();
  }, []);

  // Filtered inventory balances
  const filteredInventory = useMemo(() => {
    return inventoryBalances.filter((item) => {
      if (invWarehouseFilter !== 'ALL' && String(item.warehouseId) !== String(invWarehouseFilter) && item.warehouseName !== invWarehouseFilter) {
        return false;
      }
      if (invStatusFilter === 'IN_STOCK' && (item.quantity <= 0 || item.isLowStock)) {
        return false;
      }
      if (invStatusFilter === 'LOW_STOCK' && !item.isLowStock) {
        return false;
      }
      if (invStatusFilter === 'OUT_OF_STOCK' && !item.isOutOfStock) {
        return false;
      }

      if (invSearchQuery.trim()) {
        const q = invSearchQuery.toLowerCase();
        const matchSku = (item.sku || '').toLowerCase().includes(q);
        const matchName = (item.productName || '').toLowerCase().includes(q);
        const matchWh = (item.warehouseName || '').toLowerCase().includes(q);
        if (!matchSku && !matchName && !matchWh) {
          return false;
        }
      }
      return true;
    });
  }, [inventoryBalances, invWarehouseFilter, invStatusFilter, invSearchQuery]);

  const handleClearInvFilters = () => {
    setInvSearchQuery('');
    setInvWarehouseFilter('ALL');
    setInvCategoryFilter('ALL');
    setInvStatusFilter('ALL');
  };

  const handleExportInventoryCSV = () => {
    if (filteredInventory.length === 0) {
      addToast('No inventory records to export', 'error');
      return;
    }
    const headers = [
      'SKU',
      'Product Name',
      'Warehouse',
      'Category',
      'Unit',
      'Quantity',
      'Cost Price (LKR)',
      'Selling Price (LKR)',
      'Min Stock Level',
      'Stock Status',
    ];
    const rows = filteredInventory.map((item) => [
      `"${item.sku || ''}"`,
      `"${(item.productName || '').replace(/"/g, '""')}"`,
      `"${(item.warehouseName || '').replace(/"/g, '""')}"`,
      `"${(item.categoryName || '').replace(/"/g, '""')}"`,
      `"${item.unitOfMeasure || 'PCS'}"`,
      item.quantity ?? 0,
      (Number(item.costPrice) || 0).toFixed(2),
      (Number(item.sellingPrice) || 0).toFixed(2),
      item.minStockLevel ?? 0,
      item.isOutOfStock ? 'Out of Stock' : item.isLowStock ? 'Low Stock Alert' : 'In Stock',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inventory_list_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Inventory list exported to CSV', 'success');
  };

  const handleNavigateGTN = () => {
    if (onNavigate) {
      onNavigate('purchasing', 'gtn');
    } else {
      addToast('Navigating to Stock Transfers (GTN)...', 'info');
    }
  };

  const handleQuickAdjust = (item) => {
    const now = new Date();
    const batchNo = `BN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(10 + Math.random() * 90)}`;
    setCreateForm({
      type: 'Addition',
      warehouseId: String(item.warehouseId || warehousesList[0]?.id || ''),
      productId: String(item.productId || ''),
      batch: batchNo,
      quantity: '1',
      reason: 'Opening stock correction',
      remarks: `Quick adjustment for ${item.productName || item.sku}`,
    });
    setShowCreateModal(true);
  };

  // Save adjustments to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ADJUSTMENTS, JSON.stringify(adjustmentRecords));
    } catch (e) {
      console.error(e);
    }
  }, [adjustmentRecords]);

  // Unique reasons for filter dropdown
  const uniqueReasons = useMemo(() => {
    const reasons = new Set(adjustmentRecords.map((r) => r.reason).filter(Boolean));
    return Array.from(reasons);
  }, [adjustmentRecords]);

  // Filtered adjustments
  const filteredAdjustments = useMemo(() => {
    return adjustmentRecords.filter((rec) => {
      if (filterType !== 'ALL' && rec.type !== filterType) return false;
      if (filterWarehouse !== 'ALL' && rec.warehouse !== filterWarehouse && rec.warehouseId !== filterWarehouse) return false;
      if (filterReason !== 'ALL' && rec.reason !== filterReason) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRecord = (rec.recordNo || '').toLowerCase().includes(q);
        const matchProduct = (rec.productName || '').toLowerCase().includes(q);
        const matchSku = (rec.sku || '').toLowerCase().includes(q);
        const matchBatch = (rec.batch || '').toLowerCase().includes(q);
        const matchWarehouse = (rec.warehouse || '').toLowerCase().includes(q);
        const matchReason = (rec.reason || '').toLowerCase().includes(q);
        if (!matchRecord && !matchProduct && !matchSku && !matchBatch && !matchWarehouse && !matchReason) {
          return false;
        }
      }
      return true;
    });
  }, [adjustmentRecords, filterType, filterWarehouse, filterReason, searchQuery]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setFilterType('ALL');
    setFilterWarehouse('ALL');
    setFilterReason('ALL');
  };

  const handleOpenCreateRecord = () => {
    setEditingRecord(null);
    const defaultWh = warehousesList[0]?.id || '';
    const defaultProd = productsList[0]?.id || '';
    const now = new Date();
    const batchNo = `BN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(10 + Math.random() * 90)}`;

    setCreateForm({
      type: 'Addition',
      warehouseId: defaultWh,
      productId: defaultProd,
      batch: batchNo,
      quantity: '1',
      reason: 'Opening stock correction',
      remarks: '',
    });
    setShowCreateModal(true);
  };

  const handleOpenEditRecord = (rec) => {
    setEditingRecord(rec);
    const prod = productsList.find((p) => p.name === rec.productName || p.sku === rec.sku);
    const wh = warehousesList.find((w) => w.name === rec.warehouse || String(w.id) === String(rec.warehouseId));
    setCreateForm({
      type: rec.type || 'Addition',
      warehouseId: String(wh?.id || rec.warehouseId || warehousesList[0]?.id || ''),
      productId: String(prod?.id || productsList[0]?.id || ''),
      batch: rec.batch || '',
      quantity: String(Math.abs(rec.quantity || 1)),
      reason: rec.reason || 'Opening stock correction',
      remarks: rec.remarks || '',
    });
    setShowCreateModal(true);
  };

  const handleDeleteRecord = (rec) => {
    if (window.confirm(`Are you sure you want to delete adjustment record ${rec.recordNo}?`)) {
      setAdjustmentRecords((prev) => prev.filter((r) => r.id !== rec.id));
      addToast(`Adjustment record ${rec.recordNo} deleted successfully.`, 'success');
      if (viewingRecord?.id === rec.id) setViewingRecord(null);
    }
  };

  const handleSaveRecord = (e) => {
    e.preventDefault();
    const qtyNum = parseFloat(createForm.quantity);
    if (!qtyNum || qtyNum <= 0) {
      addToast('Please enter a valid positive quantity', 'error');
      return;
    }

    const selectedWh = warehousesList.find((w) => String(w.id) === String(createForm.warehouseId));
    const selectedProd = productsList.find((p) => String(p.id) === String(createForm.productId));

    const finalQty = createForm.type === 'Reduction' ? -Math.abs(qtyNum) : Math.abs(qtyNum);

    if (editingRecord) {
      const updated = adjustmentRecords.map((r) => {
        if (r.id === editingRecord.id) {
          return {
            ...r,
            type: createForm.type,
            warehouse: selectedWh?.name || r.warehouse,
            warehouseId: createForm.warehouseId,
            sku: selectedProd?.sku || r.sku,
            productName: selectedProd?.name || r.productName,
            batch: createForm.batch || r.batch,
            quantity: finalQty,
            reason: createForm.reason,
          };
        }
        return r;
      });
      setAdjustmentRecords(updated);
      addToast(`Adjustment record ${editingRecord.recordNo} updated successfully!`, 'success');
      setEditingRecord(null);
      setShowCreateModal(false);
      return;
    }

    const newRecordNo = `SA-MB-${adjustmentRecords.length + 3}`;

    const newRecord = {
      id: newRecordNo,
      recordNo: newRecordNo,
      date: new Date().toLocaleDateString(),
      type: createForm.type,
      warehouse: selectedWh?.name || 'Warehouse 1',
      warehouseId: createForm.warehouseId,
      sku: selectedProd?.sku || '—',
      productName: selectedProd?.name || 'Custom Item',
      batch: createForm.batch || `BN-${Date.now().toString().slice(-6)}`,
      quantity: finalQty,
      reason: createForm.reason,
      status: 'COMPLETED',
    };

    setAdjustmentRecords([newRecord, ...adjustmentRecords]);
    addToast(`Adjustment record ${newRecordNo} created successfully!`, 'success');
    setShowCreateModal(false);
  };

  // Export stock adjustments to CSV
  const handleExportCSV = () => {
    if (filteredAdjustments.length === 0) {
      addToast('No adjustment records to export', 'error');
      return;
    }
    const headers = ['Record #', 'Date', 'Type', 'Warehouse', 'SKU', 'Product Name', 'Batch', 'Quantity', 'Reason', 'Status'];
    const rows = filteredAdjustments.map((rec) => [
      `"${(rec.recordNo || '').replace(/"/g, '""')}"`,
      `"${rec.date || ''}"`,
      `"${rec.type || ''}"`,
      `"${(rec.warehouse || '').replace(/"/g, '""')}"`,
      `"${(rec.sku || '').replace(/"/g, '""')}"`,
      `"${(rec.productName || '').replace(/"/g, '""')}"`,
      `"${(rec.batch || '').replace(/"/g, '""')}"`,
      rec.quantity,
      `"${(rec.reason || '').replace(/"/g, '""')}"`,
      `"${rec.status || ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `stock_adjustments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Stock adjustments exported to CSV', 'success');
  };

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 32px',
        backgroundColor: '#f8fafc',
        overflow: 'hidden',
      }}
    >
      {/* Page Header (Fixed / Sticky at Top) - Matching EmployeesHub / CustomersHub */}
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
            Inventory Management
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            Create and manage inventory records, warehouse locations, categories, and stock adjustments.
          </p>
        </div>

        {/* Action Button matching current active tab */}
        {currentTab === 'adjustments' ? (
          <button
            type="button"
            onClick={handleOpenCreateRecord}
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
            <Plus size={17} /> Create Record
          </button>
        ) : currentTab === 'inventory-list' ? (
          <button
            type="button"
            onClick={handleNavigateGTN}
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
            <ArrowRightLeft size={16} /> Stock Transfer (GTN)
          </button>
        ) : (
          <button
            type="button"
            onClick={handleHeaderAdd}
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
            <Plus size={17} /> Add {currentTab === 'products' ? 'Product' : currentTab === 'brands' ? 'Brand' : currentTab === 'warehouses' ? 'Warehouse' : 'Category'}
          </button>
        )}
      </div>

      {/* Subtabs Bar (Underline Style matching EmployeesHub - Fixed / Sticky) */}
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
        {INVENTORY_TABS.map((tab) => {
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
      {/* 1. INVENTORY LIST TAB (Live Stock Balances with Qty, Cost, Selling, Valuation) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'inventory-list' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>
          {/* Search Bar & Filter Controls (Aligned with Desktop View, Matching Customer Page) */}
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
            {/* Left Control: Search Input extending to take remaining space */}
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
                placeholder="Search inventory by SKU, product name, warehouse..."
                value={invSearchQuery}
                onChange={(e) => setInvSearchQuery(e.target.value)}
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
              {invSearchQuery && (
                <button
                  type="button"
                  onClick={() => setInvSearchQuery('')}
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

            {/* Right Controls: Filters, Reset, Export CSV, & Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'nowrap' }}>
              {/* Stock Status selector - nicely expanded to prevent text clipping */}
              <select
                value={invStatusFilter}
                onChange={(e) => setInvStatusFilter(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 32px 0 14px',
                  minWidth: '165px',
                  maxWidth: '185px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
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
                  backgroundPosition: 'right 11px center',
                }}
              >
                <option value="ALL">All Stock Levels</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>

              {/* Reset Filters */}
              {(invSearchQuery || invStatusFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={handleClearInvFilters}
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
                  title="Reset all filters to default"
                >
                  <X size={13} /> Reset
                </button>
              )}

              {/* Export CSV - Icon only */}
              <button
                type="button"
                onClick={handleExportInventoryCSV}
                style={{
                  width: '38px',
                  height: '38px',
                  padding: 0,
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
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
                  e.currentTarget.style.color = '#475569';
                }}
                title="Export Inventory to CSV"
              >
                <Download size={15} />
              </button>

              {/* Refresh - Icon only */}
              <button
                type="button"
                onClick={loadInventoryBalances}
                style={{
                  width: '38px',
                  height: '38px',
                  padding: 0,
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
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
                  e.currentTarget.style.color = '#475569';
                }}
                title="Refresh Inventory Data"
              >
                <RefreshCw size={15} className={inventoryLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Table Container (Fixed / Sticky Frame - Matching Customer/Employee Look) */}
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
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CODE / SKU</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PRODUCT NAME</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>WAREHOUSE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CATEGORY</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>QUANTITY</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>COST PRICE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>SELLING PRICE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryLoading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        Loading live inventory balances...
                      </td>
                    </tr>
                  ) : filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        No inventory records found matching current criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setViewingStockItem(item)}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        title="Click row to view full stock details"
                      >
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                          {item.sku}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                          {item.productName}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569', fontWeight: 500 }}>
                          {item.warehouseName}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              backgroundColor: '#e0f2fe',
                              color: '#0369a1',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                            }}
                          >
                            {item.categoryName}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: item.quantity > 0 ? '#0f172a' : '#dc2626' }}>
                          {item.quantity.toLocaleString()} <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>{item.unitOfMeasure}</span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>
                          Rs. {Number(item.costPrice || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                          Rs. {Number(item.sellingPrice || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {item.isOutOfStock ? (
                            <span
                              style={{
                                backgroundColor: '#fee2e2',
                                color: '#dc2626',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              Out of Stock
                            </span>
                          ) : item.isLowStock ? (
                            <span
                              style={{
                                backgroundColor: '#fef3c7',
                                color: '#d97706',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              Low Stock
                            </span>
                          ) : (
                            <span
                              style={{
                                backgroundColor: '#dcfce7',
                                color: '#16a34a',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              In Stock
                            </span>
                          )}
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
      {/* 2. PRODUCTS TAB (Master Product Directory) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'products' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <MastersView
            ref={mastersRef}
            activeSubTab="products"
            isStandalone={true}
            allowedTabs={['products']}
            hideHeader={true}
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2b. BRANDS TAB */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'brands' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <MastersView
            ref={mastersRef}
            activeSubTab="brands"
            isStandalone={true}
            allowedTabs={['brands']}
            hideHeader={true}
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. WAREHOUSES TAB */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'warehouses' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <MastersView
            ref={mastersRef}
            activeSubTab="warehouses"
            isStandalone={true}
            allowedTabs={['warehouses']}
            hideHeader={true}
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. CATEGORIES TAB */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'categories' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <MastersView
            ref={mastersRef}
            activeSubTab="categories"
            isStandalone={true}
            allowedTabs={['categories']}
            hideHeader={true}
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. STOCK ADJUSTMENT TAB (Last Navigation Item) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'adjustments' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>

          {/* Search Bar & Filter Controls (Aligned with Desktop View, Matching Customer Page) */}
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
            {/* Left Control: Search Input extending to take remaining space */}
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
                placeholder="Search records by #, product, SKU, batch, warehouse, reason..."
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

            {/* Right Controls: Filters, Reset, Export CSV, & Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'nowrap' }}>
              {/* Type filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 28px 0 12px',
                  minWidth: '115px',
                  maxWidth: '135px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
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
                  backgroundPosition: 'right 9px center',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <option value="ALL">All Types</option>
                <option value="Addition">Addition</option>
                <option value="Reduction">Reduction</option>
              </select>

              {/* Warehouse filter */}
              <select
                value={filterWarehouse}
                onChange={(e) => setFilterWarehouse(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 28px 0 12px',
                  minWidth: '120px',
                  maxWidth: '145px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
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
                  backgroundPosition: 'right 9px center',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <option value="ALL">All Warehouses</option>
                {warehousesList.map((w) => (
                  <option key={w.id} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>

              {/* Reason filter */}
              <select
                value={filterReason}
                onChange={(e) => setFilterReason(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 28px 0 12px',
                  minWidth: '120px',
                  maxWidth: '145px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
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
                  backgroundPosition: 'right 9px center',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <option value="ALL">All Reasons</option>
                {uniqueReasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              {/* Reset Filters button */}
              {(filterType !== 'ALL' || filterWarehouse !== 'ALL' || filterReason !== 'ALL' || searchQuery) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
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
                  title="Reset all filters to default"
                >
                  <X size={13} /> Reset
                </button>
              )}

              {/* Export CSV - Icon only */}
              <button
                type="button"
                onClick={handleExportCSV}
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
                title="Export stock adjustments to CSV"
              >
                <Download size={15} />
              </button>

              {/* Refresh Records - Icon only */}
              <button
                type="button"
                onClick={() => {
                  addToast('Stock adjustments refreshed', 'info');
                }}
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
                title="Refresh records"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {/* Adjustment Records Table (Fixed Frame, Sticky Header, Internal Scroll for Data Rows Only) */}
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
              <table style={{ width: '100%', minWidth: '960px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>RECORD #</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DATE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>TYPE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>WAREHOUSE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>SKU</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PRODUCT NAME</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>BATCH</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>QUANTITY</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>REASON</th>
                    <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdjustments.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        No adjustment records found matching selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAdjustments.map((rec) => {
                      const isAddition = rec.type === 'Addition';

                      return (
                        <tr
                          key={rec.id}
                          onClick={() => setViewingRecord(rec)}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            transition: 'background-color 0.1s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          title="Click row to view record details"
                        >
                          <td style={{ padding: '12px 18px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                            {rec.recordNo}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.88rem' }}>
                            {rec.date}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                color: isAddition ? '#16a34a' : '#dc2626',
                                fontWeight: 700,
                                fontSize: '0.84rem',
                              }}
                            >
                              {rec.type}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 500, fontSize: '0.88rem' }}>
                            {rec.warehouse}
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#64748b', fontSize: '0.88rem' }}>
                            {rec.sku}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>
                            {rec.productName}
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.82rem', color: '#475569' }}>
                            {rec.batch}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: isAddition ? '#16a34a' : '#dc2626', fontFamily: 'monospace' }}>
                            {rec.quantity > 0 ? `+${rec.quantity}` : rec.quantity}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.88rem' }}>
                            {rec.reason}
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditRecord(rec);
                                }}
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  color: '#0284c7',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#f0f9ff';
                                  e.currentTarget.style.borderColor = '#0284c7';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#ffffff';
                                  e.currentTarget.style.borderColor = '#cbd5e1';
                                }}
                                title="Edit Adjustment"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRecord(rec);
                                }}
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  background: '#ffffff',
                                  border: '1px solid #fecaca',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  color: '#dc2626',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#fef2f2';
                                  e.currentTarget.style.borderColor = '#dc2626';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#ffffff';
                                  e.currentTarget.style.borderColor = '#fecaca';
                                }}
                                title="Delete Adjustment"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Create Stock Adjustment Record */}
      {/* ------------------------------------------------------------- */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '28px',
              borderRadius: '14px',
              backgroundColor: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SlidersHorizontal size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
                    {editingRecord ? `Edit Stock Adjustment (${editingRecord.recordNo})` : 'Create Stock Adjustment Record'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Post physical additions or reduction adjustments</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Type selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Adjustment Type *
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, type: 'Addition', reason: 'Opening stock correction' })}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: createForm.type === 'Addition' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                      backgroundColor: createForm.type === 'Addition' ? '#f0fdf4' : '#ffffff',
                      color: createForm.type === 'Addition' ? '#16a34a' : '#475569',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    + Addition (Increase Stock)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, type: 'Reduction', reason: 'Stock count variance' })}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: createForm.type === 'Reduction' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                      backgroundColor: createForm.type === 'Reduction' ? '#fef2f2' : '#ffffff',
                      color: createForm.type === 'Reduction' ? '#dc2626' : '#475569',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    - Reduction (Decrease Stock)
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Warehouse *
                  </label>
                  <select
                    value={createForm.warehouseId}
                    onChange={(e) => setCreateForm({ ...createForm, warehouseId: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', backgroundColor: '#ffffff' }}
                    required
                  >
                    {warehousesList.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Product *
                  </label>
                  <select
                    value={createForm.productId}
                    onChange={(e) => setCreateForm({ ...createForm, productId: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', backgroundColor: '#ffffff' }}
                    required
                  >
                    {productsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku || 'SKU'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Batch Number
                  </label>
                  <input
                    type="text"
                    value={createForm.batch}
                    onChange={(e) => setCreateForm({ ...createForm, batch: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Adjustment Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 10"
                    value={createForm.quantity}
                    onChange={(e) => setCreateForm({ ...createForm, quantity: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Adjustment Reason *
                </label>
                <select
                  value={createForm.reason}
                  onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', backgroundColor: '#ffffff' }}
                >
                  <option value="Opening stock correction">Opening stock correction</option>
                  <option value="Stock count variance">Stock count variance</option>
                  <option value="Expired stock">Expired stock</option>
                  <option value="Damaged stock">Damaged stock</option>
                  <option value="Found stock">Found stock</option>
                  <option value="Physical cycle audit">Physical cycle audit</option>
                  <option value="Other adjustment">Other adjustment</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Remarks / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={createForm.remarks}
                  onChange={(e) => setCreateForm({ ...createForm, remarks: e.target.value })}
                  placeholder="Additional audit reference notes..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingRecord}
                  style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
                >
                  {editingRecord ? 'Update Adjustment Record' : 'Post Adjustment Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: View Adjustment Record Details */}
      {/* ------------------------------------------------------------- */}
      {viewingRecord && (
        <div className="modal-backdrop" onClick={() => setViewingRecord(null)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '28px',
              borderRadius: '14px',
              backgroundColor: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SlidersHorizontal size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{viewingRecord.recordNo}</h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Date: {viewingRecord.date}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Adjustment Type</span>
                <span style={{ fontWeight: 700, color: viewingRecord.type === 'Addition' ? '#16a34a' : '#dc2626' }}>
                  {viewingRecord.type}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Product</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{viewingRecord.productName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>SKU</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{viewingRecord.sku}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Warehouse</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{viewingRecord.warehouse}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Batch Number</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace', color: '#0284c7' }}>{viewingRecord.batch}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Quantity Adjusted</span>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: viewingRecord.quantity > 0 ? '#16a34a' : '#dc2626', fontFamily: 'monospace' }}>
                  {viewingRecord.quantity > 0 ? `+${viewingRecord.quantity}` : viewingRecord.quantity}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: '#64748b' }}>Reason</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>{viewingRecord.reason}</span>
              </div>
            </div>

            <div style={{ marginTop: '22px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setViewingRecord(null)}
                style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', padding: '7px 20px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: View Stock Item Details */}
      {/* ------------------------------------------------------------- */}
      {viewingStockItem && (
        <div className="modal-backdrop" onClick={() => setViewingStockItem(null)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '28px',
              borderRadius: '14px',
              backgroundColor: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Boxes size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>{viewingStockItem.productName}</h3>
                  <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    SKU: <strong style={{ fontFamily: 'monospace', color: '#0284c7' }}>{viewingStockItem.sku}</strong> • {viewingStockItem.warehouseName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingStockItem(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '18px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>On-Hand Stock</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: viewingStockItem.quantity > 0 ? '#0f172a' : '#dc2626', marginTop: '2px' }}>
                  {viewingStockItem.quantity.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>{viewingStockItem.unitOfMeasure}</span>
                </div>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Available Stock</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>
                  {viewingStockItem.availableQuantity.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>{viewingStockItem.unitOfMeasure}</span>
                </div>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Unit Cost Price</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#334155', marginTop: '2px' }}>
                  Rs. {Number(viewingStockItem.costPrice || 0).toFixed(2)}
                </div>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Unit Selling Price</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                  Rs. {Number(viewingStockItem.sellingPrice || 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Category</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{viewingStockItem.categoryName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Warehouse Location</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{viewingStockItem.warehouseName} ({viewingStockItem.warehouseCode || '—'})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Minimum Stock Alert Level</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>{viewingStockItem.minStockLevel || 5} {viewingStockItem.unitOfMeasure}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Total On-Hand Valuation</span>
                <span style={{ fontWeight: 800, color: '#0284c7', fontSize: '1rem' }}>
                  Rs. {Number(viewingStockItem.totalCostValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Stock Status</span>
                <span>
                  {viewingStockItem.isOutOfStock ? (
                    <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700 }}>
                      Out of Stock
                    </span>
                  ) : viewingStockItem.isLowStock ? (
                    <span style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700 }}>
                      Low Stock Alert
                    </span>
                  ) : (
                    <span style={{ backgroundColor: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700 }}>
                      In Stock
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '22px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-glass"
                onClick={() => setViewingStockItem(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const item = viewingStockItem;
                  setViewingStockItem(null);
                  handleQuickAdjust(item);
                }}
                style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <SlidersHorizontal size={15} /> Adjust Stock
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
