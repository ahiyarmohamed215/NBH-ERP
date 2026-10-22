import {useDataSync} from '../hooks/useDataSync';
import { useWorkspaceActive } from '../components/RetainedWorkspaces';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  productApi,
  warehouseApi,
  customerApi,
  salesApi,
  inventoryApi,
  categoryApi,
  brandApi,
  customerTargetApi,
  customerMonthlyRangeApi,
  printPdfDocument,
} from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import './PosView.css';
import PosRangeProgress, {posMoney} from '../components/PosRangeProgress';
import {warehouseSellableStock,totalSellableStock,allocationBudget} from '../utils/posStockLimits';
import PosRangePreview from '../components/PosRangePreview';
import SearchBar from '../components/SearchBar';
import FilterSelect from '../components/FilterSelect';
import StatusBadge from '../components/StatusBadge';
import PosHeldBills from '../components/PosHeldBills';
import PosPerformanceDialog from '../components/PosPerformanceDialog';
import PosLineEditor from '../components/PosLineEditor';
import HeldBillPrintDialog from '../components/HeldBillPrintDialog';
import PosBillRemarksDialog from '../components/PosBillRemarksDialog';
import PosCartItemDetails from '../components/PosCartItemDetails';
import {usePurchaseItemRemoval,RemovalDialog} from '../hooks/usePurchaseItemRemoval';
import PosCustomerOutstandingModal from '../components/PosCustomerOutstandingModal';
import CustomerRangeBadge from '../components/CustomerRangeBadge';
import {numberError} from '../utils/purchasingValidation';
import {previewPosProgress} from '../utils/posProgressPreview';
import {customerCreditBlock} from '../utils/customerCredit';
import {
  Search,
  Plus,
  Minus,
  PauseCircle,
  PlayCircle,
  CheckCircle,
  Printer,
  CreditCard,
  Banknote,
  Clock,
  User,
  Phone,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  X,
  Building2,
  Package,
  Percent,
  Layers,
  AlertCircle,
  Check,
  FileText,
  ChevronDown,
  RefreshCw,
  UserCheck,
  ShoppingCart,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  LogOut,
  Trophy,
  Award,
  Flame,
  Users,
  BarChart2,
  Eye,
  Target,
  Sparkles,
  Zap,
  Filter,
  Trash2,
  Receipt,
  RotateCcw,
  Edit2,
} from 'lucide-react';

