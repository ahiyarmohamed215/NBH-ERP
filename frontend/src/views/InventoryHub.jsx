import {adjustmentStatus} from '../utils/stockAdjustmentPresentation';
import AdjustmentTable from '../components/AdjustmentTable';
import AdjustmentWorkspace from '../components/AdjustmentWorkspace';
import AdjustmentDetailsModal from '../components/AdjustmentDetailsModal';
import InventoryBalanceTable from '../components/InventoryBalanceTable';
import {newestFirst} from '../utils/recordOrder';
import AllocationDetailsModal from '../components/AllocationDetailsModal';
import {canAccessTab,canWriteTab,hasPermission} from '../utils/moduleAccess';
import useModuleTab from '../hooks/useModuleTab';
import ErpTabs, {ErpTab} from '../components/ErpTabs';
import PurchasingStatusDialog from '../components/PurchasingStatusDialog';
import {staffCode} from '../utils/staffCode';
import AllocationWorkspace from '../components/AllocationWorkspace';
import AllocationTable from '../components/AllocationTable';
import useRecordDeletion from '../hooks/useRecordDeletion';
import StockDetailsModal from '../components/StockDetailsModal';
import DateRangePicker,{matchesDateRange} from '../components/DateRangePicker';
import FilterSelect from '../components/FilterSelect';
import {inventorySellingPrice} from '../utils/inventoryPricing';
import {numberError} from '../utils/purchasingValidation';
import {printCurrentDirectory} from '../utils/printDirectory';
import './InventoryTheme.css';
import '../components/PurchasingAppearance.css';
import { formatBusinessDate } from '../utils/invoiceMapping';
import SearchBar from '../components/SearchBar';
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
  brandApi,
  staffQuotaApi,
  salesmanApi,
  clearApiCache,
} from '../api/apiClient';
import { useInventoryBalancesQuery, invalidateInventoryQueries } from '../queryClient';
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
  const allocationDeletion=useRecordDeletion('ALLOCATION','Inventory allocation',()=>{setShowViewQuotaModal(false);return loadQuotas();});
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

  const allowedTabs = INVENTORY_TABS.filter((tab) => canAccessTab(user, 'inventory', tab.id));
  const defaultTab = allowedTabs[0]?.id || 'inventory-list';

  const [currentTab, setCurrentTab] = useModuleTab('inventory', activeSubTab || defaultTab, defaultTab, user);
  const activeTab = currentTab || defaultTab;

  // Sync subTab prop
  useEffect(() => {
    if (activeSubTab && INVENTORY_TABS.some((t) => t.id === activeSubTab)) {
      setCurrentTab(activeSubTab);
    }
  }, [activeSubTab]);

  useEffect(() => {
    if (activeTab && onSubTabChange && activeTab !== activeSubTab) {
      onSubTabChange(activeTab);
    }
  }, [activeTab, activeSubTab, onSubTabChange]);

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
  const [adjustmentStatusFilter,setAdjustmentStatusFilter]=useState('ALL');
  const [adjustmentTransition,setAdjustmentTransition]=useState(null);
  const [adjustmentTransitionReason,setAdjustmentTransitionReason]=useState('');
  const [adjustmentTransitionBusy,setAdjustmentTransitionBusy]=useState(false);
  const [adjustmentsLoading, setAdjustmentsLoading] = useState(false);

  const loadAdjustments = async (isManual = false) => {
    try {
      setAdjustmentsLoading(true);
      if (isManual) {
        clearApiCache('/stock-adjustments');
        invalidateInventoryQueries();
      }
      const minDelay = isManual ? new Promise((r) => setTimeout(r, 250)) : Promise.resolve();
      const [res] = await Promise.all([
        adjustmentApi.search({ size: 100 }, { force: true, skipCache: true }),
        minDelay,
      ]);
      const content = res.data?.data?.content || res.data?.content || [];
      const formatted = content.map((adj) => {
        const items = (adj.items || []).map((it) => ({
          id: it.id || `${adj.id}-${it.productId}`,
          productId: it.productId,
          productCode: it.productSku,
          sku: it.productSku,
          productSku: it.productSku,
          productName: it.productName,
          unitOfMeasure: it.unitOfMeasure,
          warehouseName: adj.warehouseName,
          warehouseId: String(adj.warehouseId),
          sourceGrnNumber: it.sourceGrnNumber,
          sourceGrnId: it.sourceGrnId,
          availableStock: it.systemQuantity,
          systemQuantity: it.systemQuantity,
          physicalQuantity: it.physicalQuantity,
          differenceQuantity: it.differenceQuantity,
          quantity: Math.abs(Number(it.differenceQuantity || 0)),
          unitCost: it.unitCost,
          reason: it.reason || adj.reason,
          after: it.physicalQuantity != null ? it.physicalQuantity : (
            adj.adjustmentType === 'REDUCTION' || adj.adjustmentType === 'Reduction'
              ? (Number(it.systemQuantity || 0) - Math.abs(Number(it.differenceQuantity || 0)))
              : (Number(it.systemQuantity || 0) + Math.abs(Number(it.differenceQuantity || 0)))
          ),
        }));
        const first = items[0] || {};
        const isReduction = adj.adjustmentType === 'REDUCTION' || adj.adjustmentType === 'Reduction' || Number(first.differenceQuantity || 0) < 0;
        return {
          id: adj.id,
          adjustmentId: adj.id,
          productId: first.productId,
          recordNo: adj.adjustmentNumber,
          date: adj.adjustmentDate,
          type: isReduction ? 'Reduction' : 'Addition',
          adjustmentType: adj.adjustmentType,
          warehouse: adj.warehouseName,
          warehouseId: String(adj.warehouseId),
          sku: first.productSku,
          productName: first.productName,
          batch: adj.adjustmentNumber,
          sourceGrnNumber: first.sourceGrnNumber,
          sourceHeldBillId: adj.sourceHeldBillId, sourceHeldBillNumber: adj.sourceHeldBillNumber,
          sourceGrnId: first.sourceGrnId,
          quantity: Number(first.differenceQuantity || 0),
          reason: first.reason || adj.reason,
          remarks: first.reason && adj.reason?.startsWith(first.reason + ': ') ? adj.reason.slice(first.reason.length + 2) : (adj.reason || ''),
          status: adj.status || 'DRAFT',
          totalProducts: items.length,
          items: items,
        };
      });
      setAdjustmentRecords(formatted);
    } catch (err) {
      console.error('Failed to load adjustments from API:', err);
    } finally {
      setAdjustmentsLoading(false);
    }
  };

  const [warehousesList, setWarehousesList] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const productsLoadingRef = useRef(false);

  const ensureProductsLoaded = async () => {
    if (productsList.length > 0) return productsList;
    if (productsLoadingRef.current) return productsList;
    productsLoadingRef.current = true;
    try {
      const prodRes = await productApi.getProducts({ size: 300 });
      const fetchedProducts = prodRes.data?.content || (Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.data || []);
      setProductsList(fetchedProducts);
      return fetchedProducts;
    } catch (e) {
      console.warn('Failed to load products for inventory workspace:', e);
      return [];
    } finally {
      productsLoadingRef.current = false;
    }
  };

  // Filters matching screenshot
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'Addition' | 'Reduction'
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
  const [quotaFrom,setQuotaFrom]=useState('');
  const [quotaTo,setQuotaTo]=useState('');

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
        staffQuotaApi.search({ size: 100, sort: 'createdAt,desc' }).catch(() => ({ data: { data: { content: [] } } })),
        staffQuotaApi.getSummary().catch(() => ({ data: { data: null } })),
        salesmanApi.getPosStaff().catch(() => {addToast('Unable to load assigning staff. Refresh inventory allocations and try again.','error');return {data:[]};}),
      ]);
      setQuotas(quotasRes.data?.data?.content || quotasRes.data?.content || []);
      setQuotaSummary(summaryRes.data?.data || summaryRes.data || null);

      const rawStaff = staffRes.data?.data || staffRes.data || [];
      // The reference endpoint already checks approval and POS access on the server.
      setSalesStaff(Array.isArray(rawStaff)?rawStaff.filter(person=>person && person.isActive!==false):[]);
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
    ensureProductsLoaded();
    setModalProductSearch('');
    setModalStaffSearch('');
    if (existingQuota) {
      setEditingQuota(existingQuota);
      setQuotaForm({
        productId: String(existingQuota.productId || ''),
        userId: String(existingQuota.userId || ''),
        allocatedQuantity: String(existingQuota.allocatedQuantity || ''),
        notes: existingQuota.notes || '',
        items: [],
      });
    } else {
      setEditingQuota(null);
      setQuotaForm({
        productId: initialProduct ? String(initialProduct.id || initialProduct.productId || '') : '',
        userId: '',
        allocatedQuantity: '',
        notes: '',
        items: [],
      });
    }
    setShowQuotaModal(true);
  };

  const handleSaveQuota = async (e, requestedStatus) => {
    e.preventDefault();
    const targetStatus=requestedStatus || (editingQuota && quotaStatus(editingQuota)==='DRAFT'?'DRAFT':'ACTIVE');
    const hasItems = Array.isArray(quotaForm.items) && quotaForm.items.length > 0;
    const hasInput = Boolean(hasItems || quotaForm.productId || quotaForm.userId || String(quotaForm.allocatedQuantity || '').trim() || (quotaForm.notes || '').trim());
    if(targetStatus==='DRAFT' && !hasInput){addToast('Fill at least one input before saving a draft.','error');return;}
    if(targetStatus!=='DRAFT' && !hasItems && (!quotaForm.productId || !quotaForm.userId || !quotaForm.allocatedQuantity)){addToast('Select product, staff and allocated quantity.','error');return;}
    if(targetStatus!=='DRAFT' && hasItems && !quotaForm.userId){addToast('Select staff member to allocate products to.','error');return;}
    if((quotaForm.notes || '').length>255){addToast('Allocation notes must be 255 characters or fewer.','error');return;}

    const allocQty = quotaForm.allocatedQuantity==='' || quotaForm.allocatedQuantity==null ? null : Number(quotaForm.allocatedQuantity);

    if (!hasItems) {
      const allocationError = quotaForm.allocatedQuantity!=='' && quotaForm.allocatedQuantity!=null ? numberError(quotaForm.allocatedQuantity,'Allocated quantity',{positive:true,decimals:2,max:9999999999.99}):'';
      if(allocationError){addToast(allocationError,'error');return;}

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
      } else if (hasItems && quotaForm.items.length > 1) {
        await Promise.all(quotaForm.items.map(item => staffQuotaApi.create({
          productId: item.productId ? Number(item.productId) : null,
          userId: quotaForm.userId ? Number(quotaForm.userId) : null,
          allocatedQuantity: item.allocatedQuantity ? Number(item.allocatedQuantity) : null,
          notes: item.notes || quotaForm.notes,
          ...(targetStatus==='DRAFT'?{status:'DRAFT'}:{}),
        })));
        addToast(`Successfully created ${quotaForm.items.length} inventory allocations`, 'success');
      } else {
        const single = hasItems ? quotaForm.items[0] : null;
        await staffQuotaApi.create({
          productId: single ? Number(single.productId) : quotaForm.productId?Number(quotaForm.productId):null,
          userId: quotaForm.userId?Number(quotaForm.userId):null,
          allocatedQuantity: single ? Number(single.allocatedQuantity) : allocQty,
          notes: single?.notes || quotaForm.notes,
          ...(targetStatus==='DRAFT'?{status:'DRAFT'}:{}),
        });
        addToast('Inventory allocation saved successfully', 'success');
      }
      invalidateInventoryQueries();
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
      invalidateInventoryQueries();
      setQuotaStatusChange(null);await loadQuotas();addToast('Allocation status updated.','success');
    }catch(error){addToast(error.response?.data?.message || error.message || 'Unable to change allocation status.','error');}
    finally{setSavingQuota(false);}
  };

  const filteredQuotas = useMemo(() => {
    return newestFirst(quotas).filter((q) => {
      if(!matchesDateRange(q.createdAt,quotaFrom,quotaTo))return false;
      if(quotaStatusFilter!=='ALL' && quotaStatus(q)!==quotaStatusFilter)return false;
      if (quotaSearch.trim()) {
        const qLower = quotaSearch.toLowerCase();
        const prodMatch = (q.productName || '').toLowerCase().includes(qLower) || (q.productSku || '').toLowerCase().includes(qLower);
        const staffMatch = (q.userFullName || '').toLowerCase().includes(qLower) || (q.username || '').toLowerCase().includes(qLower) || (q.userEmployeeCode || '').toLowerCase().includes(qLower);
        return prodMatch || staffMatch;
      }
      return true;
    });
  }, [quotas, quotaStatusFilter, quotaSearch, quotaFrom, quotaTo]);

  // -------------------------------------------------------------
  // INVENTORY LIST (LIVE BALANCES) TAB STATE & LOGIC
  // -------------------------------------------------------------
  const [inventoryBalances, setInventoryBalances] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [brandsList, setBrandsList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [invSearchQuery, setInvSearchQuery] = useState('');
  const [invWarehouseFilter, setInvWarehouseFilter] = useState('ALL');
  const [invBrandFilter, setInvBrandFilter] = useState('ALL');
  const [invCategoryFilter, setInvCategoryFilter] = useState('ALL');
  const [invStatusFilter, setInvStatusFilter] = useState('ALL'); // 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  const [viewingStockItem, setViewingStockItem] = useState(null);
  const inventoryLoadGeneration=useRef(0);

  // Central TanStack Query for Inventory Balances
  const {
    data: balancesQueryData,
    refetch: refetchBalances,
  } = useInventoryBalancesQuery(
    {
      warehouseId: invWarehouseFilter !== 'ALL' ? invWarehouseFilter : undefined,
      query: invSearchQuery,
      size: 300,
    },
    {
      enabled: currentTab === 'inventory-list',
    }
  );

  useEffect(() => {
    if (balancesQueryData && currentTab === 'inventory-list') {
      const rawBalances = balancesQueryData?.content || balancesQueryData?.data?.content || (Array.isArray(balancesQueryData?.data) ? balancesQueryData?.data : (Array.isArray(balancesQueryData) ? balancesQueryData : []));
      if (Array.isArray(rawBalances) && rawBalances.length > 0) {
        const items = rawBalances
          .filter((b) => Number(b.quantity ?? 0) > 0)
          .map((b) => {
            const prod = productsList && productsList.length > 0
              ? productsList.find((p) => String(p.id) === String(b.productId) || (b.productSku && p.sku === b.productSku))
              : null;
            const qty = Number(b.quantity ?? 0);
            const reserved = Number(b.reservedQuantity ?? 0);
            const avail = Number(b.availableQuantity ?? (qty - reserved));
            const cost = canSeeCost ? Number(b.costPrice ?? prod?.costPrice ?? 0) : null;
            const sell = inventorySellingPrice(b, prod || b, canSeeCost);
            const min = Number(b.minStockLevel ?? prod?.minStockLevel ?? 0);
            return {
              id: b.id || `bal-${b.productId}-${b.warehouseId}`,
              warehouseId: b.warehouseId,
              warehouseName: b.warehouseName || warehousesList.find(w => String(w.id) === String(b.warehouseId))?.name || '—',
              warehouseCode: b.warehouseCode || warehousesList.find(w => String(w.id) === String(b.warehouseId))?.code,
              productId: b.productId || prod?.id,
              sku: b.productSku || prod?.sku || '—',
              productName: b.productName || prod?.name || 'Unknown Product',
              brandName: b.brandName || prod?.brandName || '—',
              categoryName: b.categoryName || prod?.categoryName || '—',
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
        setInventoryBalances(items);
        setViewingStockItem(current => current ? items.find(item => item.id === current.id) || null : null);
      }
    }
  }, [balancesQueryData, currentTab, canSeeCost, productsList, warehousesList]);

  const activeCategories = useMemo(() => (Array.isArray(categoriesList) ? categoriesList : []).filter(c => c && c.isActive !== false), [categoriesList]);
  const activeBrands = useMemo(() => (Array.isArray(brandsList) ? brandsList : []).filter(b => b && b.isActive !== false), [brandsList]);

  // Load warehouses, categories, brands, and inventory balances (products loaded on demand for workspace)
  const loadInventoryBalances = async () => {
    const generation=++inventoryLoadGeneration.current;
    try {
      setInventoryLoading(true);
      invalidateInventoryQueries();
      const [balRes, whRes, catRes, brandRes, prodRes] = await Promise.allSettled([
        inventoryApi.getBalances({ size: 300 }, { force: true, skipCache: true }),
        warehouseApi.getAll({ force: true, skipCache: true }),
        categoryApi.getActive({ force: true, skipCache: true }),
        brandApi.getActive({ force: true, skipCache: true }),
        productApi.getProducts({ size: 300 }, { force: true, skipCache: true }),
      ]);
      if(generation!==inventoryLoadGeneration.current)return;

      const fetchedBalances = balRes.status === 'fulfilled' ? (balRes.value.data?.content || (Array.isArray(balRes.value.data) ? balRes.value.data : balRes.value.data?.data || [])) : [];
      const fetchedWarehouses = whRes.status === 'fulfilled' ? (whRes.value.data?.data || (Array.isArray(whRes.value.data) ? whRes.value.data : [])) : [];
      const fetchedCategories = catRes.status === 'fulfilled' ? (catRes.value.data?.data || (Array.isArray(catRes.value.data) ? catRes.value.data : catRes.value.data?.content || [])) : [];
      const fetchedBrands = brandRes.status === 'fulfilled' ? (brandRes.value.data?.data || (Array.isArray(brandRes.value.data) ? brandRes.value.data : brandRes.value.data?.content || [])) : [];
      const fetchedProducts = prodRes.status === 'fulfilled' ? (prodRes.value.data?.content || (Array.isArray(prodRes.value.data) ? prodRes.value.data : prodRes.value.data?.data || [])) : [];

      if (whRes.status === 'fulfilled') setWarehousesList(fetchedWarehouses);
      if (catRes.status === 'fulfilled') setCategoriesList(fetchedCategories);
      if (brandRes.status === 'fulfilled') setBrandsList(fetchedBrands);
      if (prodRes.status === 'fulfilled' && fetchedProducts.length > 0) setProductsList(fetchedProducts);

      const currentProducts = (prodRes.status === 'fulfilled' && fetchedProducts.length > 0) ? fetchedProducts : productsList;

      let items = [];

      if (fetchedBalances.length > 0) {
        items = fetchedBalances
          .filter((b) => Number(b.quantity ?? 0) > 0)
          .map((b) => {
            const prod = currentProducts && currentProducts.length > 0
              ? currentProducts.find((p) => String(p.id) === String(b.productId) || (b.productSku && p.sku === b.productSku))
              : null;
            const qty = Number(b.quantity ?? 0);
            const reserved = Number(b.reservedQuantity ?? 0);
            const avail = Number(b.availableQuantity ?? (qty - reserved));
            const cost = canSeeCost ? Number(b.costPrice ?? prod?.costPrice ?? 0) : null;
            const sell = inventorySellingPrice(b, prod || b, canSeeCost);
            const min = Number(b.minStockLevel ?? prod?.minStockLevel ?? 0);
            return {
              id: b.id || `bal-${b.productId}-${b.warehouseId}`,
              warehouseId: b.warehouseId,
              warehouseName: b.warehouseName || fetchedWarehouses.find(warehouse=>String(warehouse.id)===String(b.warehouseId))?.name || '—',
              warehouseCode: b.warehouseCode || fetchedWarehouses.find(warehouse=>String(warehouse.id)===String(b.warehouseId))?.code,
              productId: b.productId || prod?.id,
              sku: b.productSku || prod?.sku || '—',
              productName: b.productName || prod?.name || 'Unknown Product',
              brandName: b.brandName || prod?.brandName || '—',
              categoryName: b.categoryName || prod?.categoryName || '—',
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
    if ((currentTab === 'adjustments' || currentTab === 'pos-quotas' || showCreateModal || showQuotaModal) && productsList.length === 0) {
      ensureProductsLoaded();
    }
  }, [currentTab, showCreateModal, showQuotaModal, productsList.length]);

  useEffect(() => {
    loadAdjustments();
  }, []);

  useDataSync((event) => {
    if (event?.detail?.remote) {
      return Promise.allSettled([loadAdjustments(), loadQuotas()]);
    }
    return Promise.allSettled([loadInventoryBalances(), loadAdjustments(), loadQuotas()]);
  }, ['erp:data_changed', 'erp:inventory_updated']);

  // Filtered inventory balances
  const filteredInventory = useMemo(() => {
    return inventoryBalances.filter((item) => {
      if (invBrandFilter !== 'ALL' && item.brandName !== invBrandFilter) {
        return false;
      }
      if (invCategoryFilter !== 'ALL' && item.categoryName !== invCategoryFilter) {
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
  }, [inventoryBalances, invBrandFilter, invCategoryFilter, invStatusFilter, invSearchQuery]);

  const handleClearInvFilters = () => {
    setInvSearchQuery('');
    setInvBrandFilter('ALL');
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
    ensureProductsLoaded();
    const now = new Date();
    const batchNo = `BN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(10 + Math.random() * 90)}`;
    setCreateForm({
      type: '',
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
      if(adjustmentStatusFilter!=='ALL' && adjustmentStatus(rec)!==adjustmentStatusFilter)return false;
      if (filterType !== 'ALL' && rec.type !== filterType) return false;
      if(!matchesDateRange(rec.date,adjustmentFrom,adjustmentTo))return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRecord = (rec.recordNo || '').toLowerCase().includes(q);
        const matchProduct = (rec.productName || '').toLowerCase().includes(q);
        const matchSku = (rec.sku || '').toLowerCase().includes(q);
        const matchBatch = (rec.batch || '').toLowerCase().includes(q);
        const matchWarehouse = (rec.warehouse || '').toLowerCase().includes(q);
        const matchReason = (rec.reason || '').toLowerCase().includes(q);
        const matchItem = (rec.items || []).some(it => 
          (it.productName || '').toLowerCase().includes(q) || (it.productCode || it.productSku || '').toLowerCase().includes(q)
        );
        if (!matchRecord && !matchProduct && !matchSku && !matchBatch && !matchWarehouse && !matchReason && !matchItem) {
          return false;
        }
      }
      return true;
    });
  }, [adjustmentRecords, adjustmentStatusFilter, filterType, adjustmentFrom, adjustmentTo, searchQuery]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setFilterType('ALL');
    setAdjustmentStatusFilter('ALL');
    setAdjustmentFrom('');setAdjustmentTo('');
  };

  const handleOpenCreateRecord = () => {
    ensureProductsLoaded();
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
      items: [],
    });
    setShowCreateModal(true);
  };

  const handleOpenEditRecord = async (rec) => {
    const prods = await ensureProductsLoaded();
    setEditingRecord(rec);
    const prod = (prods || productsList).find((p) => p.name === rec.productName || p.sku === rec.sku);
    const wh = warehousesList.find((w) => w.name === rec.warehouse || String(w.id) === String(rec.warehouseId));
    setCreateForm({
      type: rec.type || 'Addition',
      warehouseId: String(wh?.id || rec.warehouseId || ''),
      productId: String(rec.productId || prod?.id || ''),
      batch: rec.batch || '',
      quantity: String(Math.abs(rec.quantity || 1)),
      costPrice: String(rec.costPrice || prod?.costPrice || '0.00'),
      reason: rec.reason || '',
      remarks: rec.remarks || '',
      items: (rec.items && rec.items.length > 0)
        ? rec.items.map((it) => ({
            productId: String(it.productId),
            productName: it.productName,
            productCode: it.productCode || it.sku,
            warehouseId: String(rec.warehouseId || wh?.id || ''),
            warehouseName: rec.warehouse || wh?.name || '',
            availableStock: it.availableStock != null ? it.availableStock : '',
            quantity: String(Math.abs(it.quantity || 1)),
            reason: it.reason || rec.reason,
            unitCost: it.unitCost,
            after: it.quantity,
          }))
        : [],
    });
    setShowCreateModal(true);
    try {
      const response=await adjustmentApi.searchProducts(rec.sku || '');
      const selected=(response.data?.data || response.data || []).find(p=>String(p.productId)===String(rec.productId || prod?.id) && String(p.warehouseId)===String(rec.warehouseId));
      if(selected)setCreateForm(previous=>({...previous,selectedProduct:selected}));
    }catch(error){addToast('Search the product again to check available stock.','error');}
  };

  const handleSaveRecord = async (e, saveDraft=false) => {
    e.preventDefault();
    if(submittingRecord)return;
    if (!createForm.type) {
      addToast('Please choose whether to Add stock or Reduce stock', 'error');
      return;
    }

    const currentItems = Array.isArray(createForm.items) ? [...createForm.items] : [];
    const stagedProduct = createForm.selectedProduct;
    const stagedQuantity = Number(createForm.quantity || 0);

    if (stagedProduct && stagedQuantity > 0) {
      const existingIdx = currentItems.findIndex(
        (it) => String(it.productId) === String(stagedProduct.productId)
      );
      const stagedItem = {
        productId: String(stagedProduct.productId),
        productName: stagedProduct.productName,
        productCode: stagedProduct.productCode,
        warehouseId: String(stagedProduct.warehouseId),
        warehouseName: stagedProduct.warehouseName,
        quantity: stagedQuantity,
        reason: createForm.reason || 'Manual adjustment',
      };
      if (existingIdx >= 0) {
        currentItems[existingIdx] = stagedItem;
      } else {
        currentItems.push(stagedItem);
      }
    }

    if (currentItems.length === 0) {
      addToast('Please choose a product and enter the adjustment quantity', 'error');
      return;
    }

    const whId = Number(
      (currentItems[0] && currentItems[0].warehouseId) ||
      createForm.warehouseId ||
      (stagedProduct && stagedProduct.warehouseId) ||
      (warehousesList[0] && warehousesList[0].id)
    );

    if (!whId) {
      addToast('Please select a valid warehouse', 'error');
      return;
    }

    const itemsPayload = currentItems.map((it) => ({
      productId: Number(it.productId),
      quantity: Number(it.quantity),
      reason: it.reason || createForm.reason || 'Manual adjustment',
    }));

    if ((createForm.remarks || '').length > 5000) { addToast('Remarks must be 5000 characters or fewer.', 'error'); return; }

    try {
      setSubmittingRecord(true);
      const payload = {
        warehouseId: whId,
        adjustmentType: createForm.type === 'Reduction' ? 'REDUCTION' : 'ADDITION',
        adjustmentDate: editingRecord?.status === 'DRAFT' ? editingRecord.date : formatBusinessDate(),
        reason: (createForm.reason || itemsPayload[0]?.reason || '') + (createForm.remarks ? `: ${createForm.remarks}` : ''),
        items: itemsPayload,
      };

      if (editingRecord && adjustmentStatus(editingRecord) === 'DRAFT') await adjustmentApi.update(editingRecord.adjustmentId, payload, !saveDraft);
      else await adjustmentApi.create(payload, !saveDraft);
      invalidateInventoryQueries();
      addToast(saveDraft ? 'Adjustment saved as draft.' : 'Stock adjustment applied.', 'success');
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

  const confirmAdjustmentTransition=async()=>{
    if(adjustmentTransitionBusy)return;
    setAdjustmentTransitionBusy(true);
    try{
      const record=adjustmentTransition.record;
      if(adjustmentTransition.target==='CANCELLED')await adjustmentApi.cancel(record.adjustmentId,adjustmentTransitionReason.trim());
      else await adjustmentApi.process(record.adjustmentId,adjustmentTransitionReason.trim());
      invalidateInventoryQueries();
      setAdjustmentTransition(null);setViewingRecord(null);
      await Promise.all([loadAdjustments(),loadInventoryBalances()]);
      addToast('Adjustment status updated.','success');
    }catch(error){addToast(error.response?.data?.message || error.message || 'Unable to update adjustment.','error');}
    finally{setAdjustmentTransitionBusy(false);}
  };
  const requestAdjustmentTransition=(record,target)=>{setAdjustmentTransition({record,target});setAdjustmentTransitionReason('');};

  return (
    <div ref={directoryRef} className={(`inventory-theme purchasing-no-shadows${showQuotaModal || showCreateModal || masterFormOpen ? ' inventory-allocation-focus' : ''}`) + ' erp-page'}
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
        {activeTab === 'pos-quotas' ? (
          <button disabled={!canWriteTab(user,'inventory',activeTab)} className="erp-button erp-button-primary"
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
        ) : activeTab === 'adjustments' ? (
          <button disabled={!canWriteTab(user,'inventory',activeTab)} className="erp-button erp-button-primary"
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
        ) : activeTab === 'inventory-list' ? (
          <button disabled={!canWriteTab(user,'inventory',activeTab)} className="erp-button erp-button-primary"
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
          <button disabled={!canWriteTab(user,'inventory',activeTab)} className="erp-button erp-button-primary"
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
            <Plus size={17} /> New {activeTab === 'products' ? 'Product' : activeTab === 'brands' ? 'Brand' : activeTab === 'warehouses' ? 'Warehouse' : 'Category'}
          </button>
        )}
      </div>

      {/* Subtabs Bar (Underline Style matching EmployeesHub - Fixed / Sticky) */}
      <ErpTabs module="inventory" className="inventory-tabs"
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
        }}
      >
        {allowedTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <ErpTab tabId={tab.id} data-active={isActive} aria-pressed={isActive}
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}

            >
              <Icon size={16} />
              {tab.label}
            </ErpTab>
          );
        })}
      </ErpTabs>

      {/* ------------------------------------------------------------- */}
      {/* 1. INVENTORY LIST TAB (Live Stock Balances with Qty, Cost, Selling, Valuation) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'inventory-list' && !showQuotaModal && !showCreateModal && (
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
            <SearchBar
              value={invSearchQuery}
              onChange={(e) => setInvSearchQuery(e.target.value)}
              onClear={() => setInvSearchQuery('')}
              placeholder="Search inventory by SKU, product name, brand, warehouse..."
            />

            {/* Right Controls: Filters, Reset Filters, Print, & Refresh */}
            <div className="inventory-list-filter-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
              {/* Brand Filter */}
              <FilterSelect
                value={invBrandFilter}
                onChange={(e) => setInvBrandFilter(e.target.value)}
                className="inventory-full-label-filter"
                title="Filter by brand"
                searchable={false}
              >
                <option value="ALL">All Brands</option>
                {activeBrands.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </FilterSelect>

              {/* Category Filter */}
              <FilterSelect
                value={invCategoryFilter}
                onChange={(e) => setInvCategoryFilter(e.target.value)}
                className="inventory-full-label-filter"
                title="Filter by category"
              >
                <option value="ALL">All Categories</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
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
              {(invSearchQuery || invStatusFilter !== 'ALL' || invBrandFilter !== 'ALL' || invCategoryFilter !== 'ALL') && (
                <button className="erp-button"
                  type="button"
                  onClick={handleClearInvFilters}
                  style={{
                    height: '38px',
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
                  height: '38px',
                  width: '38px',
                  minWidth: '38px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
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
                  height: '38px',
                  width: '38px',
                  minWidth: '38px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
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
                title="Refresh records"
                aria-label="Refresh records"
                disabled={inventoryLoading}
              >
                <RefreshCw size={15} className={inventoryLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Table Container (Fixed / Sticky Frame - Matching Customer/Employee Look) */}
          <div className="erp-table-frame"
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
            <div className="erp-table-scroll" style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <InventoryBalanceTable rows={filteredInventory} loading={inventoryLoading} canSeeCost={canSeeCost} onView={setViewingStockItem}/>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. PRODUCTS TAB (Master Product Directory) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'products' && !showQuotaModal && !showCreateModal && (
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
      {activeTab === 'brands' && !showQuotaModal && !showCreateModal && (
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
      {activeTab === 'warehouses' && !showQuotaModal && !showCreateModal && (
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
      {activeTab === 'categories' && !showQuotaModal && !showCreateModal && (
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
      {activeTab === 'adjustments' && !showQuotaModal && !showCreateModal && (
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
            <SearchBar
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              placeholder="Search adjustment code, product code or name, warehouse, reason..."
            />

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

              <FilterSelect value={adjustmentStatusFilter} onChange={event=>setAdjustmentStatusFilter(event.target.value)} title="Filter stock adjustments by status" style={{width:140}}>
                <option value="ALL">All Statuses</option><option value="DRAFT">Draft</option><option value="CANCELLED">Cancelled</option><option value="ADJUSTED">Adjusted</option>
              </FilterSelect>
              {/* Reset Filters button */}
              {(adjustmentStatusFilter !== 'ALL' || filterType !== 'ALL' || adjustmentFrom || adjustmentTo || searchQuery) && (
                <button className="erp-button"
                  type="button"
                  onClick={handleClearFilters}
                  style={{
                    height: '38px',
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
                  height: '38px',
                  width: '38px',
                  minWidth: '38px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
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
                title="Print Stock Adjustments (A4)" aria-label="Print Stock Adjustments (A4)"
              >
                <Printer size={15} />
              </button>

              {/* Refresh Records - Icon only */}
              <button
                type="button"
                onClick={async () => {
                  await loadAdjustments(true);
                  addToast('Stock adjustments refreshed', 'info');
                }}
                disabled={adjustmentsLoading}
                style={{
                  height: '38px',
                  width: '38px',
                  minWidth: '38px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
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
                title="Refresh records"
                aria-label="Refresh records"
              >
                <RefreshCw size={15} className={adjustmentsLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <AdjustmentTable rows={filteredAdjustments} loading={adjustmentsLoading} canEdit={canEditInventory} onView={setViewingRecord} onEdit={handleOpenEditRecord} onCancel={(rec) => requestAdjustmentTransition(rec, 'CANCELLED')}/>
        </div>
      )}
      {/* ------------------------------------------------------------- */}
      {/* 6. INVENTORY ALLOCATION TAB (Product Quantity Allocated per Staff Member) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'pos-quotas' && !showQuotaModal && !showCreateModal && (
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
            <SearchBar
              value={quotaSearch}
              onChange={(e) => setQuotaSearch(e.target.value)}
              onClear={() => setQuotaSearch('')}
              placeholder="Search allocation by product SKU, name, or staff member..."
            />

            {/* Right Controls: Status Filter, Reset, Print (Icon only), Refresh (Icon only) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
              <DateRangePicker documentType="Inventory allocation" from={quotaFrom} to={quotaTo} onChange={(from,to)=>{setQuotaFrom(from);setQuotaTo(to);}}/>
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
              {(quotaSearch || quotaStatusFilter !== 'ALL' || quotaFrom || quotaTo) && (
                <button className="erp-button"
                  type="button"
                  onClick={() => {
                    setQuotaSearch('');
                    setQuotaStatusFilter('ALL');
                    setQuotaFrom('');setQuotaTo('');
                  }}
                  style={{
                    height: '38px',
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
                  e.currentTarget.style.color = '#64748b';
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
                  e.currentTarget.style.color = '#64748b';
                }}
                title="Refresh inventory allocations"
              >
                <RefreshCw size={15} className={loadingQuotas ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <AllocationTable rows={filteredQuotas} loading={loadingQuotas} canEdit={canEditInventory} statusOf={quotaStatus} onView={handleViewQuota} onEdit={q=>handleOpenQuotaModal(null,q)} onCreate={()=>handleOpenQuotaModal()} onDelete={allocationDeletion.requestDeletion}/>

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
      {showViewQuotaModal && viewingQuota && <AllocationDetailsModal allocation={viewingQuota} status={quotaStatus(viewingQuota)} canManage={canEditInventory} busy={savingQuota}
        onClose={()=>setShowViewQuotaModal(false)} onEdit={()=>{setShowViewQuotaModal(false);handleOpenQuotaModal(null,viewingQuota);}}
        onStatusChange={target=>openQuotaStatus(viewingQuota,target)} onDelete={()=>allocationDeletion.requestDeletion(viewingQuota)}/>}


      {/* ------------------------------------------------------------- */}
      {/* MODAL: New Stock Adjustment Record (Exact Matching User Screenshots) */}
      {/* ------------------------------------------------------------- */}
      {showCreateModal && <AdjustmentWorkspace form={createForm} onChange={setCreateForm} warehouses={warehousesList} products={productsList} balances={inventoryBalances} canSeeCost={canSeeCost} editing={editingRecord} busy={submittingRecord} onSave={handleSaveRecord} onSaveDraft={event=>handleSaveRecord(event,true)} onClose={()=>setShowCreateModal(false)}/>}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: View Adjustment Record Details */}
      {/* ------------------------------------------------------------- */}
      {adjustmentTransition && <PurchasingStatusDialog title={adjustmentTransition.target==='CANCELLED'?'Cancel adjustment':'Apply adjustment'} confirmLabel={adjustmentTransition.target==='CANCELLED'?'Cancel adjustment':'Adjust stock'} pending={{type:'Adjustment',number:adjustmentTransition.record.recordNo,current:adjustmentStatus(adjustmentTransition.record),target:adjustmentTransition.target,description:adjustmentTransition.target==='CANCELLED'?'Cancelling an adjusted record reverses its stock movement. Reserved stock is protected.':'Apply this draft adjustment to current warehouse stock.'}} reason={adjustmentTransitionReason} onReasonChange={setAdjustmentTransitionReason} busy={adjustmentTransitionBusy} onClose={()=>!adjustmentTransitionBusy && setAdjustmentTransition(null)} onConfirm={confirmAdjustmentTransition}/>}
      {viewingRecord && <AdjustmentDetailsModal record={viewingRecord} canManage={canEditInventory} busy={adjustmentTransitionBusy} onCancel={()=>requestAdjustmentTransition(viewingRecord,'CANCELLED')} onAdjust={()=>requestAdjustmentTransition(viewingRecord,'ADJUSTED')} onClose={()=>setViewingRecord(null)} onEdit={()=>{const record=viewingRecord;setViewingRecord(null);handleOpenEditRecord(record);}}/>}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: View Stock Item Details (Wide, Scroll-Free Executive View) */}
      {/* ------------------------------------------------------------- */}
      {quotaStatusChange && <PurchasingStatusDialog title={quotaStatusChange.target==='INACTIVE'?'Deactivate allocation':quotaStatusChange.target==='DRAFT'?'Return allocation to draft':'Activate allocation'} confirmLabel={quotaStatusChange.target==='INACTIVE'?'Make inactive':quotaStatusChange.target==='DRAFT'?'Save as draft':'Allocate'}
        pending={{type:'Allocation',number:quotaStatusChange.quota.productSku || `Allocation #${quotaStatusChange.quota.id}`,current:quotaStatus(quotaStatusChange.quota),target:quotaStatusChange.target,description:quotaStatusChange.target==='INACTIVE'?'Deactivating disables this selling limit and preserves its history. Warehouse stock will not change.':quotaStatusChange.target==='DRAFT'?'The allocation will remain saved as a draft until it is completed and activated.':'Complete product, staff and quantity first. Available stock will be checked before activation.'}}
        reason={quotaStatusReason} onReasonChange={setQuotaStatusReason} busy={savingQuota} onClose={()=>setQuotaStatusChange(null)} onConfirm={confirmQuotaStatus}/>}
      {viewingStockItem && <StockDetailsModal item={viewingStockItem} canSeeCost={canSeeCost} onClose={()=>setViewingStockItem(null)}/>}

      {allocationDeletion.deletionDialog}
    </div>
  );
}
