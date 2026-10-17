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
  staffQuotaApi,
  customerTargetApi,
  customerMonthlyRangeApi,
  printPdfDocument,
} from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import './PosView.css';
import PosRangeProgress, {RangeMeter, posMoney} from '../components/PosRangeProgress';
import PosHeldBills from '../components/PosHeldBills';
import PosLineEditor from '../components/PosLineEditor';
import {numberError} from '../utils/purchasingValidation';
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
  Edit3,
} from 'lucide-react';

export default function PosView({ onExitPos, initialHeldInvoice }) {
  const workspaceActive = useWorkspaceActive();
  const { addToast } = useToast();
  const { user } = useAuth();
  const isSupervisor = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_ADMIN') || user?.permissions?.includes('SALES_VIEW_ALL');

  const draftKey=`nbh_pos_working_bill_${user?.username || 'cashier'}`;
  const restoredDraft=useMemo(()=>{try{return JSON.parse(localStorage.getItem(draftKey) || 'null');}catch{return null;}},[draftKey]);
  const [activeBillId,setActiveBillId]=useState(restoredDraft?.invoiceId || null);
  const activeBillRef=useRef(restoredDraft?.invoiceId || null),savingBillRef=useRef(false);
  const [savingBill,setSavingBill]=useState(false);
  const [checkingBill,setCheckingBill]=useState(Boolean(restoredDraft?.invoiceId));
  const [billCheckFailed,setBillCheckFailed]=useState(false);
  const billVersionRef=useRef(restoredDraft?.recordVersion ?? null);
  const [customerRanges,setCustomerRanges]=useState({});
  const refreshSequence=useRef(0);
  const initialHeldHandled=useRef(null);
  const savedHeaderRef=useRef(null);
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

  // Staff Motivation / KPI Data
  const [cashierStats, setCashierStats] = useState([]);
  const [activeCircleModal, setActiveCircleModal] = useState(null); // 'my' | 'max' | 'all'
  const [selectedStaffForBills, setSelectedStaffForBills] = useState(null);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState(null);

  // Top Bar: Customer Selection & Details
  const [selectedCustomerId, setSelectedCustomerId] = useState(restoredDraft?.customerId || null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
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
  const [cart, setCart] = useState(restoredDraft?.cart || []);
  const [editingCartItem, setEditingCartItem] = useState(null);
  const subtotal = cart.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const [discountAmount, setDiscountAmount] = useState(restoredDraft?.discountAmount || 0);

  // Held Bills
  const [heldInvoices, setHeldInvoices] = useState([]);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [heldTab, setHeldTab] = useState('mine');

  // Customer Monthly Range & Targets State (Real-time live milestone projection)
  const [monthlyRangeProgress, setMonthlyRangeProgress] = useState(null);
  const [loadingMonthlyRange, setLoadingMonthlyRange] = useState(false);
  const [showMonthlyRangesModal, setShowMonthlyRangesModal] = useState(false);

  // Promotional Campaign Targets (V5)
  const [showTargetRangesModal, setShowTargetRangesModal] = useState(false);
  const [activeTargetForModal, setActiveTargetForModal] = useState(null);

  // Net calculations
  const discountVal = Math.min(subtotal, Math.max(0, Number(discountAmount) || 0));
  const netTotal = Math.max(0, subtotal - discountVal);

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

  // Auto-resume held bill if passed from Hold Bills nav
  useEffect(() => {
    if (initialHeldInvoice && warehouses.length > 0 && initialHeldHandled.current!==initialHeldInvoice.id) {
      initialHeldHandled.current=initialHeldInvoice.id;handleResumeInvoice(initialHeldInvoice);
    }
  }, [initialHeldInvoice, warehouses]);

  // The backend supplies month boundaries, saved-bill totals and milestone projections.
  const [progressVersion,setProgressVersion]=useState(0);
  useEffect(()=>{
    if(!selectedCustomerId){setMonthlyRangeProgress(null);return;}
    let alive=true;
    const load=async()=>{
      setLoadingMonthlyRange(true);
      try{
        const response=await salesApi.getPosProgress({customerId:selectedCustomerId,billId:activeBillId || undefined});
        const data=response.data?.data || response.data;
        if(alive){setMonthlyRangeProgress(data);if(data)setCustomerRanges(previous=>({...previous,[selectedCustomerId]:data}));}
      }catch{if(alive)setMonthlyRangeProgress(null);}
      finally{if(alive)setLoadingMonthlyRange(false);}
    };
    const timer=setTimeout(load,150);
    return()=>{alive=false;clearTimeout(timer);};
  },[selectedCustomerId,activeBillId,progressVersion]);

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
      const defaultCust = custList.find((c) => c.customerCode === 'CUST-0001') || custList[0];
      if (defaultCust) {
        setSelectedCustomerId(previous=>previous || defaultCust.id);
      }

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
      const res = await salesApi.getHeld().catch(() => ({ data: [] }));
      const apiHeld = res.data || [];
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
  };
  useDataSync(() => Promise.allSettled([refreshStock(),loadHeldInvoices(),loadStaffPerformance()]),
    ['erp:inventory_updated','erp:sales_updated'], [], ['inventory','sales','grn','gtn','prn']);
  useDataSync(() => loadInitialData(), ['erp:customers_updated'], [], ['customers','inventory']);
  useDataSync(() => setProgressVersion(value=>value+1), ['erp:targets_updated','erp:sales_updated'], [], ['targets','sales','customers']);
  useEffect(()=>{
    localStorage.setItem(draftKey,JSON.stringify({invoiceId:activeBillId,recordVersion:billVersionRef.current,cart,customerId:selectedCustomerId,discountAmount}));
  },[draftKey,activeBillId,cart,selectedCustomerId,discountAmount]);
  useEffect(()=>{
    if(!restoredDraft?.invoiceId)return;
    salesApi.getById(restoredDraft.invoiceId).then(response=>{
      const invoice=response.data?.data || response.data;
      if(invoice?.status==='HELD'){
        billVersionRef.current=invoice.recordVersion;
        savedHeaderRef.current={customerId:invoice.customerId,discountAmount:Number(invoice.discountAmount || 0)};
        if(invoice.recordVersion!==restoredDraft.recordVersion){setSelectedCustomerId(invoice.customerId);setDiscountAmount(Number(invoice.discountAmount || 0));}
        setCart((invoice.items || []).map((line,index)=>({id:`${line.productId}_${invoice.warehouseId}_${index}`,productId:line.productId,sku:line.productSku,name:line.productName,unitOfMeasure:line.unitOfMeasure,warehouseId:invoice.warehouseId,warehouseCode:invoice.warehouseCode,warehouseName:invoice.warehouseName,quantity:Number(line.quantity),unitPrice:Number(line.unitPrice),discountRate:Number(line.discountRate || 0),discountAmount:Number(line.discountAmount || 0),total:Number(line.totalPrice)})));
      } else if(invoice){setCart([]);setActiveBillId(null);activeBillRef.current=null;}

    }).catch(()=>{setBillCheckFailed(true);addToast('The saved bill could not be checked. Refresh before billing.','error');}).finally(()=>setCheckingBill(false));
  },[]);
  const billPayload=(lines,hold=true)=>({warehouseId:lines[0]?.warehouseId,customerId:selectedCustomerId,hold,reserveStock:true,expectedVersion:billVersionRef.current,taxRate:0,
    discountAmount:Math.min(lines.reduce((sum,line)=>sum+Number(line.total),0),Math.max(0,Number(discountAmount)||0)),
    items:lines.map(line=>({productId:line.productId,quantity:Number(line.quantity),unitPrice:Number(line.unitPrice),discountRate:Number(line.discountRate || 0),discountAmount:Number(line.discountAmount || 0)}))});
  const commitCart=async lines=>{
    if(savingBillRef.current || checkingBill || billCheckFailed)return false;
    savingBillRef.current=true;setSavingBill(true);
    try{
      if(lines.length){
        if(lines.some(line=>String(line.warehouseId)!==String(lines[0].warehouseId)))throw new Error('Use one warehouse per bill. Start another bill for a different warehouse.');
        const response=activeBillRef.current?await salesApi.savePosDraft(activeBillRef.current,billPayload(lines)):await salesApi.create(billPayload(lines));
        const invoice=response.data?.data || response.data;
        if(!invoice?.id)throw new Error('The server did not confirm the saved bill.');
        setProgressVersion(previous=>previous+1);activeBillRef.current=invoice.id;billVersionRef.current=invoice.recordVersion;savedHeaderRef.current={customerId:invoice.customerId ?? selectedCustomerId,discountAmount:Number(invoice.discountAmount || 0)};setActiveBillId(invoice.id);
        const confirmed=lines.map(line=>{const saved=invoice.items?.find(item=>String(item.productId)===String(line.productId));return saved?{...line,quantity:Number(saved.quantity),unitPrice:Number(saved.unitPrice),discountRate:Number(saved.discountRate || 0),discountAmount:Number(saved.discountAmount || 0),total:Number(saved.totalPrice)}:line;});
        localStorage.setItem(draftKey,JSON.stringify({invoiceId:invoice.id,recordVersion:invoice.recordVersion,cart:confirmed,customerId:selectedCustomerId,discountAmount}));setCart(confirmed);
      }else{
        if(activeBillRef.current)await salesApi.cancelHeld(activeBillRef.current);
        activeBillRef.current=null;setActiveBillId(null);setCart([]);setDiscountAmount(0);
      }
      await refreshStock().catch(()=>{});await loadHeldInvoices();return true;
    }catch(error){const message=error.response?.data?.message || error.message || 'Unable to save the bill.';if(message.includes('another session') || message.includes('Only held POS'))setBillCheckFailed(true);addToast(message,'error');await refreshStock().catch(()=>{});return false;}
    finally{savingBillRef.current=false;setSavingBill(false);}
  };
  useEffect(()=>{
    if(!activeBillId || !cart.length || savingBill || checkingBill || billCheckFailed)return;
    const saved=savedHeaderRef.current;
    if(saved && String(saved.customerId)===String(selectedCustomerId) && Number(saved.discountAmount)===discountVal)return;
    const timer=setTimeout(()=>commitCart(cart),500);
    return()=>clearTimeout(timer);
  },[selectedCustomerId,discountVal,activeBillId,cart,checkingBill]);
  const resetWorkingBill=()=>{activeBillRef.current=null;setActiveBillId(null);setCart([]);setDiscountAmount(0);setStagedItem(null);localStorage.removeItem(draftKey);};

  // Helper to find stock for a product in a given warehouse
  const getProductStockInWarehouse = (productId, warehouseId) => {
    const record = stockBalances.find(
      (b) => String(b.productId ?? b.product?.id) === String(productId) &&
             String(b.warehouseId ?? b.warehouse?.id) === String(warehouseId)
    );
    return record ? Number(record.availableQuantity ?? record.quantity ?? 0) : 0;
  };

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
  },[stockBalances]);

  // Helper for total product stock across all warehouses
  const getProductTotalStock = (productId) => {
    return warehouses.reduce((sum, wh) => sum + getProductStockInWarehouse(productId, wh.id), 0);
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
  }, [allProducts, catalogSearch, selectedCategoryFilter, selectedBrandFilter, inStockOnlyFilter, stockBalances, warehouses]);

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
    const whsWithStock = warehouses.filter((wh) => (!cart.length || String(wh.id)===String(cart[0].warehouseId)) && getProductStockInWarehouse(product.id, wh.id) > 0);

    const availableWhs = whsWithStock.length > 0
      ? whsWithStock
      : (product.warehouseId
          ? warehouses.filter((w) => w.id === product.warehouseId)
          : (warehouses.length > 0 ? [warehouses[0]] : []));

    const autoWarehouse = availableWhs[0] || warehouses[0] || null;
    const realQty = autoWarehouse ? getProductStockInWarehouse(product.id, autoWarehouse.id) : 0;

    const price = Number(product.sellingPrice || 0);
    const qty = 1;

    let quotaInfo = null;
    try {
      if (user?.id) {
        const qRes = await staffQuotaApi.check({
          productId: product.id,
          userId: user.id,
          warehouseId: autoWarehouse ? autoWarehouse.id : undefined,
          requestedQuantity: 1,
        });
        quotaInfo = qRes.data?.data || qRes.data || null;
      }
    } catch (e) {
      console.error('Failed to check staff quota in POS:', e);
    }

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
    const rate = Math.max(0, Math.min(100, parseFloat(rateVal) || 0));
    const gross = stagedItem.salesPrice * stagedItem.salesQty;
    const discAmt = parseFloat(((gross * rate) / 100).toFixed(2));
    const subtotal = Math.max(0, gross - discAmt);

    setStagedItem((prev) => ({
      ...prev,
      discountRate: rate,
      discountAmount: discAmt,
      subtotal,
    }));
  };

  const handleStagedDiscountAmountChange = (amtVal) => {
    if (!stagedItem) return;
    const gross = stagedItem.salesPrice * stagedItem.salesQty;
    const discAmt = Math.max(0, Math.min(gross, parseFloat(amtVal) || 0));
    const rate = gross > 0 ? parseFloat(((discAmt / gross) * 100).toFixed(2)) : 0;
    const subtotal = Math.max(0, gross - discAmt);

    setStagedItem((prev) => ({
      ...prev,
      discountRate: rate,
      discountAmount: discAmt,
      subtotal,
    }));
  };

  const handleStagedQtyChange = (qtyVal) => {
    if (!stagedItem) return;
    let maxLimit = stagedItem.realQuantity || 1;
    if (stagedItem.quotaInfo?.quotaRestricted) {
      const rem = Number(stagedItem.quotaInfo.remainingQuantity ?? 999999);
      maxLimit = Math.min(maxLimit, rem);
    }
    const maxStock = Math.max(1, maxLimit);
    const qty = Math.min(maxStock, Math.max(1, parseFloat(qtyVal) || 1));
    const gross = stagedItem.salesPrice * qty;
    const discAmt = stagedItem.discountRate > 0
      ? parseFloat(((gross * stagedItem.discountRate) / 100).toFixed(2))
      : stagedItem.discountAmount;
    const subtotal = Math.max(0, gross - discAmt);

    setStagedItem((prev) => ({
      ...prev,
      salesQty: qty,
      discountAmount: discAmt,
      subtotal,
    }));
  };

  const handleAddStagedToTable = async () => {
    if(!stagedItem || savingBillRef.current)return;
    const error=numberError(stagedItem.salesQty,'Quantity',{positive:true,decimals:2});if(error){addToast(error,'error');return;}
    const available=getProductStockInWarehouse(stagedItem.product.id,stagedItem.warehouseId);
    if(Number(stagedItem.salesQty)>available){addToast(`Only ${available} units are available. Refresh and lower the quantity.`,'error');return;}
    if(cart.length && String(cart[0].warehouseId)!==String(stagedItem.warehouseId)){addToast('Select the bill’s warehouse, or start a separate bill for this warehouse.','error');return;}
    const existing=cart.find(line=>String(line.productId)===String(stagedItem.product.id));
    const quantity=Number(stagedItem.salesQty)+Number(existing?.quantity || 0);
    if(stagedItem.quotaInfo?.quotaRestricted && quantity>Number(stagedItem.quotaInfo.remainingQuantity)){addToast('The quantity exceeds your remaining allocation.','error');return;}
    const item=existing?{...existing,quantity,discountRate:0,discountAmount:existing.discountAmount+stagedItem.discountAmount,total:Math.max(0,quantity*existing.unitPrice-existing.discountAmount-stagedItem.discountAmount)}:
      {id:`${stagedItem.product.id}_${stagedItem.warehouseId}`,productId:stagedItem.product.id,sku:stagedItem.product.sku,name:stagedItem.product.name,unitOfMeasure:stagedItem.product.unitOfMeasure,warehouseId:stagedItem.warehouseId,warehouseCode:stagedItem.warehouseCode,warehouseName:stagedItem.warehouseName,unitPrice:stagedItem.salesPrice,quantity,discountRate:stagedItem.discountRate,discountAmount:stagedItem.discountAmount,total:stagedItem.subtotal,availableQty:stagedItem.realQuantity,quotaInfo:stagedItem.quotaInfo};
    const next=existing?cart.map(line=>line.id===existing.id?item:line):[...cart,item];
    if(await commitCart(next)){setStagedItem(null);setCatalogSearch('');catalogSearchInputRef.current?.focus();}
  };

  const removeFromCart = (lineId) => {
    commitCart(cart.filter(item=>item.id!==lineId));
  };

  // Small Edit Popup Handlers for added product table
  const handleOpenEditCartItem = (item) => {
    setEditingCartItem({
      ...item,
      availableQty:Number(item.quantity)+getProductStockInWarehouse(item.productId,item.warehouseId),
      editQty: item.quantity,
      editDiscRate: item.discountRate || 0,
      editDiscAmt: item.discountAmount || 0,
      editTotal: item.total || 0,
    });
  };

  const handleEditCartItemQtyChange = (val) => {
    if (!editingCartItem) return;
    let maxStock = editingCartItem.availableQty || 999999;
    if (editingCartItem.quotaInfo?.quotaRestricted) {
      const rem = Number(editingCartItem.quotaInfo.remainingQuantity ?? 999999);
      maxStock = Math.min(maxStock, rem);
    }
    const newQty = val === '' ? '' : Math.min(maxStock, Math.max(0.01, parseFloat(val) || 0.01));
    const gross = newQty * editingCartItem.unitPrice;
    const disc = editingCartItem.editDiscRate > 0
      ? parseFloat(((gross * editingCartItem.editDiscRate) / 100).toFixed(2))
      : Math.min(gross, editingCartItem.editDiscAmt);
    const total = Math.max(0, gross - disc);

    setEditingCartItem((prev) => ({
      ...prev,
      editQty: newQty,
      editDiscAmt: disc,
      editTotal: total,
    }));
  };

  const handleEditCartItemDiscRateChange = (val) => {
    if (!editingCartItem) return;
    const rate = Math.max(0, Math.min(100, parseFloat(val) || 0));
    const gross = editingCartItem.editQty * editingCartItem.unitPrice;
    const discAmt = parseFloat(((gross * rate) / 100).toFixed(2));
    const total = Math.max(0, gross - discAmt);

    setEditingCartItem((prev) => ({
      ...prev,
      editDiscRate: rate,
      editDiscAmt: discAmt,
      editTotal: total,
    }));
  };

  const handleEditCartItemDiscAmtChange = (val) => {
    if (!editingCartItem) return;
    const gross = editingCartItem.editQty * editingCartItem.unitPrice;
    const discAmt = Math.max(0, Math.min(gross, parseFloat(val) || 0));
    const rate = gross > 0 ? parseFloat(((discAmt / gross) * 100).toFixed(2)) : 0;
    const total = Math.max(0, gross - discAmt);

    setEditingCartItem((prev) => ({
      ...prev,
      editDiscRate: rate,
      editDiscAmt: discAmt,
      editTotal: total,
    }));
  };

  const handleSaveEditCartItem = async () => {
    if(!editingCartItem)return;
    const error=numberError(editingCartItem.editQty,'Quantity',{positive:true,decimals:2});if(error){addToast(error,'error');return;}
    const next=cart.map(item=>item.id===editingCartItem.id?{...item,quantity:editingCartItem.editQty,discountRate:editingCartItem.editDiscRate,discountAmount:editingCartItem.editDiscAmt,total:editingCartItem.editTotal}:item);
    if(await commitCart(next))setEditingCartItem(null);
  };
  const clearCart=async()=>{if(cart.length && window.confirm('Clear this bill and release its reserved stock?')){if(await commitCart([]))setStagedItem(null);}};

  // Hold Bill Handler (Primary Action in Flow)
  const handleHoldCart=async()=>{
    if(!cart.length || savingBillRef.current)return;
    setIsHoldingCart(true);
    try{if(await commitCart(cart)){resetWorkingBill();await loadHeldInvoices();catalogSearchInputRef.current?.focus();}}
    finally{setIsHoldingCart(false);}
  };

  // Resume Held Invoice
  const handleResumeInvoice = async (heldInv) => {
    if(savingBillRef.current)return;
    if(cart.length && String(activeBillRef.current)!==String(heldInv.id)){addToast('Hold or clear the current bill before resuming another.','error');return;}
    savingBillRef.current=true;setSavingBill(true);
    try {
      const fetched=await salesApi.getById(heldInv.id), fresh=fetched.data?.data || fetched.data;
      if(fresh?.status!=='HELD')throw new Error('This bill is no longer held.');
      const response=await salesApi.savePosDraft(fresh.id,{warehouseId:fresh.warehouseId,customerId:fresh.customerId,hold:true,reserveStock:true,expectedVersion:fresh.recordVersion,discountAmount:Number(fresh.discountAmount || 0),taxRate:Number(fresh.taxRate || 0),items:fresh.items.map(line=>({productId:line.productId,quantity:Number(line.quantity),unitPrice:Number(line.unitPrice),discountRate:Number(line.discountRate || 0),discountAmount:Number(line.discountAmount || 0)}))});
      const invoice=response.data?.data || response.data;
      const lines=invoice.items.map((line,index)=>({id:`${line.productId}_${invoice.warehouseId}_${index}`,productId:line.productId,sku:line.productSku,name:line.productName,unitOfMeasure:line.unitOfMeasure,warehouseId:invoice.warehouseId,warehouseCode:invoice.warehouseCode,warehouseName:invoice.warehouseName,quantity:Number(line.quantity),unitPrice:Number(line.unitPrice),discountRate:Number(line.discountRate || 0),discountAmount:Number(line.discountAmount || 0),total:Number(line.totalPrice)}));
      setProgressVersion(previous=>previous+1);activeBillRef.current=invoice.id;billVersionRef.current=invoice.recordVersion;savedHeaderRef.current={customerId:invoice.customerId ?? selectedCustomerId,discountAmount:Number(invoice.discountAmount || 0)};setActiveBillId(invoice.id);setCart(lines);setSelectedCustomerId(invoice.customerId);setDiscountAmount(Number(invoice.discountAmount || 0));
      await refreshStock().catch(()=>{});await loadHeldInvoices();setShowHeldModal(false);catalogSearchInputRef.current?.focus();
    }catch(error){addToast(error.response?.data?.message || error.message || 'Unable to resume bill.','error');}
    finally{savingBillRef.current=false;setSavingBill(false);}
  };

  const handleOpenMonthlyRangeModal = () => setShowMonthlyRangesModal(true);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handlePosKeys = (e) => {
      if (!workspaceActive) return;

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
        if (cart.length > 0 && !showHeldModal && !activeCircleModal) {
          e.preventDefault();
          handleHoldCart();
        }
        return;
      }

      // Escape: Close active modals or unstage or exit POS
      if (e.key === 'Escape') {
        if (editingCartItem) {
          setEditingCartItem(null);
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
          onExitPos();
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
    selectedInvoiceDetail,
    showMonthlyRangesModal,
    showTargetRangesModal,
    selectedCustomerId,discountVal,savingBill,checkingBill,billCheckFailed,
    onExitPos,
  ]);

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
        {/* Left: Customer Selection with Inline Financial Badges */}
        <div className="pos-customer-tools" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '280px', flex: '0 0 auto', position: 'relative' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <User size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#2563eb' }} />
            <input
              ref={customerSearchInputRef}
              type="text"
              className="input-glass erp-field"
              placeholder="Select Customer (F1)..."
              value={
                showCustomerSearch
                  ? customerSearchQuery
                  : selectedCustomer
                  ? `${selectedCustomer.name}${selectedCustomer.address ? ` — ${selectedCustomer.address}` : ''}`
                  : ''
              }
              onFocus={() => {
                setShowCustomerSearch(true);
                setCustomerSearchQuery('');
              }}
              onChange={(e) => {
                setShowCustomerSearch(true);
                setCustomerSearchQuery(e.target.value);
              }}
              onKeyDown={handleCustomerSearchKeyDown}
              style={{
                paddingLeft: '30px',
                fontWeight: 600,
                width: '100%',
                height: '32px',
                fontSize: '0.82rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
              }}
            />
          </div>

          {showCustomerSearch ? (
            <button
              type="button"
              className="btn btn-glass btn-sm erp-button"
              onClick={() => setShowCustomerSearch(false)}
              style={{ height: '32px', padding: '0 8px' }}
              title="Cancel search"
            >
              <X size={12} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-glass btn-sm erp-button"
              onClick={() => {
                setShowCustomerSearch(true);
                setCustomerSearchQuery('');
                customerSearchInputRef.current?.focus();
              }}
              title="Change Customer (F1)"
              style={{ height: '32px', padding: '0 8px', gap: '4px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
            >
              <RefreshCw size={11} /> Change
            </button>
          )}

          {/* Customer Search Autocomplete Dropdown */}
          {showCustomerSearch && (
            <div
              style={{
                position: 'absolute',
                top: '38px',
                left: 0,
                width: '360px',
                maxWidth: '92vw',
                zIndex: 500,
                maxHeight: '280px',
                overflowY: 'auto',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                boxShadow: 'none',
                padding: '4px 0',
                borderRadius: '6px',
              }}
            >
              {filteredCustomers.length === 0 ? (
                <div style={{ padding: '12px 14px', textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>
                  No customer matching query
                </div>
              ) : (
                filteredCustomers.slice(0,15).map((c, idx) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomerId(c.id);
                      setShowCustomerSearch(false);
                      setCustomerSearchQuery('');

                      setTimeout(() => {
                        catalogSearchInputRef.current?.focus();
                        catalogSearchInputRef.current?.select();
                      }, 50);
                    }}
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f1f5f9',
                      background: idx === customerHighlightedIndex ? '#dbeafe' : c.id === selectedCustomerId ? '#eff6ff' : 'transparent',
                    }}
                    onMouseEnter={() => setCustomerHighlightedIndex(idx)}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.84rem' }}>{c.name}</div><div className="pos-muted">Range: {customerRanges[c.id]?.currentRangeName || '—'}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {c.address ? `${c.address} ` : ''}{c.phone ? `• ${c.phone}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: Number(c.currentBalance) > 0 ? '#ef4444' : '#16a34a', fontSize: '0.8rem' }}>
                        Rs. {Number(c.currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Customer Financial Badges */}
          {selectedCustomer && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem' }}>
              <div
                style={{
                  padding: '2px 7px',
                  borderRadius: '5px',
                  background: custOutstanding > 0 ? '#fef2f2' : '#f0fdf4',
                  border: `1px solid ${custOutstanding > 0 ? '#fca5a5' : '#86efac'}`,
                  color: custOutstanding > 0 ? '#b91c1c' : '#15803d',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
                title="Outstanding Due"
              >
                Due: Rs. {custOutstanding.toLocaleString()}
              </div>

              <div
                style={{
                  padding: '2px 7px',
                  borderRadius: '5px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
                title="Credit Limit"
              >
                Limit: Rs. {custCreditLimit.toLocaleString()}
              </div>


            </div>
          )}
        </div>

        <button type="button" className="pos-range-preview" onClick={handleOpenMonthlyRangeModal} title="View all ranges and campaign targets">
          <div className="pos-range-heading"><span>Current range</span><strong>{monthlyRangeProgress?.currentRangeName || '—'}</strong><ChevronDown size={13}/></div>
          {monthlyRangeProgress?.nextRange && !monthlyRangeProgress.highestRange?<><RangeMeter milestone={monthlyRangeProgress.nextRange} label="Next monthly range"/><small>{posMoney(monthlyRangeProgress.nextRange.remaining)} to {monthlyRangeProgress.nextRangeName}</small></>:<small>{loadingMonthlyRange?'Loading progress…':monthlyRangeProgress?'Highest range reached':'View ranges & targets'}</small>}
        </button>

        {/* Right: Held Bills Button + Clean Exit */}
        <div className="pos-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Held Bills Button (Contains held bills count) */}
          <button
            type="button"
            className="btn btn-glass btn-sm erp-button"
            onClick={() => setShowHeldModal(true)}
            style={{
              height: '32px',
              padding: '0 12px',
              gap: '6px',
              color: heldInvoices.length > 0 ? '#d97706' : '#475569',
              borderColor: heldInvoices.length > 0 ? '#fde68a' : '#cbd5e1',
              backgroundColor: heldInvoices.length > 0 ? '#fffbeb' : '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 700,
            }}
            title="Inspect Held Bills"
          >
            <PauseCircle size={14} />
            Held Bills ({heldInvoices.length})
          </button>

          <div style={{ height: '18px', width: '1px', background: '#e2e8f0' }} />

          {/* Subtle Clean Exit Button */}
          {onExitPos && (
            <button
              type="button"
              className="btn btn-sm erp-button"
              onClick={onExitPos}
              style={{
                height: '32px',
                padding: '0 10px',
                gap: '4px',
                color: '#dc2626',
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
              title="Exit POS Mode (Esc)"
            >
              <LogOut size={12} /> Exit
            </button>
          )}
        </div>
      </header>
      {checkingBill || billCheckFailed?<div className="pos-save-status" role="status">{checkingBill?'Restoring saved bill…':'Reload the saved bill before making further changes.'}{billCheckFailed?<button type="button" className="btn btn-secondary erp-button" onClick={()=>window.location.reload()}>Reload bill</button>:null}</div>:null}

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
            flex: '0 0 calc(46% - 1.5in)',
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
            {/* Compact Search Input Bar with Little Text */}
            <div style={{ position: 'relative', flex: 1, minWidth: '110px' }}>
              <Search size={13} style={{ position: 'absolute', left: '8px', top: '7.5px', color: '#94a3b8' }} />
              <input
                ref={catalogSearchInputRef}
                type="text"
                className="input-glass erp-field"
                style={{
                  width: '100%',
                  height: '28px',
                  paddingLeft: '26px',
                  paddingRight: catalogSearch ? '24px' : '6px',
                  fontSize: '0.74rem',
                  borderRadius: '5px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                }}
                placeholder="Search product code..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                onKeyDown={handleCatalogSearchKeyDown}
              />
              {catalogSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setCatalogSearch('');
                    catalogSearchInputRef.current?.focus();
                  }}
                  style={{
                    position: 'absolute',
                    right: '5px',
                    top: '6px',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Brand Filter Dropdown */}
            <div style={{ flex: '0 0 90px', minWidth: '80px' }}>
              <select
                className="input-glass erp-field"
                style={{
                  width: '100%',
                  height: '28px',
                  padding: '2px 4px',
                  fontSize: '0.72rem',
                  borderRadius: '5px',
                  fontWeight: 600,
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                }}
                aria-label="Brand"
                value={selectedBrandFilter}
                onChange={(e) => setSelectedBrandFilter(e.target.value)}
              >
                <option value="">Brand</option>
                {brands.map((b) => (
                  <option key={`brand-${b.id}`} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Category Filter Dropdown */}
            <div style={{ flex: '0 0 100px', minWidth: '85px' }}>
              <select
                className="input-glass erp-field"
                style={{
                  width: '100%',
                  height: '28px',
                  padding: '2px 4px',
                  fontSize: '0.72rem',
                  borderRadius: '5px',
                  fontWeight: 600,
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                }}
                aria-label="Category"
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              >
                <option value="">Category</option>
                {categories.map((cat) => (
                  <option key={`cat-${cat.id}`} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>


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
              gap: '6px',
            }}
          >
            {loadingData ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.86rem' }}>
                <RefreshCw size={20} className="erp-spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                Loading inventory catalog...
              </div>
            ) : filteredProducts.length === 0 ? (
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
                      height: '0.5in',
                      minHeight: '0.5in',
                      maxHeight: '0.5in',
                      padding: '0 10px',
                      borderRadius: '6px',
                      border: isSelected
                        ? '1.5px solid #0284c7'
                        : isHighlighted
                        ? '1.5px solid #0284c7'
                        : '1px solid #f1f5f9',
                      background: isSelected
                        ? '#eff6ff'
                        : isHighlighted
                        ? '#f0f9ff'
                        : isOutOfStock
                        ? '#fff1f2'
                        : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                      opacity: isOutOfStock ? 0.6 : 1,
                      transition: 'all 0.1s ease',
                      boxShadow: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Product Details (Compact 1/2 inch fit) */}
                    <div style={{ minWidth: 0, flex: 1, paddingRight: '8px', lineHeight: 1.15 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </span>
                        {p.unitOfMeasure && (
                          <span style={{ fontSize: '0.64rem', color: '#64748b', background: '#f1f5f9', padding: '0 4px', borderRadius: '3px', flexShrink: 0 }}>
                            {p.unitOfMeasure}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: '#64748b', marginTop: '1px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>{p.sku}</span>
                        {p.brandName && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>• {p.brandName}</span>}
                        {p.categoryName && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>• {p.categoryName}</span>}
                      </div>
                    </div>

                    {/* Stock Status Badge & Price */}
                    <div style={{ textAlign: 'right', flexShrink: 0, lineHeight: 1.15 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.86rem', color: isOutOfStock ? '#94a3b8' : '#2563eb' }}>
                        Rs. {Number(p.sellingPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>

                      <div style={{ marginTop: '1px' }}>
                        {isOutOfStock ? (
                          <span style={{ fontSize: '0.64rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                            Out (0)
                          </span>
                        ) : isLowStock ? (
                          <span style={{ fontSize: '0.64rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', backgroundColor: '#fef3c7', color: '#b45309' }}>
                            Low ({totalStock})
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.64rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', backgroundColor: '#dcfce7', color: '#15803d' }}>
                            Stock ({totalStock})
                          </span>
                        )}
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
            {/* Header row: Product Title, SKU & Cancel */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '22px', marginBottom: stagedItem?.quotaInfo?.quotaRestricted ? '4px' : '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                <Package size={15} color={stagedItem ? '#0284c7' : '#94a3b8'} style={{ flexShrink: 0 }} />
                <span
                  style={{
                    fontWeight: stagedItem ? 700 : 500,
                    fontSize: '0.86rem',
                    color: stagedItem ? '#0f172a' : '#64748b',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {stagedItem ? stagedItem.product.name : 'Select product from catalog (or press F2)'}
                </span>
                {stagedItem ? (
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: '#0369a1',
                      background: '#e0f2fe',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      border: '1px solid #bae6fd',
                      flexShrink: 0,
                    }}
                  >
                    {stagedItem.product.sku}
                  </span>
                ) : (
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
                  Quota Active: {stagedItem.quotaInfo.remainingQuantity} items remaining of {stagedItem.quotaInfo.allocatedQuantity} allocated
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
                  value={stagedItem ? stagedItem.salesQty : 1}
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
                  value={stagedItem ? (stagedItem.discountRate || '') : ''}
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
                  value={stagedItem ? (stagedItem.discountAmount || '') : ''}
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

              {/* Button to Add Items (Width: exactly 2 inches = 2in, pushed to far right) */}
              <div style={{ flex: '0 0 2in', width: '2in', minWidth: '2in', marginLeft: 'auto' }}>
                <button
                  type="button"
                  className={`btn erp-button ${stagedItem ? 'btn-primary' : 'btn-glass'}`}
                  onClick={handleAddStagedToTable}
                  disabled={savingBill || checkingBill || billCheckFailed || !stagedItem || Number(stagedItem.salesQty)>stagedItem.realQuantity || (stagedItem.quotaInfo?.quotaRestricted && Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0)}
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    whiteSpace: 'nowrap',
                    background: stagedItem ? '#0284c7' : '#f1f5f9',
                    color: stagedItem ? '#ffffff' : '#94a3b8',
                    border: `1px solid ${stagedItem ? '#0284c7' : '#cbd5e1'}`,
                    cursor: stagedItem ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s ease',
                  }}
                  title={stagedItem ? "Add Product (Enter)" : "Select a product from catalog first"}
                >
                  <Plus size={15} /> Add Product
                  {stagedItem && (
                    <span style={{ fontSize: '0.7rem', opacity: 0.85, fontWeight: 600, marginLeft: '2px' }}>
                      (Enter)
                    </span>
                  )}
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
            <table className="erp-table" style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fafbfc' }}>
                <tr style={{ borderBottom: '1px solid #e2e8f0', fontSize: '0.74rem' }}>
                  <th className="erp-table-heading" style={{ width: '105px', padding: '8px 10px' }}>SKU</th>
                  <th className="erp-table-heading" style={{ padding: '8px 10px' }}>PRODUCT NAME</th>
                  <th className="erp-table-heading" style={{ textAlign: 'right', width: '120px', padding: '8px 10px' }}>PRICE</th>
                  <th className="erp-table-heading" style={{ textAlign: 'center', width: '130px', padding: '8px 10px' }}>QTY</th>
                  <th className="erp-table-heading" style={{ textAlign: 'right', width: '120px', padding: '8px 10px' }}>DISC</th>
                  <th className="erp-table-heading" style={{ textAlign: 'right', width: '145px', padding: '8px 10px' }}>TOTAL</th>
                  <th className="erp-table-heading" style={{ textAlign: 'center', width: '44px', padding: '8px 6px' }}>ACTION</th>
                </tr>
              </thead>
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
                  cart.map((item) => (
                    <tr
                      key={item.id}
                      style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.82rem' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td className="erp-table-cell erp-table-code" style={{ padding: '6px 10px', fontWeight: 600, color: '#0284c7' }}>
                        {item.sku}
                      </td>

                      <td className="erp-table-cell" style={{ padding: '6px 10px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
                        {item.unitOfMeasure && (
                          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Unit: {item.unitOfMeasure}</span>
                        )}
                      </td>

                      <td className="erp-table-cell" style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 600, color: '#334155' }}>
                        Rs. {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="erp-table-cell" style={{ padding: '6px 10px', textAlign: 'left' }}>
                        {item.quantity}
                      </td>

                      <td className="erp-table-cell" style={{ textAlign: 'right', padding: '6px 10px', color: item.discountAmount > 0 ? '#ef4444' : '#64748b' }}>
                        {item.discountAmount > 0 ? `-Rs. ${item.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </td>

                      <td className="erp-table-cell" style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 800, color: '#0f172a' }}>
                        Rs. {item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="erp-table-cell erp-table-actions" style={{ textAlign: 'center', padding: '6px 6px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditCartItem(item);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#0284c7',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: '2px',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e0f2fe')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          title="Edit item quantity & discount"
                          className="erp-table-icon-action" disabled={savingBill}
                          aria-label={`Edit ${item.name}`}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromCart(item.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ef4444',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fee2e2')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          title="Delete item"
                          className="erp-table-icon-action" data-tone="danger" disabled={savingBill}
                          aria-label={`Delete ${item.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 3. Single-Line Dock: Subtotal, Discount, Net Total, Clear, and Add to Hold Bill (ALL IN ONE LINE) */}
          <div className="pos-bill-footer"
            style={{
              flexShrink: 0,
              padding: '8px 16px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              boxSizing: 'border-box',
              width: '100%',
              flexWrap: 'nowrap',
            }}
          >
            {/* Left: Subtotal, Bill Discount, Net Total (Left aligned, clean textboxes, no arrows) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'nowrap', minWidth: 0, justifyContent: 'flex-start' }}>
              {/* Subtotal */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', fontSize: '0.82rem', color: '#475569', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 600 }}>Sub:</span>
                <strong style={{ color: '#0f172a', fontSize: '0.88rem', fontFamily: 'monospace' }}>
                  Rs. {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>

              {/* Discount (Clean left-aligned textbox, no arrows) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#475569', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 600 }}>Disc:</span>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '7px', top: '5.5px', fontSize: '0.72rem', color: '#94a3b8' }}>Rs.</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="input-glass erp-field no-spin-arrows"
                    style={{ width: '135px', height: '28px', paddingLeft: '26px', paddingRight: '8px', textAlign: 'left', fontWeight: 700, fontSize: '0.82rem', border: '1px solid #cbd5e1', background: '#ffffff', MozAppearance: 'textfield' }}
                    value={discountAmount || ''}
                    placeholder="0.00"
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Net Total */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>NET:</span>
                <span
                  style={{
                    fontSize: '1.24rem',
                    fontWeight: 900,
                    color: '#0284c7',
                    fontFamily: 'var(--font-heading, system-ui)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Rs. {netTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Right: Clear Button & Add to Hold Bill Button (ALL IN ONE LINE) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {/* Clear Cart Button */}
              <button
                type="button"
                className="btn btn-glass btn-sm erp-button"
                onClick={clearCart}
                disabled={cart.length === 0 || savingBill || checkingBill || billCheckFailed}
                style={{ height: '32px', padding: '0 10px', gap: '4px', color: '#64748b', fontSize: '0.78rem', border: '1px solid #cbd5e1', background: '#ffffff' }}
                title="Clear current bill"
              >
                <Trash2 size={13} /> Clear
              </button>

              {/* Add to Hold Bill Button (Primary Action) */}
              <button
                type="button"
                className="btn btn-primary erp-button erp-button-primary"
                onClick={handleHoldCart}
                disabled={cart.length === 0 || isHoldingCart || savingBill || checkingBill || billCheckFailed}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  whiteSpace: 'nowrap',
                  background: '#0284c7',
                  borderColor: '#0284c7',
                }}
                title="Save bill to On-Hold bills (F12 or F5)"
              >
                <PauseCircle size={15} /> Hold Bill (F12)
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
      {showHeldModal && <PosHeldBills activeBillId={activeBillId} busy={savingBill} onResume={handleResumeInvoice} onClose={()=>setShowHeldModal(false)}/>}

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
      {showMonthlyRangesModal && <PosRangeProgress customer={selectedCustomer} progress={monthlyRangeProgress} loading={loadingMonthlyRange} onClose={()=>setShowMonthlyRangesModal(false)}/>}

      {editingCartItem && <PosLineEditor item={editingCartItem} busy={savingBill} onQty={handleEditCartItemQtyChange} onRate={handleEditCartItemDiscRateChange} onAmount={handleEditCartItemDiscAmtChange} onSave={handleSaveEditCartItem} onClose={()=>setEditingCartItem(null)}/>}
    </div>
  );
}
