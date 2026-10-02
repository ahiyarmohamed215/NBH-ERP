import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { canEditModule } from '../utils/permissionUtils';
import MastersView from './MastersView';
import {
  warehouseApi,
  productApi,
  adjustmentApi,
  inventoryApi,
  categoryApi,
  staffQuotaApi,
  salesmanApi,
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
  MinusCircle,
  Minus,
  ArrowRightLeft,
  Award,
  ShieldCheck,
  UserCheck,
  Users,
  AlertCircle,
  Clock,
  Ban,
} from 'lucide-react';

const getBrandForProduct = (prod) => {
  if (!prod) return 'General';
  return prod.brandName || prod.brand || 'General';
};

// Empty initial adjustments - populated live from API
const INITIAL_ADJUSTMENTS = [];

export default function InventoryHub({ activeSubTab = 'inventory-list', onSubTabChange, onNavigate }) {
  const { user } = useAuth();
  const canEditInventory = canEditModule(user, 'INVENTORY');
  const { addToast } = useToast();
  const mastersRef = useRef(null);

  const INVENTORY_TABS = [
    { id: 'inventory-list', label: 'Inventory List', icon: Boxes },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'brands', label: 'Brands', icon: Award },
    { id: 'categories', label: 'Categories', icon: LayoutGrid },
    { id: 'warehouses', label: 'Warehouses', icon: Building2 },
    { id: 'adjustments', label: 'Stock Adjustment', icon: SlidersHorizontal },
    { id: 'pos-quotas', label: 'POS Staff Quotas', icon: ShieldCheck },
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
  // STOCK ADJUSTMENTS TAB STATE & LOGIC (Backed by real REST API)
  // -------------------------------------------------------------
  const [adjustmentRecords, setAdjustmentRecords] = useState([]);

  const loadAdjustments = async () => {
    try {
      const res = await adjustmentApi.search({ size: 100 });
      const content = res.data?.data?.content || res.data?.content || [];
      const formatted = content.flatMap((adj) =>
        (adj.items || []).map((it) => ({
          id: String(adj.id) + '-' + (it.id || it.productId),
          recordNo: adj.adjustmentNumber,
          date: adj.adjustmentDate,
          type: Number(it.differenceQuantity || 0) >= 0 ? 'Addition' : 'Reduction',
          warehouse: adj.warehouseName,
          warehouseId: String(adj.warehouseId),
          sku: it.productSku,
          productName: it.productName,
          batch: adj.adjustmentNumber,
          quantity: Number(it.differenceQuantity || 0),
          reason: it.reason || adj.reason,
          status: adj.status || 'COMPLETED',
        }))
      );
      setAdjustmentRecords(formatted);
    } catch (err) {
      console.error('Failed to load adjustments from API:', err);
    }
  };

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
    type: '',
    warehouseId: '',
    productId: '',
    batch: '',
    quantity: '',
    costPrice: '',
    reason: '',
    remarks: '',
  });
  const [submittingRecord, setSubmittingRecord] = useState(false);
  const [viewingRecord, setViewingRecord] = useState(null);

  // -------------------------------------------------------------
  // POS STAFF QUOTAS STATE & LOGIC
  // -------------------------------------------------------------
  const [quotas, setQuotas] = useState([]);
  const [quotaSummary, setQuotaSummary] = useState(null);
  const [salesStaff, setSalesStaff] = useState([]);
  const [loadingQuotas, setLoadingQuotas] = useState(false);
  const [quotaSearch, setQuotaSearch] = useState('');
  const [quotaWarehouseFilter, setQuotaWarehouseFilter] = useState('ALL');
  const [quotaStatusFilter, setQuotaStatusFilter] = useState('ALL');

  // Quota Modal State
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [editingQuota, setEditingQuota] = useState(null);
  const [quotaForm, setQuotaForm] = useState({
    productId: '',
    userId: '',
    warehouseId: '',
    allocatedQuantity: '',
    notes: '',
  });
  const [savingQuota, setSavingQuota] = useState(false);

  const loadQuotas = async () => {
    setLoadingQuotas(true);
    try {
      const [quotasRes, summaryRes, staffRes] = await Promise.all([
        staffQuotaApi.search({ size: 100 }).catch(() => ({ data: { data: { content: [] } } })),
        staffQuotaApi.getSummary().catch(() => ({ data: { data: null } })),
        salesmanApi.getActive().catch(() => ({ data: { data: [] } })),
      ]);
      setQuotas(quotasRes.data?.data?.content || quotasRes.data?.content || []);
      setQuotaSummary(summaryRes.data?.data || summaryRes.data || null);
      setSalesStaff(staffRes.data?.data || staffRes.data || []);
    } catch (err) {
      console.error('Failed to load staff quotas:', err);
    } finally {
      setLoadingQuotas(false);
    }
  };

  useEffect(() => {
    if (currentTab === 'pos-quotas') {
      loadQuotas();
    }
  }, [currentTab]);

  const handleOpenQuotaModal = (initialProduct = null, existingQuota = null) => {
    if (existingQuota) {
      setEditingQuota(existingQuota);
      setQuotaForm({
        productId: String(existingQuota.productId || ''),
        userId: String(existingQuota.userId || ''),
        warehouseId: existingQuota.warehouseId ? String(existingQuota.warehouseId) : '',
        allocatedQuantity: String(existingQuota.allocatedQuantity || ''),
        notes: existingQuota.notes || '',
      });
    } else {
      setEditingQuota(null);
      setQuotaForm({
        productId: initialProduct ? String(initialProduct.id || initialProduct.productId || '') : (productsList.length > 0 ? String(productsList[0].id) : ''),
        userId: salesStaff.length > 0 ? String(salesStaff[0].id) : '',
        warehouseId: warehousesList.length > 0 ? String(warehousesList[0].id) : '',
        allocatedQuantity: '',
        notes: '',
      });
    }
    setShowQuotaModal(true);
  };

  const handleSaveQuota = async (e) => {
    e.preventDefault();
    if (!quotaForm.productId || !quotaForm.userId || !quotaForm.allocatedQuantity) {
      addToast('Please fill all required fields (Product, Staff, and Allocated Quantity)', 'error');
      return;
    }
    const allocQty = parseFloat(quotaForm.allocatedQuantity);
    if (isNaN(allocQty) || allocQty <= 0) {
      addToast('Allocated quantity must be greater than zero', 'error');
      return;
    }

    setSavingQuota(true);
    try {
      if (editingQuota) {
        await staffQuotaApi.update(editingQuota.id, {
          allocatedQuantity: allocQty,
          notes: quotaForm.notes,
        });
        addToast('Staff quota updated successfully', 'success');
      } else {
        await staffQuotaApi.create({
          productId: Number(quotaForm.productId),
          userId: Number(quotaForm.userId),
          warehouseId: quotaForm.warehouseId ? Number(quotaForm.warehouseId) : null,
          allocatedQuantity: allocQty,
          notes: quotaForm.notes,
        });
        addToast('Staff selling quota allocated successfully', 'success');
      }
      setShowQuotaModal(false);
      await loadQuotas();
    } catch (err) {
      addToast('Failed to save staff quota: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setSavingQuota(false);
    }
  };

  const handleToggleQuotaStatus = async (quota) => {
    try {
      await staffQuotaApi.update(quota.id, {
        isActive: !quota.isActive,
      });
      addToast(`Quota ${quota.isActive ? 'deactivated' : 'activated'}`, 'success');
      await loadQuotas();
    } catch (err) {
      addToast('Failed to toggle quota: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  const filteredQuotas = useMemo(() => {
    return quotas.filter((q) => {
      if (quotaWarehouseFilter !== 'ALL' && q.warehouseId && String(q.warehouseId) !== String(quotaWarehouseFilter)) {
        return false;
      }
      if (quotaStatusFilter !== 'ALL' && q.status !== quotaStatusFilter) {
        return false;
      }
      if (quotaSearch.trim()) {
        const qLower = quotaSearch.toLowerCase();
        const prodMatch = (q.productName || '').toLowerCase().includes(qLower) || (q.productSku || '').toLowerCase().includes(qLower);
        const staffMatch = (q.userFullName || '').toLowerCase().includes(qLower) || (q.username || '').toLowerCase().includes(qLower);
        return prodMatch || staffMatch;
      }
      return true;
    });
  }, [quotas, quotaWarehouseFilter, quotaStatusFilter, quotaSearch]);

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
        items = fetchedBalances
          .filter((b) => Number(b.quantity ?? 0) > 0)
          .map((b) => {
            const prod = fetchedProducts.find((p) => p.id === b.productId || p.sku === b.productSku);
            const brandName = getBrandForProduct(prod || b);
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
              brandName: brandName,
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
    loadAdjustments();
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
        const matchBrand = (item.brandName || '').toLowerCase().includes(q);
        const matchWh = (item.warehouseName || '').toLowerCase().includes(q);
        const matchCat = (item.categoryName || '').toLowerCase().includes(q);
        if (!matchSku && !matchName && !matchBrand && !matchWh && !matchCat) {
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
      'Brand',
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
      `"${(item.brandName || 'General').replace(/"/g, '""')}"`,
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

  // Adjustments are loaded live from backend adjustmentApi

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
    const now = new Date();
    const batchNo = `BN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(10 + Math.random() * 90)}`;

    setCreateForm({
      type: '', // No action is selected by default
      warehouseId: '',
      productId: '',
      batch: batchNo,
      quantity: '',
      costPrice: '',
      reason: '',
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
      warehouseId: String(wh?.id || rec.warehouseId || ''),
      productId: String(prod?.id || ''),
      batch: rec.batch || '',
      quantity: String(Math.abs(rec.quantity || 1)),
      costPrice: String(rec.costPrice || prod?.costPrice || '0.00'),
      reason: rec.reason || '',
      remarks: rec.remarks || '',
    });
    setShowCreateModal(true);
  };

  const handleSaveRecord = async (e) => {
    e.preventDefault();
    if (!createForm.type) {
      addToast('Please choose whether to Add stock or Reduce stock', 'error');
      return;
    }
    if (!createForm.warehouseId) {
      addToast('Please select a warehouse', 'error');
      return;
    }
    if (!createForm.productId) {
      addToast('Please select a product', 'error');
      return;
    }
    const qtyNum = parseFloat(createForm.quantity);
    if (!qtyNum || qtyNum <= 0) {
      addToast('Please enter a valid positive quantity', 'error');
      return;
    }
    if (!createForm.reason) {
      addToast('Please select a valid reason', 'error');
      return;
    }

    try {
      setSubmittingRecord(true);
      const whId = Number(createForm.warehouseId);
      const prdId = Number(createForm.productId);
      const sysBal = inventoryBalances.find(
        (b) => String(b.productId) === String(prdId) && String(b.warehouseId) === String(whId)
      );
      const currentPhysical = sysBal ? Number(sysBal.quantity || 0) : 0;
      const targetPhysical = createForm.type === 'Reduction'
        ? Math.max(0, currentPhysical - Math.abs(qtyNum))
        : currentPhysical + Math.abs(qtyNum);

      const payload = {
        warehouseId: whId,
        adjustmentDate: new Date().toISOString().split('T')[0],
        reason: createForm.reason + (createForm.remarks ? `: ${createForm.remarks}` : ''),
        items: [
          {
            productId: prdId,
            physicalQuantity: targetPhysical,
            reason: createForm.reason,
          },
        ],
      };

      await adjustmentApi.create(payload, true);
      addToast('Stock adjustment successfully submitted and processed to inventory!', 'success');
      setShowCreateModal(false);
      setEditingRecord(null);
      await Promise.all([loadAdjustments(), loadInventoryBalances()]);
    } catch (err) {
      console.error('Adjustment API failed:', err);
      addToast(err?.response?.data?.message || err?.message || 'Failed to submit adjustment', 'error');
    } finally {
      setSubmittingRecord(false);
    }
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
        {currentTab === 'pos-quotas' ? (
          <button
            type="button"
            onClick={() => handleOpenQuotaModal()}
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
            <ShieldCheck size={17} /> Allocate Staff Quota
          </button>
        ) : currentTab === 'adjustments' ? (
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
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          {/* Search Bar & Action Buttons (Matched with Products Table Layout) */}
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
            {/* Left Control: Search Input matching table width */}
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
                placeholder="Search inventory by SKU, product name, brand, warehouse..."
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

            {/* Right Controls: Filter dropdown, Reset Filters, Export CSV, & Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'nowrap' }}>
              {/* Stock Status selector */}
              <select
                value={invStatusFilter}
                onChange={(e) => setInvStatusFilter(e.target.value)}
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
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <option value="ALL">All Stock Levels</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>

              {/* Reset Filters button */}
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
                    fontSize: '0.85rem',
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
                title="Export inventory to CSV"
              >
                <Download size={15} />
              </button>

              {/* Refresh Records - Icon only */}
              <button
                type="button"
                onClick={loadInventoryBalances}
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
                title="Refresh inventory records"
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
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>BRAND</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>WAREHOUSE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CATEGORY</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>QUANTITY</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>COST PRICE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>SELLING PRICE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>POS QUOTA</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryLoading ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        Loading live inventory balances...
                      </td>
                    </tr>
                  ) : filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
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
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              backgroundColor: '#f8fafc',
                              color: '#334155',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              border: '1px solid #e2e8f0',
                              display: 'inline-block',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.brandName || 'General'}
                          </span>
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
                        <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              const prodMatch = productsList.find((p) => p.id === item.productId || p.sku === item.sku) || item;
                              handleOpenQuotaModal(prodMatch);
                            }}
                            style={{
                              backgroundColor: '#f0f9ff',
                              color: '#0284c7',
                              border: '1px solid #bae6fd',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.15s ease',
                            }}
                            title="Allocate selling limit to a sales rep"
                          >
                            <ShieldCheck size={13} /> Allocate
                          </button>
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
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>

          {/* Search Bar & Filter Controls (Matched with Products Table Layout) */}
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
            {/* Left Control: Search Input matching table width */}
            <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
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
                placeholder="Search adjustments by #, product, SKU, batch, warehouse, reason..."
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
                  padding: '0 24px 0 10px',
                  width: '100px',
                  minWidth: '95px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
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
                  padding: '0 24px 0 10px',
                  width: '115px',
                  minWidth: '105px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
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
                  padding: '0 24px 0 10px',
                  width: '110px',
                  minWidth: '100px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
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
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
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
                                title={canEditInventory ? "Edit Adjustment" : "View Only (Edit Restricted)"}
                                disabled={!canEditInventory}
                              >
                                <Edit2 size={13} />
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
      {/* 6. POS STAFF QUOTAS TAB (Product Selling Limits per Sales Rep) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'pos-quotas' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          
          {/* Top KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              flexShrink: 0,
            }}
          >
            {/* Card 1: Active Quotas */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#e0f2fe',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ShieldCheck size={22} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Active Quotas
                </p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
                  {quotaSummary?.activeQuotas ?? quotas.filter((q) => q.isActive).length}
                </h3>
              </div>
            </div>

            {/* Card 2: Total Units Allocated */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#ede9fe',
                  color: '#7c3aed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Boxes size={22} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Allocated Units
                </p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
                  {Number(quotaSummary?.totalAllocatedUnits ?? 0).toLocaleString()}
                </h3>
              </div>
            </div>

            {/* Card 3: Sold / Billed Units */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#dcfce7',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <TrendingUp size={22} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Sold / Billed Units
                </p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
                  {Number(quotaSummary?.totalSoldUnits ?? 0).toLocaleString()}
                </h3>
              </div>
            </div>

            {/* Card 4: Exhausted / Blocked Quotas */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertCircle size={22} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Exhausted (Limit Reached)
                </p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.45rem', fontWeight: 800, color: '#dc2626' }}>
                  {quotaSummary?.exhaustedQuotas ?? quotas.filter((q) => q.status === 'EXHAUSTED').length}
                </h3>
              </div>
            </div>
          </div>

          {/* Search Bar & Filter Controls */}
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
              flexShrink: 0,
            }}
          >
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search
                size={16}
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
                placeholder="Search quota by product SKU, name, or staff member..."
                value={quotaSearch}
                onChange={(e) => setQuotaSearch(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 36px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                }}
              />
              {quotaSearch && (
                <button
                  type="button"
                  onClick={() => setQuotaSearch('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Warehouse Filter */}
            <select
              value={quotaWarehouseFilter}
              onChange={(e) => setQuotaWarehouseFilter(e.target.value)}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                backgroundColor: '#ffffff',
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Warehouses</option>
              {warehousesList.map((w) => (
                <option key={w.id} value={String(w.id)}>{w.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={quotaStatusFilter}
              onChange={(e) => setQuotaStatusFilter(e.target.value)}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                backgroundColor: '#ffffff',
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active (Selling Allowed)</option>
              <option value="EXHAUSTED">Exhausted (Limit Reached)</option>
              <option value="INACTIVE">Inactive (Disabled)</option>
            </select>

            {/* Refresh */}
            <button
              type="button"
              onClick={loadQuotas}
              disabled={loadingQuotas}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#475569',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Refresh Quotas"
            >
              <RefreshCw size={15} className={loadingQuotas ? 'animate-spin' : ''} />
            </button>

            {/* + Allocate Button */}
            <button
              type="button"
              onClick={() => handleOpenQuotaModal()}
              style={{
                height: '38px',
                padding: '0 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
              }}
            >
              <Plus size={16} /> Allocate Quota
            </button>
          </div>

          {/* Quotas Data Table */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>PRODUCT</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>STAFF / SALES REP</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>WAREHOUSE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>ALLOCATED</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>SOLD / BILLED</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>REMAINING LIMIT</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>STATUS</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingQuotas ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        Loading staff quota allocations...
                      </td>
                    </tr>
                  ) : filteredQuotas.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <ShieldCheck size={36} color="#94a3b8" />
                          <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>No staff quotas configured</p>
                          <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                            Allocate product selling limits to sales reps so they don't fight over warehouse stock.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleOpenQuotaModal()}
                            style={{
                              marginTop: '8px',
                              padding: '6px 14px',
                              backgroundColor: '#0284c7',
                              color: '#fff',
                              borderRadius: '6px',
                              border: 'none',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            + Allocate First Quota
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredQuotas.map((q) => {
                      const utilPct = q.utilizationPercentage || 0;
                      const isExhausted = q.status === 'EXHAUSTED';
                      const isInactive = q.status === 'INACTIVE';

                      return (
                        <tr
                          key={q.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: isInactive ? '#fafafa' : '#ffffff',
                            transition: 'background-color 0.1s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isInactive ? '#f5f5f5' : '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isInactive ? '#fafafa' : '#ffffff')}
                        >
                          {/* Product */}
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{q.productName}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>{q.productSku}</span>
                              {q.currentStockInWarehouse !== undefined && (
                                <span style={{ fontSize: '0.72rem', backgroundColor: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: '4px' }}>
                                  Stock: {q.currentStockInWarehouse} {q.productUnit || ''}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Staff / Sales Rep */}
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  backgroundColor: '#e0f2fe',
                                  color: '#0284c7',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '0.82rem',
                                  flexShrink: 0,
                                }}
                              >
                                {(q.userFullName || q.username || 'S').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>
                                  {q.userFullName || q.username}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                  @{q.username} {q.userEmployeeCode ? `• ${q.userEmployeeCode}` : ''}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Warehouse */}
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                color: '#334155',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                              }}
                            >
                              {q.warehouseName || 'All Warehouses'}
                            </span>
                          </td>

                          {/* Allocated Quantity */}
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>
                            {Number(q.allocatedQuantity || 0).toLocaleString()} <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>{q.productUnit || ''}</span>
                          </td>

                          {/* Sold / Billed with progress */}
                          <td style={{ padding: '12px 16px', minWidth: '130px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                              <span>{Number(q.soldQuantity || 0).toLocaleString()}</span>
                              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{utilPct}%</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${Math.min(100, utilPct)}%`,
                                  height: '100%',
                                  backgroundColor: isExhausted ? '#dc2626' : utilPct > 75 ? '#f59e0b' : '#0284c7',
                                  borderRadius: '3px',
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>
                          </td>

                          {/* Remaining Limit */}
                          <td style={{ padding: '12px 16px' }}>
                            {isExhausted ? (
                              <span
                                style={{
                                  backgroundColor: '#fee2e2',
                                  color: '#dc2626',
                                  padding: '4px 9px',
                                  borderRadius: '6px',
                                  fontSize: '0.78rem',
                                  fontWeight: 800,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Ban size={12} /> 0 Left (Blocked)
                              </span>
                            ) : Number(q.remainingQuantity || 0) <= 5 ? (
                              <span
                                style={{
                                  backgroundColor: '#fef3c7',
                                  color: '#b45309',
                                  padding: '4px 9px',
                                  borderRadius: '6px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <AlertTriangle size={12} /> {Number(q.remainingQuantity || 0).toLocaleString()} {q.productUnit || ''} left
                              </span>
                            ) : (
                              <span
                                style={{
                                  backgroundColor: '#dcfce7',
                                  color: '#15803d',
                                  padding: '4px 9px',
                                  borderRadius: '6px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <CheckCircle size={12} /> {Number(q.remainingQuantity || 0).toLocaleString()} {q.productUnit || ''} avail
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                backgroundColor: isInactive ? '#f1f5f9' : isExhausted ? '#fff1f2' : '#f0fdf4',
                                color: isInactive ? '#64748b' : isExhausted ? '#e11d48' : '#16a34a',
                                border: `1px solid ${isInactive ? '#cbd5e1' : isExhausted ? '#fecdd3' : '#bbf7d0'}`,
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                              }}
                            >
                              {q.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {/* Edit / Adjust Quota */}
                              <button
                                type="button"
                                onClick={() => handleOpenQuotaModal(null, q)}
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#ffffff',
                                  color: '#0284c7',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                                title="Edit / Adjust Quota Limit"
                              >
                                <Edit2 size={13} />
                              </button>

                              {/* Toggle Active / Inactive */}
                              <button
                                type="button"
                                onClick={() => handleToggleQuotaStatus(q)}
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#ffffff',
                                  color: q.isActive ? '#eab308' : '#16a34a',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                                title={q.isActive ? 'Deactivate Quota' : 'Activate Quota'}
                              >
                                {q.isActive ? <Ban size={13} /> : <CheckCircle size={13} />}
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
      {/* MODAL: Allocate / Adjust Staff Selling Quota */}
      {/* ------------------------------------------------------------- */}
      {showQuotaModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1200,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#f8fafc',
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
                  }}
                >
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    {editingQuota ? 'Adjust POS Selling Quota' : 'Allocate Product Quota to Staff'}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                    Restrict max units this sales rep can bill to ensure fair stock distribution
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuotaModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveQuota} style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Product Select */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Target Product <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  disabled={!!editingQuota}
                  value={quotaForm.productId}
                  onChange={(e) => setQuotaForm({ ...quotaForm, productId: e.target.value })}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    backgroundColor: editingQuota ? '#f1f5f9' : '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                  required
                >
                  <option value="">Select product to restrict / allocate...</option>
                  {productsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              {/* Staff / Sales Rep Select */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Sales Rep / POS Staff Member <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  disabled={!!editingQuota}
                  value={quotaForm.userId}
                  onChange={(e) => setQuotaForm({ ...quotaForm, userId: e.target.value })}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    backgroundColor: editingQuota ? '#f1f5f9' : '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                  required
                >
                  <option value="">Select sales rep or POS staff...</option>
                  {salesStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName || s.username} ({s.username}) {s.employeeCode ? `[${s.employeeCode}]` : ''}
                    </option>
                  ))}
                </select>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                  Only this staff member will be restricted by this limit when billing in POS or Sales Invoices.
                </p>
              </div>

              {/* Warehouse Select */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Warehouse Facility
                </label>
                <select
                  disabled={!!editingQuota}
                  value={quotaForm.warehouseId}
                  onChange={(e) => setQuotaForm({ ...quotaForm, warehouseId: e.target.value })}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    backgroundColor: editingQuota ? '#f1f5f9' : '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                >
                  <option value="">All Warehouses (Global Quota)</option>
                  {warehousesList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Allocated Quantity Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Allocated Selling Limit (Units) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  placeholder="e.g. 25"
                  value={quotaForm.allocatedQuantity}
                  onChange={(e) => setQuotaForm({ ...quotaForm, allocatedQuantity: e.target.value })}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    outline: 'none',
                  }}
                  required
                />
                <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                  Once this staff member bills this quantity, the system will prevent further sales until quota is increased.
                </p>
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Notes / Distribution Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g., Weekly ration for Western route customers..."
                  value={quotaForm.notes}
                  onChange={(e) => setQuotaForm({ ...quotaForm, notes: e.target.value })}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '12px',
                  paddingTop: '16px',
                  borderTop: '1px solid #f1f5f9',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowQuotaModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuota}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {savingQuota ? 'Saving...' : editingQuota ? 'Save Changes' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: New Stock Adjustment Record (Exact Matching User Screenshots) */}
      {/* ------------------------------------------------------------- */}
      {showCreateModal && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '720px',
              padding: '24px 28px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  {editingRecord ? `Edit Stock Adjustment (${editingRecord.recordNo})` : 'New Stock Adjustment'}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  First choose what should happen to inventory. No action is selected by default.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* What do you want to do? */}
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  What do you want to do? *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  {/* Reduce stock card */}
                  <div
                    onClick={() => {
                      setCreateForm((prev) => ({
                        ...prev,
                        type: 'Reduction',
                        reason: prev.reason || 'Stock count variance',
                      }));
                    }}
                    style={{
                      border: createForm.type === 'Reduction' ? '2px solid #ef4444' : '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      transition: 'all 0.15s ease',
                      boxShadow: createForm.type === 'Reduction' ? '0 0 0 1px #ef4444' : 'none',
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      border: createForm.type === 'Reduction' ? '2px solid #ef4444' : '1.5px solid #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: createForm.type === 'Reduction' ? '#ef4444' : '#94a3b8',
                      flexShrink: 0,
                      marginTop: '1px',
                    }}>
                      <Minus size={13} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: createForm.type === 'Reduction' ? '#dc2626' : '#0f172a' }}>
                        Reduce stock
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', lineHeight: 1.35 }}>
                        Remove units already held in an existing batch.
                      </div>
                    </div>
                  </div>

                  {/* Add stock card */}
                  <div
                    onClick={() => {
                      setCreateForm((prev) => ({
                        ...prev,
                        type: 'Addition',
                        reason: prev.reason || 'Opening stock correction',
                      }));
                    }}
                    style={{
                      border: createForm.type === 'Addition' ? '2px solid #22c55e' : '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      transition: 'all 0.15s ease',
                      boxShadow: createForm.type === 'Addition' ? '0 0 0 1px #22c55e' : 'none',
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      border: createForm.type === 'Addition' ? '2px solid #22c55e' : '1.5px solid #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: createForm.type === 'Addition' ? '#16a34a' : '#94a3b8',
                      flexShrink: 0,
                      marginTop: '1px',
                    }}>
                      <Plus size={14} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: createForm.type === 'Addition' ? '#16a34a' : '#0f172a' }}>
                        Add stock
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', lineHeight: 1.35 }}>
                        Create new available units and record their cost.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notice Banner */}
              {!createForm.type ? (
                <div
                  style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fef3c7',
                    borderRadius: '6px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#92400e',
                    fontSize: '0.84rem',
                  }}
                >
                  <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
                  <span>Select an action above to continue.</span>
                </div>
              ) : createForm.type === 'Addition' ? (
                <div
                  style={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    color: '#166534',
                    fontSize: '0.84rem',
                  }}
                >
                  You are adding stock. The quantity entered below will be added as new available inventory.
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    color: '#991b1b',
                    fontSize: '0.84rem',
                  }}
                >
                  You are reducing stock. The quantity entered below will be deducted from existing batch inventory.
                </div>
              )}

              {/* Form Content only shown when type is selected */}
              {createForm.type && (
                <>
                  {/* Row 1: Warehouse, Product, Quantity */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.8fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Warehouse *
                      </label>
                      <select
                        value={createForm.warehouseId}
                        onChange={(e) => setCreateForm({ ...createForm, warehouseId: e.target.value })}
                        style={{
                          width: '100%',
                          height: '38px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.86rem',
                          backgroundColor: '#ffffff',
                          color: createForm.warehouseId ? '#0f172a' : '#94a3b8',
                          outline: 'none',
                        }}
                        required
                      >
                        <option value="">Select warehouse</option>
                        {warehousesList.map((w) => (
                          <option key={w.id} value={w.id} style={{ color: '#0f172a' }}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Product *
                      </label>
                      <select
                        value={createForm.productId}
                        onChange={(e) => {
                          const prod = productsList.find((p) => String(p.id) === e.target.value);
                          setCreateForm({
                            ...createForm,
                            productId: e.target.value,
                            costPrice: prod?.costPrice ? String(prod.costPrice) : (createForm.costPrice || '0.00'),
                          });
                        }}
                        style={{
                          width: '100%',
                          height: '38px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.86rem',
                          backgroundColor: '#ffffff',
                          color: createForm.productId ? '#0f172a' : '#94a3b8',
                          outline: 'none',
                        }}
                        required
                      >
                        <option value="">Select product</option>
                        {productsList.map((p) => (
                          <option key={p.id} value={p.id} style={{ color: '#0f172a' }}>
                            {p.name} {p.sku ? `(${p.sku})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="0"
                        value={createForm.quantity}
                        onChange={(e) => setCreateForm({ ...createForm, quantity: e.target.value })}
                        style={{
                          width: '100%',
                          height: '38px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.86rem',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                        required
                      />
                    </div>
                  </div>

                  {/* Row 2: Cost price per unit & Reason */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Cost price per unit *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={createForm.costPrice}
                        onChange={(e) => setCreateForm({ ...createForm, costPrice: e.target.value })}
                        style={{
                          width: '100%',
                          height: '38px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.86rem',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Reason *
                      </label>
                      <select
                        value={createForm.reason}
                        onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
                        style={{
                          width: '100%',
                          height: '38px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.86rem',
                          backgroundColor: '#ffffff',
                          color: createForm.reason ? '#0f172a' : '#94a3b8',
                          outline: 'none',
                        }}
                        required
                      >
                        <option value="">Select a valid reason</option>
                        {createForm.type === 'Addition' ? (
                          <>
                            <option value="Opening stock correction" style={{ color: '#0f172a' }}>Opening stock correction</option>
                            <option value="Found stock" style={{ color: '#0f172a' }}>Found stock</option>
                            <option value="Stock count variance" style={{ color: '#0f172a' }}>Stock count variance</option>
                            <option value="Physical cycle audit" style={{ color: '#0f172a' }}>Physical cycle audit</option>
                            <option value="Other adjustment" style={{ color: '#0f172a' }}>Other adjustment</option>
                          </>
                        ) : (
                          <>
                            <option value="Stock count variance" style={{ color: '#0f172a' }}>Stock count variance</option>
                            <option value="Damaged stock" style={{ color: '#0f172a' }}>Damaged stock</option>
                            <option value="Expired stock" style={{ color: '#0f172a' }}>Expired stock</option>
                            <option value="Internal consumption" style={{ color: '#0f172a' }}>Internal consumption</option>
                            <option value="Physical cycle audit" style={{ color: '#0f172a' }}>Physical cycle audit</option>
                            <option value="Other adjustment" style={{ color: '#0f172a' }}>Other adjustment</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Adjustment summary */}
                  {(() => {
                    const selWh = warehousesList.find((w) => String(w.id) === String(createForm.warehouseId));
                    const selProd = productsList.find((p) => String(p.id) === String(createForm.productId));
                    const qtyNum = parseFloat(createForm.quantity) || 0;
                    const costNum = parseFloat(createForm.costPrice) || (selProd?.costPrice || 0);
                    const totalVal = qtyNum * costNum;
                    const isAddition = createForm.type === 'Addition';

                    return (
                      <div
                        style={{
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '14px 18px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          marginTop: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                            Adjustment summary
                          </span>
                          <span
                            style={{
                              backgroundColor: isAddition ? '#dcfce7' : '#fee2e2',
                              color: isAddition ? '#15803d' : '#dc2626',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            {isAddition ? 'Stock addition' : 'Stock reduction'}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                          <div>
                            <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600 }}>Warehouse</div>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.84rem', marginTop: '2px' }}>
                              {selWh?.name || 'Not selected'}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600 }}>Product</div>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.84rem', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selProd?.name}>
                              {selProd?.name || 'Not selected'}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600 }}>Quantity</div>
                            <div style={{ fontWeight: 700, color: isAddition ? '#16a34a' : '#dc2626', fontSize: '0.84rem', marginTop: '2px' }}>
                              {isAddition ? `+${qtyNum} units` : `-${qtyNum} units`}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600 }}>Cost per unit</div>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.84rem', marginTop: '2px' }}>
                              {costNum.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600 }}>Total value</div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.84rem', marginTop: '2px' }}>
                              {totalVal.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                {!createForm.type ? (
                  <button
                    type="button"
                    disabled
                    style={{
                      backgroundColor: '#f1f5f9',
                      color: '#94a3b8',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '10px 20px',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      cursor: 'not-allowed',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    + Select an action
                  </button>
                ) : createForm.type === 'Addition' ? (
                  <button
                    type="submit"
                    disabled={submittingRecord}
                    style={{
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '10px 22px',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#15803d')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#16a34a')}
                  >
                    <Plus size={16} /> Add Stock
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submittingRecord}
                    style={{
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '10px 22px',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b91c1c')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
                  >
                    <Minus size={16} /> Reduce Stock
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: View Adjustment Record Details */}
      {/* ------------------------------------------------------------- */}
      {viewingRecord && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
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
      {/* MODAL: View Stock Item Details (Wide, Scroll-Free Executive View) */}
      {/* ------------------------------------------------------------- */}
      {viewingStockItem && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '920px',
              padding: '22px 28px',
              borderRadius: '14px',
              backgroundColor: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.22)',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Boxes size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{viewingStockItem.productName}</h3>
                    <span
                      style={{
                        backgroundColor: '#f1f5f9',
                        color: '#334155',
                        border: '1px solid #e2e8f0',
                        padding: '1px 8px',
                        borderRadius: '4px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                      }}
                    >
                      {viewingStockItem.brandName || 'General'}
                    </span>
                    {viewingStockItem.isOutOfStock ? (
                      <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} /> Out of Stock
                      </span>
                    ) : viewingStockItem.isLowStock ? (
                      <span style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} /> Low Stock Alert ({Math.max(1, (viewingStockItem.minStockLevel || 5) - viewingStockItem.quantity)} needed)
                      </span>
                    ) : (
                      <span style={{ backgroundColor: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={12} /> In Stock (Healthy)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>SKU: <strong style={{ fontFamily: 'monospace', color: '#0284c7' }}>{viewingStockItem.sku}</strong></span>
                    <span>•</span>
                    <span>Warehouse: <strong style={{ color: '#334155' }}>{viewingStockItem.warehouseName}</strong> ({viewingStockItem.warehouseCode || 'WH-01'})</span>
                    <span>•</span>
                    <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 7px', borderRadius: '3px', fontSize: '0.74rem', fontWeight: 600 }}>
                      {viewingStockItem.categoryName}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingStockItem(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', borderRadius: '6px' }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* 2-Column Balanced Grid: Left = Quantities & Placement, Right = Commercial & Valuations */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '16px' }}>

              {/* LEFT COLUMN: Stock Quantities & Attributes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                    Stock Quantities & Availability
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>On-Hand Physical Stock</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: viewingStockItem.quantity > 0 ? '#0f172a' : '#dc2626', marginTop: '1px' }}>
                        {viewingStockItem.quantity.toLocaleString()} <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 500 }}>{viewingStockItem.unitOfMeasure}</span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Total Warehouse Count</div>
                    </div>
                    <div style={{ backgroundColor: '#f0fdf4', padding: '10px 12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>Available To Sell</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a', marginTop: '1px' }}>
                        {viewingStockItem.availableQuantity.toLocaleString()} <span style={{ fontSize: '0.76rem', color: '#166534', fontWeight: 500 }}>{viewingStockItem.unitOfMeasure}</span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#166534' }}>Unallocated & Free</div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Reserved / Allocated</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#475569', marginTop: '1px' }}>
                        {(viewingStockItem.reservedQuantity || 0).toLocaleString()} <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 500 }}>{viewingStockItem.unitOfMeasure}</span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Committed to Orders</div>
                    </div>
                    <div style={{ backgroundColor: '#fffbeb', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 600 }}>Min Reorder Threshold</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b45309', marginTop: '1px' }}>
                        {viewingStockItem.minStockLevel || 5} <span style={{ fontSize: '0.76rem', color: '#92400e', fontWeight: 500 }}>{viewingStockItem.unitOfMeasure}</span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#b45309' }}>Alert Trigger Level</div>
                    </div>
                  </div>
                </div>

                {/* Logistics & Placement Info */}
                <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b' }}>Brand & Manufacturer</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{viewingStockItem.brandName || 'General'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b' }}>Category Group</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{viewingStockItem.categoryName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b' }}>Warehouse Location</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{viewingStockItem.warehouseName}</span>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Commercial Pricing & Valuations */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                    Pricing & Profit Margin
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '10px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>Unit Cost</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#334155', marginTop: '1px' }}>
                        Rs. {Number(viewingStockItem.costPrice || 0).toFixed(2)}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Purchase</div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '10px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>Unit Selling</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '1px' }}>
                        Rs. {Number(viewingStockItem.sellingPrice || 0).toFixed(2)}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Catalog</div>
                    </div>
                    <div style={{ backgroundColor: '#f0f9ff', padding: '10px 10px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                      <div style={{ fontSize: '0.70rem', color: '#0369a1', fontWeight: 600 }}>Gross Margin</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0284c7', marginTop: '1px' }}>
                        Rs. {(Number(viewingStockItem.sellingPrice || 0) - Number(viewingStockItem.costPrice || 0)).toFixed(2)}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#0369a1', fontWeight: 700 }}>
                        {Number(viewingStockItem.sellingPrice) > 0
                          ? (((Number(viewingStockItem.sellingPrice) - Number(viewingStockItem.costPrice)) / Number(viewingStockItem.sellingPrice)) * 100).toFixed(1)
                          : '0.0'}% margin
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inventory Valuation Breakdown */}
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                    Asset Valuation & Revenue Potential
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>Total Asset Valuation (Cost)</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0284c7', marginTop: '1px' }}>
                        Rs. {Number(viewingStockItem.totalCostValue || (viewingStockItem.quantity * viewingStockItem.costPrice) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>On-Hand Stock × Cost Price</div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>Potential Retail Revenue</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginTop: '1px' }}>
                        Rs. {Number(viewingStockItem.quantity * (viewingStockItem.sellingPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>On-Hand Stock × Selling Price</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn btn-glass"
                onClick={() => setViewingStockItem(null)}
                style={{ padding: '8px 20px', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
