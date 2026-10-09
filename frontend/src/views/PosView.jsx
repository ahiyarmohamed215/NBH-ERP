import { useWorkspaceActive } from '../components/RetainedWorkspaces';
import React, { useState, useEffect, useRef } from 'react';
import { productApi, warehouseApi, customerApi, salesApi, inventoryApi, pdfApi, staffQuotaApi, customerTargetApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';
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
  Download,
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
  ChevronRight,
  Target,
  Sparkles,
  Zap,
} from 'lucide-react';

export default function PosView({ onExitPos, initialHeldInvoice }) {
  const workspaceActive = useWorkspaceActive();
  const { addToast } = useToast();
  const { user } = useAuth();
  const isSupervisor = user?.roles?.includes('ROLE_ADMIN') || user?.permissions?.includes('SALES_VIEW_ALL');

  // Master Data
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [stockBalances, setStockBalances] = useState([]);
  const [isHoldingCart, setIsHoldingCart] = useState(false);

  // Staff Motivation / KPI Data
  const [cashierStats, setCashierStats] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]);
  const [activeCircleModal, setActiveCircleModal] = useState(null); // 'my' | 'max' | 'all'
  const [selectedStaffForBills, setSelectedStaffForBills] = useState(null);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState(null);
  const [staffModalSearch, setStaffModalSearch] = useState('');

  // Flow Step 1: Customer Selection & Financial Summary
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  // Flow Step 2 & 3: Product Search & Staging
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [stagedItem, setStagedItem] = useState(null);
  const searchInputRef = useRef(null);

  // Flow Step 4: Sales Order Table
  const [cart, setCart] = useState([]);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Held Bills
  const [heldInvoices, setHeldInvoices] = useState([]);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [heldTab, setHeldTab] = useState('mine');

  // Customer Range & Targets State in POS
  const [customerTargets, setCustomerTargets] = useState([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [showTargetRangesModal, setShowTargetRangesModal] = useState(false);
  const [activeTargetForModal, setActiveTargetForModal] = useState(null);

  // Fetch Customer Range & Targets whenever selected customer changes
  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerTargets([]);
      return;
    }
    let isCurrent = true;
    setLoadingTargets(true);
    customerTargetApi
      .getCustomerProgress(selectedCustomerId)
      .then((res) => {
        if (!isCurrent) return;
        const list = res?.data?.data || res?.data || [];
        setCustomerTargets(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        console.error('Error loading customer targets in POS:', err);
      })
      .finally(() => {
        if (isCurrent) setLoadingTargets(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [selectedCustomerId]);

  // Sync targets on event bus updates
  useEffect(() => {
    const handleTargetSync = () => {
      if (selectedCustomerId) {
        customerTargetApi
          .getCustomerProgress(selectedCustomerId)
          .then((res) => {
            const list = res?.data?.data || res?.data || [];
            setCustomerTargets(Array.isArray(list) ? list : []);
          })
          .catch(() => {});
      }
    };
    window.addEventListener('erp:targets_updated', handleTargetSync);
    window.addEventListener('erp:sales_updated', handleTargetSync);
    return () => {
      window.removeEventListener('erp:targets_updated', handleTargetSync);
      window.removeEventListener('erp:sales_updated', handleTargetSync);
    };
  }, [selectedCustomerId]);

  useEffect(() => {
    loadInitialData();
    loadHeldInvoices();
    loadStaffPerformance();
  }, []);

  // Auto-resume held bill if passed from Hold Bills nav
  useEffect(() => {
    if (initialHeldInvoice && warehouses.length > 0) {
      handleResumeInvoice(initialHeldInvoice);
    }
  }, [initialHeldInvoice, warehouses]);

  const loadInitialData = async () => {
    try {
      const [whRes, custRes, balancesRes] = await Promise.all([
        warehouseApi.getActive(),
        customerApi.getActive(),
        inventoryApi.getBalances({ size: 1000 }).catch(() => ({ data: [] })),
      ]);

      const whList = whRes.data || [];
      setWarehouses(whList);

      const custList = custRes.data || [];
      setCustomers(custList);
      const defaultCust = custList.find((c) => c.customerCode === 'CUST-0001') || custList[0];
      if (defaultCust) {
        setSelectedCustomerId(defaultCust.id);
      }

      const balancesList = balancesRes.data?.content || balancesRes.data || [];
      setStockBalances(balancesList);
    } catch (err) {
      addToast('Error loading master data: ' + err.message, 'error');
    }
  };

  const loadHeldInvoices = async () => {
    try {
      const res = await salesApi.getHeld().catch(() => ({ data: [] }));
      const apiHeld = res.data || [];
      setHeldInvoices(apiHeld);
    } catch (e) {
      console.error('Failed to load held bills:', e);
    }
  };

  const loadStaffPerformance = async () => {
    try {
      const [summaryRes, invoicesRes] = await Promise.all([
        salesApi.getCashierSalesSummary().catch(() => ({ data: [] })),
        salesApi.search({ size: 200 }).catch(() => ({ data: [] })),
      ]);

      const cList = summaryRes.data || [];
      setCashierStats(cList);

      const invList = invoicesRes.data?.content || invoicesRes.data || [];
      setAllInvoices(invList);
    } catch (err) {
      console.error('Failed to load cashier performance data', err);
    }
  };

  // Helper to find stock for a product in a given warehouse
  const getProductStockInWarehouse = (productId, warehouseId) => {
    const record = stockBalances.find(
      (b) => b.productId === productId && b.warehouseId === warehouseId
    );
    return record ? Number(record.availableQuantity || 0) : 0;
  };

  // Selected Customer
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;
  const filteredCustomers = customerSearchQuery
    ? customers.filter(
        (c) =>
          c.name?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
          c.customerCode?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
          c.phone?.includes(customerSearchQuery)
      )
    : customers.slice(0, 10);

  // Customer Financial Metrics Calculations (Compact details)
  const custOutstanding = Number(selectedCustomer?.currentBalance || 0);
  const custCreditLimit = Number(selectedCustomer?.creditLimit || 0);
  const custAvailableCredit = Math.max(0, custCreditLimit - custOutstanding);
  const custCreditUsagePct =
    custCreditLimit > 0 ? Math.min(100, Math.round((custOutstanding / custCreditLimit) * 100)) : 0;

  let creditStatusBadge = { text: 'Healthy', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' };
  if (custOutstanding > custCreditLimit && custCreditLimit > 0) {
    creditStatusBadge = { text: 'Exceeded', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' };
  } else if (custCreditUsagePct >= 80 && custCreditLimit > 0) {
    creditStatusBadge = { text: 'Near Limit', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' };
  }

  // -------------------------------------------------------------
  // Motivation Circles Calculations
  // -------------------------------------------------------------
  const currentUsername = user?.username || 'admin';
  const myStat = cashierStats.find((c) => c.username === currentUsername) || null;
  const myInvoices = allInvoices.filter((inv) => inv.createdBy === currentUsername);

  const myBillsCount = myStat
    ? Number(myStat.completedInvoicesCount || 0)
    : myInvoices.length;
  const myTotalAmount = myStat
    ? Number(myStat.totalSalesAmount || 0)
    : myInvoices.reduce((sum, inv) => sum + Number(inv.netTotal || 0), 0);
  const myAvgBill = myBillsCount > 0 ? myTotalAmount / myBillsCount : 0;
  const myHeldCount = heldInvoices.filter((h) => h.createdBy === currentUsername).length;

  // Max / Top record calculation
  let maxBillsCount = 0;
  let maxSalesAmount = 0;
  let topCashierName = 'Top Cashier';

  if (cashierStats.length > 0) {
    cashierStats.forEach((c) => {
      const sales = Number(c.totalSalesAmount || 0);
      const bills = Number(c.completedInvoicesCount || 0);
      if (sales > maxSalesAmount) {
        maxSalesAmount = sales;
        topCashierName = c.fullName || c.username;
      }
      if (bills > maxBillsCount) {
        maxBillsCount = bills;
      }
    });
  } else if (allInvoices.length > 0) {
    maxBillsCount = allInvoices.length;
    maxSalesAmount = allInvoices.reduce((s, it) => s + Number(it.netTotal || 0), 0);
    topCashierName = user?.fullName || 'Cashier';
  } else {
    maxBillsCount = Math.max(1, myBillsCount);
    maxSalesAmount = Math.max(1000, myTotalAmount);
  }

  // All Staff Team calculation
  const totalTeamBills = cashierStats.length > 0
    ? cashierStats.reduce((s, c) => s + Number(c.completedInvoicesCount || 0), 0)
    : allInvoices.length;
  const totalTeamAmount = cashierStats.length > 0
    ? cashierStats.reduce((s, c) => s + Number(c.totalSalesAmount || 0), 0)
    : allInvoices.reduce((s, it) => s + Number(it.netTotal || 0), 0);
  const staffCount = Math.max(1, cashierStats.length);

  // Flow Step 2: Product Search by Code or Name
  const handleProductSearch = async (query) => {
    setSearchQuery(query);
    if (!query || query.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await productApi.searchActive(query.trim());
      setSearchResults(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Flow Step 3: When clicking a product, activate Per-Product Staging Workstation
  const handleSelectProductForStaging = async (product) => {
    // 1. Filter warehouses that have available stock for this product
    const whsWithStock = warehouses.filter((wh) => getProductStockInWarehouse(product.id, wh.id) > 0);

    // 2. If product has warehouses with stock, use those; otherwise fallback to assigned warehouse or first warehouse
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
      salesPrice: price, // Non-editable, locked from GRN/Inventory
      salesQty: qty,
      discountRate: 0,
      discountAmount: 0,
      subtotal: price * qty,
    });

    setSearchQuery('');
    setSearchResults([]);
  };

  const handleStagedWarehouseChange = async (whId) => {
    if (!stagedItem) return;
    const wh = (stagedItem.availableWarehouses || warehouses).find((w) => w.id === Number(whId)) || warehouses.find((w) => w.id === Number(whId));
    if (!wh) return;

    const realStock = getProductStockInWarehouse(stagedItem.product.id, wh.id);
    let quotaInfo = stagedItem.quotaInfo;
    try {
      if (user?.id) {
        const qRes = await staffQuotaApi.check({
          productId: stagedItem.product.id,
          userId: user.id,
          warehouseId: wh.id,
          requestedQuantity: stagedItem.salesQty || 1,
        });
        quotaInfo = qRes.data?.data || qRes.data || null;
      }
    } catch (e) {
      console.error('Failed to recheck staff quota:', e);
    }

    setStagedItem((prev) => ({
      ...prev,
      warehouseId: wh.id,
      warehouseCode: wh.code,
      warehouseName: wh.name,
      realQuantity: realStock,
      quotaInfo: quotaInfo,
    }));
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

  const handleAddStagedToTable = () => {
    if (!stagedItem) return;

    if (stagedItem.salesQty <= 0) {
      addToast('Please enter a valid quantity greater than 0', 'error');
      return;
    }

    if (stagedItem.realQuantity <= 0) {
      addToast(`Cannot add product: zero stock available in ${stagedItem.warehouseCode}`, 'error');
      return;
    }

    // Inventory allocation check
    if (stagedItem.quotaInfo?.quotaRestricted && stagedItem.quotaInfo?.remainingQuantity !== undefined) {
      const rem = Number(stagedItem.quotaInfo.remainingQuantity);
      if (rem <= 0) {
        addToast(`Inventory Allocation Limit Reached: You have sold all ${stagedItem.quotaInfo.allocatedQuantity} allocated items for ${stagedItem.product.name}. Cannot add.`, 'error');
        return;
      }
      if (stagedItem.salesQty > rem) {
        addToast(`Exceeds your inventory allocation (${rem} items left). Please enter a lower quantity.`, 'error');
        return;
      }
    }

    if (stagedItem.salesQty > stagedItem.realQuantity) {
      addToast(
        `Quantity (${stagedItem.salesQty}) cannot exceed available stock (${stagedItem.realQuantity}) in ${stagedItem.warehouseCode}`,
        'error'
      );
      return;
    }

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (item) => item.productId === stagedItem.product.id && item.warehouseId === stagedItem.warehouseId
      );

      if (existingIdx !== -1) {
        const existing = prev[existingIdx];
        let maxLimit = stagedItem.realQuantity;
        if (stagedItem.quotaInfo?.quotaRestricted) {
          const rem = Number(stagedItem.quotaInfo.remainingQuantity ?? 999999);
          maxLimit = Math.min(maxLimit, rem);
        }
        if (existing.quantity + stagedItem.salesQty > maxLimit) {
          addToast(
            `Cannot add: total quantity (${existing.quantity + stagedItem.salesQty}) exceeds your inventory allocation of ${maxLimit}`,
            'error'
          );
          return prev;
        }
        const newQty = Math.min(maxLimit, existing.quantity + stagedItem.salesQty);
        const gross = newQty * existing.unitPrice;
        const newDiscAmt = existing.discountRate > 0
          ? (gross * existing.discountRate) / 100
          : existing.discountAmount + stagedItem.discountAmount;
        const newTotal = Math.max(0, gross - newDiscAmt);

        const updated = [...prev];
        updated[existingIdx] = {
          ...existing,
          quantity: newQty,
          discountAmount: newDiscAmt,
          total: newTotal,
          quotaInfo: stagedItem.quotaInfo || existing.quotaInfo,
        };
        return updated;
      }

      const newLineItem = {
        id: `${stagedItem.product.id}_${stagedItem.warehouseId}_${Date.now()}`,
        productId: stagedItem.product.id,
        sku: stagedItem.product.sku,
        name: stagedItem.product.name,
        unitOfMeasure: stagedItem.product.unitOfMeasure,
        warehouseId: stagedItem.warehouseId,
        warehouseCode: stagedItem.warehouseCode,
        warehouseName: stagedItem.warehouseName,
        unitPrice: stagedItem.salesPrice,
        quantity: stagedItem.salesQty,
        discountRate: stagedItem.discountRate,
        discountAmount: stagedItem.discountAmount,
        total: stagedItem.subtotal,
        availableQty: stagedItem.realQuantity,
        quotaInfo: stagedItem.quotaInfo,
      };

      return [...prev, newLineItem];
    });

    addToast(`Added ${stagedItem.product.name} to sales table`, 'success');
    setStagedItem(null);
    searchInputRef.current?.focus();
  };

  const updateTableItemQty = (lineId, delta) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === lineId) {
          let maxAvail = item.availableQty || 999999;
          if (item.quotaInfo?.quotaRestricted) {
            const rem = Number(item.quotaInfo.remainingQuantity ?? 999999);
            maxAvail = Math.min(maxAvail, rem);
          }
          const candidate = item.quantity + delta;
          if (candidate > maxAvail) {
            addToast(
              `Quantity cannot exceed limit of ${maxAvail}${item.quotaInfo?.quotaRestricted ? ' (Your Inventory Allocation)' : ' (Warehouse Stock)'}`,
              'warning'
            );
            return item;
          }
          const newQty = Math.max(1, candidate);
          const gross = newQty * item.unitPrice;
          const disc = item.discountRate > 0 ? (gross * item.discountRate) / 100 : item.discountAmount;
          return {
            ...item,
            quantity: newQty,
            total: Math.max(0, gross - disc),
          };
        }
        return item;
      })
    );
  };

  const setTableItemQtyDirect = (lineId, val) => {
    let parsed = parseFloat(val);
    if (isNaN(parsed) || parsed < 1) parsed = 1;
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === lineId) {
          let maxAvail = item.availableQty || 999999;
          if (item.quotaInfo?.quotaRestricted) {
            const rem = Number(item.quotaInfo.remainingQuantity ?? 999999);
            maxAvail = Math.min(maxAvail, rem);
          }
          const finalQty = Math.min(maxAvail, parsed);
          if (parsed > maxAvail) {
            addToast(
              `Quantity cannot exceed limit of ${maxAvail}${item.quotaInfo?.quotaRestricted ? ' (Your Inventory Allocation)' : ' (Warehouse Stock)'}`,
              'warning'
            );
          }
          const gross = finalQty * item.unitPrice;
          const disc = item.discountRate > 0 ? (gross * item.discountRate) / 100 : item.discountAmount;
          return {
            ...item,
            quantity: finalQty,
            total: Math.max(0, gross - disc),
          };
        }
        return item;
      })
    );
  };

  const removeFromCart = (lineId) => {
    setCart((prev) => prev.filter((item) => item.id !== lineId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const discountVal = Math.min(subtotal, Number(discountAmount) || 0);
  const netTotal = Math.max(0, subtotal - discountVal);

  const uniqueWarehouseIds = [...new Set(cart.map((i) => i.warehouseId))];
  const warehouseBreakdown = uniqueWarehouseIds.map((whId) => {
    const items = cart.filter((i) => i.warehouseId === whId);
    const wh = warehouses.find((w) => w.id === whId) || {
      id: whId,
      code: items[0]?.warehouseCode || 'WH',
      name: items[0]?.warehouseName || 'Warehouse',
    };
    const whSubtotal = items.reduce((s, it) => s + it.total, 0);
    return { warehouse: wh, items, subtotal: whSubtotal };
  });

  // Hold Bill Only (Single Action Button)
  const handleHoldCart = async () => {
    if (isHoldingCart) return;
    if (cart.length === 0) {
      addToast('Cart is empty. Add products first.', 'error');
      return;
    }
    setIsHoldingCart(true);
    try {
      const headerWhId = cart[0]?.warehouseId || warehouses[0]?.id;
      const payload = {
        warehouseId: headerWhId,
        customerId: selectedCustomerId,
        discountAmount: discountVal,
        taxRate: 0,
        hold: true,
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountAmount: i.discountAmount,
        })),
      };

      const res = await salesApi.create(payload);
      const heldInvoice = res.data?.data || res.data;
      addToast(`Hold Bill ${heldInvoice?.invoiceNumber || ''} saved successfully!`, 'success');

      setCart([]);
      await loadHeldInvoices();
      loadStaffPerformance();
    } catch (err) {
      if (err.isUnknownStatus) {
        addToast("We couldn't confirm whether the invoice was saved. Please check the invoice list before trying again.", 'warning');
      } else {
        addToast('Unable to save the invoice. Please try again.', 'error');
      }
    } finally {
      setIsHoldingCart(false);
    }
  };

  const handleResumeInvoice = async (heldInv) => {
    setSelectedCustomerId(heldInv.customerId);
    setDiscountAmount(heldInv.discountAmount || 0);

    const invWh = warehouses.find((w) => w.id === heldInv.warehouseId) || {
      id: heldInv.warehouseId,
      code: heldInv.warehouseCode || 'WH-01',
      name: heldInv.warehouseName || 'Warehouse',
    };

    const reconstructedCart = (heldInv.items || []).map((i, idx) => ({
      id: `${i.productId}_${invWh.id}_${Date.now()}_${idx}`,
      productId: i.productId,
      sku: i.productSku,
      name: i.productName,
      unitOfMeasure: i.unitOfMeasure,
      warehouseId: invWh.id,
      warehouseCode: invWh.code,
      warehouseName: invWh.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discountRate: i.discountRate || 0,
      discountAmount: i.discountAmount || 0,
      total: i.totalPrice,
      availableQty: getProductStockInWarehouse(i.productId, invWh.id) || 99,
    }));

    setCart(reconstructedCart);
    try {
      await salesApi.cancelHeld(heldInv.id);
    } catch (e) {
      console.error('Failed to cancel held bill on resume:', e);
    }
    await loadHeldInvoices();
    setShowHeldModal(false);
    addToast(`Resumed held bill ${heldInv.invoiceNumber}`, 'success');
  };

  useEffect(() => {
    const handlePosKeys = (e) => {
      if (!workspaceActive) return;
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // F5 or F12 triggers Hold Bill
      if (e.key === 'F5' || e.key === 'F12' || (e.altKey && (e.key === 'h' || e.key === 'H'))) {
        if (cart.length > 0 && !activeCircleModal && !showHeldModal) {
          e.preventDefault();
          handleHoldCart();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (selectedInvoiceDetail) {
          setSelectedInvoiceDetail(null);
          return;
        }
        if (activeCircleModal) {
          setActiveCircleModal(null);
          return;
        }
        if (stagedItem) {
          setStagedItem(null);
          return;
        }
        if (searchResults.length > 0) {
          setSearchResults([]);
          return;
        }
        if (showCustomerSearch) {
          setShowCustomerSearch(false);
          return;
        }
        if (showHeldModal) {
          setShowHeldModal(false);
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
  }, [workspaceActive, cart, stagedItem, searchResults, showCustomerSearch, activeCircleModal, showHeldModal, selectedInvoiceDetail, onExitPos]);

  return (
    <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '100vh', boxSizing: 'border-box' }}>
      
      {/* ─────────────────────────────────────────────────────────────
          TOP BAR: "POS" Brand + 3 Motivation Circles in Right Above Corner + Exit
         ───────────────────────────────────────────────────────────── */}
      <div
        className="glass-card"
        style={{
          padding: '8px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* Left Side: Clean "POS" Heading Title Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShoppingCart size={17} />
          </div>
          <span style={{ fontWeight: 900, fontSize: '1.25rem', color: '#0f172a', letterSpacing: '0.04em' }}>
            POS
          </span>
        </div>

        {/* Right Above Corner: 3 Staff Motivation Circles + ONLY ONE Exit Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          
          {/* Motivation Circles Group - Minimalist & Displays Names */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            
            {/* CIRCLE 1: Staff Name / My Total */}
            <div
              onClick={() => setActiveCircleModal('my')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px 4px 5px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '24px',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'all 0.15s ease',
              }}
              title={`Click to see billing details for ${user?.fullName || user?.username || 'You'}`}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.backgroundColor = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.backgroundColor = '#ffffff';
              }}
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  border: '1px solid #dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  flexShrink: 0,
                }}
              >
                {((user?.fullName || user?.username || 'M').charAt(0)).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569' }}>
                  {user?.fullName || user?.username || 'Cashier'}
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                  {myBillsCount} bills • Rs. {myTotalAmount >= 1000 ? `${(myTotalAmount / 1000).toFixed(1)}k` : myTotalAmount.toFixed(0)}
                </span>
              </div>
            </div>

            {/* CIRCLE 2: Max / Top Record Staff */}
            <div
              onClick={() => setActiveCircleModal('max')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px 4px 5px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '24px',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'all 0.15s ease',
              }}
              title={`Click to view top benchmark by ${topCashierName}`}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.backgroundColor = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.backgroundColor = '#ffffff';
              }}
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: '#fef3c7',
                  color: '#d97706',
                  border: '1px solid #fde68a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  flexShrink: 0,
                }}
              >
                <Trophy size={13} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#92400e' }}>
                  {topCashierName} (Max)
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                  {maxBillsCount} bills • Rs. {maxSalesAmount >= 1000 ? `${(maxSalesAmount / 1000).toFixed(1)}k` : maxSalesAmount.toFixed(0)}
                </span>
              </div>
            </div>

            {/* CIRCLE 3: All Staff / Team */}
            <div
              onClick={() => {
                setSelectedStaffForBills(null);
                setActiveCircleModal('all');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px 4px 5px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '24px',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'all 0.15s ease',
              }}
              title="Click to see all staff members and their bills"
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.backgroundColor = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.backgroundColor = '#ffffff';
              }}
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: '#f3e8ff',
                  color: '#7c3aed',
                  border: '1px solid #e9d5ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  flexShrink: 0,
                }}
              >
                <Users size={13} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#5b21b6' }}>
                  All Staff ({staffCount})
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                  {totalTeamBills} bills • Rs. {totalTeamAmount >= 1000 ? `${(totalTeamAmount / 1000).toFixed(1)}k` : totalTeamAmount.toFixed(0)}
                </span>
              </div>
            </div>

          </div>

          <div style={{ height: '22px', width: '1px', background: '#e2e8f0' }} />

          {/* ONLY ONE BUTTON: Exit */}
          {onExitPos && (
            <button
              type="button"
              className="btn btn-glass btn-sm"
              onClick={onExitPos}
              style={{
                height: '32px',
                padding: '0 12px',
                gap: '5px',
                color: '#dc2626',
                borderColor: '#fca5a5',
                fontWeight: 800,
                fontSize: '0.8rem',
              }}
              title="Exit POS Mode (Esc)"
            >
              <LogOut size={13} /> Exit
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: CUSTOMER SELECTION & FINANCIAL DETAILS (BELOW TOP BAR)
         ───────────────────────────────────────────────────────────── */}
      <div
        className="glass-card"
        style={{
          padding: '10px 16px',
          background: '#ffffff',
          borderRadius: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {/* Row 1: Customer Selector Input */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 320px', position: 'relative' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
              <User size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#2563eb' }} />
              <input
                type="text"
                className="input-glass"
                placeholder="Search customer by name, code or phone..."
                value={
                  showCustomerSearch
                    ? customerSearchQuery
                    : selectedCustomer
                    ? `${selectedCustomer.name} (${selectedCustomer.customerCode || selectedCustomer.code})`
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
                style={{
                  paddingLeft: '32px',
                  fontWeight: 600,
                  width: '100%',
                  height: '34px',
                  fontSize: '0.84rem',
                }}
              />
            </div>

            {showCustomerSearch ? (
              <button
                type="button"
                className="btn btn-glass btn-sm"
                onClick={() => setShowCustomerSearch(false)}
                style={{ height: '34px', padding: '0 8px' }}
                title="Cancel search"
              >
                <X size={13} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-glass btn-sm"
                onClick={() => {
                  setShowCustomerSearch(true);
                  setCustomerSearchQuery('');
                }}
                title="Change customer"
                style={{ height: '34px', padding: '0 10px', gap: '4px', fontSize: '0.76rem' }}
              >
                <RefreshCw size={11} /> Change
              </button>
            )}

            {/* Customer Search Dropdown */}
            {showCustomerSearch && (
              <div
                className="glass-card"
                style={{
                  position: 'absolute',
                  top: '40px',
                  left: 0,
                  width: '380px',
                  maxWidth: '100%',
                  zIndex: 350,
                  maxHeight: '260px',
                  overflowY: 'auto',
                  background: 'rgba(255, 255, 255, 0.99)',
                  boxShadow: '0 16px 36px rgba(0,0,0,0.18)',
                  padding: '4px 0',
                  borderRadius: '8px',
                }}
              >
                {filteredCustomers.length === 0 ? (
                  <div style={{ padding: '10px 14px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                    No matching customer found
                  </div>
                ) : (
                  filteredCustomers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setShowCustomerSearch(false);
                        setCustomerSearchQuery('');
                        addToast(`Customer: ${c.name}`, 'info');
                      }}
                      style={{
                        padding: '8px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(226, 232, 240, 0.6)',
                        background: c.id === selectedCustomerId ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                        fontSize: '0.82rem',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = c.id === selectedCustomerId ? 'rgba(37, 99, 235, 0.08)' : 'transparent')
                      }
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {c.customerCode || c.code} • {c.phone || '-'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: Number(c.currentBalance) > 0 ? '#ef4444' : '#10b981', fontSize: '0.8rem' }}>
                          Rs. {Number(c.currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {selectedCustomer && (
            <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: '12px' }}>
              <span>Phone: <strong style={{ color: '#334155' }}>{selectedCustomer.phone || '-'}</strong></span>
              {selectedCustomer.city && <span>City: <strong style={{ color: '#334155' }}>{selectedCustomer.city}</strong></span>}
            </div>
          )}
        </div>

        {/* Row 2 (BELOW): Outstanding Amount, Credit Limit, Available Credit & Status */}
        {selectedCustomer && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              padding: '6px 12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Outstanding Amount:</span>
              <strong style={{ color: custOutstanding > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                Rs. {custOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>

            <span style={{ color: '#cbd5e1' }}>•</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Credit Limit:</span>
              <strong style={{ color: '#334155', fontWeight: 700 }}>
                Rs. {custCreditLimit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>

            <span style={{ color: '#cbd5e1' }}>•</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Available Credit:</span>
              <strong style={{ color: '#2563eb', fontWeight: 700 }}>
                Rs. {custAvailableCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>

            <span style={{ color: '#cbd5e1' }}>•</span>

            <span
              style={{
                fontSize: '0.68rem',
                padding: '2px 7px',
                borderRadius: '4px',
                fontWeight: 700,
                color: creditStatusBadge.color,
                background: creditStatusBadge.bg,
              }}
            >
              {creditStatusBadge.text}
            </span>
          </div>
        )}

        {/* Row 3 (BELOW): Customer Range & Targets Milestone Card in POS */}
        {selectedCustomer && customerTargets.length > 0 && (() => {
          const primaryTarget = customerTargets[0];
          const achieved = Number(primaryTarget.currentAchievedAmount || 0);
          const goal = Number(primaryTarget.targetAmount || 0);
          const pct = Number(primaryTarget.achievementPercentage || 0);
          const currentTier = primaryTarget.currentTier;
          const nextTier = primaryTarget.nextTier;
          const neededForNext = Number(primaryTarget.amountNeededForNextTier || 0);
          const discPct = Number(primaryTarget.currentDiscountPercentage || 0);

          // Cart projection
          const cartSubtotal = subtotal || 0;
          const unlocksNextWithCart = nextTier && cartSubtotal >= neededForNext;

          return (
            <div
              style={{
                marginTop: '4px',
                padding: '10px 14px',
                background: 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)',
                border: '1px solid #bae6fd',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: '0 2px 5px rgba(2, 132, 199, 0.05)',
              }}
            >
              {/* Target Title & Quick Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      background: '#0284c7',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                    }}
                  >
                    <Target size={15} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                        {primaryTarget.targetName}
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontFamily: 'monospace',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: '#e0f2fe',
                          color: '#0369a1',
                          fontWeight: 700,
                        }}
                      >
                        {primaryTarget.targetCode}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Period: {primaryTarget.startDate} to {primaryTarget.endDate} • {primaryTarget.daysRemaining} days remaining
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTargetForModal(primaryTarget);
                      setShowTargetRangesModal(true);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      color: '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    View Slabs
                  </button>

                  {discPct > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (cartSubtotal <= 0) {
                          addToast('Cart is empty. Add products to apply discount.', 'warning');
                          return;
                        }
                        const discVal = parseFloat(((cartSubtotal * discPct) / 100).toFixed(2));
                        setDiscountAmount(discVal);
                        addToast(`🎯 Applied ${discPct}% Target Range Discount (-Rs. ${discVal.toLocaleString()})!`, 'success');
                      }}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#ffffff',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                      }}
                      title="Click to apply earned target discount to this bill"
                    >
                      <Zap size={12} /> Apply {discPct}% Target Discount
                    </button>
                  )}
                </div>
              </div>

              {/* Progress & Milestone Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.76rem', color: '#334155' }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Achieved: </span>
                  <strong style={{ fontWeight: 800, color: '#0f172a' }}>
                    Rs. {achieved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>{' '}
                  <span style={{ color: '#64748b' }}>/ Rs. {goal.toLocaleString()}</span>{' '}
                  <span style={{ fontWeight: 700, color: pct >= 100 ? '#16a34a' : '#0284c7' }}>({pct}%)</span>
                </div>

                {/* Unlocked Tier Badge */}
                {currentTier ? (
                  <div
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: '#dcfce7',
                      color: '#15803d',
                      border: '1px solid #86efac',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Award size={12} /> Unlocked: {currentTier.tierName} ({discPct}% Off)
                  </div>
                ) : (
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Base Level (No discount unlocked yet)
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  height: '6px',
                  background: '#e2e8f0',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, pct))}%`,
                    background: pct >= 100 ? '#16a34a' : 'linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              {/* Next Milestone Incentive Note */}
              {nextTier && (
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: unlocksNextWithCart ? '#15803d' : '#0369a1',
                    background: unlocksNextWithCart ? '#dcfce7' : '#f0f9ff',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: unlocksNextWithCart ? '1px solid #86efac' : '1px solid #e0f2fe',
                  }}
                >
                  <span>
                    {unlocksNextWithCart ? (
                      <strong>🎉 Current cart (+Rs. {cartSubtotal.toLocaleString()}) unlocks {nextTier.tierName} ({nextTier.discountPercentage}% Discount)!</strong>
                    ) : (
                      <span>
                        Next Target: <strong>{nextTier.tierName}</strong> ({nextTier.discountPercentage}% Disc) — needs <strong>Rs. {neededForNext.toLocaleString()}</strong> more
                        {cartSubtotal > 0 && ` (this order adds Rs. ${cartSubtotal.toLocaleString()})`}
                      </span>
                    )}
                  </span>
                  <span style={{ fontWeight: 700 }}>Tier {nextTier.tierLevel}</span>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2 & 3: PRODUCT SEARCH & PER-PRODUCT STAGING WORKSTATION
         ───────────────────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Product Search Bar */}
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '13px', top: '10px', color: '#94a3b8' }} />
            <input
              ref={searchInputRef}
              type="text"
              className="input-glass"
              style={{ paddingLeft: '38px', width: '100%', height: '36px', fontSize: '0.9rem' }}
              placeholder="Search product code (SKU) or product name... (Press F2 to focus)"
              value={searchQuery}
              onChange={(e) => handleProductSearch(e.target.value)}
            />
          </div>

          {/* Autocomplete Dropdown */}
          {searchResults.length > 0 && (
            <div
              className="glass-card"
              style={{
                position: 'absolute',
                top: '42px',
                left: 0,
                right: 0,
                zIndex: 300,
                maxHeight: '260px',
                overflowY: 'auto',
                background: 'rgba(255, 255, 255, 0.99)',
                boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
                padding: '4px 0',
                borderRadius: '8px',
              }}
            >
              {searchResults.map((p) => {
                const totalStock = warehouses.reduce(
                  (sum, wh) => sum + getProductStockInWarehouse(p.id, wh.id),
                  0
                );
                const isOutOfStock = totalStock <= 0;
                const isLowStock = totalStock > 0 && totalStock <= (p.minStockLevel || 5);

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (!isOutOfStock) {
                        handleSelectProductForStaging(p);
                      }
                    }}
                    style={{
                      padding: '9px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                      opacity: isOutOfStock ? 0.55 : 1,
                      backgroundColor: isOutOfStock ? '#fff1f2' : 'transparent',
                      borderBottom: '1px solid rgba(226, 232, 240, 0.6)',
                      transition: 'background-color 0.15s ease',
                      pointerEvents: isOutOfStock ? 'none' : 'auto',
                    }}
                    onMouseEnter={(e) => {
                      if (!isOutOfStock) e.currentTarget.style.background = '#eff6ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isOutOfStock ? '#fff1f2' : 'transparent';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: isOutOfStock ? '#94a3b8' : '#0f172a', fontSize: '0.86rem' }}>
                          {p.name}
                        </span>
                        {isOutOfStock ? (
                          <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
                            Out of Stock (0)
                          </span>
                        ) : isLowStock ? (
                          <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                            Low Stock ({totalStock})
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
                            In Stock ({totalStock})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', gap: '8px', marginTop: '2px' }}>
                        <span>Code: <strong>{p.sku}</strong></span>
                        <span>Unit: <strong>{p.unitOfMeasure || 'PCS'}</strong></span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: isOutOfStock ? '#94a3b8' : '#2563eb', fontSize: '0.92rem' }}>
                        Rs. {Number(p.sellingPrice || 0).toFixed(2)}
                      </div>
                      {isOutOfStock ? (
                        <span style={{ fontSize: '0.66rem', color: '#dc2626', fontWeight: 700 }}>
                          Not Selectable (No Stock)
                        </span>
                      ) : (
                        <span className={`badge ${isLowStock ? 'badge-warning' : 'badge-primary'}`} style={{ fontSize: '0.66rem', padding: '2px 6px' }}>
                          Configure & Add +
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Per-Product Staging Workstation (Rendered when product is clicked) */}
        {stagedItem && (
          <div
            style={{
              padding: '14px 16px',
              background: '#f8fafc',
              border: '2px solid #3b82f6',
              borderRadius: '9px',
              boxShadow: '0 6px 18px rgba(59, 130, 246, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={17} color="#2563eb" />
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                  {stagedItem.product.name}
                </span>
                <span className="badge badge-outline" style={{ fontSize: '0.7rem' }}>
                  Code: {stagedItem.product.sku}
                </span>
              </div>

              <button
                type="button"
                className="btn btn-glass btn-sm"
                onClick={() => setStagedItem(null)}
                style={{ color: '#64748b', padding: '2px 7px' }}
              >
                <X size={13} /> Cancel
              </button>
            </div>

            {/* Quota Restriction Alert Banner */}
            {stagedItem.quotaInfo?.quotaRestricted && (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0
                    ? '#fef2f2'
                    : '#f0fdf4',
                  border: `1px solid ${Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0 ? '#fca5a5' : '#86efac'}`,
                }}
              >
                {Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0 ? (
                  <ShieldAlert size={20} color="#dc2626" style={{ flexShrink: 0 }} />
                ) : (
                  <ShieldCheck size={20} color="#16a34a" style={{ flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0 ? '#991b1b' : '#166534',
                  }}>
                    {Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0
                      ? 'Inventory Allocation Finished'
                      : 'Inventory Allocation Active'}
                  </div>
                  <div style={{
                    fontSize: '0.74rem',
                    color: Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0 ? '#b91c1c' : '#15803d',
                    marginTop: '1px',
                  }}>
                    {Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0
                      ? `You have reached your allocated limit of ${stagedItem.quotaInfo.allocatedQuantity} items. You cannot sell more of this product.`
                      : `You have ${stagedItem.quotaInfo.remainingQuantity} items left out of ${stagedItem.quotaInfo.allocatedQuantity} allocated (Sold: ${stagedItem.quotaInfo.soldQuantity || 0}).`}
                  </div>
                </div>
                <div style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  background: Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0 ? '#fee2e2' : '#dcfce7',
                  color: Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0 ? '#dc2626' : '#15803d',
                  border: `1px solid ${Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0 ? '#f87171' : '#4ade80'}`,
                  whiteSpace: 'nowrap',
                }}>
                  {stagedItem.quotaInfo.remainingQuantity} Left (Allocation)
                </div>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '10px',
                alignItems: 'end',
              }}
            >
              {/* 1. Auto-Selected Assigned/Stocked Warehouse */}
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  WAREHOUSE (ASSIGNED / IN STOCK)
                </label>
                <select
                  className="input-glass"
                  style={{ width: '100%', height: '34px', fontWeight: 600, fontSize: '0.8rem' }}
                  value={stagedItem.warehouseId || ''}
                  onChange={(e) => handleStagedWarehouseChange(e.target.value)}
                >
                  {(stagedItem.availableWarehouses && stagedItem.availableWarehouses.length > 0
                    ? stagedItem.availableWarehouses
                    : warehouses
                  ).map((wh) => {
                    const whStock = getProductStockInWarehouse(stagedItem.product.id, wh.id);
                    return (
                      <option key={wh.id} value={wh.id}>
                        {wh.code} - {wh.name} ({whStock} in stock)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 2. Real Quantity */}
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  REAL QUANTITY (IN STOCK)
                </label>
                <div
                  style={{
                    height: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    background: stagedItem.realQuantity > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${stagedItem.realQuantity > 0 ? '#86efac' : '#fca5a5'}`,
                    borderRadius: '6px',
                    fontWeight: 800,
                    color: stagedItem.realQuantity > 0 ? '#15803d' : '#b91c1c',
                    fontSize: '0.82rem',
                  }}
                >
                  {stagedItem.quotaInfo?.quotaRestricted
                    ? `${stagedItem.quotaInfo.remainingQuantity} Left of Allocation (${stagedItem.realQuantity} in Stock)`
                    : `${stagedItem.realQuantity} ${stagedItem.product.unitOfMeasure || 'Units'} Available`}
                </div>
              </div>

              {/* 3. Non-Editable Sales Price (Fixed from Inventory / GRN) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  SALES PRICE (LOCKED - INVENTORY)
                </label>
                <div
                  style={{
                    height: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 10px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontWeight: 800,
                    color: '#0f172a',
                    fontSize: '0.86rem',
                  }}
                  title="Sales price is fixed from Inventory / GRN and cannot be edited"
                >
                  <span>Rs. {Number(stagedItem.salesPrice || 0).toFixed(2)}</span>
                  <span style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 700, background: '#e2e8f0', padding: '1px 6px', borderRadius: '4px' }}>
                    Fixed
                  </span>
                </div>
              </div>

              {/* 4. Sales Quantity */}
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  SALES QTY
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <button
                    type="button"
                    className="btn btn-glass btn-sm"
                    style={{ height: '34px', width: '32px', padding: 0 }}
                    onClick={() => handleStagedQtyChange(stagedItem.salesQty - 1)}
                  >
                    <Minus size={12} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    className="input-glass"
                    style={{ width: '100%', height: '34px', textAlign: 'center', fontWeight: 700, fontSize: '0.86rem' }}
                    value={stagedItem.salesQty}
                    onChange={(e) => handleStagedQtyChange(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-glass btn-sm"
                    style={{ height: '34px', width: '32px', padding: 0 }}
                    onClick={() => handleStagedQtyChange(stagedItem.salesQty + 1)}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {/* 5. Discount in % or Amount */}
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  DISCOUNT (% OR RS.)
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      className="input-glass"
                      placeholder="%"
                      style={{ width: '100%', height: '34px', paddingRight: '18px', fontSize: '0.8rem' }}
                      value={stagedItem.discountRate || ''}
                      onChange={(e) => handleStagedDiscountRateChange(e.target.value)}
                    />
                    <span style={{ position: 'absolute', right: '5px', top: '7px', fontSize: '0.7rem', color: '#94a3b8' }}>
                      %
                    </span>
                  </div>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input-glass"
                      placeholder="Rs."
                      style={{ width: '100%', height: '34px', fontSize: '0.8rem' }}
                      value={stagedItem.discountAmount || ''}
                      onChange={(e) => handleStagedDiscountAmountChange(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 6. Product Sub Total & Add to Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b' }}>
                  SUB TOTAL
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2563eb', fontFamily: 'var(--font-heading)' }}>
                  Rs. {stagedItem.subtotal.toFixed(2)}
                </div>
                <button
                  type="button"
                  className={stagedItem.quotaInfo?.quotaRestricted && Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0 ? "btn btn-secondary" : "btn btn-primary"}
                  onClick={handleAddStagedToTable}
                  disabled={stagedItem.quotaInfo?.quotaRestricted && Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0}
                  style={{ height: '34px', width: '100%', gap: '5px', fontWeight: 700, fontSize: '0.82rem' }}
                >
                  {stagedItem.quotaInfo?.quotaRestricted && Number(stagedItem.quotaInfo.remainingQuantity || 0) <= 0 ? (
                    <>
                      <ShieldAlert size={14} /> Allocation Limit Reached
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> Add to Table
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: SALES ITEMS TABLE & SINGLE ACTION (HOLD BILL)
         ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-start', flex: 1 }}>
        
        {/* Left Side: Main Sales Table */}
        <div className="glass-card" style={{ flex: '1 1 680px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '1rem', color: '#0f172a', margin: 0, fontWeight: 700 }}>
                Sales Order Items ({cart.length})
              </h3>
              {uniqueWarehouseIds.length > 1 && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                  }}
                >
                  Multi-Warehouse: {warehouseBreakdown.map((w) => w.warehouse.code).join(', ')}
                </span>
              )}
            </div>
          </div>

          {/* Sales Items Table Styled Exactly Like Customer Table */}
          <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff' }}>
            <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                  <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0', width: '110px' }}>
                    WAREHOUSE
                  </th>
                  <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0', width: '120px' }}>
                    PRODUCT CODE
                  </th>
                  <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0' }}>
                    PRODUCT NAME
                  </th>
                  <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', borderBottom: '1px solid #e2e8f0', width: '95px' }}>
                    PRICE
                  </th>
                  <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', borderBottom: '1px solid #e2e8f0', width: '110px' }}>
                    QTY
                  </th>
                  <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', borderBottom: '1px solid #e2e8f0', width: '95px' }}>
                    DISCOUNT
                  </th>
                  <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', borderBottom: '1px solid #e2e8f0', width: '110px' }}>
                    AMOUNT
                  </th>
                  <th style={{ padding: '12px 12px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', width: '40px', borderBottom: '1px solid #e2e8f0' }}>
                  </th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', color: '#64748b', padding: '48px 20px', fontSize: '0.875rem' }}>
                      <ShoppingCart size={32} style={{ opacity: 0.3, marginBottom: '6px' }} />
                      <br />
                      No products added yet. Search and configure products above to populate the sales table.
                    </td>
                  </tr>
                ) : (
                  cart.map((item) => (
                    <tr
                      key={item.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          className="badge badge-primary"
                          style={{ fontSize: '0.72rem', padding: '3px 8px', fontWeight: 700, letterSpacing: '0.04em' }}
                        >
                          {item.warehouseCode}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#2563eb', fontSize: '0.84rem' }}>
                        {item.sku}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem', lineHeight: '1.25' }}>{item.name}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>Unit: {item.unitOfMeasure || 'PCS'}</span>
                          {item.quotaInfo?.quotaRestricted && (
                            <span
                              style={{
                                background: '#ecfdf5',
                                color: '#047857',
                                border: '1px solid #a7f3d0',
                                borderRadius: '4px',
                                padding: '1px 5px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                              }}
                              title={`Allocation: ${item.quotaInfo.remainingQuantity} left of ${item.quotaInfo.allocatedQuantity} allocated`}
                            >
                              Allocation: {item.quotaInfo.remainingQuantity} left
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#334155', fontSize: '0.84rem' }}>
                        Rs. {item.unitPrice.toFixed(2)}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn btn-glass btn-sm"
                            style={{ padding: '2px 5px', height: '24px', width: '24px' }}
                            onClick={() => updateTableItemQty(item.id, -1)}
                          >
                            <Minus size={10} />
                          </button>
                          <input
                            type="number"
                            className="input-glass"
                            style={{ width: '44px', height: '24px', textAlign: 'center', padding: '2px', fontSize: '0.82rem', fontWeight: 700 }}
                            value={item.quantity}
                            onChange={(e) => setTableItemQtyDirect(item.id, e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn btn-glass btn-sm"
                            style={{ padding: '2px 5px', height: '24px', width: '24px' }}
                            onClick={() => updateTableItemQty(item.id, 1)}
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right', color: item.discountAmount > 0 ? '#ef4444' : '#64748b', fontSize: '0.84rem' }}>
                        {item.discountAmount > 0 ? (
                          <>
                            -Rs. {item.discountAmount.toFixed(2)}
                            {item.discountRate > 0 && <span style={{ fontSize: '0.68rem', display: 'block', color: '#dc2626' }}>({item.discountRate}%)</span>}
                          </>
                        ) : (
                          '-'
                        )}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                        Rs. {item.total.toFixed(2)}
                      </td>

                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={() => removeFromCart(item.id)}
                          title="Remove item"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Bill Summary & ONLY ONE BUTTON: "Hold Bill" */}
        <div style={{ flex: '1 1 290px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="glass-card" style={{ padding: '18px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#0f172a', margin: '0 0 12px 0', fontWeight: 700 }}>
              Order Summary
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '0.84rem' }}>
                <span>Subtotal ({cart.length} items):</span>
                <span style={{ fontWeight: 700 }}>Rs. {subtotal.toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#475569', fontSize: '0.82rem' }}>Bill Discount (Rs.):</span>
                <input
                  type="number"
                  className="input-glass"
                  style={{ width: '85px', textAlign: 'right', padding: '3px 6px', fontWeight: 600, fontSize: '0.82rem' }}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div style={{ height: '1px', background: 'rgba(226, 232, 240, 0.8)', margin: '2px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>NET TOTAL:</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb', fontFamily: 'var(--font-heading)' }}>
                  Rs. {netTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Warehouse Breakdown Pill */}
            {warehouseBreakdown.length > 0 && (
              <div
                style={{
                  padding: '8px 10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  marginBottom: '14px',
                  fontSize: '0.76rem',
                }}
              >
                <div style={{ fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                  Warehouse Fulfillment:
                </div>
                {warehouseBreakdown.map((wb) => (
                  <div key={wb.warehouse.id} style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', margin: '2px 0' }}>
                    <span>{wb.warehouse.code} ({wb.items.length} items):</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>Rs. {wb.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ONLY ONE ACTION BUTTON: "Hold Bill" (No create invoice button needed) */}
            <div>
              <button
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '13px',
                  fontSize: '1rem',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontWeight: 800,
                  backgroundColor: '#2563eb',
                }}
                disabled={cart.length === 0}
                onClick={handleHoldCart}
                title="Hold Bill / Save Draft (F12 or F5)"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PauseCircle size={18} /> Hold Bill
                </div>
                <kbd className="erp-kbd" style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.4)' }}>
                  F12
                </kbd>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          STAFF MOTIVATION POPUPS (3 CIRCLES MODALS)
         ───────────────────────────────────────────────────────────── */}
      
      {/* POPUP 1: My Billing Details Modal */}
      {activeCircleModal === 'my' && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{ width: 'min(720px, 96vw)', maxWidth: '720px', padding: '24px', borderRadius: '14px', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: '#2563eb',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', color: '#0f172a', margin: 0, fontWeight: 800 }}>
                    My Billing Performance
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                    Cashier: <strong>{user?.fullName || user?.username}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveCircleModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* KPI Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '18px' }}>
              <div style={{ padding: '14px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#1e40af' }}>BILLS COMPLETED</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1d4ed8', fontFamily: 'var(--font-heading)' }}>
                  {myBillsCount}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#60a5fa' }}>Transactions settled</div>
              </div>

              <div style={{ padding: '14px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#166534' }}>TOTAL AMOUNT BILLED</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#15803d', fontFamily: 'var(--font-heading)' }}>
                  Rs. {myTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#4ade80' }}>Revenue generated</div>
              </div>

              <div style={{ padding: '14px', background: '#faf5ff', borderRadius: '10px', border: '1px solid #e9d5ff' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#6b21a8' }}>AVERAGE BILL VALUE</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#7e22ce', fontFamily: 'var(--font-heading)' }}>
                  Rs. {myAvgBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#c084fc' }}>Per sale transaction</div>
              </div>
            </div>

            {/* My Bills List */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#334155' }}>
                  My Bills ({myInvoices.length})
                </span>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Click any bill to inspect product details
                </span>
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                {myInvoices.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                    No completed bills recorded in this session yet.
                  </div>
                ) : (
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '8px 10px' }}>Invoice #</th>
                        <th style={{ padding: '8px 10px' }}>Customer</th>
                        <th style={{ padding: '8px 10px' }}>Date</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Items</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myInvoices.map((inv) => (
                        <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: '#2563eb' }}>
                            {inv.invoiceNumber}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>
                            {inv.customerName || 'Walk-in'}
                          </td>
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>
                            {inv.invoiceDate || 'Today'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>
                            {inv.items?.length || 1}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                            Rs. {Number(inv.netTotal || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-glass btn-sm"
                              onClick={() => setSelectedInvoiceDetail(inv)}
                              style={{ padding: '3px 8px', fontSize: '0.74rem', gap: '4px' }}
                            >
                              <Eye size={12} /> View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <button
                className="btn btn-glass btn-sm"
                onClick={() => setActiveCircleModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 2: Max Record / Top Performer Benchmark Modal */}
      {activeCircleModal === 'max' && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{ width: 'min(640px, 96vw)', maxWidth: '640px', padding: '24px', borderRadius: '14px', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: '#d97706',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Trophy size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', color: '#0f172a', margin: 0, fontWeight: 800 }}>
                    Top Performance Record
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                    Benchmark Record Leader: <strong>{topCashierName}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveCircleModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '18px' }}>
              <div style={{ padding: '16px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#92400e' }}>MAX BILLS RECORD</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#b45309', fontFamily: 'var(--font-heading)' }}>
                  {maxBillsCount} Bills
                </div>
                <div style={{ fontSize: '0.74rem', color: '#d97706' }}>Highest billing volume</div>
              </div>

              <div style={{ padding: '16px', background: '#fef3c7', borderRadius: '10px', border: '1px solid #fcd34d' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#92400e' }}>MAX SALES AMOUNT</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#b45309', fontFamily: 'var(--font-heading)' }}>
                  Rs. {maxSalesAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#d97706' }}>Highest revenue benchmark</div>
              </div>
            </div>

            {/* Motivation Progress & Comparison */}
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>
                  Your Progress Toward Record ({myTotalAmount >= maxSalesAmount ? '100%' : `${Math.min(100, Math.round((myTotalAmount / (maxSalesAmount || 1)) * 100))}%`})
                </span>
                <span style={{ fontSize: '0.74rem', color: '#2563eb', fontWeight: 700 }}>
                  You: Rs. {myTotalAmount.toFixed(0)} / Max: Rs. {maxSalesAmount.toFixed(0)}
                </span>
              </div>

              <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                <div
                  style={{
                    width: `${Math.min(100, (myTotalAmount / (maxSalesAmount || 1)) * 100)}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
                    borderRadius: '4px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>

              <div style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
                {myTotalAmount >= maxSalesAmount
                  ? '🏆 Outstanding! You are currently the #1 Top Cashier Record Holder!'
                  : `🔥 Keep billing! You are Rs. ${(maxSalesAmount - myTotalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} away from setting the new record!`}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <button
                className="btn btn-glass btn-sm"
                onClick={() => setActiveCircleModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 3: All Staffs Performance & Bills Details Modal */}
      {activeCircleModal === 'all' && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{ width: 'min(880px, 96vw)', maxWidth: '880px', padding: '24px', borderRadius: '14px', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: '#7c3aed',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Users size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', color: '#0f172a', margin: 0, fontWeight: 800 }}>
                    All Staff Billing Performance
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                    Overview of active cashiers and bills created
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveCircleModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Staff Overview Table */}
            <div style={{ marginBottom: '18px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 14px' }}>Staff Name</th>
                    <th style={{ padding: '10px 14px' }}>Username</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>Completed Bills</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total Amount</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cashierStats.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                        No staff records found
                      </td>
                    </tr>
                  ) : (
                    cashierStats.map((c) => (
                      <tr
                        key={c.username}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: selectedStaffForBills === c.username ? '#eff6ff' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                          {c.fullName || c.username}
                          {c.username === user?.username && (
                            <span className="badge badge-primary" style={{ marginLeft: '6px', fontSize: '0.66rem' }}>
                              You
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>
                          {c.username}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>
                          {c.completedInvoicesCount || 0}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>
                          Rs. {Number(c.totalSalesAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <button
                            type="button"
                            className={`btn ${selectedStaffForBills === c.username ? 'btn-primary' : 'btn-glass'} btn-sm`}
                            onClick={() => setSelectedStaffForBills(c.username)}
                            style={{ padding: '4px 10px', fontSize: '0.74rem', gap: '4px' }}
                          >
                            <FileText size={12} /> View Bills
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Selected Staff's Detailed Bills */}
            {selectedStaffForBills && (
              <div style={{ border: '2px solid #3b82f6', borderRadius: '10px', padding: '16px', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                    Bills created by <strong>{selectedStaffForBills}</strong>
                  </div>
                  <button
                    className="btn btn-glass btn-sm"
                    onClick={() => setSelectedStaffForBills(null)}
                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                  >
                    Close Staff Bills
                  </button>
                </div>

                <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  {allInvoices.filter((inv) => inv.createdBy === selectedStaffForBills).length === 0 ? (
                    <div style={{ padding: '18px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                      No bills recorded for this staff member in this period.
                    </div>
                  ) : (
                    <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', background: '#ffffff', borderRadius: '6px' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                          <th style={{ padding: '8px 10px' }}>Invoice #</th>
                          <th style={{ padding: '8px 10px' }}>Customer</th>
                          <th style={{ padding: '8px 10px' }}>Date</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center' }}>Items</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center' }}>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allInvoices
                          .filter((inv) => inv.createdBy === selectedStaffForBills)
                          .map((inv) => (
                            <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 700, color: '#2563eb' }}>
                                {inv.invoiceNumber}
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                                {inv.customerName || 'Walk-in'}
                              </td>
                              <td style={{ padding: '8px 10px', color: '#64748b' }}>
                                {inv.invoiceDate || 'Today'}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>
                                {inv.items?.length || 1}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>
                                Rs. {Number(inv.netTotal || 0).toFixed(2)}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-glass btn-sm"
                                  onClick={() => setSelectedInvoiceDetail(inv)}
                                  style={{ padding: '2px 8px', fontSize: '0.72rem', gap: '3px' }}
                                >
                                  <Eye size={12} /> Inspect
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            <div style={{ textAlign: 'right', marginTop: '14px' }}>
              <button
                className="btn btn-glass btn-sm"
                onClick={() => setActiveCircleModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP: Bill Detail Inspection Modal (Shows all products/details in any bill) */}
      {selectedInvoiceDetail && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1200, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{ width: 'min(640px, 96vw)', maxWidth: '640px', padding: '24px', borderRadius: '12px', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#0f172a', margin: 0, fontWeight: 800 }}>
                  Bill Details: {selectedInvoiceDetail.invoiceNumber}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Customer: <strong>{selectedInvoiceDetail.customerName || 'Walk-in'}</strong> • Cashier: <strong>{selectedInvoiceDetail.createdBy}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoiceDetail(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '14px' }}>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '8px 10px' }}>Code</th>
                    <th style={{ padding: '8px 10px' }}>Product</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedInvoiceDetail.items || []).map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#2563eb' }}>
                        {it.productSku || it.sku || '-'}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                        {it.productName || it.name || '-'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>
                        {it.quantity}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        Rs. {Number(it.unitPrice || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>
                        Rs. {Number(it.totalPrice || (it.quantity * it.unitPrice) || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>Total Bill Amount:</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#2563eb', fontFamily: 'var(--font-heading)' }}>
                Rs. {Number(selectedInvoiceDetail.netTotal || 0).toFixed(2)}
              </span>
            </div>

            <div style={{ textAlign: 'right', marginTop: '14px' }}>
              <button
                className="btn btn-glass btn-sm"
                onClick={() => setSelectedInvoiceDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          HELD CARTS MODAL
         ───────────────────────────────────────────────────────────── */}
      {showHeldModal && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{ width: 'min(800px, 96vw)', maxWidth: '800px', padding: '24px', borderRadius: '12px', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#0f172a', margin: 0, fontWeight: 700 }}>
                  {isSupervisor ? 'Suspended / Held Carts' : 'My Suspended Bills'}
                </h3>
                <p style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                  {isSupervisor
                    ? 'Supervise and resume carts across active cashier sessions'
                    : 'Your personal held transactions waiting to be completed'}
                </p>
              </div>
              <button
                onClick={() => setShowHeldModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={17} />
              </button>
            </div>

            {isSupervisor && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                <button
                  type="button"
                  onClick={() => setHeldTab('mine')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: heldTab === 'mine' ? '#2563eb' : '#e2e8f0',
                    background: heldTab === 'mine' ? '#eff6ff' : '#ffffff',
                    color: heldTab === 'mine' ? '#1d4ed8' : '#64748b',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  My Held Carts ({heldInvoices.filter((h) => h.createdBy === user?.username).length})
                </button>
                <button
                  type="button"
                  onClick={() => setHeldTab('all')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: heldTab === 'all' ? '#2563eb' : '#e2e8f0',
                    background: heldTab === 'all' ? '#eff6ff' : '#ffffff',
                    color: heldTab === 'all' ? '#1d4ed8' : '#64748b',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  All Cashiers ({heldInvoices.length})
                </button>
              </div>
            )}

            {(() => {
              const displayed =
                isSupervisor && heldTab === 'mine'
                  ? heldInvoices.filter((h) => h.createdBy === user?.username)
                  : heldInvoices;

              if (displayed.length === 0) {
                return (
                  <p style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 0', fontSize: '0.85rem' }}>
                    No suspended bills found.
                  </p>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '380px', overflowY: 'auto' }}>
                  {displayed.map((held) => (
                    <div
                      key={held.id}
                      className="glass-card"
                      style={{
                        padding: '10px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 700, color: '#2563eb' }}>{held.invoiceNumber}</span>
                          {held.createdBy && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                color: '#4338ca',
                                background: '#e0e7ff',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              Cashier: {held.createdBy}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          Customer: {held.customerName} | {held.items?.length || 0} items
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                          Rs. {Number(held.netTotal).toFixed(2)}
                        </span>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleResumeInvoice(held)}
                          style={{ padding: '4px 8px', fontSize: '0.76rem' }}
                        >
                          <PlayCircle size={12} /> Resume
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      {/* Target Ranges Breakdown Modal in POS */}
      {showTargetRangesModal && activeTargetForModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px',
          }}
          onClick={() => setShowTargetRangesModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              maxWidth: '520px',
              width: '100%',
              padding: '20px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  {activeTargetForModal.targetName} Slabs
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTargetRangesModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 12px', fontSize: '0.78rem', color: '#64748b' }}>
              Purchasing within each slab unlocks the reward discount for this customer during the promotion period.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {(activeTargetForModal.tiers || []).map((tier) => (
                <div
                  key={tier.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: tier.isAchieved ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                    background: tier.isAchieved ? '#f0fdf4' : '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.84rem', color: tier.isAchieved ? '#15803d' : '#1e293b' }}>
                      {tier.tierName}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Spend: Rs. {Number(tier.minAmount).toLocaleString()} - {tier.maxAmount ? `Rs. ${Number(tier.maxAmount).toLocaleString()}` : 'Unlimited'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: tier.isAchieved ? '#16a34a' : '#0284c7' }}>
                      {tier.discountPercentage}% Discount
                    </div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: tier.isAchieved ? '#16a34a' : '#94a3b8' }}>
                      {tier.isAchieved ? '✓ REACHED' : 'NOT REACHED'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setShowTargetRangesModal(false)}
                style={{
                  padding: '7px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  cursor: 'pointer',
                }}
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