export default function PosView({ onExitPos }) {
  const workspaceActive = useWorkspaceActive();
  const { addToast } = useToast();
  const { user } = useAuth();
  const isSupervisor = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_ADMIN') || user?.permissions?.includes('SALES_VIEW_ALL');

  const draftKey=`nbh_pos_working_bill_${user?.username || 'cashier'}`;
  const [activeBillId,setActiveBillId]=useState(null);
  const activeBillRef=useRef(null),savingBillRef=useRef(false),reservedLinesRef=useRef([]);
  const [savingBill,setSavingBill]=useState(false);
  const [checkingBill,setCheckingBill]=useState(true);
  const [billCheckFailed,setBillCheckFailed]=useState(false);
  const billVersionRef=useRef(null);
  const preparePosRef=useRef(null);
  const [customerRanges,setCustomerRanges]=useState({});
  const refreshSequence=useRef(0);
  // Master Data
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [stockBalances, setStockBalances] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Operation States
  const [isHoldingCart, setIsHoldingCart] = useState(false);
  const holdingCartRef=useRef(false);
  const [savedBillToPrint,setSavedBillToPrint]=useState(null);
  const [showBillRemarks,setShowBillRemarks]=useState(false);

  // Staff Motivation / KPI Data
  const [cashierStats, setCashierStats] = useState([]);
  const [activeCircleModal, setActiveCircleModal] = useState(null); // 'my' | 'max' | 'all'
  const [selectedStaffForBills, setSelectedStaffForBills] = useState(null);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState(null);

  // Top Bar: Customer Selection & Details
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [stockLimits,setStockLimits]=useState([]),[loadingStockLimits,setLoadingStockLimits]=useState(true),[stockLimitError,setStockLimitError]=useState('');
  const stockLimitsSequence=useRef(0);
  const refreshStockLimits=async()=>{
    const sequence=++stockLimitsSequence.current;
    try{const response=await salesApi.getPosStockLimits({excludeId:activeBillRef.current || undefined});if(sequence!==stockLimitsSequence.current)return;const data=response.data?.data || response.data;setStockLimits(Array.isArray(data)?data:[]);setStockLimitError('');}
    catch{if(sequence===stockLimitsSequence.current)setStockLimitError('Unable to check your stock allocation. Refresh stock to try again.');}
    finally{if(sequence===stockLimitsSequence.current)setLoadingStockLimits(false);}
  };

  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showCustomerDetailsDrop, setShowCustomerDetailsDrop] = useState(false);
  const [showOutstandingModal, setShowOutstandingModal] = useState(false);
  const [customerHighlightedIndex, setCustomerHighlightedIndex] = useState(0);
  const customerSearchInputRef = useRef(null);

  // Left Column: Catalog Filters, Search & Keyboard Navigation
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('');
  const [inStockOnlyFilter, setInStockOnlyFilter] = useState(false);
  const [productHighlightedIndex, setProductHighlightedIndex] = useState(0);
  const catalogSearchInputRef = useRef(null);
  const catalogListRef = useRef(null);

  // Right Column: Staging Quick-Input Workstation & Input Refs
  const [stagedItem, setStagedItem] = useState(null);
  const qtyInputRef = useRef(null);
  const discPercentInputRef = useRef(null);
  const discAmountInputRef = useRef(null);

  // Right Column: Cart Table & Totals
  const [cart, setCart] = useState([]);
  const [editingCartItem, setEditingCartItem] = useState(null);
  const [viewingCartItemId,setViewingCartItemId]=useState(null);
  const [showClearConfirmation,setShowClearConfirmation]=useState(false);
  const [showExitConfirmation,setShowExitConfirmation]=useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Gross Subtotal (Sum of Unit Price * Quantity before discount)
  const grossSubtotal = cart.reduce((sum, item) => sum + (Number(item.unitPrice || 0) * Number(item.quantity || 0)), 0);

  // Total discount given for all products in the cart table
  const totalTableDiscount = cart.reduce((sum, item) => sum + Number(item.discountAmount || 0), 0);

  // Net Total = Gross Subtotal - Total Discount
  const netTotal = Math.max(0, grossSubtotal - totalTableDiscount);
  const subtotal = grossSubtotal;

  // Held Bills
  const [heldInvoices, setHeldInvoices] = useState([]);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [showPerformance,setShowPerformance]=useState(false);
  const [heldTab, setHeldTab] = useState('mine');

  // Customer Monthly Range & Targets State (Real-time live milestone projection)
  const [serverRangeProgress, setMonthlyRangeProgress] = useState(null);
  const monthlyRangeProgress=useMemo(()=>selectedCustomerId && serverRangeProgress?.customerId===selectedCustomerId?previewPosProgress(serverRangeProgress,0):null,[serverRangeProgress,selectedCustomerId]);
  const [loadingMonthlyRange, setLoadingMonthlyRange] = useState(false);
  const [showMonthlyRangesModal, setShowMonthlyRangesModal] = useState(false);

  // Promotional Campaign Targets (V5)
  const [showTargetRangesModal, setShowTargetRangesModal] = useState(false);
  const [activeTargetForModal, setActiveTargetForModal] = useState(null);

  // Net calculations
  const discountVal = totalTableDiscount;

  // Initial Load
  useEffect(() => {
    loadInitialData();
    loadHeldInvoices();
    loadStaffPerformance();
  }, []);

  // Auto-focus on initial mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedCustomerId) {
        catalogSearchInputRef.current?.focus();
      } else {
        customerSearchInputRef.current?.focus();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, []);



  // The backend supplies totals and thresholds; the current unsaved bill is previewed locally.
  const [progressVersion,setProgressVersion]=useState(0);
  useEffect(()=>{
    if(!selectedCustomerId){setMonthlyRangeProgress(null);setLoadingMonthlyRange(false);return;}
    let alive=true;
    const load=async()=>{
      setLoadingMonthlyRange(true);
      try{
        const response=await salesApi.getPosProgress({customerId:selectedCustomerId});
        const data=response.data?.data || response.data;
        if(alive){setMonthlyRangeProgress(data?{...data,customerId:selectedCustomerId}:null);if(data)setCustomerRanges(previous=>({...previous,[selectedCustomerId]:data}));}
      }catch{if(alive)setMonthlyRangeProgress(null);}
      finally{if(alive)setLoadingMonthlyRange(false);}
    };
    const timer=setTimeout(load,150);
    return()=>{alive=false;clearTimeout(timer);};
  },[selectedCustomerId,activeBillId,progressVersion]);

  useEffect(()=>{setLoadingStockLimits(true);refreshStockLimits();const timer=setInterval(refreshStockLimits,30000);return()=>{clearInterval(timer);stockLimitsSequence.current++;};},[activeBillId]);

  const loadInitialData = async () => {
    setLoadingData(true);
    try {
      const [whRes, custRes, balancesRes, catRes, brandRes, prodRes] = await Promise.all([
        warehouseApi.getActive().catch(() => ({ data: [] })),
        customerApi.getActive().catch(() => ({ data: [] })),
        inventoryApi.getBalances({ size: 1000 }).catch(() => ({ data: [] })),
        categoryApi.getActive().catch(() => ({ data: [] })),
        brandApi.getActive().catch(() => ({ data: [] })),
        productApi.searchActive('').catch(() => ({ data: [] })),
      ]);

      const whList = whRes.data || [];
      setWarehouses(whList);

      const custList = custRes.data || [];
      setCustomers(custList);

      const balancesList = balancesRes.data?.content || balancesRes.data || [];
      setStockBalances(balancesList);

      const catList = catRes.data?.data || catRes.data || [];
      setCategories(Array.isArray(catList) ? catList : []);

      const brandList = brandRes.data?.data || brandRes.data || [];
      setBrands(Array.isArray(brandList) ? brandList : []);

      const prodList = prodRes.data?.data || prodRes.data || [];
      setAllProducts(Array.isArray(prodList) ? prodList : []);
    } catch (err) {
      addToast('Error loading master data: ' + err.message, 'error');
    } finally {
      setLoadingData(false);
    }
  };

  const loadHeldInvoices = async () => {
    try {
      const res = await salesApi.getHeldOriginals({scope:'mine'});
      const data=res.data?.data || res.data;
      const apiHeld = Array.isArray(data)?data:data?.bills || [];
      setHeldInvoices(apiHeld.filter(invoice=>String(invoice.id)!==String(activeBillRef.current)));
    } catch (e) {
      console.error('Failed to load held bills:', e);
    }
  };

  const loadStaffPerformance = async () => {
    try {
      const summaryRes=await salesApi.getCashierSalesSummary();
      const cList=summaryRes.data || [];
      setCashierStats(cList);
    } catch (err) {
      console.error('Failed to load cashier performance data', err);
    }
  };

  const refreshStock=async()=>{
    const sequence=++refreshSequence.current;
    const response=await inventoryApi.getBalances({size:1000},{skipCache:true});
    if(sequence===refreshSequence.current)setStockBalances(response.data?.content || response.data || []);
    await refreshStockLimits();
  };
  useDataSync(() => Promise.allSettled([refreshStock(),loadHeldInvoices(),loadStaffPerformance()]),
    ['erp:inventory_updated','erp:sales_updated'], [], ['inventory','sales','grn','gtn','prn']);
  useDataSync(() => loadInitialData(), ['erp:customers_updated'], [], ['customers','inventory']);
  useDataSync(() => refreshCustomerCredit(), ['erp:payments_updated','erp:sales_updated'], [], ['payments','sales']);
  useDataSync(() => setProgressVersion(value=>value+1), ['erp:targets_updated','erp:sales_updated'], [], ['targets','sales','customers']);
  // POS has no recoverable drafts: clear only this staff member's old,
  // unpublished bills through the service so their reservations are released.
  useEffect(()=>{
    let alive=true;
    const prepare=async()=>{
      localStorage.removeItem(draftKey);
      try {
        const response=await salesApi.getHeld();const data=response.data?.data || response.data;
        const previous=Array.isArray(data)?data:data?.content || [];
        for(const bill of previous.filter(bill=>bill.status==='HELD' && bill.createdBy===user?.username))
          await salesApi.cancelHeld(bill.id,{expectedVersion:bill.recordVersion,reason:'Unsubmitted POS bill discarded; draft recovery discontinued.'});
        await refreshStock();
      }catch(error){throw error;}
    };
    preparePosRef.current ??= prepare();
    preparePosRef.current.then(()=>{if(alive)setCheckingBill(false);}).catch(error=>{if(alive){setBillCheckFailed(true);setCheckingBill(false);addToast(error.response?.data?.message || 'Unable to prepare a fresh POS bill. Reload to try again.','error');}});
    return()=>{alive=false;};
  },[]);
  const billPayload=(lines,hold=true)=>({warehouseId:lines[0]?.warehouseId,customerId:selectedCustomerId,hold,reserveStock:true,expectedVersion:billVersionRef.current,taxRate:0,
    discountAmount:Math.min(lines.reduce((sum,line)=>sum+Number(line.total),0),Math.max(0,Number(discountAmount)||0)),
    // POS already calculates the monetary discount. Sending a rounded display rate
    // would make the server recalculate and change an explicitly entered amount.
    items:lines.map(line=>({productId:line.productId,warehouseId:line.warehouseId,quantity:Number(line.quantity),unitPrice:Number(line.unitPrice),discountRate:0,discountAmount:Number(Number(line.discountAmount || 0).toFixed(2))}))});
  // Product additions and edits stay in memory until Save Onhold Bill.
  const commitCart=async lines=>{
    if(savingBillRef.current || checkingBill || billCheckFailed)return false;
    if(lines.length){
      setCart(lines);return true;
    }
    savingBillRef.current=true;setSavingBill(true);
    try {
      if(activeBillRef.current)await salesApi.cancelHeld(activeBillRef.current,{expectedVersion:billVersionRef.current,reason:'Unfinished POS bill discarded.'});
      activeBillRef.current=null;reservedLinesRef.current=[];billVersionRef.current=null;
      setActiveBillId(null);setCart([]);setDiscountAmount(0);await refreshStock();return true;
    }catch(error){addToast(error.response?.data?.message || error.message || 'Unable to clear the bill. Try again.','error');return false;}
    finally{savingBillRef.current=false;setSavingBill(false);}
  };
  const resetWorkingBill=()=>{activeBillRef.current=null;reservedLinesRef.current=[];billVersionRef.current=null;setActiveBillId(null);setCart([]);setDiscountAmount(0);setStagedItem(null);localStorage.removeItem(draftKey);};

  const getProductBrandName = (prod) => {
    if (!prod) return '';
    if (prod.brandName) return prod.brandName;
    if (prod.brand?.name) return prod.brand.name;
    if (prod.brandId) {
      const found = brands.find((b) => String(b.id) === String(prod.brandId));
      if (found) return found.name;
    }
    return '';
  };

  const getProductCategoryName = (prod) => {
    if (!prod) return '';
    if (prod.categoryName) return prod.categoryName;
    if (prod.category?.name) return prod.category.name;
    if (prod.categoryId) {
      const found = categories.find((c) => String(c.id) === String(prod.categoryId));
      if (found) return found.name;
    }
    return '';
  };

  // Helper to find stock for a product in a given warehouse
  const getPhysicalStockInWarehouse = (productId, warehouseId) => {
    const record = stockBalances.find(
      (b) => String(b.productId ?? b.product?.id) === String(productId) &&
             String(b.warehouseId ?? b.warehouse?.id) === String(warehouseId)
    );
    const reserved=reservedLinesRef.current.filter(line=>String(line.productId)===String(productId) && String(line.warehouseId)===String(warehouseId)).reduce((total,line)=>total+Number(line.quantity),0);
    const inBill=cart.filter(line=>String(line.productId)===String(productId) && String(line.warehouseId)===String(warehouseId)).reduce((total,line)=>total+Number(line.quantity),0);
    return Math.max(0,(record ? Number(record.availableQuantity ?? record.quantity ?? 0) : 0)+reserved-inBill);
  };

  const getProductStockInWarehouse=(productId,warehouseId)=>loadingStockLimits || stockLimitError?0:warehouseSellableStock(productId,warehouseId,getPhysicalStockInWarehouse(productId,warehouseId),stockLimits,cart);

  useEffect(()=>{
    setStagedItem(previous=>{
      if(!previous)return previous;
      const available=getProductStockInWarehouse(previous.product.id,previous.warehouseId);
      return available===previous.realQuantity?previous:{...previous,realQuantity:available};
    });
    setEditingCartItem(previous=>{
      if(!previous)return previous;
      const own=cart.find(line=>line.id===previous.id);
      const available=getProductStockInWarehouse(previous.productId,previous.warehouseId)+Number(own?.quantity || 0);
      return available===previous.availableQty?previous:{...previous,availableQty:available};
    });
  },[stockBalances,stockLimits,loadingStockLimits,stockLimitError]);

  // Helper for total product stock across all warehouses
  const getProductTotalStock = (productId) => {
    return loadingStockLimits || stockLimitError?0:totalSellableStock(productId,warehouses.map(wh=>({warehouseId:wh.id,quantity:getPhysicalStockInWarehouse(productId,wh.id)})),stockLimits,cart);
  };

  // Selected Customer & Filtered Search
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;
  const filteredCustomers = customerSearchQuery
    ? customers.filter(
        (c) =>
          c.name?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
          c.address?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
          c.phone?.includes(customerSearchQuery)
      )
    : customers.slice(0, 15);

  useEffect(()=>{
    if(!showCustomerSearch)return;let alive=true;
    const timer=setTimeout(()=>{Promise.all(filteredCustomers.slice(0,15).filter(customer=>!customerRanges[customer.id]).map(async customer=>{
      try{const response=await customerMonthlyRangeApi.getCustomerProgress(customer.id);const data=response.data?.data || response.data;if(alive && data)setCustomerRanges(previous=>({...previous,[customer.id]:data}));}catch{}
    }));},250);
    return()=>{alive=false;clearTimeout(timer);};
  },[showCustomerSearch,customerSearchQuery,customers]);
  // Customer Financial Metrics
  const custOutstanding = Number(selectedCustomer?.currentBalance || 0);
  const custCreditLimit = Number(selectedCustomer?.creditLimit || 0);
  const creditBlock = customerCreditBlock(selectedCustomer, netTotal);
  const refreshCustomerCredit = async () => {
    try {const response=await customerApi.getActive({skipCache:true});const list=response.data?.data || response.data; if(Array.isArray(list))setCustomers(list);}
    catch {addToast('Could not refresh customer balances. Please try again.','error');}
  };
  const custAvailableCredit = Math.max(0, custCreditLimit - custOutstanding);
  const custCreditUsagePct =
    custCreditLimit > 0 ? Math.min(100, Math.round((custOutstanding / custCreditLimit) * 100)) : 0;

  // Motivation & Cashier Calculations
  const currentUsername = user?.username || 'admin';
  const myStat = cashierStats.find((c) => c.username === currentUsername) || null;

  const myBillsCount = myStat
    ? Number(myStat.heldInvoicesCount || 0)
    : 0;
  const myTotalAmount = myStat
    ? Number(myStat.totalHeldAmount || 0)
    : 0;
  const myAvgBill = Number(myStat?.averageHeldAmount || 0);

  // Left Column: Filtered Products Catalog
  const filteredProducts = useMemo(() => {
    return allProducts.filter((product) => {
      // 1. Search Query (SKU, Name, Barcode)
      if (catalogSearch.trim()) {
        const q = catalogSearch.toLowerCase().trim();
        const matchesName = product.name?.toLowerCase().includes(q);
        const matchesSku = product.sku?.toLowerCase().includes(q);
        const matchesBarcode = product.barcode?.toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesBarcode) return false;
      }

      // 2. Category Filter
      if (selectedCategoryFilter) {
        if (String(product.categoryId) !== String(selectedCategoryFilter)) return false;
      }

      // 3. Brand Filter
      if (selectedBrandFilter) {
        if (String(product.brandId) !== String(selectedBrandFilter)) return false;
      }

      // 4. In-Stock Filter
      if (inStockOnlyFilter) {
        const totalStock = getProductTotalStock(product.id);
        if (totalStock <= 0) return false;
      }

      return true;
    });
  }, [allProducts, catalogSearch, selectedCategoryFilter, selectedBrandFilter, inStockOnlyFilter, stockBalances, warehouses, stockLimits, loadingStockLimits, stockLimitError, cart]);

  // Reset highlight index when products change
  useEffect(() => {
    setProductHighlightedIndex(0);
  }, [catalogSearch, selectedCategoryFilter, selectedBrandFilter]);

  // Reset customer highlight index when query changes
  useEffect(() => {
    setCustomerHighlightedIndex(0);
  }, [customerSearchQuery]);

  // Customer Search Keyboard Navigation
  const handleCustomerSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!showCustomerSearch) setShowCustomerSearch(true);
      setCustomerHighlightedIndex((prev) => Math.min(filteredCustomers.length - 1, prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCustomerHighlightedIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const custToSelect = filteredCustomers[customerHighlightedIndex] || filteredCustomers[0];
      if (custToSelect) {
        setSelectedCustomerId(custToSelect.id);
        setShowCustomerSearch(false);
        setCustomerSearchQuery('');

        // Auto jump focus to Product Search input
        setTimeout(() => {
          catalogSearchInputRef.current?.focus();
          catalogSearchInputRef.current?.select();
        }, 50);
      }
    } else if (e.key === 'Escape') {
      setShowCustomerSearch(false);
    }
  };

  // Product Search Keyboard Navigation
  const handleCatalogSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setProductHighlightedIndex((prev) => {
        const nextIdx = Math.min(filteredProducts.length - 1, prev + 1);
        const itemEl = catalogListRef.current?.children[nextIdx];
        itemEl?.scrollIntoView({ block: 'nearest' });
        return nextIdx;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setProductHighlightedIndex((prev) => {
        const nextIdx = Math.max(0, prev - 1);
        const itemEl = catalogListRef.current?.children[nextIdx];
        itemEl?.scrollIntoView({ block: 'nearest' });
        return nextIdx;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const prodToSelect = filteredProducts[productHighlightedIndex] || filteredProducts[0];
      if (prodToSelect) {
        const totalStock = getProductTotalStock(prodToSelect.id);
        if (totalStock <= 0) {
          addToast(`Cannot select ${prodToSelect.name}: Out of Stock`, 'warning');
          return;
        }
        handleSelectProductForStaging(prodToSelect);
      }
    }
  };

  // Handle Product Selection for Staging Workstation (Auto-defaults warehouse and auto-focuses Qty)
  const handleSelectProductForStaging = async (product) => {
    const whsWithStock = warehouses.filter((wh) => getProductStockInWarehouse(product.id, wh.id) > 0);

    const availableWhs = whsWithStock.length > 0
      ? whsWithStock
      : (product.warehouseId
          ? warehouses.filter((w) => w.id === product.warehouseId)
          : (warehouses.length > 0 ? [warehouses[0]] : []));

    const preferredWarehouse=product.warehouseId || product.defaultWarehouseId || product.defaultWarehouse?.id;
    const autoWarehouse = availableWhs.find(warehouse=>String(warehouse.id)===String(preferredWarehouse)) || availableWhs[0] || warehouses[0] || null;
    const realQty = autoWarehouse ? getProductStockInWarehouse(product.id, autoWarehouse.id) : 0;

    const price = Number(product.sellingPrice || 0);
    const qty = 1;

    const restricted=allocationBudget(product.id,stockLimits,cart);
    const quotaInfo=restricted?{quotaRestricted:true,remainingQuantity:realQty+Number(cart.find(line=>String(line.productId)===String(product.id) && String(line.warehouseId)===String(autoWarehouse?.id))?.quantity || 0)}:null;

    setStagedItem({
      product,
      availableWarehouses: availableWhs,
      warehouseId: autoWarehouse ? autoWarehouse.id : null,
      warehouseCode: autoWarehouse ? autoWarehouse.code : 'WH-01',
      warehouseName: autoWarehouse ? autoWarehouse.name : 'Main Warehouse',
      realQuantity: Math.max(0, realQty),
      quotaInfo: quotaInfo,
      salesPrice: price,
      salesQty: qty,
      discountRate: 0,
      discountAmount: 0,
      subtotal: price * qty,
    });

    // Auto-focus Quantity input so user can type qty and hit Enter immediately
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 50);
  };

  const handleStagedDiscountRateChange = (rateVal) => {
    if (!stagedItem) return;
    if (rateVal === '' || rateVal === null || rateVal === undefined) {
      const qty = parseFloat(stagedItem.salesQty) || 0;
      const gross = stagedItem.salesPrice * qty;
      setStagedItem((prev) => ({
        ...prev,
        discountRate: '',
        discountMode:'rate',
        discountAmount: '',
        subtotal: gross,
      }));
      return;
    }
    const parsed = parseFloat(rateVal);
    const rate = isNaN(parsed) ? '' : Math.max(0, Math.min(100, parsed));
    const qty = parseFloat(stagedItem.salesQty) || 0;
    const gross = stagedItem.salesPrice * qty;
    const discAmt = rate !== '' ? parseFloat(((gross * rate) / 100).toFixed(2)) : 0;
    const subtotal = Math.max(0, gross - discAmt);

    setStagedItem((prev) => ({
      ...prev,
      discountRate: rateVal,
      discountMode:'rate',
      discountAmount: discAmt > 0 ? discAmt : '',
      subtotal,
    }));
  };

  const handleStagedDiscountAmountChange = (amtVal) => {
    if (!stagedItem) return;
    if (amtVal === '' || amtVal === null || amtVal === undefined) {
      const qty = parseFloat(stagedItem.salesQty) || 0;
      const gross = stagedItem.salesPrice * qty;
      setStagedItem((prev) => ({
        ...prev,
        discountRate: '',
        discountMode:'amount',
        discountAmount: '',
        subtotal: gross,
      }));
      return;
    }
    const parsed = parseFloat(amtVal);
    const qty = parseFloat(stagedItem.salesQty) || 0;
    const gross = stagedItem.salesPrice * qty;
    const discAmt = isNaN(parsed) ? '' : Math.max(0, Math.min(gross, parsed));
    const rate = (gross > 0 && discAmt !== '') ? parseFloat(((discAmt / gross) * 100).toFixed(2)) : 0;
    const subtotal = Math.max(0, gross - (Number(discAmt) || 0));

    setStagedItem((prev) => ({
      ...prev,
      discountRate: rate > 0 ? rate : '',
      discountMode:'amount',
      discountAmount: amtVal,
      subtotal,
    }));
  };

  const handleStagedQtyChange = (qtyVal) => {
    if (!stagedItem) return;
    if (qtyVal === '' || qtyVal === null || qtyVal === undefined) {
      setStagedItem((prev) => ({
        ...prev,
        salesQty: '',
        subtotal: 0,
      }));
      return;
    }
    let maxLimit = stagedItem.realQuantity || 1;
    const maxStock = Math.max(1, maxLimit);
    const parsed = parseFloat(qtyVal);
    const qty = isNaN(parsed) ? '' : Math.min(maxStock, Math.max(0, parsed));
    const gross = stagedItem.salesPrice * (Number(qty) || 0);
    const rate = Number(stagedItem.discountRate) || 0;
    const discAmt = stagedItem.discountMode==='rate'
      ? parseFloat(((gross * rate) / 100).toFixed(2))
      : Math.min(gross, Number(stagedItem.discountAmount) || 0);
    const subtotal = Math.max(0, gross - discAmt);

    setStagedItem((prev) => ({
      ...prev,
      salesQty: qtyVal,
      discountRate:stagedItem.discountMode==='rate'?stagedItem.discountRate:(gross>0?Number((Number(discAmt || 0)*100/gross).toFixed(2)):0),
      discountAmount: discAmt > 0 ? discAmt : (prev.discountAmount === '' ? '' : discAmt),
      subtotal,
    }));
  };

  const handleAddStagedToTable = async () => {
    if(!stagedItem || savingBillRef.current)return;
    const numQty = parseFloat(stagedItem.salesQty);
    if (!numQty || isNaN(numQty) || numQty <= 0) {
      addToast('Please enter a valid quantity of at least 1.', 'error');
      qtyInputRef.current?.focus();
      return;
    }
    const error=numberError(numQty,'Quantity',{positive:true,decimals:2});if(error){addToast(error,'error');return;}
    const available=getProductStockInWarehouse(stagedItem.product.id,stagedItem.warehouseId);
    if(numQty>available){addToast(`Only ${available} units are available. Refresh and lower the quantity.`,'error');return;}
    const existing=cart.find(line=>String(line.productId)===String(stagedItem.product.id) && String(line.warehouseId)===String(stagedItem.warehouseId));
    const quantity=numQty+Number(existing?.quantity || 0);
    const discAmt = Number(stagedItem.discountAmount) || 0;
    const discRate = Number(stagedItem.discountRate) || 0;
    const stagedBrand = getProductBrandName(stagedItem.product);
    const stagedCat = getProductCategoryName(stagedItem.product);
    const item=existing?{...existing,quantity,discountMode:'amount',discountRate:0,discountAmount:existing.discountAmount+discAmt,total:Math.max(0,quantity*existing.unitPrice-existing.discountAmount-discAmt)}:
      {id:`${stagedItem.product.id}_${stagedItem.warehouseId}`,productId:stagedItem.product.id,sku:stagedItem.product.sku,name:stagedItem.product.name,brandName:stagedBrand,categoryName:stagedCat,unitOfMeasure:stagedItem.product.unitOfMeasure,warehouseId:stagedItem.warehouseId,warehouseCode:stagedItem.warehouseCode,warehouseName:stagedItem.warehouseName,unitPrice:stagedItem.salesPrice,quantity,discountMode:stagedItem.discountMode || 'amount',discountRate:discRate,discountAmount:discAmt,total:stagedItem.subtotal,availableQty:stagedItem.realQuantity,quotaInfo:stagedItem.quotaInfo};
    const next=existing?cart.map(line=>line.id===existing.id?item:line):[...cart,item];
    if(await commitCart(next)){setStagedItem(null);setCatalogSearch('');catalogSearchInputRef.current?.focus();}
  };

  const removeFromCart = (lineId) => {
    commitCart(cart.filter(item=>item.id!==lineId));
  };

  const {requestRemove:requestCartRemoval,removalDialog:cartRemovalDialog,isRemovalOpen:cartRemovalOpen}=usePurchaseItemRemoval({items:cart,products:allProducts,onRemove:index=>{if(!savingBillRef.current)removeFromCart(cart[index].id);}});

  // Small Edit Popup Handlers for added product table
  const handleOpenEditCartItem = (item) => {
    setEditingCartItem({
      ...item,
      availableQty:Number(item.quantity)+getProductStockInWarehouse(item.productId,item.warehouseId),
      editQty: item.quantity,
      editDiscRate: item.discountRate || (Number(item.quantity)*Number(item.unitPrice)>0?Number((Number(item.discountAmount || 0)*100/(Number(item.quantity)*Number(item.unitPrice))).toFixed(2)):0),
      editDiscountMode:item.discountMode || (Number(item.discountRate)>0?'rate':'amount'),
      editDiscAmt: item.discountAmount || 0,
      editTotal: item.total || 0,
    });
  };
  const closeCartItemEditor=()=>{if(savingBillRef.current)return;setEditingCartItem(null);catalogSearchInputRef.current?.focus();catalogSearchInputRef.current?.select();};

  const handleEditCartItemQtyChange = (val) => {
    if (!editingCartItem) return;
    if (val === '') {
      setEditingCartItem((prev) => ({
        ...prev,
        editQty: '',
        editTotal: 0,
      }));
      return;
    }
    let maxStock = editingCartItem.availableQty ?? 0;
    const newQty = Math.min(maxStock, Math.max(0.01, parseFloat(val) || 0.01));
    const gross = Number((newQty * editingCartItem.unitPrice).toFixed(2));
    const disc = editingCartItem.editDiscountMode==='rate'
      ? parseFloat(((gross * Number(editingCartItem.editDiscRate)) / 100).toFixed(2))
      : Math.min(gross, Number(editingCartItem.editDiscAmt) || 0);
    const total = Number(Math.max(0, gross - disc).toFixed(2));

    setEditingCartItem((prev) => ({
      ...prev,
      editQty: val,
      editDiscAmt: disc > 0 ? disc : '',
      editDiscRate:editingCartItem.editDiscountMode==='rate'?editingCartItem.editDiscRate:(gross>0?Number((disc*100/gross).toFixed(2)):0),
      editTotal: total,
    }));
  };

  const handleEditCartItemDiscRateChange = (val) => {
    if (!editingCartItem) return;
    if (val === '') {
      const gross = Number(((Number(editingCartItem.editQty) || 0) * editingCartItem.unitPrice).toFixed(2));
      setEditingCartItem((prev) => ({
        ...prev,
        editDiscRate: '',
        editDiscountMode:'rate',
        editDiscAmt: '',
        editTotal: gross,
      }));
      return;
    }
    const rate = Math.max(0, Math.min(100, parseFloat(val) || 0));
    const gross = Number(((Number(editingCartItem.editQty) || 0) * editingCartItem.unitPrice).toFixed(2));
    const discAmt = parseFloat(((gross * rate) / 100).toFixed(2));
    const total = Number(Math.max(0, gross - discAmt).toFixed(2));

    setEditingCartItem((prev) => ({
      ...prev,
      editDiscRate: val,
      editDiscountMode:'rate',
      editDiscAmt: discAmt > 0 ? discAmt : '',
      editTotal: total,
    }));
  };

  const handleEditCartItemDiscAmtChange = (val) => {
    if (!editingCartItem) return;
    if (val === '') {
      const gross = Number(((Number(editingCartItem.editQty) || 0) * editingCartItem.unitPrice).toFixed(2));
      setEditingCartItem((prev) => ({
        ...prev,
        editDiscRate: '',
        editDiscountMode:'amount',
        editDiscAmt: '',
        editTotal: gross,
      }));
      return;
    }
    const gross = Number(((Number(editingCartItem.editQty) || 0) * editingCartItem.unitPrice).toFixed(2));
    const discAmt = Math.max(0, Math.min(gross, parseFloat(val) || 0));
    const rate = gross > 0 ? parseFloat(((discAmt / gross) * 100).toFixed(2)) : 0;
    const total = Number(Math.max(0, gross - discAmt).toFixed(2));

    setEditingCartItem((prev) => ({
      ...prev,
      editDiscRate: rate > 0 ? rate : '',
      editDiscountMode:'amount',
      editDiscAmt: val,
      editTotal: total,
    }));
  };

  const handleSaveEditCartItem = async () => {
    if(!editingCartItem)return;
    const numQty = parseFloat(editingCartItem.editQty);
    if (!numQty || isNaN(numQty) || numQty <= 0) {
      addToast('Please enter a valid quantity of at least 1.', 'error');
      return;
    }
    const error=numberError(numQty,'Quantity',{positive:true,decimals:2});if(error){addToast(error,'error');return;}
    const available=Number(editingCartItem.availableQty);
    if(numQty>available){addToast(`Only ${available} units are available.`,'error');return;}
    const sellable=getProductStockInWarehouse(editingCartItem.productId,editingCartItem.warehouseId)+Number(cart.find(line=>line.id===editingCartItem.id)?.quantity || 0);
    if(numQty>sellable){addToast(`Only ${sellable} units remain available for your allocation.`,'error');return;}
    const gross=Number((numQty*Number(editingCartItem.unitPrice)).toFixed(2));
    const discountError=numberError(editingCartItem.editDiscAmt || 0,'Discount',{decimals:2,max:gross});
    const rateError=numberError(editingCartItem.editDiscRate || 0,'Discount rate',{decimals:2,max:100});
    if(discountError || rateError){addToast(discountError || rateError,'error');return;}
    const discAmt = Number(Number(editingCartItem.editDiscAmt || 0).toFixed(2));
    const discRate = editingCartItem.editDiscountMode==='rate'?Number(editingCartItem.editDiscRate || 0):0;
    const next=cart.map(item=>item.id===editingCartItem.id?{...item,quantity:numQty,discountMode:editingCartItem.editDiscountMode,discountRate:discRate,discountAmount:discAmt,total:Number((gross-discAmt).toFixed(2))}:item);
    if(await commitCart(next))closeCartItemEditor();
  };
  const clearCart=()=>{if(cart.length && !savingBillRef.current)setShowClearConfirmation(true);};
  const exitFreshPos=()=>{resetWorkingBill();onExitPos?.();};
  const requestExitPos=()=>{if(savingBillRef.current || holdingCartRef.current || checkingBill)return;if(cart.length)setShowExitConfirmation(true);else exitFreshPos();};
  const confirmExitPos=async()=>{if(savingBillRef.current || holdingCartRef.current)return;if(cart.length && !await commitCart([]))return;setShowExitConfirmation(false);exitFreshPos();};
  const confirmClearCart=async()=>{if(savingBillRef.current || checkingBill || billCheckFailed)return;if(await commitCart([])){setStagedItem(null);setViewingCartItemId(null);setShowClearConfirmation(false);}};

  // Hold Bill Handler (Primary Action in Flow)
  const handleHoldCart=async()=>{
    if(!cart.length || savingBillRef.current || holdingCartRef.current)return;
    if(loadingStockLimits || stockLimitError){addToast('Wait for your stock allocation to load before saving.','error');return;}
    if(!selectedCustomer){addToast('Select a customer before saving the bill.','error');customerSearchInputRef.current?.focus();return;}
    setShowBillRemarks(true);
  };
  const submitHeldCart=async remarks=>{
    if(!cart.length || savingBillRef.current || holdingCartRef.current)return false;
    holdingCartRef.current=true;setIsHoldingCart(true);
    try{
      savingBillRef.current=true;setSavingBill(true);
      const payload={...billPayload(cart),notes:remarks};
      const persisted=activeBillRef.current?await salesApi.savePosDraft(activeBillRef.current,payload):await salesApi.create(payload);
      const invoice=persisted.data?.data || persisted.data;
      if(!invoice?.id)throw new Error('The server did not confirm the bill. Your products remain in POS.');
      activeBillRef.current=invoice.id;billVersionRef.current=invoice.recordVersion;setActiveBillId(invoice.id);
      reservedLinesRef.current=cart.map(line=>({...line}));
      const response=await salesApi.sendHeld(activeBillRef.current,{expectedVersion:billVersionRef.current,printNow:false});
      const saved=response.data?.data || response.data;
      if(!saved?.id || !['YET_TO_PRINT','SENT_TO_WAREHOUSE'].includes(saved.status))throw new Error('The server did not confirm the Onhold bill. Your products remain in POS; try saving again.');
      resetWorkingBill();setShowBillRemarks(false);setSavedBillToPrint(saved);setProgressVersion(value=>value+1);
      await Promise.all([refreshStock().catch(()=>{}),loadHeldInvoices()]);addToast(`Onhold bill ${saved.heldNumber || ''} saved. Print the warehouse sheets now or later.`,'success');return true;
    }catch(error){addToast(error.response?.data?.message || error.message || 'Unable to save Onhold bill. Your products remain in POS.','error');await refreshStock().catch(()=>{});return false;}
    finally{holdingCartRef.current=false;savingBillRef.current=false;setSavingBill(false);setIsHoldingCart(false);}
  };

  const handleOpenMonthlyRangeModal = () => {if(selectedCustomerId)setShowMonthlyRangesModal(true);};

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handlePosKeys = (e) => {
      if (!workspaceActive) return;
      if ((cartRemovalOpen || showClearConfirmation || showExitConfirmation || showBillRemarks || savedBillToPrint || viewingCartItemId!==null || editingCartItem) && e.key!=='Escape') {
        if (/^F\d+$/.test(e.key)) e.preventDefault();
        return;
      }

      // F2: Focus catalog search
      if (e.key === 'F2') {
        e.preventDefault();
        catalogSearchInputRef.current?.focus();
        catalogSearchInputRef.current?.select();
        return;
      }

      // F1: Focus customer search
      if (e.key === 'F1') {
        e.preventDefault();
        setShowCustomerSearch(true);
        customerSearchInputRef.current?.focus();
        return;
      }

      // F12 or F5: Hold Bill
      // F12, F5 or F9: Hold Bill (All bills are saved to held bills table)
      if (e.key === 'F12' || e.key === 'F5' || e.key === 'F9') {
        if (cart.length > 0 && !showHeldModal && !showPerformance && !cartRemovalOpen && !activeCircleModal) {
          e.preventDefault();
          handleHoldCart();
        }
        return;
      }

      // Escape: Close active modals or unstage or exit POS
      if (e.key === 'Escape') {
        if (cartRemovalOpen || showClearConfirmation || showExitConfirmation || showBillRemarks || savedBillToPrint || viewingCartItemId!==null) return;
        if (showPerformance) {setShowPerformance(false);return;}
        if (editingCartItem) {
          closeCartItemEditor();
          return;
        }
        if (selectedInvoiceDetail) {
          setSelectedInvoiceDetail(null);
          return;
        }
        if (activeCircleModal) {
          setActiveCircleModal(null);
          return;
        }
        if (showHeldModal) {
          setShowHeldModal(false);
          return;
        }
        if (showOutstandingModal) {
          setShowOutstandingModal(false);
          return;
        }
        if (showCustomerDetailsDrop) {
          setShowCustomerDetailsDrop(false);
          return;
        }
        if (showMonthlyRangesModal) {
          setShowMonthlyRangesModal(false);
          return;
        }
        if (showTargetRangesModal) {
          setShowTargetRangesModal(false);
          return;
        }
        if (stagedItem) {
          setStagedItem(null);
          catalogSearchInputRef.current?.focus();
          return;
        }
        if (showCustomerSearch) {
          setShowCustomerSearch(false);
          return;
        }
        if (onExitPos) {
          requestExitPos();
          return;
        }
      }
    };

    window.addEventListener('keydown', handlePosKeys);
    return () => window.removeEventListener('keydown', handlePosKeys);
  }, [
    workspaceActive,
    cart,
    editingCartItem,
    stagedItem,
    showCustomerSearch,
    activeCircleModal,
    showHeldModal,
    showPerformance,
    cartRemovalOpen,
    showClearConfirmation,showExitConfirmation,showBillRemarks,savedBillToPrint,viewingCartItemId,
    selectedInvoiceDetail,
    showMonthlyRangesModal,
    showTargetRangesModal,
    selectedCustomerId,discountVal,savingBill,checkingBill,billCheckFailed,
    onExitPos,
  ]);

  const viewedCartLine=cart.find(item=>item.id===viewingCartItemId);
  const viewedProduct=viewedCartLine && allProducts.find(product=>String(product.id)===String(viewedCartLine.productId));
  const viewedCartItem=viewedCartLine && {...viewedCartLine,
    brandName:getProductBrandName(viewedCartLine) || getProductBrandName(viewedProduct),
    categoryName:getProductCategoryName(viewedCartLine) || getProductCategoryName(viewedProduct)};
  return (
    <div className="pos-view purchasing-no-shadows"
      style={{
        height: '100vh',
        maxHeight: '100vh',
        width: '100%',
        maxWidth: '100vw',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f1f5f9',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* Remove number input spinner arrows across textboxes */}
      <style>{`
        input.no-spin-arrows::-webkit-inner-spin-button,
        input.no-spin-arrows::-webkit-outer-spin-button {
          -webkit-appearance: none !important;
          margin: 0 !important;
        }
        input.no-spin-arrows {
          -moz-appearance: textfield !important;
          appearance: textfield !important;
        }
      `}</style>

      {/* ─────────────────────────────────────────────────────────────
          TOP BAR: CUSTOMER SELECTOR + PERFECTLY ALIGNED RANGE/TARGET CARD + ACTIONS
          (No labels hanging out, single 64px line)
         ───────────────────────────────────────────────────────────── */}
      <header
        style={{
          height: '64px',
          flexShrink: 0,
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          zIndex: 40,
        }}
      >
        {/* Left: Customer Selection, 1.5cm Search Dropdown, Details Popdown & Clickable Outstanding */}
        <div className="pos-customer-tools" style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '380px', flex: '0 0 auto', position: 'relative' }}>
          <div className="pos-customer-selection" style={{ position: 'relative', width: '380px', maxWidth: '100%' }}>
            <div className="pos-customer-input-row" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="pos-customer-search-field" style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                <User size={14} style={{ position: 'absolute', left: '10px', top: 'calc(50% - 7px)', color: '#2563eb', pointerEvents:'none' }} />
                <input
                  ref={customerSearchInputRef}
                  type="text"
                  className="input-glass erp-field"
                  placeholder="Select Customer (F1)..."
                  value={
                    showCustomerSearch
                      ? customerSearchQuery
                      : selectedCustomer
                      ? selectedCustomer.name
                      : ''
                  }
                  onFocus={() => {
                    setShowCustomerSearch(true);
                    setCustomerSearchQuery('');
                  }}
                  onClick={() => {
                    if (!showCustomerSearch) {
                      setShowCustomerSearch(true);
                      setCustomerSearchQuery('');
                    }
                  }}
                  onChange={(e) => {
                    setShowCustomerSearch(true);
                    setCustomerSearchQuery(e.target.value);
                  }}
                  onKeyDown={handleCustomerSearchKeyDown}
                  style={{
                    paddingLeft: '30px',
                    paddingRight: selectedCustomer ? '70px' : '10px',
                    fontWeight: 600,
                    width: '100%',
                    height: '38px',
                    paddingTop: 0,
                    paddingBottom: 0,
                    fontSize: '0.82rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                  }}
                />
                {/* Range badge near customer name on the right */}
                {selectedCustomer && !showCustomerSearch && (
                  <CustomerRangeBadge name={monthlyRangeProgress?.currentRangeName || customerRanges[selectedCustomer.id]?.currentRangeName || 'Standard'}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: 'calc(50% - 11px)',
                      height:'22px',
                      boxSizing:'border-box',
                      pointerEvents: 'none',
                    }}/> )}
              </div>

              {showCustomerSearch && (
                <button
                  type="button"
                  className="btn btn-glass btn-sm erp-button"
                  onClick={() => setShowCustomerSearch(false)}
                  style={{ height: '32px', padding: '0 8px' }}
                  title="Cancel search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Selected Customer Meta Bar */}
            <div className="pos-customer-meta-bar">
              <div className="pos-customer-meta-summary">
                {selectedCustomer ? (
                  <>
                    {selectedCustomer.contactPerson && (
                      <span className="pos-meta-pill" title={`Contact: ${selectedCustomer.contactPerson}`} aria-label={`Contact: ${selectedCustomer.contactPerson}`}>
                        <User size={11} aria-hidden="true" /> <span>{selectedCustomer.contactPerson}</span>
                      </span>)}
                    {selectedCustomer.phone && (
                      <span className="pos-meta-pill pos-meta-phone" title={`Phone: ${selectedCustomer.phone}`} aria-label={`Phone: ${selectedCustomer.phone}`}>
                        <Phone size={11} aria-hidden="true" /> <span>{selectedCustomer.phone}</span>
                      </span>)}
                    {selectedCustomer.address && (
                      <span className="pos-meta-pill pos-meta-addr" title={`Address: ${selectedCustomer.address}`} aria-label={`Address: ${selectedCustomer.address}`}>
                        <MapPin size={11} aria-hidden="true" /> <span>{selectedCustomer.address}</span>
                      </span>)}
                  </>
                ) : (
                  <span className="pos-muted">Choose a customer to view purchase progress & dues</span>)}
              </div>
            </div>

            {/* Dropdown 1: Selected Customer Quick Details Dropdown Card */}
            {showCustomerDetailsDrop && selectedCustomer && (
              <div className="pos-customer-details-dropdown" onClick={(e) => e.stopPropagation()}>
                <div className="pos-cdd-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{selectedCustomer.name}</strong>
                    <CustomerRangeBadge name={monthlyRangeProgress?.currentRangeName || customerRanges[selectedCustomer.id]?.currentRangeName || 'Standard'}/>
                    {selectedCustomer.customerCode && <span className="pos-cdd-code">({selectedCustomer.customerCode})</span>}
                  </div>
                  <button
                    type="button"
                    className="erp-table-icon-action"
                    onClick={() => setShowCustomerDetailsDrop(false)}
                    aria-label="Close details"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="pos-cdd-grid">
                  <div className="pos-cdd-item">
                    <span className="lbl"><User size={12} /> Person to Contact:</span>
                    <span className="val">{selectedCustomer.contactPerson || '—'}</span>
                  </div>
                  <div className="pos-cdd-item">
                    <span className="lbl"><Phone size={12} /> Phone:</span>
                    <span className="val">{selectedCustomer.phone || '—'}</span>
                  </div>
                  <div className="pos-cdd-item pos-cdd-full">
                    <span className="lbl"><MapPin size={12} /> Address:</span>
                    <span className="val">{selectedCustomer.address || '—'}</span>
                  </div>
                  <div className="pos-cdd-item pos-cdd-full">
                    <span className="lbl"><Target size={12} /> Target Progress:</span>
                    <span className="val">
                      {monthlyRangeProgress?.nextRange && !monthlyRangeProgress.highestRange ? (
                        <span style={{ color: '#0369a1', fontWeight: 600 }}>
                          {posMoney(monthlyRangeProgress.nextRange.remaining)} more to achieve {monthlyRangeProgress.nextRangeName}
                        </span>) : monthlyRangeProgress?.highestRange ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>⭐ Highest Target Level Reached!</span>) : (
                        <span>Tracking monthly sales targets</span>)}
                    </span>
                  </div>
                </div>

                {/* Clickable Outstanding amount banner inside dropdown */}
                <div
                  className={`pos-cdd-outstanding-strip ${custOutstanding > 0 ? 'has-due' : 'settled'}`}
                  onClick={() => {
                    setShowCustomerDetailsDrop(false);
                    setShowOutstandingModal(true);
                  }}
                  role="button"
                  tabIndex={0}
                  title="Click to view full outstanding bills table"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Receipt size={16} />
                    <div>
                      <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'block' }}>
                        Outstanding Balance (Click to View)
                      </span>
                      <strong style={{ fontSize: '0.95rem' }}>{posMoney(custOutstanding)}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 600 }}>
                    <span>View Outstanding Bills</span>
                    <ArrowRight size={13} />
                  </div>
                </div>
              </div>
            )}

            {/* Customer search results. */}
            {showCustomerSearch && (
              <div className="pos-customer-search-dropdown" onClick={(e) => e.stopPropagation()}>
                {filteredCustomers.length === 0 ? (
                  <div className="pos-drop-empty">
                    No customer matching query "{customerSearchQuery}"
                  </div>
                ) : (
                  filteredCustomers.slice(0, 15).map((c, idx) => {
                    const rData = customerRanges[c.id];
                    const rangeName = rData?.currentRangeName || 'Standard';

                    return (
                      <div
                        key={c.id}
                        className={`pos-customer-drop-row ${idx === customerHighlightedIndex ? 'highlighted' : ''} ${c.id === selectedCustomerId ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedCustomerId(c.id);
                          setShowCustomerSearch(false);
                          setShowCustomerDetailsDrop(false);
                          setCustomerSearchQuery('');
                          setTimeout(() => {
                            catalogSearchInputRef.current?.focus();
                            catalogSearchInputRef.current?.select();
                          }, 50);
                        }}
                        onMouseEnter={() => setCustomerHighlightedIndex(idx)}
                      >
                        {/* Customer identity with the range badge aligned right. */}
                        <div className="pos-drop-row-top">
                          <div className="pos-drop-name-box">
                            <span className="pos-drop-name" title={c.name}>{c.name}</span>
                            {c.customerCode && (
                              <span className="pos-drop-code">
                                {c.customerCode}
                              </span>)}
                          </div>
                          <CustomerRangeBadge name={rangeName}/>

                        </div>

                        {/* Contact details. */}
                        <div className="pos-drop-row-bottom">
                          <div className="pos-drop-contacts">
                            {c.contactPerson && <span title={`Contact: ${c.contactPerson}`}><User size={11}/><span className="pos-drop-contact-text">{c.contactPerson}</span></span>}
                            {c.phone && <span title={`Phone: ${c.phone}`}><Phone size={11}/><span className="pos-drop-contact-text">{c.phone}</span></span>}
                            {c.address && <span title={`Address: ${c.address}`}><MapPin size={11}/><span className="pos-drop-contact-text">{c.address}</span></span>}
                            {!c.contactPerson && !c.phone && !c.address && <span>No additional details</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

            <div className="pos-customer-finances">
              <button type="button" disabled={!selectedCustomer} className="pos-finance pos-finance-outstanding" data-due={custOutstanding > 0}
                onClick={() => setShowOutstandingModal(true)} title="View customer outstanding invoices and statement">
                <span className="pos-finance-label">Outstanding Due</span><strong>{posMoney(custOutstanding)}</strong>
              </button>
              <button type="button" disabled={!selectedCustomer} className="pos-finance pos-finance-credit" onClick={() => setShowOutstandingModal(true)} title="View customer credit limit and outstanding invoices">
                <span className="pos-finance-label">Credit Limit</span><strong>{custCreditLimit>0 || !selectedCustomer?posMoney(custCreditLimit):'No limit'}</strong>
              </button>
            </div>
        </div>

        <PosRangePreview progress={monthlyRangeProgress} loading={loadingMonthlyRange} customer={selectedCustomer} onClick={handleOpenMonthlyRangeModal}/>

        {/* Right: Held Bills Button + Clean Exit */}
        <div className="pos-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Held Bills Button */}
          <button
            type="button"
            className="btn btn-glass btn-sm erp-button pos-onhold-action"
            onClick={() => setShowHeldModal(true)}
            title="Inspect Held Bills"
          >
            <PauseCircle size={14} />
            Held Bills
          </button>

          <button type="button" className="btn btn-sm erp-button pos-performance-action" onClick={()=>setShowPerformance(true)} title="View monthly POS performance"><Trophy size={14}/>Performance</button>

          <div style={{ height: '18px', width: '1px', background: '#e2e8f0' }} />

          {/* Subtle Clean Exit Button */}
          {onExitPos && (
            <button
              type="button"
              className="btn btn-sm erp-button pos-exit-action"
              onClick={requestExitPos}
              disabled={savingBill || checkingBill}
              title="Exit POS Mode (Esc)"
            >
              <LogOut size={12} /> Exit
            </button>
          )}
        </div>
      </header>
      {checkingBill || billCheckFailed?<div className="pos-save-status" role="status">{checkingBill?'Preparing a new POS bill…':'Unable to prepare POS. Reload before billing.'}{billCheckFailed?<button type="button" className="btn btn-secondary erp-button" onClick={()=>window.location.reload()}>Reload POS</button>:null}</div>:null}

      {/* ─────────────────────────────────────────────────────────────
          MAIN SPLIT WORKSPACE: 1 WINDOW, ZERO VERTICAL SCROLL
          Left Side (46%): Inventory Catalog with Search & Brand/Category Filters
          Right Side (54%): Staging Workstation (Qty & 2 Disc boxes) + Cart Table + Totals & Hold Bill
         ───────────────────────────────────────────────────────────── */}
      <div className="pos-workspace"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          gap: '10px',
          padding: '10px 14px 12px 14px',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* =========================================================
            LEFT COLUMN: INVENTORY CATALOG & FILTERS
           ========================================================= */}
        <section
          style={{
            flex: '0 0 calc(46% - 1in)',
            minWidth: '320px',
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            background: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          {/* Catalog Search & Filter Header (Single Horizontal Line: Search + Category + Brand) */}
          <div className="pos-catalog-filters"
            style={{
              flexShrink: 0,
              padding: '6px 8px',
              borderBottom: '1px solid #e2e8f0',
              background: '#fafbfc',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              boxSizing: 'border-box',
              width: '100%',
            }}
          >
            <SearchBar inputRef={catalogSearchInputRef} value={catalogSearch}
              onChange={event=>setCatalogSearch(event.target.value)}
              onClear={()=>{setCatalogSearch('');catalogSearchInputRef.current?.focus();}}
              onKeyDown={handleCatalogSearchKeyDown} placeholder="Search product code..." ariaLabel="Search POS products"/>
            <FilterSelect aria-label="Brand" searchable={false} value={selectedBrandFilter} onChange={event=>setSelectedBrandFilter(event.target.value)} style={{width:'100%'}}>
              <option value="">Brand</option>{brands.map(brand=><option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </FilterSelect>
            <FilterSelect aria-label="Category" value={selectedCategoryFilter} onChange={event=>setSelectedCategoryFilter(event.target.value)} style={{width:'100%'}}>
              <option value="">Category</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}
            </FilterSelect>

          </div>

          {/* Catalog Products List (Internally Scrollable Only, with Keyboard Highlight) */}
          <div
            ref={catalogListRef}
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
            }}
          >
            {loadingData || loadingStockLimits ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.86rem' }}>
                <RefreshCw size={20} className="erp-spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                Loading inventory catalog...
              </div>
            ) : stockLimitError ? (<div role="alert" style={{padding:'20px',color:'#9f1239',fontSize:'var(--erp-text-body)'}}>{stockLimitError}<button type="button" className="erp-button btn-glass" onClick={refreshStockLimits}>Retry</button></div>) : filteredProducts.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                <Package size={28} style={{ margin: '0 auto 8px auto', display: 'block', opacity: 0.4 }} />
                <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>No products match filter</div>
                <div style={{ fontSize: '0.76rem', marginTop: '2px' }}>Try adjusting search or category/brand filter.</div>
              </div>
            ) : (
              filteredProducts.map((p, idx) => {
                const totalStock = getProductTotalStock(p.id);
                const isOutOfStock = totalStock <= 0;
                const isLowStock = totalStock > 0 && totalStock <= (p.minStockLevel || 5);
                const isSelected = stagedItem?.product?.id === p.id;
                const isHighlighted = idx === productHighlightedIndex;

                return (
                  <div
                    key={p.id}
                    className="pos-inventory-row"
                    role="button"
                    tabIndex={isOutOfStock ? -1 : 0}
                    aria-label={`Select ${p.name}`}
                    aria-disabled={isOutOfStock}
                    onClick={() => {
                      if (!isOutOfStock) {
                        setProductHighlightedIndex(idx);
                        handleSelectProductForStaging(p);
                      }
                    }}
                    style={{
                      height: '50px',
                      minHeight: '50px',
                      maxHeight: '50px',
                      padding: '0 12px',
                      borderRadius: 0,
                      border: '1px solid transparent',
                      borderBottom: '1px solid #e2e8f0',
                      background: isSelected || isHighlighted ? '#f8fafc' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                      opacity: 1,
                      transition: 'all 0.1s ease',
                      boxShadow: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Product Details (Compact 1/2 inch fit) */}
                    <div style={{ minWidth: 0, flex: 1, paddingRight: '8px', lineHeight: 1.15 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 'var(--erp-text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </span>
                        {p.unitOfMeasure && (
                          <span style={{ fontSize: '0.64rem', color: '#64748b', padding: '0 4px', borderRadius: '3px', flexShrink: 0 }}>
                            {p.unitOfMeasure}
                          </span>)}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: '#64748b', marginTop: '1px' }}>
                        <span style={{ fontWeight: 600, color: '#64748b' }}>{p.sku}</span>
                        {(p.brandName || getProductBrandName(p)) && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>• {p.brandName || getProductBrandName(p)}</span>}
                        {(p.categoryName || getProductCategoryName(p)) && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>• {p.categoryName || getProductCategoryName(p)}</span>}
                      </div>
                    </div>

                    {/* Stock Status Badge & Price */}
                    <div style={{ textAlign: 'right', flexShrink: 0, lineHeight: 1.15 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--erp-text-body)', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                        Rs. {Number(p.sellingPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>

                      <div className="pos-inventory-stock" style={{ marginTop: '2px' }}>
                        <StatusBadge status={isOutOfStock?'OUT_OF_STOCK':isLowStock?'LOW_STOCK':'IN_STOCK'}
                          label={isOutOfStock?'Out of Stock (0)':isLowStock?`Low Stock (${totalStock})`:`In Stock (${totalStock})`}/>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* =========================================================
            RIGHT COLUMN: STAGING WORKSTATION (NO WAREHOUSE, 2 DISC BOXES) + CART TABLE + TOTALS & HOLD BILL
           ========================================================= */}
        <section
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            background: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          {/* 1. Staging Quick-Input Workstation (Always Visible: Price, Selling Qty, Disc %, Disc Rs., Add Button in-line) */}
          <div
            style={{
              flexShrink: 0,
              padding: '10px 14px',
              background: stagedItem ? '#f0f9ff' : '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              transition: 'background-color 0.2s ease',
              boxSizing: 'border-box',
              width: '100%',
              overflow: 'hidden',
            }}
          >
            {/* Header row: Product Name, Brand, Category, Code & Cancel */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '26px', marginBottom: stagedItem?.quotaInfo?.quotaRestricted ? '4px' : '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                <Package size={15} color={stagedItem ? '#0284c7' : '#94a3b8'} style={{ flexShrink: 0 }} />
                {stagedItem ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '0.86rem',
                        color: '#0f172a',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '240px',
                      }}
                      title={stagedItem.product.name}
                    >
                      {stagedItem.product.name}
                    </span>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#0369a1',
                        background: '#e0f2fe',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        border: '1px solid #bae6fd',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                      title={`Code: ${stagedItem.product.sku}`}
                    >
                      Code: {stagedItem.product.sku}
                    </span>
                    <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: '#475569',
                          background: '#f1f5f9',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                        }}
                        title={`Brand: ${getProductBrandName(stagedItem.product) || 'None'}`}
                      >
                        Brand: {getProductBrandName(stagedItem.product) || 'None'}
                      </span>
                    <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: '#475569',
                          background: '#f1f5f9',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                        }}
                        title={`Category: ${getProductCategoryName(stagedItem.product) || 'None'}`}
                      >
                        Category: {getProductCategoryName(stagedItem.product) || 'None'}
                      </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontWeight: 500,
                        fontSize: '0.86rem',
                        color: '#64748b',
                      }}
                    >
                      Select product from catalog (or press F2)
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: '#94a3b8',
                        background: '#ffffff',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        flexShrink: 0,
                      }}
                    >
                      Ready
                    </span>
                  </div>
                )}
              </div>

              {/* Cancel selection button */}
              {stagedItem && (
                <button
                  type="button"
                  onClick={() => {
                    setStagedItem(null);
                    catalogSearchInputRef.current?.focus();
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '4px',
                    flexShrink: 0,
                  }}
                  title="Cancel selection (Esc)"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Quota Banner if Applicable */}
            {stagedItem?.quotaInfo?.quotaRestricted && (
              <div
                style={{
                  marginBottom: '6px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0 ? '#fee2e2' : '#f0fdf4',
                  border: `1px solid ${Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0 ? '#fca5a5' : '#86efac'}`,
                  color: Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0 ? '#b91c1c' : '#15803d',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <ShieldCheck size={13} />
                <span>
                  Stock allocation: {stagedItem.realQuantity} units available to add
                </span>
              </div>
            )}

            {/* Workstation Inputs: Price, Qty, Disc (%), Disc (Rs.), Line Total on left with better gaps, Add Product (2in) pushed right */}
            <div className="pos-staging-fields"
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '12px',
                width: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
                flexWrap: 'nowrap',
              }}
            >
              {/* Locked Selling Price (Accommodates 10,000,000.00+ cleanly, left-aligned) */}
              <div style={{ flex: '0 0 135px', minWidth: '115px' }}>
                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Price
                </label>
                <div
                  style={{
                    height: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    padding: '0 10px',
                    background: stagedItem ? '#ffffff' : '#f8fafc',
                    border: `1px solid ${stagedItem ? '#cbd5e1' : '#e2e8f0'}`,
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    color: stagedItem ? '#0f172a' : '#94a3b8',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textAlign: 'left',
                  }}
                  title={stagedItem ? `Rs. ${stagedItem.salesPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Rs. 0.00'}
                >
                  Rs. {stagedItem ? stagedItem.salesPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </div>
              </div>

              {/* Selling Quantity (Left-aligned clean textbox without arrows) */}
              <div style={{ flex: '0 0 90px', minWidth: '78px' }}>
                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={stagedItem ? `Available: ${stagedItem.realQuantity}` : ''}>
                  Qty {stagedItem ? `(${stagedItem.realQuantity})` : ''}
                </label>
                <input
                  ref={qtyInputRef}
                  type="number"
                  min="1"
                  max={stagedItem?.realQuantity || 99999999}
                  className="input-glass erp-field no-spin-arrows"
                  style={{
                    width: '100%',
                    height: '34px',
                    textAlign: 'left',
                    padding: '0 10px',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    border: `1px solid ${stagedItem ? '#cbd5e1' : '#e2e8f0'}`,
                    background: stagedItem ? '#ffffff' : '#f8fafc',
                    MozAppearance: 'textfield',
                  }}
                  value={stagedItem ? (stagedItem.salesQty ?? '') : 1}
                  disabled={!stagedItem}
                  onChange={(e) => stagedItem && handleStagedQtyChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddStagedToTable();
                    }
                  }}
                />
              </div>

              {/* Discount (%) Textbox (Left-aligned clean textbox without arrows) */}
              <div style={{ flex: '0 0 72px', minWidth: '60px' }}>
                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Disc (%)
                </label>
                <input
                  ref={discPercentInputRef}
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  className="input-glass erp-field no-spin-arrows"
                  placeholder="0%"
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 8px',
                    fontSize: '0.84rem',
                    textAlign: 'left',
                    fontWeight: 600,
                    border: `1px solid ${stagedItem ? '#cbd5e1' : '#e2e8f0'}`,
                    background: stagedItem ? '#ffffff' : '#f8fafc',
                    MozAppearance: 'textfield',
                  }}
                  value={stagedItem ? (stagedItem.discountRate ?? '') : ''}
                  disabled={!stagedItem}
                  onChange={(e) => stagedItem && handleStagedDiscountRateChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddStagedToTable();
                    }
                  }}
                />
              </div>

              {/* Discount (Rs.) Textbox (Left-aligned clean textbox without arrows) */}
              <div style={{ flex: '0 0 130px', minWidth: '115px' }}>
                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Disc (Rs.)
                </label>
                <input
                  ref={discAmountInputRef}
                  type="number"
                  step="0.01"
                  min="0"
                  className="input-glass erp-field no-spin-arrows"
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 10px',
                    fontSize: '0.84rem',
                    textAlign: 'left',
                    fontWeight: 600,
                    border: `1px solid ${stagedItem ? '#cbd5e1' : '#e2e8f0'}`,
                    background: stagedItem ? '#ffffff' : '#f8fafc',
                    MozAppearance: 'textfield',
                  }}
                  value={stagedItem ? (stagedItem.discountAmount ?? '') : ''}
                  disabled={!stagedItem}
                  onChange={(e) => stagedItem && handleStagedDiscountAmountChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddStagedToTable();
                    }
                  }}
                />
              </div>

              {/* Line Total (Accommodates 10,000,000.00+ cleanly, left-aligned) */}
              <div style={{ flex: '0 0 150px', minWidth: '135px' }}>
                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Line Total
                </label>
                <div
                  style={{
                    height: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    padding: '0 10px',
                    background: stagedItem ? '#ffffff' : '#f8fafc',
                    border: `1px solid ${stagedItem ? '#cbd5e1' : '#e2e8f0'}`,
                    borderRadius: '6px',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    color: stagedItem ? '#0284c7' : '#94a3b8',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textAlign: 'left',
                  }}
                  title={stagedItem ? `Rs. ${stagedItem.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Rs. 0.00'}
                >
                  Rs. {stagedItem ? stagedItem.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </div>
              </div>

              {/* Button to Add Items (Width: exactly 1 1/2 inches = 1.5in, pushed to far right, no + icon, no (Enter)) */}
              <div style={{ flex: '0 0 1.5in', width: '1.5in', minWidth: '1.5in', marginLeft: 'auto' }}>
                <button
                  type="button"
                  className={`btn erp-button ${stagedItem ? 'btn-primary' : 'btn-glass'}`}
                  onClick={handleAddStagedToTable}
                  disabled={savingBill || checkingBill || billCheckFailed || !stagedItem || Number(stagedItem.salesQty)>stagedItem.realQuantity || (stagedItem.quotaInfo?.quotaRestricted && Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0)}
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    whiteSpace: 'nowrap',
                    background: stagedItem ? '#0284c7' : '#f1f5f9',
                    color: stagedItem ? '#ffffff' : '#94a3b8',
                    border: `1px solid ${stagedItem ? '#0284c7' : '#cbd5e1'}`,
                    cursor: stagedItem ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s ease',
                    borderRadius: '6px',
                  }}
                  title={stagedItem ? "Add Product" : "Select a product from catalog first"}
                >
                  Add Product
                </button>
              </div>
            </div>
          </div>

          {/* 2. Added Products Table (Cart) (Scrollable internally with Delete icon in action col) */}
          <div
            className="erp-table-scroll erp-table-frame"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
            }}
          >
            <table className="erp-table pos-cart-table" style={{ width:'100%',minWidth:'740px',borderCollapse:'collapse',textAlign:'left' }}>
              <colgroup><col style={{width:'1.5in'}}/><col style={{width:'.5in'}}/><col/><col style={{width:'84px'}}/><col style={{width:'104px'}}/><col/><col style={{width:'86px'}}/></colgroup>
              <thead><tr>
                <th className="erp-table-heading" scope="col">Product</th>
                <th className="erp-table-heading pos-cart-numeric" scope="col">Qty</th>
                <th className="erp-table-heading pos-cart-numeric" scope="col">Unit price</th>
                <th className="erp-table-heading pos-cart-numeric" scope="col">Discount %</th>
                <th className="erp-table-heading pos-cart-numeric" scope="col">Discount</th>
                <th className="erp-table-heading pos-cart-numeric" scope="col">Line total</th>
                <th className="erp-table-heading erp-table-actions" scope="col">Actions</th>
              </tr></thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '48px 16px', color: '#94a3b8' }}>
                      <ShoppingCart size={32} style={{ opacity: 0.35, margin: '0 auto 8px auto', display: 'block' }} />
                      <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>Bill is currently empty</div>
                      <div style={{ fontSize: '0.76rem', marginTop: '2px' }}>
                        Search and select products to add items to this bill.
                      </div>
                    </td>
                  </tr>
                ) : (
                  cart.map((item,index) => (
                    <tr
                      key={item.id}
                      onClick={()=>setViewingCartItemId(item.id)}
                      onKeyDown={event=>{if(event.target===event.currentTarget && (event.key==='Enter' || event.key===' ')){event.preventDefault();setViewingCartItemId(item.id);}}}
                      tabIndex={0}
                      aria-label={`View ${item.name}`}
                      className="pos-cart-details-row"
                      style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.82rem' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td className="erp-table-cell">
                        <span className="pos-cart-product-name" title={[item.name,item.brandName,item.categoryName].filter(Boolean).join(' · ')}>{item.name}</span>
                        <span className="pos-cart-product-meta" title={item.sku}>{item.sku}</span>
                      </td>
                      <td className="erp-table-cell pos-cart-numeric">{item.quantity}</td>
                      <td className="erp-table-cell pos-cart-numeric" title={posMoney(item.unitPrice)}>{posMoney(item.unitPrice)}</td>
                      <td className="erp-table-cell pos-cart-numeric">{(Number(item.quantity)*Number(item.unitPrice)>0?Number(item.discountAmount || 0)*100/(Number(item.quantity)*Number(item.unitPrice)):0).toLocaleString(undefined,{maximumFractionDigits:2})}%</td>
                      <td className="erp-table-cell pos-cart-numeric" title={posMoney(item.discountAmount)}>{posMoney(item.discountAmount)}</td>
                      <td className="erp-table-cell pos-cart-numeric pos-cart-line-total" title={posMoney(item.total)}>{posMoney(item.total)}</td>

                      <td className="erp-table-cell erp-table-actions" onClick={event=>event.stopPropagation()}>
                        <div className="erp-row-actions">
                          <button type="button" className="erp-table-icon-action" title="Edit item quantity & discount" aria-label={`Edit ${item.name}`} disabled={savingBill || checkingBill || billCheckFailed} onClick={()=>handleOpenEditCartItem(item)}><Edit2 size={13}/></button>
                          <button type="button" className="erp-table-icon-action" data-tone="danger" title="Delete item" aria-label={`Delete ${item.name}`} disabled={savingBill || checkingBill || billCheckFailed} onClick={()=>requestCartRemoval(index)}><Trash2 size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {creditBlock && <div className="pos-credit-block" role="status"><span>{creditBlock} You can save this bill on hold. Final invoicing requires sufficient available credit.</span><button type="button" className="erp-button btn-glass" onClick={refreshCustomerCredit}>Refresh balance</button></div>}
          {/* 3. Single-Line Dock: Subtotal, Discount, Net Total, Clear, and Hold Bill (ALL IN ONE LINE) */}
          <div className="pos-bill-footer"
            style={{
              flexShrink: 0,
              padding: '10px 18px',
              borderTop: '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '24px',
              boxSizing: 'border-box',
              width: '100%',
              flexWrap: 'nowrap',
            }}
          >
            {/* Left: Subtotal, Total Table Discount, Net Total (Light, clean, breathable, no box) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '22px', flexWrap: 'nowrap', minWidth: 0, justifyContent: 'flex-start' }}>
              {/* Gross Subtotal */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', fontSize: '0.84rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 600 }}>Sub:</span>
                <strong style={{ color: '#0f172a', fontSize: '0.92rem', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}>
                  Rs. {grossSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>

              {/* Total Discount given for all products in table (No box, breathable) */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', fontSize: '0.84rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 600 }}>Disc:</span>
                <span
                  style={{
                    color: totalTableDiscount > 0 ? '#ef4444' : '#64748b',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {totalTableDiscount > 0
                    ? `-Rs. ${totalTableDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : 'Rs. 0.00'}
                </span>
              </div>

              {/* Net Total */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.2px' }}>NET:</span>
                <span
                  style={{
                    fontSize: '1.28rem',
                    fontWeight: 900,
                    color: '#0284c7',
                    fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Rs. {netTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Right: Clear Button & Save Onhold Bill Button (ALL IN ONE LINE) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              {/* Clear Cart Button (No trash icon) */}
              <button
                type="button"
                className="btn btn-glass btn-sm erp-button"
                onClick={clearCart}
                disabled={cart.length === 0 || savingBill || checkingBill || billCheckFailed}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  color: '#64748b',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  borderRadius: '6px',
                  cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
                }}
                title="Clear current bill"
              >
                Clear
              </button>

              {/* Save Onhold Bill Button (No icon, no F12) */}
              <button
                type="button"
                className="btn btn-primary erp-button erp-button-primary"
                onClick={handleHoldCart}
                disabled={loadingStockLimits || Boolean(stockLimitError) || !selectedCustomer || cart.length === 0 || isHoldingCart || savingBill || checkingBill || billCheckFailed}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  whiteSpace: 'nowrap',
                  background: '#0284c7',
                  borderColor: '#0284c7',
                  borderRadius: '6px',
                  cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
                }}
                title="Save bill to Onhold Bills"
              >
                Save Onhold Bill
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          POPUP MODAL: INVOICE COMPLETED & RECEIPT PRINT
         ───────────────────────────────────────────────────────────── */}


      {/* ─────────────────────────────────────────────────────────────
          HELD BILLS RESUME MODAL
         ───────────────────────────────────────────────────────────── */}
      {showHeldModal && <PosHeldBills activeBillId={activeBillId} busy={savingBill} user={user} onClose={()=>setShowHeldModal(false)}/>}

      {/* ─────────────────────────────────────────────────────────────
          CASHIER KPI / MOTIVATION CIRCLES MODAL
         ───────────────────────────────────────────────────────────── */}
      {activeCircleModal === 'my' && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
          onClick={() => setActiveCircleModal(null)}
        >
          <div
            className="glass-modal"
            style={{ width: 'min(720px, 96vw)', maxWidth: '720px', padding: '24px', borderRadius: '14px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#2563eb',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                    My Billing Performance
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                    Cashier: <strong>{user?.fullName || user?.username}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveCircleModal(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af' }}>BILLS HELD THIS MONTH</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#1d4ed8' }}>{myBillsCount}</div>
              </div>

              <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#166534' }}>TOTAL AMOUNT</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#15803d' }}>
                  Rs. {myTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ padding: '12px', background: '#faf5ff', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6b21a8' }}>AVERAGE BILL</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#7e22ce' }}>
                  Rs. {myAvgBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <button
                type="button"
                className="btn btn-secondary erp-button"
                onClick={() => setActiveCircleModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MONTHLY RANGE TIERS OVERVIEW MODAL
         ───────────────────────────────────────────────────────────── */}
      {showOutstandingModal && selectedCustomer && (
        <PosCustomerOutstandingModal
          isOpen={showOutstandingModal}
          customer={selectedCustomer}
          rangeInfo={monthlyRangeProgress || customerRanges[selectedCustomer.id]}
          onClose={() => setShowOutstandingModal(false)}
        />
      )}

      {showPerformance && <PosPerformanceDialog user={user} onClose={()=>setShowPerformance(false)}/>}

      {showMonthlyRangesModal && selectedCustomer && <PosRangeProgress customer={selectedCustomer} progress={monthlyRangeProgress} loading={loadingMonthlyRange} onClose={()=>setShowMonthlyRangesModal(false)}/>}

      {cartRemovalDialog}
      {showClearConfirmation && <RemovalDialog item={{name:`${cart.length} added products · ${posMoney(netTotal)}`}} title="Clear current bill?" description="Remove all added products from this bill and release their reserved stock?" confirmLabel="Clear bill" busy={savingBill} onClose={()=>setShowClearConfirmation(false)} onConfirm={confirmClearCart}/>}
      {showExitConfirmation && <RemovalDialog item={{name:`${cart.length} added products · ${posMoney(netTotal)}`}} icon={LogOut} title="Exit POS?" description="Discard this unfinished bill and release its reserved stock? POS will open with a new bill next time. Saved Onhold bills remain available." confirmLabel="Discard & Exit" busy={savingBill} onClose={()=>setShowExitConfirmation(false)} onConfirm={confirmExitPos}/>}
      {showBillRemarks && <PosBillRemarksDialog customerName={selectedCustomer?.name} total={netTotal} busy={isHoldingCart || savingBill} onClose={()=>{if(!holdingCartRef.current)setShowBillRemarks(false);}} onConfirm={submitHeldCart}/>}
      {savedBillToPrint && <HeldBillPrintDialog bill={savedBillToPrint} onClose={()=>{setSavedBillToPrint(null);catalogSearchInputRef.current?.focus();}} onPrinted={async()=>{setSavedBillToPrint(null);setProgressVersion(value=>value+1);await loadHeldInvoices();catalogSearchInputRef.current?.focus();}}/>}
      {viewedCartItem && <PosCartItemDetails item={viewedCartItem} busy={savingBill || checkingBill || billCheckFailed} onClose={()=>setViewingCartItemId(null)} onEdit={()=>{setViewingCartItemId(null);handleOpenEditCartItem(viewedCartItem);}} onDelete={()=>{setViewingCartItemId(null);requestCartRemoval(cart.findIndex(item=>item.id===viewedCartItem.id));}}/>}

      {editingCartItem && <PosLineEditor item={editingCartItem} busy={savingBill} onQty={handleEditCartItemQtyChange} onRate={handleEditCartItemDiscRateChange} onAmount={handleEditCartItemDiscAmtChange} onSave={handleSaveEditCartItem} onClose={closeCartItemEditor}/>}
    </div>
  );
}
