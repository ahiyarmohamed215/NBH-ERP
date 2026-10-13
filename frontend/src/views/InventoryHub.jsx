import PurchasingStatusDialog from '../components/PurchasingStatusDialog';
import {staffCode} from '../utils/staffCode';
import AllocationWorkspace from '../components/AllocationWorkspace';
import AllocationTable from '../components/AllocationTable';
import StockDetailsModal from '../components/StockDetailsModal';
import DateRangePicker,{matchesDateRange} from '../components/DateRangePicker';
import FilterSelect from '../components/FilterSelect';
import {inventorySellingPrice} from '../utils/inventoryPricing';
import {numberError} from '../utils/purchasingValidation';
import {printCurrentDirectory} from '../utils/printDirectory';
import './InventoryTheme.css';
import '../components/PurchasingAppearance.css';
import StatusBadge from '../components/StatusBadge';
import { formatBusinessDate } from '../utils/invoiceMapping';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDataSync } from '../hooks/useDataSync';
import { canEditModule, canViewCostPrice } from '../utils/permissionUtils';
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
  Printer,
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
  User,
  Check,
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
  const canSeeCost = canViewCostPrice(user);
  const { addToast } = useToast();
  const mastersRef = useRef(null);
  const directoryRef=useRef(null);

  const INVENTORY_TABS = [
    { id: 'inventory-list', label: 'Inventory List', icon: Boxes },
    { id: 'adjustments', label: 'Stock Adjustment', icon: SlidersHorizontal },
    { id: 'pos-quotas', label: 'Inventory Allocation', icon: ShieldCheck },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'warehouses', label: 'Warehouses', icon: Building2 },
    { id: 'brands', label: 'Brands', icon: Award },
    { id: 'categories', label: 'Categories', icon: LayoutGrid },
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
  const [adjustmentFrom,setAdjustmentFrom]=useState('');
  const [adjustmentTo,setAdjustmentTo]=useState('');

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
  const [quotaStatusFilter, setQuotaStatusFilter] = useState('ALL');

  // Quota Modal State
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [masterFormOpen,setMasterFormOpen]=useState(false);
  const [editingQuota, setEditingQuota] = useState(null);
  const [viewingQuota, setViewingQuota] = useState(null);
  const [showViewQuotaModal, setShowViewQuotaModal] = useState(false);
  const [quotaForm, setQuotaForm] = useState({
    productId: '',
    userId: '',
    allocatedQuantity: '',
    notes: '',
  });
  const [savingQuota, setSavingQuota] = useState(false);
  const [quotaStatusChange,setQuotaStatusChange]=useState(null);
  const [quotaStatusReason,setQuotaStatusReason]=useState('');
  const quotaStatus=quota=>quota.status==='DRAFT'?'DRAFT':quota.status==='CANCELLED'?'INACTIVE':quota.isActive?'ACTIVE':'INACTIVE';
  const [selectedProductStock, setSelectedProductStock] = useState(null);
  const [loadingProductStock, setLoadingProductStock] = useState(false);

  // Helper to determine available stock from loaded inventory balances
  const getProductStockInfo = (prodId) => {
    if (!prodId) return { available: 0, isOutOfStock: true, unit: 'Units' };
    const numId = Number(prodId);
    const prod = productsList.find((p) => Number(p.id) === numId);
    const matching = inventoryBalances.filter((b) => Number(b.productId) === numId || (prod && b.sku && b.sku === prod.sku));
    const unit = matching[0]?.unitOfMeasure || prod?.unitOfMeasure || 'Units';
    if (matching.length === 0) {
      return { available: 0, isOutOfStock: true, unit };
    }
    const totalAvail = matching.reduce((sum, b) => sum + (Number(b.availableQuantity ?? b.quantity) || 0), 0);
    return {
      available: totalAvail,
      isOutOfStock: totalAvail <= 0,
      unit,
    };
  };

  // Sync real-time database stock whenever selected product changes in allocation modal
  useEffect(() => {
    if (showQuotaModal && quotaForm.productId) {
      let isCancelled = false;
      const localStock = getProductStockInfo(quotaForm.productId);
      const prod = productsList.find((p) => String(p.id) === String(quotaForm.productId));
      setSelectedProductStock({
        availableStock: localStock.available,
        outOfStock: localStock.isOutOfStock,
        unit: localStock.unit,
        productName: prod?.name || '',
        productSku: prod?.sku || '',
      });
      setLoadingProductStock(true);

      staffQuotaApi.getProductStock(quotaForm.productId)
        .then((res) => {
          if (!isCancelled && res.data?.data) {
            const data = res.data.data;
            const avail = Number(data.availableStock ?? 0);
            setSelectedProductStock({
              availableStock: avail,
              outOfStock: Boolean(data.outOfStock || avail <= 0),
              unit: prod?.unitOfMeasure || localStock.unit || 'Units',
              productName: data.productName || prod?.name || '',
              productSku: data.productSku || prod?.sku || '',
              warehouseId: data.warehouseId,
            });
          }
        })
        .catch((err) => {
          console.warn('Real-time stock check fallback to inventory balances:', err);
        })
        .finally(() => {
          if (!isCancelled) setLoadingProductStock(false);
        });

      return () => {
        isCancelled = true;
      };
    } else {
      setSelectedProductStock(null);
    }
  }, [showQuotaModal, quotaForm.productId]);

  const [modalProductSearch, setModalProductSearch] = useState('');
  const [modalStaffSearch, setModalStaffSearch] = useState('');

  const filteredProductsForModal = useMemo(() => {
    if (!modalProductSearch.trim()) return productsList.slice(0, 60);
    const q = modalProductSearch.toLowerCase().trim();
    return productsList.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      const cat = (p.categoryName || p.category?.name || '').toLowerCase();
      const brand = (p.brandName || p.brand?.name || '').toLowerCase();
      return name.includes(q) || sku.includes(q) || barcode.includes(q) || cat.includes(q) || brand.includes(q);
    }).slice(0, 60);
  }, [productsList, modalProductSearch]);

  const filteredStaffForModal = useMemo(() => {
    if (!modalStaffSearch.trim()) return salesStaff;
    const q = modalStaffSearch.toLowerCase().trim();
    return salesStaff.filter((s) => {
      const name = (s.fullName || '').toLowerCase();
      const username = (s.username || '').toLowerCase();
      const code = staffCode(s).toLowerCase();
      const email = (s.email || '').toLowerCase();
      return name.includes(q) || username.includes(q) || code.includes(q) || email.includes(q);
    });
  }, [salesStaff, modalStaffSearch]);

  const loadQuotas = async () => {
    setLoadingQuotas(true);
    try {
      const [quotasRes, summaryRes, staffRes] = await Promise.all([
        staffQuotaApi.search({ size: 100 }).catch(() => ({ data: { data: { content: [] } } })),
        staffQuotaApi.getSummary().catch(() => ({ data: { data: null } })),
        salesmanApi.getPosStaff().catch(() => salesmanApi.getActive()).catch(() => ({ data: { data: [] } })),
      ]);
      setQuotas(quotasRes.data?.data?.content || quotasRes.data?.content || []);
      setQuotaSummary(summaryRes.data?.data || summaryRes.data || null);

      const rawStaff = staffRes.data?.data || staffRes.data || [];
      // Filter strictly to staff with POS module access
      const posAllowedStaff = rawStaff.filter((u) => {
        if (!u) return false;
        const roles = (u.roles || []).map((r) => String(r).toUpperCase());
        const perms = (u.permissions || []).map((p) => String(p).toUpperCase());
        return (
          roles.some(
            (r) =>
              r === 'ROLE_ADMIN' ||
              r === 'ROLE_SUPER_ADMIN' ||
              r === 'ROLE_MANAGER' ||
              r === 'ROLE_DIRECTOR' ||
              r.includes('CASHIER') ||
              r.includes('POS') ||
              r.includes('SALES')
          ) ||
          perms.some(
            (p) =>
              p.includes('SALES_CREATE') ||
              p.includes('SALES') ||
              p.includes('POS')
          )
        );
      });
      setSalesStaff(posAllowedStaff);
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

  const handleViewQuota = (quota) => {
    setViewingQuota(quota);
    setShowViewQuotaModal(true);
  };

  const handleOpenQuotaModal = (initialProduct = null, existingQuota = null) => {
    setModalProductSearch('');
    setModalStaffSearch('');
    if (existingQuota) {
      setEditingQuota(existingQuota);
      setQuotaForm({
        productId: String(existingQuota.productId || ''),
        userId: String(existingQuota.userId || ''),
        allocatedQuantity: String(existingQuota.allocatedQuantity || ''),
        notes: existingQuota.notes || '',
      });
    } else {
      setEditingQuota(null);
      setQuotaForm({
        productId: initialProduct ? String(initialProduct.id || initialProduct.productId || '') : '',
        userId: '',
        allocatedQuantity: '',
        notes: '',
      });
    }
    setShowQuotaModal(true);
  };

  const handleSaveQuota = async (e, requestedStatus) => {
    e.preventDefault();
    const targetStatus=requestedStatus || (editingQuota && quotaStatus(editingQuota)==='DRAFT'?'DRAFT':'ACTIVE');
    const hasInput=Boolean(quotaForm.productId || quotaForm.userId || String(quotaForm.allocatedQuantity || '').trim() || (quotaForm.notes || '').trim());
    if(targetStatus==='DRAFT' && !hasInput){addToast('Fill at least one input before saving a draft.','error');return;}
    if(targetStatus!=='DRAFT' && (!quotaForm.productId || !quotaForm.userId || !quotaForm.allocatedQuantity)){addToast('Select product, staff and allocated quantity.','error');return;}
    const allocationError=quotaForm.allocatedQuantity!==''?numberError(quotaForm.allocatedQuantity,'Allocated quantity',{positive:true,decimals:2,max:9999999999.99}):'';
    if(allocationError){addToast(allocationError,'error');return;}
    if((quotaForm.notes || '').length>255){addToast('Allocation notes must be 255 characters or fewer.','error');return;}
    const allocQty=quotaForm.allocatedQuantity===''?null:Number(quotaForm.allocatedQuantity);

    const availableStock = selectedProductStock != null
      ? Number(selectedProductStock.availableStock ?? 0)
      : Number(getProductStockInfo(quotaForm.productId).available ?? 0);
    const isOutOfStock = selectedProductStock != null
      ? Boolean(selectedProductStock.outOfStock || availableStock <= 0)
      : availableStock <= 0;

    if (targetStatus!=='DRAFT' && (isOutOfStock || availableStock <= 0)) {
      addToast('Selected product is out of stock (0 available). Cannot allocate inventory.', 'error');
      return;
    }

    if (targetStatus!=='DRAFT' && allocQty > availableStock) {
      addToast(`Cannot allocate ${allocQty} units. Only ${availableStock} units available in inventory stock.`, 'error');
      return;
    }

    setSavingQuota(true);
    try {
      if (editingQuota) {
        await staffQuotaApi.update(editingQuota.id, {
          allocatedQuantity: allocQty,
          notes: quotaForm.notes,
          ...(targetStatus==='DRAFT'?{status:'DRAFT',replaceDraftFields:true,productId:quotaForm.productId?Number(quotaForm.productId):null,userId:quotaForm.userId?Number(quotaForm.userId):null}:{}),
        });
        addToast('Inventory allocation updated successfully', 'success');
      } else {
        await staffQuotaApi.create({
          productId: quotaForm.productId?Number(quotaForm.productId):null,
          userId: quotaForm.userId?Number(quotaForm.userId):null,
          allocatedQuantity: allocQty,
          notes: quotaForm.notes,
          ...(targetStatus==='DRAFT'?{status:'DRAFT'}:{}),
        });
        addToast('Inventory allocation saved successfully', 'success');
      }
      setShowQuotaModal(false);
      await loadQuotas();
    } catch (err) {
      addToast('Failed to save inventory allocation: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setSavingQuota(false);
    }
  };

  const openQuotaStatus=(quota,target)=>{setQuotaStatusChange({quota,target});setQuotaStatusReason('');};
  const confirmQuotaStatus=async()=>{
    if(!quotaStatusChange || !quotaStatusReason.trim() || savingQuota)return;
    setSavingQuota(true);
    try{
      const {quota,target}=quotaStatusChange;
      const response=await staffQuotaApi.update(quota.id,{status:target,statusReason:quotaStatusReason.trim()});
      const updated=response.data?.data || response.data;
      if(viewingQuota?.id===quota.id)setViewingQuota(updated?.id?updated:{...quota,status:target,isActive:target==='ACTIVE'});
      setQuotaStatusChange(null);await loadQuotas();addToast('Allocation status updated.','success');
    }catch(error){addToast(error.response?.data?.message || error.message || 'Unable to change allocation status.','error');}
    finally{setSavingQuota(false);}
  };

  const filteredQuotas = useMemo(() => {
    return quotas.filter((q) => {
      if(quotaStatusFilter!=='ALL' && quotaStatus(q)!==quotaStatusFilter)return false;
      if (quotaSearch.trim()) {
        const qLower = quotaSearch.toLowerCase();
        const prodMatch = (q.productName || '').toLowerCase().includes(qLower) || (q.productSku || '').toLowerCase().includes(qLower);
        const staffMatch = (q.userFullName || '').toLowerCase().includes(qLower) || (q.username || '').toLowerCase().includes(qLower) || (q.userEmployeeCode || '').toLowerCase().includes(qLower);
        return prodMatch || staffMatch;
      }
      return true;
    });
  }, [quotas, quotaStatusFilter, quotaSearch]);

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
  const inventoryLoadGeneration=useRef(0);

  // Load warehouses, products, categories, and inventory balances
  const loadInventoryBalances = async () => {
    const generation=++inventoryLoadGeneration.current;
    try {
      setInventoryLoading(true);
      const [balRes, prodRes, whRes, catRes] = await Promise.allSettled([
        inventoryApi.getBalances({ size: 300 },{force:true}),
        productApi.getProducts({ size: 300 },{force:true}),
        warehouseApi.getAll(),
        categoryApi.getActive(),
      ]);
      if(generation!==inventoryLoadGeneration.current)return;

      const fetchedBalances = balRes.status === 'fulfilled' ? (balRes.value.data?.content || balRes.value.data || []) : [];
      const fetchedProducts = prodRes.status === 'fulfilled' ? (prodRes.value.data?.content || prodRes.value.data || []) : [];
      const fetchedWarehouses = whRes.status === 'fulfilled' ? (whRes.value.data || []) : [];
      const fetchedCategories = catRes.status === 'fulfilled' ? (catRes.value.data || []) : [];

      if (whRes.status === 'fulfilled') setWarehousesList(fetchedWarehouses);
      if (prodRes.status === 'fulfilled') setProductsList(fetchedProducts);
      if (catRes.status === 'fulfilled') setCategoriesList(fetchedCategories);



      let items = [];

      if (fetchedBalances.length > 0) {
        items = fetchedBalances
          .filter((b) => Number(b.quantity ?? 0) > 0)
          .map((b) => {
            const prod = fetchedProducts.find((p) => String(p.id) === String(b.productId) || (b.productSku && p.sku === b.productSku));
            const qty = Number(b.quantity ?? 0);
            const reserved = Number(b.reservedQuantity ?? 0);
            const avail = Number(b.availableQuantity ?? (qty - reserved));
            const cost = canSeeCost ? Number(b.costPrice ?? prod?.costPrice ?? 0) : null;
            const sell = inventorySellingPrice(b,prod,canSeeCost);
            const min = Number(b.minStockLevel ?? prod?.minStockLevel ?? 0);
            return {
              id: b.id || `bal-${b.productId}-${b.warehouseId}`,
              warehouseId: b.warehouseId,
              warehouseName: b.warehouseName || fetchedWarehouses.find(warehouse=>String(warehouse.id)===String(b.warehouseId))?.name || '—',
              warehouseCode: b.warehouseCode || fetchedWarehouses.find(warehouse=>String(warehouse.id)===String(b.warehouseId))?.code,
              productId: b.productId || prod?.id,
              sku: b.productSku || prod?.sku || '—',
              productName: b.productName || prod?.name || 'Unknown Product',
              brandName: prod?.brandName || b.brandName || '—',
              categoryName: prod?.categoryName || '—',
              unitOfMeasure: b.unitOfMeasure || prod?.unitOfMeasure || 'PCS',
              quantity: qty,
              reservedQuantity: reserved,
              availableQuantity: avail,
              costPrice: cost,
              sellingPrice: sell,
              totalCostValue: canSeeCost ? Number(b.totalCostValue ?? (qty * (cost || 0))) : null,
              minStockLevel: min,
              isLowStock: qty <= min && qty > 0,
              isOutOfStock: qty <= 0,
            };
          });
      }

      setInventoryBalances(items);
      setViewingStockItem(current=>current ? items.find(item=>item.id===current.id) || null : null);
    } catch (err) {
      if(generation!==inventoryLoadGeneration.current)return;
      console.error(err);
      addToast('Failed to load inventory balances: ' + err.message, 'error');
    } finally {
      if(generation===inventoryLoadGeneration.current)setInventoryLoading(false);
    }
  };

  useEffect(() => {
    loadInventoryBalances();
  }, [canSeeCost]);

  useEffect(() => {
    loadAdjustments();
  }, []);

  useDataSync(() => {
    loadInventoryBalances();
    loadAdjustments();
    loadQuotas();
  }, ['erp:data_changed', 'erp:inventory_updated']);

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

  const handlePrintDirectory = title => printCurrentDirectory(directoryRef.current,title);

  const handleNavigateGTN = () => {
    if (onNavigate) {
      onNavigate('purchasing', 'gtn', 'create');
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

  // Filtered adjustments
  const filteredAdjustments = useMemo(() => {
    return adjustmentRecords.filter((rec) => {
      if (filterType !== 'ALL' && rec.type !== filterType) return false;
      if (filterWarehouse !== 'ALL' && rec.warehouse !== filterWarehouse && rec.warehouseId !== filterWarehouse) return false;
      if(!matchesDateRange(rec.date,adjustmentFrom,adjustmentTo))return false;

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
  }, [adjustmentRecords, filterType, filterWarehouse, adjustmentFrom, adjustmentTo, searchQuery]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setFilterType('ALL');
    setFilterWarehouse('ALL');
    setAdjustmentFrom('');setAdjustmentTo('');
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
    if(canSeeCost && createForm.type!=='Reduction') {
      const error=numberError(createForm.costPrice,'Unit cost',{decimals:6});
      if(error){addToast(error,'error');return;}
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
        adjustmentDate: formatBusinessDate(),
        reason: createForm.reason + (createForm.remarks ? `: ${createForm.remarks}` : ''),
        items: [
          {
            productId: prdId,
            physicalQuantity: targetPhysical,
            ...(canSeeCost && createForm.type!=='Reduction' ? {unitCost:Number(createForm.costPrice)} : {}),
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

  return (
    <div ref={directoryRef} className={(`inventory-theme purchasing-no-shadows${showQuotaModal || masterFormOpen ? ' inventory-allocation-focus' : ''}`) + ' erp-page'}
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
      <div className="inventory-page-header erp-page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <h1 className="erp-page-title"

          >
            Inventory Management
          </h1>
          <p className="erp-page-description">
            Create and manage inventory records, warehouse locations, categories, and stock adjustments.
          </p>
        </div>

        {/* Action Button matching current active tab */}
        {currentTab === 'pos-quotas' ? (
          <button className="erp-button erp-button-primary"
            type="button"
            onClick={() => handleOpenQuotaModal()}
            style={{
              padding: '9px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <Plus size={17} /> New Allocation
          </button>
        ) : currentTab === 'adjustments' ? (
          <button className="erp-button erp-button-primary"
            type="button"
            onClick={handleOpenCreateRecord}
            style={{
              padding: '9px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <Plus size={17} /> New Adjustment
          </button>
        ) : currentTab === 'inventory-list' ? (
          <button className="erp-button erp-button-primary"
            type="button"
            onClick={handleNavigateGTN}
            style={{
              padding: '9px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <ArrowRightLeft size={16} /> New Stock Transfer
          </button>
        ) : (
          <button className="erp-button erp-button-primary"
            type="button"
            onClick={handleHeaderAdd}
            style={{
              padding: '9px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <Plus size={17} /> New {currentTab === 'products' ? 'Product' : currentTab === 'brands' ? 'Brand' : currentTab === 'warehouses' ? 'Warehouse' : 'Category'}
          </button>
        )}
      </div>

      {/* Subtabs Bar (Underline Style matching EmployeesHub - Fixed / Sticky) */}
      <div className="inventory-tabs erp-tabs"
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
        }}
      >
        {INVENTORY_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button data-active={isActive} aria-pressed={isActive} className="erp-tab"
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}

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
      {currentTab === 'inventory-list' && !showQuotaModal && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          {/* Search Bar & Action Buttons (Matched with Products Table Layout) */}
          <div className="inventory-toolbar"
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
              boxShadow: 'none',
            }}
          >
            {/* Left Control: Search Input matching table width */}
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search
                size={17}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '9px',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              />
              <input className="erp-field"
                type="text"
                placeholder="Search inventory by SKU, product name, brand, warehouse..."
                value={invSearchQuery}
                onChange={(e) => setInvSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 32px 0 38px',
                  border: '1px solid #e2e8f0',
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
              {invSearchQuery && (
                <button
                  type="button"
                  onClick={() => setInvSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: '2px',
                  }}
                  title="Clear search text"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Right Controls: Filters, Reset Filters, Print, & Refresh */}
            <div className="inventory-list-filter-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
              {/* Warehouse selector */}
              <FilterSelect
                value={invWarehouseFilter}
                onChange={(e) => setInvWarehouseFilter(e.target.value)}
                className="inventory-full-label-filter"
                title="Filter by warehouse"
              >
                <option value="ALL">All Warehouses</option>
                {warehousesList.map((w) => (
                  <option key={w.id} value={String(w.id)}>
                    {w.name}
                  </option>
                ))}
              </FilterSelect>

              {/* Stock Status selector */}
              <FilterSelect
                value={invStatusFilter}
                onChange={(e) => setInvStatusFilter(e.target.value)}
                className="inventory-full-label-filter"
                title="Filter by stock status"
              >
                <option value="ALL">All Stock Levels</option>
                <option value="IN_STOCK">In Stock Only</option>
                <option value="LOW_STOCK">Low Stock Only</option>
                <option value="OUT_OF_STOCK">Out of Stock Only</option>
              </FilterSelect>

              {/* Reset Filters button */}
              {(invSearchQuery || invStatusFilter !== 'ALL' || invWarehouseFilter !== 'ALL') && (
                <button className="erp-button"
                  type="button"
                  onClick={handleClearInvFilters}
                  style={{
                    height: '34px',
                    padding: '0 12px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
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

              {/* Print directory - Icon only */}
              <button
                type="button"
                onClick={()=>handlePrintDirectory('Inventory List')}
                style={{
                  height: '34px',
                  width: '36px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: 0,
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: 'none',
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
                  e.currentTarget.style.color = '#334155';
                }}
                title="Print Inventory List (A4)" aria-label="Print Inventory List (A4)"
              >
                <Printer size={15} />
              </button>

              {/* Refresh Records - Icon only */}
              <button
                type="button"
                onClick={loadInventoryBalances}
                style={{
                  height: '34px',
                  width: '36px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: 0,
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: 'none',
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
                  e.currentTarget.style.color = '#334155';
                }}
                title="Refresh inventory balances"
              >
                <RefreshCw size={14} className={inventoryLoading ? 'animate-spin' : ''} />
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
              boxShadow: 'none',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CODE / SKU</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PRODUCT NAME</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>BRAND</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>WAREHOUSE</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CATEGORY</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>QUANTITY</th>
                    {canSeeCost && (
                      <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>COST PRICE</th>
                    )}
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>SELLING PRICE</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryLoading ? (
                    <tr>
                      <td className="erp-table-cell" colSpan={canSeeCost ? 9 : 8} style={{ textAlign: 'center', color: '#64748b' }}>
                        Loading live inventory balances...
                      </td>
                    </tr>
                  ) : filteredInventory.length === 0 ? (
                    <tr>
                      <td className="erp-table-cell" colSpan={canSeeCost ? 9 : 8} style={{ textAlign: 'center', color: '#64748b' }}>
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
                        <td className="erp-table-cell" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                          {item.sku}
                        </td>
                        <td className="erp-table-cell" style={{ fontWeight: 600, color: '#0f172a' }}>
                          {item.productName}
                        </td>
                        <td className="erp-table-cell">
                          <span
                            style={{
                              backgroundColor: '#f8fafc',
                              color: '#334155',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: 'var(--erp-text-small)',
                              fontWeight: 600,
                              border: '1px solid #e2e8f0',
                              display: 'inline-block',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.brandName || 'General'}
                          </span>
                        </td>
                        <td className="erp-table-cell" style={{ color: '#475569', fontWeight: 500 }}>
                          {item.warehouseName}
                        </td>
                        <td className="erp-table-cell">
                          <span
                            style={{
                              backgroundColor: '#e0f2fe',
                              color: '#0369a1',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: 'var(--erp-text-small)',
                              fontWeight: 600,
                            }}
                          >
                            {item.categoryName}
                          </span>
                        </td>
                        <td className="erp-table-cell" style={{ fontWeight: 700, color: item.quantity > 0 ? '#0f172a' : '#dc2626' }}>
                          {item.quantity.toLocaleString()} <span style={{ fontSize: 'var(--erp-text-small)', color: '#64748b', fontWeight: 500 }}>{item.unitOfMeasure}</span>
                        </td>
                        {canSeeCost && (
                          <td className="erp-table-cell" style={{ color: '#475569', fontWeight: 600 }}>
                            Rs. {Number(item.costPrice || 0).toFixed(2)}
                          </td>
                        )}
                        <td className="erp-table-cell" style={{ fontWeight: 700, color: '#0f172a' }}>
                          Rs. {Number(item.sellingPrice || 0).toFixed(2)}
                        </td>
                        <td className="erp-table-cell">
                          <StatusBadge status={item.isOutOfStock ? 'OUT_OF_STOCK' : item.isLowStock ? 'LOW_STOCK' : 'IN_STOCK'} />
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
      {currentTab === 'products' && !showQuotaModal && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <MastersView
            ref={mastersRef}
            activeSubTab="products"
            isStandalone={true}
            allowedTabs={['products']}
            hideHeader={true}
            printDirectory={true}
            onFormModeChange={setMasterFormOpen}
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2b. BRANDS TAB */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'brands' && !showQuotaModal && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <MastersView
            ref={mastersRef}
            activeSubTab="brands"
            isStandalone={true}
            allowedTabs={['brands']}
            hideHeader={true}
            printDirectory={true}
            onFormModeChange={setMasterFormOpen}
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. WAREHOUSES TAB */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'warehouses' && !showQuotaModal && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <MastersView
            ref={mastersRef}
            activeSubTab="warehouses"
            isStandalone={true}
            allowedTabs={['warehouses']}
            hideHeader={true}
            printDirectory={true}
            onFormModeChange={setMasterFormOpen}
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. CATEGORIES TAB */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'categories' && !showQuotaModal && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <MastersView
            ref={mastersRef}
            activeSubTab="categories"
            isStandalone={true}
            allowedTabs={['categories']}
            hideHeader={true}
            printDirectory={true}
            onFormModeChange={setMasterFormOpen}
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. STOCK ADJUSTMENT TAB (Last Navigation Item) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'adjustments' && !showQuotaModal && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>

          {/* Search Bar & Filter Controls (Matched with Products Table Layout) */}
          <div className="inventory-toolbar"
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
            {/* Left Control: Search Input matching table width */}
            <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '9px',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              />
              <input className="erp-field"
                type="text"
                placeholder="Search adjustments by #, product, SKU, batch, warehouse, reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 32px 0 38px',
                  border: '1px solid #e2e8f0',
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
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: '2px',
                  }}
                  title="Clear search text"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Right Controls: Filters, Reset, Print, & Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
              <DateRangePicker documentType="Stock adjustment" from={adjustmentFrom} to={adjustmentTo} onChange={(from,to)=>{setAdjustmentFrom(from);setAdjustmentTo(to);}}/>
              {/* Type filter */}
              <FilterSelect
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{width:'115px'}}
              >
                <option value="ALL">All Types</option>
                <option value="Addition">Addition</option>
                <option value="Reduction">Reduction</option>
              </FilterSelect>

              {/* Warehouse filter */}
              <FilterSelect
                value={filterWarehouse}
                onChange={(e) => setFilterWarehouse(e.target.value)}
                className="inventory-full-label-filter"
                title="Filter stock adjustments by warehouse"
                style={{width:'auto'}}
              >
                <option value="ALL">All Warehouses</option>
                {warehousesList.map((w) => (
                  <option key={w.id} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </FilterSelect>

              {/* Reset Filters button */}
              {(filterType !== 'ALL' || filterWarehouse !== 'ALL' || adjustmentFrom || adjustmentTo || searchQuery) && (
                <button className="erp-button"
                  type="button"
                  onClick={handleClearFilters}
                  style={{
                    height: '34px',
                    padding: '0 12px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
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

              {/* Print directory - Icon only */}
              <button
                type="button"
                onClick={()=>handlePrintDirectory('Stock Adjustments')}
                style={{
                  height: '34px',
                  width: '36px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: 0,
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: 'none',
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
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.color = '#334155';
                }}
                title="Print Stock Adjustments (A4)" aria-label="Print Stock Adjustments (A4)"
              >
                <Printer size={15} />
              </button>

              {/* Refresh Records - Icon only */}
              <button
                type="button"
                onClick={() => {
                  addToast('Stock adjustments refreshed', 'info');
                }}
                style={{
                  height: '34px',
                  width: '36px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: 0,
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: 'none',
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
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.color = '#334155';
                }}
                title="Refresh records"
              >
                <RefreshCw size={14} />
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
              boxShadow: 'none',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>RECORD #</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DATE</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>TYPE</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>WAREHOUSE</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>SKU</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PRODUCT NAME</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>BATCH</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>QUANTITY</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>REASON</th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdjustments.length === 0 ? (
                    <tr>
                      <td className="erp-table-cell" colSpan={10} style={{ textAlign: 'center', color: '#64748b' }}>
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
                          <td className="erp-table-cell" style={{ fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                            {rec.recordNo}
                          </td>
                          <td className="erp-table-cell" style={{ color: '#475569' }}>
                            {rec.date}
                          </td>
                          <td className="erp-table-cell">
                            <span
                              style={{
                                color: isAddition ? '#16a34a' : '#dc2626',
                                fontWeight: 700,
                                fontSize: 'var(--erp-text-body)',
                              }}
                            >
                              {rec.type}
                            </span>
                          </td>
                          <td className="erp-table-cell" style={{ color: '#334155', fontWeight: 500 }}>
                            {rec.warehouse}
                          </td>
                          <td className="erp-table-cell" style={{ fontFamily: 'monospace', color: '#64748b' }}>
                            {rec.sku}
                          </td>
                          <td className="erp-table-cell" style={{ fontWeight: 600, color: '#0f172a' }}>
                            {rec.productName}
                          </td>
                          <td className="erp-table-cell" style={{ fontFamily: 'monospace', color: '#475569' }}>
                            {rec.batch}
                          </td>
                          <td className="erp-table-cell" style={{ textAlign: 'right', fontWeight: 700, color: isAddition ? '#16a34a' : '#dc2626', fontFamily: 'monospace' }}>
                            {rec.quantity > 0 ? `+${rec.quantity}` : rec.quantity}
                          </td>
                          <td className="erp-table-cell" style={{ color: '#475569' }}>
                            {rec.reason}
                          </td>
                          <td className="erp-table-cell" style={{ textAlign: 'center' }}>
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
      {/* 6. INVENTORY ALLOCATION TAB (Product Quantity Allocated per Staff Member) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'pos-quotas' && !showQuotaModal && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>

          {/* Search Bar & Filter Controls */}          <div className="inventory-toolbar"
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
              boxShadow: 'none',
            }}
          >
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search
                size={17}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '9px',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              />
              <input className="erp-field"
                type="text"
                placeholder="Search allocation by product SKU, name, or staff member..."
                value={quotaSearch}
                onChange={(e) => setQuotaSearch(e.target.value)}
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 32px 0 38px',
                  border: '1px solid #e2e8f0',
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
              {quotaSearch && (
                <button
                  type="button"
                  onClick={() => setQuotaSearch('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: '2px',
                  }}
                  title="Clear search text"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Right Controls: Status Filter, Reset, Print (Icon only), Refresh (Icon only) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
              {/* Status Filter */}
              <FilterSelect
                value={quotaStatusFilter}
                onChange={(e) => setQuotaStatusFilter(e.target.value)}
                style={{width:'140px'}}
                title="Filter allocations by status"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </FilterSelect>

              {/* Reset Filters button */}
              {(quotaSearch || quotaStatusFilter !== 'ALL') && (
                <button className="erp-button"
                  type="button"
                  onClick={() => {
                    setQuotaSearch('');
                    setQuotaStatusFilter('ALL');
                  }}
                  style={{
                    height: '34px',
                    padding: '0 12px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                  title="Reset allocation filters"
                >
                  <X size={13} /> Reset
                </button>
              )}

              {/* Print directory - Icon only */}
              <button
                type="button"
                onClick={()=>handlePrintDirectory('Inventory Allocation')}
                style={{
                  height: '34px',
                  width: '36px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: 0,
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: 'none',
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
                  e.currentTarget.style.color = '#334155';
                }}
                title="Print Inventory Allocation (A4)" aria-label="Print Inventory Allocation (A4)"
              >
                <Printer size={15} />
              </button>

              {/* Refresh Records - Icon only */}
              <button
                type="button"
                onClick={loadQuotas}
                disabled={loadingQuotas}
                style={{
                  height: '34px',
                  width: '36px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: 0,
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: 'none',
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
                  e.currentTarget.style.color = '#334155';
                }}
                title="Refresh inventory allocations"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          <AllocationTable rows={filteredQuotas} loading={loadingQuotas} canEdit={canEditInventory} statusOf={quotaStatus} onView={handleViewQuota} onEdit={q=>handleOpenQuotaModal(null,q)} onCreate={()=>handleOpenQuotaModal()}/>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Set / Edit Inventory Allocation */}
      {/* ------------------------------------------------------------- */}
      {showQuotaModal && <AllocationWorkspace form={quotaForm} onChange={setQuotaForm} editing={editingQuota}
        products={productsList} staff={salesStaff} productResults={filteredProductsForModal} staffResults={filteredStaffForModal}
        productQuery={modalProductSearch} onProductQuery={setModalProductSearch} staffQuery={modalStaffSearch} onStaffQuery={setModalStaffSearch}
        stockInfo={selectedProductStock} getStock={getProductStockInfo} loadingStock={loadingProductStock} saving={savingQuota}
        onSave={handleSaveQuota} onCancel={()=>setShowQuotaModal(false)}/>}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: View Inventory Allocation Details Popup */}
      {/* ------------------------------------------------------------- */}
      {showViewQuotaModal && viewingQuota && (
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
          onClick={() => setShowViewQuotaModal(false)}
        >
          <div role="dialog" aria-modal="true" aria-label="Inventory allocation details"
            style={{
              width: '100%',
              maxWidth: '540px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: 'none',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
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
                  <h3 style={{ margin: 0, fontSize: 'var(--erp-text-section)', fontWeight: 700, color: '#0f172a' }}>
                    Inventory Allocation Details
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: 'var(--erp-text-small)', color: '#64748b' }}>
                    Staff product limit and available inventory
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowViewQuotaModal(false)}
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

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Key Metrics: Total Stock Available vs Given to Staff */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Total Stock Available
                  </span>
                  {Number(viewingQuota.totalStockAvailable ?? viewingQuota.currentStockInWarehouse ?? 0) <= 0 ? (
                    <div style={{ fontSize: 'var(--erp-text-dialog)', fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={18} color="#ef4444" />
                      0 (Out of Stock)
                    </div>
                  ) : (
                    <div style={{ fontSize: 'var(--erp-text-dialog)', fontWeight: 700, color: '#15803d' }}>
                      {Number(viewingQuota.totalStockAvailable ?? viewingQuota.currentStockInWarehouse ?? 0).toLocaleString()}{' '}
                      <span style={{ fontSize: 'var(--erp-text-body)', color: '#166534', fontWeight: 500 }}>{viewingQuota.productUnit || 'Units'}</span>
                    </div>
                  )}
                  <span style={{ fontSize: 'var(--erp-text-caption)', color: '#94a3b8' }}>Total enterprise inventory</span>
                </div>

                <div
                  style={{
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Given to Staff
                  </span>
                  <div style={{ fontSize: 'var(--erp-text-dialog)', fontWeight: 700, color: '#0284c7' }}>
                    {Number(viewingQuota.allocatedQuantity || 0).toLocaleString()}{' '}
                    <span style={{ fontSize: 'var(--erp-text-body)', color: '#0284c7', fontWeight: 600 }}>{viewingQuota.productUnit || 'Units'}</span>
                  </div>
                  <span style={{ fontSize: 'var(--erp-text-caption)', color: '#0284c7' }}>Allocated selling limit</span>
                </div>
              </div>

              {/* Details List */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* Product */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--erp-text-body)', color: '#64748b', fontWeight: 500 }}>Product</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 'var(--erp-text-button)' }}>{viewingQuota.productName || 'Product not selected'}</div>
                    <div style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b', fontFamily: 'monospace' }}>SKU: {viewingQuota.productSku || '—'}</div>
                  </div>
                </div>

                <div style={{ height: '1px', backgroundColor: '#f1f5f9' }} />

                {/* Staff Member */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--erp-text-body)', color: '#64748b', fontWeight: 500 }}>Staff Member</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 'var(--erp-text-button)' }}>
                      {viewingQuota.userFullName || viewingQuota.username || 'Staff not selected'}
                    </div>
                    <div style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b' }}>
                      @{viewingQuota.username} {viewingQuota.userEmployeeCode ? `• ${viewingQuota.userEmployeeCode}` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ height: '1px', backgroundColor: '#f1f5f9' }} />

                {/* Status with Toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--erp-text-body)', color: '#64748b', fontWeight: 500 }}>Status</span>
                  <StatusBadge status={quotaStatus(viewingQuota)}/>

                </div>

                {viewingQuota.notes && (
                  <>
                    <div style={{ height: '1px', backgroundColor: '#f1f5f9' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 'var(--erp-text-body)', color: '#64748b', fontWeight: 500 }}>Notes</span>
                      <span style={{ fontSize: 'var(--erp-text-body)', color: '#334155', maxWidth: '65%', textAlign: 'right' }}>
                        {viewingQuota.notes}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                backgroundColor: '#f8fafc',
              }}
            >
              <button className="erp-button"
                type="button"
                onClick={() => setShowViewQuotaModal(false)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
              {canEditInventory && <>
                {['DRAFT','INACTIVE'].includes(quotaStatus(viewingQuota)) && <button type="button" className="allocation-primary" disabled={savingQuota || !viewingQuota.productId || !viewingQuota.userId || Number(viewingQuota.allocatedQuantity || 0)<=0} onClick={()=>openQuotaStatus(viewingQuota,'ACTIVE')}>Allocate</button>}
                {quotaStatus(viewingQuota)!=='INACTIVE' && <button type="button" className="allocation-cancel-status" disabled={savingQuota} onClick={()=>openQuotaStatus(viewingQuota,'INACTIVE')}>Make inactive</button>}
                {quotaStatus(viewingQuota)!=='DRAFT' && Number(viewingQuota.soldQuantity || 0)===0 && <button type="button" className="allocation-secondary" disabled={savingQuota} onClick={()=>openQuotaStatus(viewingQuota,'DRAFT')}>Return to draft</button>}
              </>}
              {canEditInventory && (
                <button
                  type="button"
                  onClick={() => {
                    setShowViewQuotaModal(false);
                    handleOpenQuotaModal(null, viewingQuota);
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontSize: 'var(--erp-text-field)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Edit2 size={14} />
                  <span>Edit Allocation</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: New Stock Adjustment Record (Exact Matching User Screenshots) */}
      {/* ------------------------------------------------------------- */}
      {showCreateModal && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '680px',
              padding: '16px 20px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              boxShadow: 'none',
              maxHeight: '96vh',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--erp-text-section)', fontWeight: 800, color: '#0f172a' }}>
                  {editingRecord ? `Edit Stock Adjustment (${editingRecord.recordNo})` : 'New Stock Adjustment'}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: 'var(--erp-text-caption)', color: '#64748b' }}>
                  Adjust warehouse inventory quantities and record reason for audit compliance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', borderRadius: '4px' }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Action Selector */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: 'var(--erp-text-small)', fontWeight: 700, color: '#334155' }}>
                    Adjustment Action *
                  </label>
                  {createForm.type && (
                    <span style={{ fontSize: 'var(--erp-text-caption)', color: createForm.type === 'Addition' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                      {createForm.type === 'Addition' ? '✓ Adds new units to available inventory' : '✓ Deducts units from existing inventory'}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {/* Add stock button */}
                  <button
                    type="button"
                    onClick={() => {
                      setCreateForm((prev) => ({
                        ...prev,
                        type: 'Addition',
                        reason: prev.reason || 'Opening stock correction',
                      }));
                    }}
                    style={{
                      border: createForm.type === 'Addition' ? '2px solid #22c55e' : '1px solid #e2e8f0',
                      backgroundColor: createForm.type === 'Addition' ? '#f0fdf4' : '#ffffff',
                      borderRadius: '8px',
                      padding: '7px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: createForm.type === 'Addition' ? '#22c55e' : '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: createForm.type === 'Addition' ? '#ffffff' : '#64748b',
                      flexShrink: 0,
                    }}>
                      <Plus size={13} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--erp-text-field)', fontWeight: 700, color: createForm.type === 'Addition' ? '#16a34a' : '#0f172a' }}>
                        Add Stock
                      </div>
                      <div style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b' }}>
                        Increase physical on-hand units
                      </div>
                    </div>
                  </button>

                  {/* Reduce stock button */}
                  <button
                    type="button"
                    onClick={() => {
                      setCreateForm((prev) => ({
                        ...prev,
                        type: 'Reduction',
                        reason: prev.reason || 'Stock count variance',
                      }));
                    }}
                    style={{
                      border: createForm.type === 'Reduction' ? '2px solid #ef4444' : '1px solid #e2e8f0',
                      backgroundColor: createForm.type === 'Reduction' ? '#fef2f2' : '#ffffff',
                      borderRadius: '8px',
                      padding: '7px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: createForm.type === 'Reduction' ? '#ef4444' : '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: createForm.type === 'Reduction' ? '#ffffff' : '#64748b',
                      flexShrink: 0,
                    }}>
                      <Minus size={13} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--erp-text-field)', fontWeight: 700, color: createForm.type === 'Reduction' ? '#dc2626' : '#0f172a' }}>
                        Reduce Stock
                      </div>
                      <div style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b' }}>
                        Deduct damage, variance, or losses
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Notice when no action selected */}
              {!createForm.type && (
                <div
                  style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fef3c7',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#92400e',
                    fontSize: 'var(--erp-text-small)',
                  }}
                >
                  <AlertTriangle size={14} color="#d97706" style={{ flexShrink: 0 }} />
                  <span>Please choose whether to Add Stock or Reduce Stock above to continue.</span>
                </div>
              )}

              {/* Form Content only shown when type is selected */}
              {createForm.type && (
                <>
                  {/* Row 1: Warehouse, Product, Quantity */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.3fr 0.8fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: '#334155', marginBottom: '3px' }}>
                        Warehouse *
                      </label>
                      <select className="erp-field"
                        value={createForm.warehouseId}
                        onChange={(e) => setCreateForm({ ...createForm, warehouseId: e.target.value })}
                        style={{
                          width: '100%',
                          height: '34px',
                          padding: '0 8px',
                          border: '1px solid #cbd5e1',
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
                      <label style={{ display: 'block', fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: '#334155', marginBottom: '3px' }}>
                        Product *
                      </label>
                      <select className="erp-field"
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
                          height: '34px',
                          padding: '0 8px',
                          border: '1px solid #cbd5e1',
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
                      <label style={{ display: 'block', fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: '#334155', marginBottom: '3px' }}>
                        Quantity *
                      </label>
                      <input className="erp-field"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="0"
                        value={createForm.quantity}
                        onChange={(e) => setCreateForm({ ...createForm, quantity: e.target.value })}
                        style={{
                          width: '100%',
                          height: '34px',
                          padding: '0 8px',
                          border: '1px solid #cbd5e1',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                        required
                      />
                    </div>
                  </div>

                  {/* Row 2: Reason & Cost price per unit */}
                  <div style={{ display: 'grid', gridTemplateColumns: canSeeCost ? '1.4fr 1fr' : '1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: '#334155', marginBottom: '3px' }}>
                        Reason *
                      </label>
                      <select className="erp-field"
                        value={createForm.reason}
                        onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
                        style={{
                          width: '100%',
                          height: '34px',
                          padding: '0 8px',
                          border: '1px solid #cbd5e1',
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

                    {canSeeCost ? (
                      <div>
                        <label style={{ display: 'block', fontSize: 'var(--erp-text-caption)', fontWeight: 600, color: '#334155', marginBottom: '3px' }}>
                          Cost price per unit *
                        </label>
                        <input className="erp-field"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={createForm.costPrice}
                          onChange={(e) => setCreateForm({ ...createForm, costPrice: e.target.value })}
                          style={{
                            width: '100%',
                            height: '34px',
                            padding: '0 8px',
                            border: '1px solid #cbd5e1',
                            boxSizing: 'border-box',
                            outline: 'none',
                          }}
                          required
                        />
                      </div>
                    ) : (
                      <input type="hidden" value={createForm.costPrice || '0.00'} />
                    )}
                  </div>

                  {/* Compact 1-line Adjustment summary strip */}
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
                          borderRadius: '6px',
                          padding: '7px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          fontSize: 'var(--erp-text-small)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                          <span
                            style={{
                              backgroundColor: isAddition ? '#dcfce7' : '#fee2e2',
                              color: isAddition ? '#15803d' : '#dc2626',
                              fontSize: 'var(--erp-text-badge)',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              textTransform: 'uppercase',
                              flexShrink: 0,
                            }}
                          >
                            {isAddition ? '+ Add' : '- Reduce'}
                          </span>
                          <span style={{ color: '#475569', flexShrink: 0 }}>
                            Wh: <strong style={{ color: '#0f172a' }}>{selWh?.name || '—'}</strong>
                          </span>
                          <span style={{ color: '#cbd5e1', flexShrink: 0 }}>|</span>
                          <span style={{ color: '#475569', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selProd?.name}>
                            Prod: <strong style={{ color: '#0f172a' }}>{selProd?.name || '—'}</strong>
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span style={{ color: '#475569' }}>
                            Qty: <strong style={{ color: isAddition ? '#16a34a' : '#dc2626' }}>{isAddition ? `+${qtyNum}` : `-${qtyNum}`}</strong>
                          </span>
                          {canSeeCost && (
                            <>
                              <span style={{ color: '#cbd5e1' }}>|</span>
                              <span style={{ color: '#475569' }}>
                                Total: <strong style={{ color: '#0f172a' }}>LKR {totalVal.toFixed(2)}</strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '2px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                <button className="erp-button"
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    padding: '0 14px',
                    height: '34px',
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                {!createForm.type ? (
                  <button className="erp-button"
                    type="button"
                    disabled
                    style={{
                      backgroundColor: '#f1f5f9',
                      color: '#94a3b8',
                      border: 'none',
                      padding: '0 16px',
                      height: '34px',
                      cursor: 'not-allowed',
                    }}
                  >
                    Select Action First
                  </button>
                ) : createForm.type === 'Addition' ? (
                  <button className="erp-button"
                    type="submit"
                    disabled={submittingRecord}
                    style={{
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0 18px',
                      height: '34px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Plus size={15} /> Add Stock
                  </button>
                ) : (
                  <button className="erp-button"
                    type="submit"
                    disabled={submittingRecord}
                    style={{
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0 18px',
                      height: '34px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Minus size={15} /> Reduce Stock
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
                  <h3 style={{ margin: 0, fontSize: 'var(--erp-text-section)', color: '#0f172a' }}>{viewingRecord.recordNo}</h3>
                  <span style={{ fontSize: 'var(--erp-text-small)', color: '#64748b' }}>Date: {viewingRecord.date}</span>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: 'var(--erp-text-button)' }}>
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
                <span style={{ fontWeight: 800, fontSize: 'var(--erp-text-nav)', color: viewingRecord.quantity > 0 ? '#16a34a' : '#dc2626', fontFamily: 'monospace' }}>
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
                className="btn btn-primary erp-button erp-button-primary"
                onClick={() => setViewingRecord(null)}
                style={{ borderColor: '#0284c7', padding: '7px 20px' }}
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
      {quotaStatusChange && <PurchasingStatusDialog title={quotaStatusChange.target==='INACTIVE'?'Deactivate allocation':quotaStatusChange.target==='DRAFT'?'Return allocation to draft':'Activate allocation'} confirmLabel={quotaStatusChange.target==='INACTIVE'?'Make inactive':quotaStatusChange.target==='DRAFT'?'Save as draft':'Allocate'}
        pending={{type:'Allocation',number:quotaStatusChange.quota.productSku || `Allocation #${quotaStatusChange.quota.id}`,current:quotaStatus(quotaStatusChange.quota),target:quotaStatusChange.target,description:quotaStatusChange.target==='INACTIVE'?'Deactivating disables this selling limit and preserves its history. Warehouse stock will not change.':quotaStatusChange.target==='DRAFT'?'The allocation will remain saved as a draft until it is completed and activated.':'Complete product, staff and quantity first. Available stock will be checked before activation.'}}
        reason={quotaStatusReason} onReasonChange={setQuotaStatusReason} busy={savingQuota} onClose={()=>setQuotaStatusChange(null)} onConfirm={confirmQuotaStatus}/>}
      {viewingStockItem && <StockDetailsModal item={viewingStockItem} canSeeCost={canSeeCost} onClose={()=>setViewingStockItem(null)}/>}

    </div>
  );
}
