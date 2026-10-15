import {newestFirst} from '../utils/recordOrder';
import PurchasingStatusDialog from '../components/PurchasingStatusDialog';
import {GRN_SHEET_HEADERS,parseCsvRows,importGrnRows,readGrnWorkbook,createGrnTemplate} from '../utils/grnSpreadsheet';
import {documentErrors,numberError} from '../utils/purchasingValidation';
import {usePurchaseItemRemoval} from '../hooks/usePurchaseItemRemoval';
import PurchaseProductSearch from '../components/PurchaseProductSearch';
import FilterSelect from '../components/FilterSelect';
import '../components/PurchasingAppearance.css';
import DateRangePicker, {matchesDateRange} from '../components/DateRangePicker';
import StatusBadge from '../components/StatusBadge';
import { mergeGrnItems, calculateGrnStaging, buildGrnItemsPayload } from '../utils/grnItems';
import './GrnView.css';
import GrnDetailsModal from '../components/GrnDetailsModal';
import { usePurchasingStatusChange } from '../hooks/usePurchasingStatusChange';
import { formatBusinessDate } from '../utils/invoiceMapping';
import React, { useState, useEffect, useRef } from 'react';
import { grnApi, supplierApi, productApi, brandApi, inventoryApi, pdfApi } from '../api/apiClient';
import { readNumericInput } from '../utils/numericInput';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { canEditModule } from '../utils/permissionUtils';
import { printA4Report } from '../utils/printReport';
import {
  FileCheck,
  Plus,
  Search,
  Printer,
  CheckCircle,
  RefreshCw,
  RotateCcw,
  X,
  Package,
  Calendar,
  UploadCloud,
  FileSpreadsheet,
  TrendingUp,
  Percent,
  DollarSign,
  Layers,
  History,
  Info,
  Edit2,
  Trash2,
} from 'lucide-react';

const GRN_TYPES = [
  'Standard Inward',
  'Import Shipment',
  'Direct Purchase',
  'Consignment Intake',
  'Inter-Branch Transfer In',
  'Sample / Promotional',
];

const INITIAL_STAGING_ITEM = {
  productId: '',
  productCode: '',
  tradeName: '',
  categoryName: '',
  unitOfMeasure: 'PCS',
  quantity: 1,
  freeQuantity: 0,
  currentQuantity: null,
  stockLoading: false,
  lastCostPrice: null,
  currentSellingPrice: null,
  packQty: 1,
  packSize: 1,
  purchaseValue: 0,
  discountPercent: 0,
  discountAmount: 0,
  amount: 0,
  costPrice: 0,
  salePrice: 0,
  markupPercent: 0,
  useBrandMarkup: true,
  creditPrice: 0,
  markupPrice: 0,
  wholesalePrice: 0,
  gpPercent: 0,
  freeCostPrice: 0,
  priceCode: '',
  lastGrnQuantity: null,
  lastGrnFreeQty: null,
  lastGrnItemCount: null,
  lastGrnRealCost: null,
  lastGrnSalePrice: null,
  lastGrnDiscount: null,
  lastGrnSupplierCost: null,
};

const GrnView = React.forwardRef(function GrnView(props, ref) {
  const { user } = useAuth();
  const canEditGrn = canEditModule(user, 'GRN') || (user?.permissions || []).includes('GRN_PROCESS');
  const [showGrnForm, setShowGrnForm] = useState(false);
  useEffect(() => {
    props.onFormModeChange?.(showGrnForm);
  }, [showGrnForm, props.onFormModeChange]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fromDate,setFromDate]=useState('');
  const [toDate,setToDate]=useState('');
  const [grns, setGrns] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingGrnId, setEditingGrnId] = useState(null);
  const [editingGrnStatus, setEditingGrnStatus] = useState(null);
  const [processingGrnId, setProcessingGrnId] = useState(null);
  const [cancellingGrn, setCancellingGrn] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Staging line workstation state for adding items one by one
  const [stagingItem, setStagingItem] = useState({ ...INITIAL_STAGING_ITEM });
  const [editingLineIndex, setEditingLineIndex] = useState(null);
  const [productQuery, setProductQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productSearchRef = useRef(null);

  const resetStagingItem = () => {
    setEditingLineIndex(null);
    setStagingItem({ ...INITIAL_STAGING_ITEM });
    setProductQuery('');
    setShowProductDropdown(false);
  };

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (productSearchRef.current && !productSearchRef.current.contains(e.target)) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  React.useImperativeHandle(ref, () => ({
    openCreate: () => {
      resetAll();
      resetStagingItem();
      setShowGrnForm(true);
    },
    openIntake: () => {
      resetAll();
      resetStagingItem();
      setShowGrnForm(true);
    },
    openList: () => setShowGrnForm(false),
    refresh: loadData,
  }));

  // GRN header and received items
  const [formData, setFormData] = useState({
    grnNumber: '',
    grnDate: formatBusinessDate(),
    supplierId: '',
    grnType: GRN_TYPES[0],
    supplierInvoiceNumber: '',
    remarks: '',
    items: [],
  });

  // Excel / CSV Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [spreadsheetBusy,setSpreadsheetBusy]=useState(false);
  const fileInputRef = useRef(null);

  // Inspection modal state for viewing a clicked GRN record
  const [selectedGrn, setSelectedGrn] = useState(null);

  const { addToast } = useToast();
  const {requestStatusChange,statusChangeDialog}=usePurchasingStatusChange();

  useEffect(() => {
    loadData();
  }, []);

  const loadStockForWarehouse = async (whId) => {
    if (!whId) return {};
    try {
      const res = await inventoryApi.getWarehouseStock(whId);
      const stockMap = {};
      (res.data || []).forEach((b) => {
        stockMap[b.productId] = Number(b.availableQuantity ?? (Number(b.quantity || 0) - Number(b.reservedQuantity || 0)));
      });
      return stockMap;
    } catch (err) {
      console.error('Failed to load warehouse stock:', err);
      return null;
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [grnRes, supRes, prodRes] = await Promise.all([
        grnApi.search({ size: 100 }),
        supplierApi.getActive(),
        productApi.getProducts({ size: 300, activeOnly: true }),
      ]);

      const gList = grnRes.data?.content || grnRes.data || [];
      const sList = supRes.data || [];
      const pList = prodRes.data?.content || prodRes.data || [];

      setGrns(gList);
      setSuppliers(sList);
      setProducts(pList);

      const targetSup = formData.supplierId || (sList.length > 0 ? sList[0].id : '');

      setFormData((prev) => ({
        ...prev,
        supplierId: prev.supplierId || targetSup,
      }));
    } catch (err) {
      addToast('Failed to load GRN intake data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Find previous GRN records for this product to populate "Last GRN Details"
  const findLastGrnDetails = (prodId, grnList = grns) => {
    let lastQty = null;
    let lastFree = null;
    let lastCount = null;
    let lastRealCost = null;
    let lastSale = null;
    let lastDisc = null;
    let lastSupCost = null;

    for (const g of grnList) {
      if (g.items && g.items.length > 0) {
        const matched = g.items.find((it) => it.productId === prodId);
        if (matched) {
          lastQty = matched.quantityReceived;
          lastRealCost = matched.unitCost;
          lastSupCost = matched.unitCost;
          lastCount = g.items.length;
          lastSale = matched.sellingPrice ?? null;
          if (matched.notes) {
            const freeM = matched.notes.match(/Free:\s*([\d.]+)/i);
            if (freeM) lastFree = parseFloat(freeM[1]);
            const discM = matched.notes.match(/Disc:\s*([\d.]+%?)/i);
            if (discM) lastDisc = discM[1];
            const saleM = matched.notes.match(/Sale:\s*(?:\$|LKR\s*|Rs\.?\s*)?([\d.]+)/i);
            if (lastSale == null && saleM) lastSale = parseFloat(saleM[1]);
          }
          break;
        }
      }
    }

    return {
      lastGrnQuantity: lastQty,
      lastGrnFreeQty: lastFree,
      lastGrnItemCount: lastCount,
      lastGrnRealCost: lastRealCost,
      lastGrnSalePrice: lastSale,
      lastGrnDiscount: lastDisc,
      lastGrnSupplierCost: lastSupCost,
    };
  };

  const refreshProductPricing = async (product) => {
    let current = product;
    try {
      const response = await productApi.getById(product.id);
      if (response.data?.id) current = { ...product, ...response.data };
    } catch { /* Retain product details while resolving its brand below. */ }
    if (current.brandId) {
      try {
        const response = await brandApi.getById(current.brandId);
        if (response.data?.markupPercent != null) current = { ...current, brandMarkupPercent: Number(response.data.markupPercent) };
      } catch {
        addToast('Unable to refresh the brand MP%. Please check the connection and select the product again.', 'warning');
      }
    }
    setProducts(previous=>previous.map(item=>String(item.id)===String(current.id) ? current : item));
    return current;
  };

  const selectProductForStaging = async (prod) => {
    if (!prod) return;
    prod = await refreshProductPricing(prod);
    const warehouseId = prod.defaultWarehouseId || prod.warehouseId;
    if (!warehouseId) {
      addToast('Set a default warehouse on this product before creating a GRN.', 'error');
      return;
    }
    const currentStock = null;
    const cost = Number(prod.costPrice) || 0;
    const markupPercent = Number(prod.brandMarkupPercent) || 0;
    const sale = Number((cost * (1 + markupPercent / 100)).toFixed(2));
    const wholesale = Number(prod.wholesalePrice) || (sale ? sale * 0.9 : cost * 1.15);
    const credit = Number(prod.creditPrice) || (sale ? sale * 1.05 : cost * 1.25);
    const markup = sale > cost ? sale - cost : 0;
    const gp = sale > 0 ? ((sale - cost) / sale) * 100 : 0;

    const hist = findLastGrnDetails(prod.id);

    const qty = stagingItem.quantity || 1;
    const free = stagingItem.freeQuantity || 0;
    const purchaseVal = qty * cost;
    const discPct = stagingItem.discountPercent || 0;
    const discAmt = (purchaseVal * discPct) / 100;
    const netAmt = purchaseVal - discAmt;
    const effectiveTotalUnits = qty + free;
    const freeCost = effectiveTotalUnits > 0 ? netAmt / effectiveTotalUnits : cost;

    setStagingItem({
      productId: prod.id,
      productCode: prod.sku || '',
      tradeName: prod.name || '',
      categoryName: prod.categoryName || '',
      unitOfMeasure: prod.unitOfMeasure || 'PCS',
      quantity: qty,
      freeQuantity: free,
      currentQuantity: currentStock,
      stockLoading: true,
      lastCostPrice: prod.costPrice ?? null,
      currentSellingPrice: prod.sellingPrice ?? null,
      packQty: 1,
      packSize: 1,
      purchaseValue: purchaseVal,
      discountPercent: discPct,
      discountAmount: discAmt,
      amount: netAmt,
      costPrice: cost,
      salePrice: sale,
      markupPercent,
      brandMarkupPercent: markupPercent,
      useBrandMarkup: true,
      creditPrice: Number(credit.toFixed(2)),
      markupPrice: Number(markup.toFixed(2)),
      wholesalePrice: Number(wholesale.toFixed(2)),
      gpPercent: Number(gp.toFixed(1)),
      freeCostPrice: Number(freeCost.toFixed(2)),
      priceCode: '',
      ...hist,
    });

    setProductQuery(`${prod.sku || ''} — ${prod.name || ''}`);
    setShowProductDropdown(false);
    const stockMap = await loadStockForWarehouse(warehouseId);
    setStagingItem(prev => String(prev.productId) === String(prod.id)
      ? { ...prev, stockLoading: false, currentQuantity: stockMap ? (stockMap[prod.id] ?? 0) : null } : prev);
  };

  // Recalculate staging calculations whenever quantities, prices, or discounts change
  const handleStagingChange = (field, value) => {
    setStagingItem(prev => calculateGrnStaging(prev, field, value));
  };

  // Add staging item to the GRN items list
  const handleAddItemToGrn = () => {
    if (!stagingItem.productId) {
      addToast('Please select a product first', 'error');
      return;
    }
    const fieldErrors=[numberError(stagingItem.quantity,'Received quantity',{positive:true}),numberError(stagingItem.costPrice,'Unit cost'),numberError(stagingItem.salePrice,'Selling price')].filter(Boolean);
    if(!Number.isFinite(Number(stagingItem.markupPercent)) || Number(stagingItem.markupPercent)<-100 || Number(stagingItem.markupPercent)>99999)fieldErrors.push('MP% must be between -100 and 99999.');
    if(fieldErrors.length){addToast(fieldErrors[0],'error');return;}

    const newItem = {
      productId: stagingItem.productId,
      productCode: stagingItem.productCode,
      tradeName: stagingItem.tradeName,
      unitOfMeasure: stagingItem.unitOfMeasure,
      quantityReceived: Number(stagingItem.quantity),
      freeQuantity: Number(stagingItem.freeQuantity) || 0,
      packQty: Number(stagingItem.packQty) || 1,
      packSize: Number(stagingItem.packSize) || 1,
      unitCost: Number(stagingItem.costPrice),
      salePrice: Number(stagingItem.salePrice),
      markupPercent: Number(stagingItem.markupPercent),
      useBrandMarkup: stagingItem.useBrandMarkup,
      creditPrice: Number(stagingItem.creditPrice),
      wholesalePrice: Number(stagingItem.wholesalePrice),
      purchaseValue: Number(stagingItem.purchaseValue),
      discountPercent: Number(stagingItem.discountPercent) || 0,
      discountAmount: Number(stagingItem.discountAmount) || 0,
      amount: Number(stagingItem.amount),
      gpPercent: Number(stagingItem.gpPercent),
      freeCostPrice: Number(stagingItem.freeCostPrice),
      priceCode: stagingItem.priceCode || '',
      notes: `Pack: ${stagingItem.packQty}x${stagingItem.packSize} | Free: ${stagingItem.freeQuantity} | Disc: ${stagingItem.discountPercent}% (LKR ${stagingItem.discountAmount.toFixed(2)}) | Sale: LKR ${stagingItem.salePrice.toFixed(2)} | GP: ${stagingItem.gpPercent.toFixed(1)}% | Code: ${stagingItem.priceCode || 'N/A'}`,
    };

    setFormData((prev) => ({
      ...prev,
      items: mergeGrnItems(editingLineIndex === null
        ? [...prev.items, newItem]
        : prev.items.map((item, index) => index === editingLineIndex ? newItem : item)),
    }));

    addToast(`${editingLineIndex === null ? 'Added' : 'Updated'} "${stagingItem.tradeName}" in GRN intake!`, 'success');

    // Reset staging item for next scan/search
    resetStagingItem();
  };

  const {requestRemove,removalDialog}=usePurchaseItemRemoval({items:formData.items,products,onRemove:index=>handleRemoveItem(index)});

  const handleRemoveItem = (index) => {
    if (editingLineIndex === index) resetStagingItem();
    else if (editingLineIndex !== null && index < editingLineIndex) setEditingLineIndex(editingLineIndex - 1);
    setFormData((prev) => {
      const updated = [...prev.items];
      updated.splice(index, 1);
      return { ...prev, items: updated };
    });
  };

  const handleEditItem = async (index) => {
    const item = formData.items[index];
    const storedProduct = products.find((p) => String(p.id) === String(item.productId));
    const product = storedProduct ? await refreshProductPricing(storedProduct) : null;
    setEditingLineIndex(index);
    setProductQuery('');
    setShowProductDropdown(false);
    setStagingItem(calculateGrnStaging({
      ...INITIAL_STAGING_ITEM, ...item,
      quantity: item.quantityReceived, costPrice: item.unitCost,
      markupPercent: item.markupPercent ?? Number(product?.brandMarkupPercent || 0),
      brandMarkupPercent: Number(product?.brandMarkupPercent ?? item.brandMarkupPercent ?? item.markupPercent ?? 0),
      useBrandMarkup: item.useBrandMarkup ?? false,
      lastCostPrice: product?.costPrice ?? null, currentSellingPrice: product?.sellingPrice ?? null,
      stockLoading: true,
    }, 'quantity', item.quantityReceived));
    const stock = await loadStockForWarehouse(product?.defaultWarehouseId || product?.warehouseId || item.warehouseId);
    setStagingItem((prev) => String(prev.productId) === String(item.productId)
      ? { ...prev, stockLoading: false, currentQuantity: stock ? stock[item.productId] ?? 0 : null } : prev);
  };

  const calculateGrandTotals = () => {
    return formData.items.reduce(
      (acc, it) => {
        acc.totalQty += it.quantityReceived || 0;
        acc.totalFree += it.freeQuantity || 0;
        acc.grossValue += it.purchaseValue || ((it.quantityReceived || 0) * (it.unitCost || 0));
        acc.totalDiscount += it.discountAmount || 0;
        acc.netPayable += it.amount || 0;
        return acc;
      },
      { totalQty: 0, totalFree: 0, grossValue: 0, totalDiscount: 0, netPayable: 0 }
    );
  };

  const resetAll = () => {
    setEditingGrnId(null);
    setEditingGrnStatus(null);
    const defaultSup = suppliers.length > 0 ? suppliers[0].id : '';

    setFormData({
      grnNumber: '',
      grnDate: formatBusinessDate(),
      supplierId: defaultSup,
      grnType: GRN_TYPES[0],
      supplierInvoiceNumber: '',
      remarks: '',
      items: [],
    });

    resetStagingItem();
  };

  const handleSaveGrn = async (processImmediately = true, statusReason) => {
    const validationErrors=documentErrors('GRN',formData);if(validationErrors.length){addToast(validationErrors[0],'error');return;}
    if (!formData.supplierId) {
      addToast('Please select a supplier', 'error');
      return;
    }
    if (!formData.grnDate) {
      addToast('Select a GRN date', 'error');
      return;
    }
    if (formData.items.length === 0) {
      addToast('Add at least one product item to the GRN', 'error');
      return;
    }
    if(editingGrnId && processImmediately && editingGrnStatus !== 'PROCESSED' && !statusReason) {
      requestStatusChange({type:'GRN',number:formData.grnNumber,current:editingGrnStatus,target:'PROCESSED',onConfirm:reason=>handleSaveGrn(processImmediately,reason)});return;
    }

    try {
      setSaving(true);
      const payload = {
        statusReason,
        purchaseOrderId: formData.purchaseOrderId ? Number(formData.purchaseOrderId) : null,
        supplierId: Number(formData.supplierId),
        grnType: formData.grnType,
        supplierInvoiceNumber: formData.supplierInvoiceNumber.trim() || null,
        receivedDate: formData.grnDate || formatBusinessDate(),
        notes: formData.remarks.trim() || null,
        items: buildGrnItemsPayload(formData.items),
      };

      let res;
      if (editingGrnId) {
        res = await grnApi.update(editingGrnId, payload, processImmediately);
      } else {
        res = await grnApi.create(payload, processImmediately);
      }
      const grnNum = res.data?.grnNumber || formData.grnNumber || 'GRN';

      addToast(
        `GRN ${grnNum} ${res.data?.status === 'PROCESSED' || processImmediately
          ? editingGrnStatus === 'PROCESSED' ? 'updated! Inventory adjusted.' : 'processed! Inventory updated.'
          : editingGrnStatus === 'CANCELLED' ? 'updated and remains cancelled.' : editingGrnId ? 'draft updated successfully!' : 'saved as draft.'}`,
        'success'
      );

      resetAll();
      loadData();
      setShowGrnForm(false);
    } catch (err) {
      addToast(err.response?.data?.message || err.message || 'Failed to save GRN', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePrintPdf = (id) => {
    pdfApi.printGrn(id);
  };

  const handleInspectGrn = async (id) => {
    try {
      const res = await grnApi.getById(id);
      setSelectedGrn(res.data);
    } catch (err) {
      addToast('Failed to load GRN details: ' + err.message, 'error');
    }
  };

  const handleEditGrn = async (g) => {
    if (g.status === 'CANCELLED') return;
    if (!canEditGrn) {
      addToast('Permission denied: Only permissible staff can edit GRNs', 'error');
      return;
    }
    try {
      const res = await grnApi.getById(g.id);
      const fullGrn = res.data;
      if (fullGrn.status === 'CANCELLED') return;
      setEditingGrnId(g.id);
      setEditingGrnStatus(fullGrn.status);
      setFormData({
        grnNumber: fullGrn.grnNumber || '',
        grnDate: fullGrn.receivedDate || formatBusinessDate(),
        purchaseOrderId: fullGrn.purchaseOrderId || '',
        supplierId: fullGrn.supplierId || '',
        supplierName: fullGrn.supplierName || '',
        grnType: fullGrn.grnType || GRN_TYPES[0],
        supplierInvoiceNumber: fullGrn.supplierInvoiceNumber || '',
        remarks: fullGrn.notes || '',
        items: mergeGrnItems((fullGrn.items || []).map((it) => ({
          productId: it.productId,
          productCode: it.productSku || '',
          tradeName: it.productName || '',
          unitOfMeasure: it.unitOfMeasure || 'PCS',
          quantityReceived: Number(it.quantityReceived || 0),
          freeQuantity: 0,
          packQty: 1,
          packSize: 1,
          unitCost: Number(it.unitCost || 0),
          salePrice: Number(it.sellingPrice ?? it.notes?.match(/Sale:\s*(?:\$|LKR\s*|Rs\.?\s*)?([\d.]+)/i)?.[1] ?? 0),
          markupPercent: Number(it.markupPercent ?? 0),
          useBrandMarkup: it.useBrandMarkup ?? false,
          warehouseId: it.warehouseId,
          creditPrice: 0,
          wholesalePrice: 0,
          purchaseValue: Number(it.totalCost || 0),
          discountPercent: 0,
          discountAmount: 0,
          amount: Number(it.totalCost || 0),
          gpPercent: 0,
          freeCostPrice: Number(it.unitCost || 0),
          priceCode: '',
          notes: it.notes || '',
        }))),
      });
      resetStagingItem();
      setShowGrnForm(true);
    } catch (err) {
      addToast('Failed to load GRN for editing: ' + err.message, 'error');
    }
  };

  const handleOpenCancelModal = (g) => {
    setCancellingGrn(g);
    setCancelReason('');
  };

  const handleProcessGrn = async (g,reason) => {
    if(!reason) {requestStatusChange({type:'GRN',number:g.grnNumber,current:g.status,target:'PROCESSED',description:'Processing this GRN adds the received quantities to their warehouses. Enter the reason for processing or restoring this receipt.',onConfirm:reason=>handleProcessGrn(g,reason)});return;}
    if (processingGrnId !== null) return;
    try {
      setProcessingGrnId(g.id);
      const res = await grnApi.process(g.id,reason);
      setSelectedGrn((current) => current?.id === g.id ? res.data : current);
      addToast(`GRN ${g.grnNumber} processed and inventory updated.`, 'success');
      await loadData();
    } catch (err) {
      addToast(err.response?.data?.message || err.message || 'Cannot process GRN', 'error');
      return false;
    } finally {
      setProcessingGrnId(null);
    }
  };

  const handleConfirmCancelGrn = async () => {
    if (!cancellingGrn) return;
    if (!cancelReason.trim()) {
      addToast('Please enter a cancellation reason', 'warning');
      return;
    }

    try {
      setCancelLoading(true);
      const res = await grnApi.cancel(cancellingGrn.id, { reason: cancelReason.trim() });
      addToast(
        `GRN ${cancellingGrn.grnNumber} cancelled${cancellingGrn.status === 'PROCESSED' ? ' and received quantities deducted from inventory' : ''}.`,
        'success'
      );
      if (selectedGrn && selectedGrn.id === cancellingGrn.id) {
        setSelectedGrn(res.data);
      }
      setCancellingGrn(null);
      setCancelReason('');
      loadData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to cancel GRN';
      addToast(msg, 'error');
    } finally {
      setCancelLoading(false);
    }
  };

  const spreadsheetProducts = async () => {
    const response=await brandApi.getAll();
    const brands=response.data?.content || response.data || [];
    return products.map(product=>({...product,brandMarkupPercent:brands.find(brand=>String(brand.id)===String(product.brandId))?.markupPercent ?? product.brandMarkupPercent ?? 0}));
  };
  const handleFileUpload = async (event) => {
    const file=event.target.files?.[0];if(!file)return;
    event.target.value='';setSpreadsheetBusy(true);
    try {
      const extension=file.name.split('.').pop().toLowerCase();
      if(!['xlsx','csv'].includes(extension))throw new Error('Choose an .xlsx or .csv file.');
      const rows=extension==='xlsx'?await readGrnWorkbook(await file.arrayBuffer()):parseCsvRows(await file.text());
      const imported=importGrnRows(rows,await spreadsheetProducts(),suppliers);
      if(formData.items.length && String(formData.supplierId)!==String(imported.supplierId))throw new Error('The sheet supplier differs from the current GRN. Start a new GRN to import it.');
      setFormData(previous=>({...previous,supplierId:String(imported.supplierId),remarks:imported.remarks || previous.remarks,items:mergeGrnItems([...previous.items,...imported.items])}));
      setEditingLineIndex(null);setStagingItem({...INITIAL_STAGING_ITEM});setProductQuery('');
      setShowGrnForm(true);
      addToast(`Imported ${imported.items.length} products and GRN details. Review them before saving.`,'success');
      setShowUploadModal(false);
    } catch(error){addToast('Spreadsheet import: '+error.message,'error');}
    finally{setSpreadsheetBusy(false);}
  };
  const downloadGrnTemplate = async () => {
    setSpreadsheetBusy(true);
    try {
      const supplier=suppliers.find(item=>String(item.id)===String(formData.supplierId));
      const buffer=await createGrnTemplate(await spreadsheetProducts(),{supplier:supplier?.name || '',remarks:formData.remarks});
      const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
      const link=document.createElement('a');link.href=url;link.download='grn_intake_template.xlsx';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(error){addToast('Could not download GRN template: '+error.message,'error');}
    finally{setSpreadsheetBusy(false);}
  };

  const filteredProducts = products.filter((p) => {
    const q = (stagingItem.productId && productQuery === `${stagingItem.productCode} — ${stagingItem.tradeName}` ? '' : productQuery).trim().toLowerCase();
    return (
      p.sku?.toLowerCase().includes(q) ||
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
    );
  });

  const filteredGrns = newestFirst(grns).filter((g) => {
    if(!matchesDateRange(g.receivedDate || g.createdAt,fromDate,toDate)) return false;
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !q ||
      g.grnNumber?.toLowerCase().includes(q) ||
      g.supplierName?.toLowerCase().includes(q) ||
      g.supplierInvoiceNumber?.toLowerCase().includes(q);

    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PROCESSED' && g.status === 'PROCESSED') ||
      (statusFilter === 'DRAFT' && g.status === 'DRAFT') ||
      (statusFilter === 'CANCELLED' && g.status === 'CANCELLED');

    return matchSearch && matchStatus;
  });

  const getTotalProducts = (grn) => new Set((grn.items || []).map((item) => item.productId)).size;

  const handlePrintGrnDirectory = () => {
    const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character]));
    printA4Report({
      title: 'Goods Received Notes',
      metaItems: [
        { label: 'Search', value: escapeText(searchTerm) || 'All GRNs' },
        { label: 'Status', value: statusFilter === 'ALL' ? 'All' : statusFilter },
      ],
      columns: [
        { header: 'GRN Number', accessor: 'number' },
        { header: 'Supplier', accessor: 'supplier' },
        { header: 'Total Products', accessor: 'products', align: 'right' },
        { header: 'Date', accessor: 'date' },
        { header: 'Status', accessor: 'status' },
      ],
      data: filteredGrns.map((grn) => ({
        number: escapeText(grn.grnNumber), supplier: escapeText(grn.supplierName),
        products: getTotalProducts(grn), date: escapeText(grn.receivedDate || grn.createdAt?.slice(0, 10)),
        status: escapeText(grn.status),
      })),
      summaryItems: [{ label: 'Total GRNs', value: String(filteredGrns.length) }],
    });
  };

  const totals = calculateGrandTotals();

  return (
    <div className="purchasing-no-shadows"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {!showGrnForm && <>
          {/* Top Filter & Actions Bar (Sticky Toolbar Card - Exact CustomersHub Look) */}
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
            {/* Left Control: Search Input */}
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
              <input className="erp-field"
                type="text"
                placeholder="Search GRNs by #, supplier, invoice..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  border: '1px solid #cbd5e1',
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

            {/* Right Controls: Filters, Upload, Print, Refresh */}
            <div className="purchase-date-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
              <DateRangePicker documentType="GRN" from={fromDate} to={toDate} onChange={(from,to)=>{setFromDate(from);setToDate(to);}}/>
              <FilterSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{width:'140px'}}
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PROCESSED">Processed</option>
                <option value="CANCELLED">Cancelled</option>
              </FilterSelect>

              {(statusFilter !== 'ALL' || searchTerm || fromDate || toDate) && (
                <button className="erp-button"
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');setFromDate('');setToDate('');
                    setSearchTerm('');
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
                  title="Reset all filters to default"
                >
                  <X size={13} /> Reset
                </button>
              )}

              <button className="erp-button"
                type="button"
                onClick={() => setShowUploadModal(true)}
                style={{
                  height: '38px',
                  padding: '0 14px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#16a34a',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0fdf4')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                title="Upload Excel or CSV Sheet"
              >
                <FileSpreadsheet size={15} /> Upload Sheet
              </button>

              <button
                type="button"
                onClick={handlePrintGrnDirectory}
                style={{
                  height: '38px',
                  width: '38px',
                  minWidth: '38px',
                  padding: 0,
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#334155',
                  fontSize: 'var(--erp-text-body)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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
                title="Print GRN Directory (A4)"
                aria-label="Print GRN Directory (A4)"
              >
                <Printer size={15} />
              </button>

              <button
                type="button"
                onClick={loadData}
                style={{
                  height: '38px',
                  width: '38px',
                  minWidth: '38px',
                  padding: 0,
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#334155',
                  fontSize: 'var(--erp-text-body)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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
                title="Refresh records"
                aria-label="Refresh records"
                disabled={loading}
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* GRN Table (Fixed Table Frame, Sticky Header, Internal Scroll for Data Rows Only) */}
          <div className="erp-table-frame"
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
            <div className="erp-table-scroll" style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
              <table className="erp-table" style={{ width: '100%', minWidth: '840px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      GRN NUMBER
                    </th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      SUPPLIER
                    </th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      TOTAL PRODUCTS
                    </th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      DATE
                    </th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      STATUS
                    </th>
                    <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      REMARKS
                    </th>
                    <th className="erp-table-heading erp-table-actions" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="erp-table-cell" colSpan="7" style={{ textAlign: 'center', color: '#64748b' }}>
                        Loading GRN records...
                      </td>
                    </tr>
                  ) : filteredGrns.length === 0 ? (
                    <tr>
                      <td className="erp-table-cell" colSpan="7" style={{ textAlign: 'center', color: '#64748b' }}>
                        No GRN records found. Click <strong>+ New Goods Received</strong> to create a new intake.
                      </td>
                    </tr>
                  ) : (
                    filteredGrns.map((g) => (
                      <tr
                        key={g.id}
                        onClick={() => handleInspectGrn(g.id)}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        title="Click row to view complete GRN details"
                      >
                        <td className="erp-table-cell">
                          <span className="erp-table-code" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                            {g.grnNumber}
                          </span>
                          {g.supplierInvoiceNumber && (
                            <div style={{ fontSize: 'var(--erp-text-caption)', color: '#64748b', marginTop: '2px' }}>
                              Inv: {g.supplierInvoiceNumber}
                            </div>
                          )}
                        </td>
                        <td className="erp-table-cell" style={{ fontWeight: 600, color: '#0f172a' }}>
                          {g.supplierName || '—'}
                        </td>
                        <td className="erp-table-cell" style={{ color: '#334155' }}>
                          {getTotalProducts(g)}
                        </td>
                        <td className="erp-table-cell erp-table-date">
                          {g.receivedDate || g.createdAt?.slice(0,10) || '—'}
                        </td>
                        <td className="erp-table-cell">
                          <StatusBadge status={g.status} />
                        </td>
                        <td className="erp-table-cell" style={{ color: '#475569', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.notes || g.remarks || ''}>
                          {g.notes || g.remarks || '—'}
                        </td>
                        <td className="erp-table-cell erp-table-actions" style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            {canEditGrn && g.status !== 'CANCELLED' && (
                              <button aria-label="Edit GRN" className="erp-table-icon-action"
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditGrn(g);
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
                                title="Edit GRN"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            <button aria-label="Print GRN PDF" className="erp-table-icon-action"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintPdf(g.id);
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
                              title="Print GRN PDF"
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
      {showGrnForm && (
        <div className="grn-page">
          <div className="grn-page-content">
            {/* Form heading */}

            <div
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                flexShrink: 0,
                flexWrap: 'wrap',
                gap: '8px',
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
                    flexShrink: 0,
                  }}
                >
                  <FileCheck size={20} />
                </div>
                <div>
                  <h2 className="erp-dialog-title" style={{ color: '#0f172a', margin: 0 }}>
                    {editingGrnId ? `Edit Goods Received Note (GRN) — ${formData.grnNumber}` : 'New Goods Received Note (GRN)'}
                  </h2>
                  <p style={{ fontSize: 'var(--erp-text-small)', color: '#64748b', margin: '1px 0 0 0' }}>
                    {editingGrnStatus === 'PROCESSED' ? 'Saving adjusts inventory by the quantity difference. Reductions require available stock.' : 'Inward delivery workstation — stock updates, unit pricing & consignment verification'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button className="erp-button"
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  style={{
                    height: '32px',
                    padding: '0 10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#16a34a',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <FileSpreadsheet size={14} /> Upload Sheet
                </button>
                <button
                  type="button"
                  onClick={() => setShowGrnForm(false)}
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

            <div className="grn-form-body">
          <div className="grn-form-content">
          <div className="grn-workspace">
          {/* Product search and entry */}
          <div className="grn-entry"
            style={{
              padding: '12px',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div ref={productSearchRef} className="purchase-search-group">
              <PurchaseProductSearch query={productQuery} onQueryChange={setProductQuery} results={filteredProducts.slice(0,50)}
                onSelect={selectProductForStaging} selected={Boolean(stagingItem.productId)} editing={editingLineIndex!==null}
                open={showProductDropdown} onOpenChange={setShowProductDropdown} showWarehouse={false}
                resultDetails={product=>`Selling price: LKR ${Number(product.sellingPrice || 0).toFixed(2)}`}
                onClear={()=>{setProductQuery('');resetStagingItem();}}/>
            </div>

            {stagingItem.productId && (
              <div className="grn-product-summary" aria-live="polite">
                <div><span>Last cost price</span><strong>{stagingItem.lastCostPrice == null ? 'Unavailable' : 'LKR ' + Number(stagingItem.lastCostPrice).toFixed(2)}</strong></div>
                <div><span>Available qty</span><strong>{stagingItem.stockLoading ? 'Loading…' : stagingItem.currentQuantity == null ? 'Unavailable' : stagingItem.currentQuantity + ' ' + stagingItem.unitOfMeasure}</strong></div>
                <div><span>Current selling price</span><strong>{stagingItem.currentSellingPrice == null ? 'Unavailable' : 'LKR ' + Number(stagingItem.currentSellingPrice).toFixed(2)}</strong></div>
              </div>
            )}

            <div className="grn-line-fields">
              {[
                ['quantity', 'RECEIVED QTY *', 0, '1'],
                ['costPrice', 'UNIT COST (LKR) *', 0, '0.01'],
              ].map(([field, label, min, step]) => (
                <label key={field}>{label}
                  <input className="input-glass erp-field" type="number" min={min} step={step}
                    inputMode={field === 'quantity' ? 'numeric' : 'decimal'} onFocus={event=>event.target.select()}
                    name={field}
                    value={stagingItem[field]} onChange={e => handleStagingChange(field, readNumericInput(e))} />
                </label>
              ))}
              <label>
                <span className="grn-markup-label"><input type="checkbox" checked={stagingItem.useBrandMarkup}
                  aria-label="Use brand MP%" onChange={(e) => handleStagingChange('useBrandMarkup', e.target.checked)} /> MP% ({stagingItem.useBrandMarkup ? 'Brand' : 'Calculated'})</span>
                <input className="input-glass erp-field" type="number" name="markupPercent" value={stagingItem.markupPercent} readOnly />
              </label>
              <label>SELLING PRICE (LKR)<input className="input-glass erp-field" type="number" name="salePrice" min="0" step="0.01"
                inputMode="decimal" onFocus={event=>{if(!event.target.readOnly)event.target.select();}}
                readOnly={stagingItem.useBrandMarkup} value={stagingItem.salePrice}
                onChange={(e) => handleStagingChange('salePrice', readNumericInput(e))} /></label>
            </div>
            <button type="button" className="btn btn-primary grn-add-item erp-button" disabled={!stagingItem.productId || saving} onClick={handleAddItemToGrn}>
              {editingLineIndex === null ? <Plus size={16} /> : <Edit2 size={16} />} {editingLineIndex === null ? 'Add item' : 'Update item'}
            </button>
            {editingLineIndex !== null && <button type="button" className="btn btn-glass erp-button" onClick={resetStagingItem}>Cancel line edit</button>}
          <div className="grn-header-fields">
            <label>Supplier *<FilterSelect variant="field" aria-label="Supplier" className="input-glass" value={formData.supplierId} onChange={e => setFormData({...formData, supplierId:e.target.value})}>
              <option value="">Select supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              {editingGrnId && formData.supplierId && !suppliers.some(s => String(s.id) === String(formData.supplierId)) && <option value={formData.supplierId}>{formData.supplierName}</option>}
            </FilterSelect></label>
            <label>GRN date *<input className="input-glass erp-field" type="date" required value={formData.grnDate} onChange={e => setFormData({...formData, grnDate:e.target.value})} /></label>
            <label className="grn-entry-remarks">Remarks / notes<textarea className="input-glass erp-field" name="remarks" maxLength={5000} rows={3} placeholder="Delivery note or remarks" value={formData.remarks} onChange={e => setFormData({...formData, remarks:e.target.value})} /></label>
          </div>
          </div>

          {/* Received items */}
          <div className="grn-items">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: 'var(--erp-text-body)', fontWeight: 800, color: '#1e293b' }}>
                Received items ({formData.items.length})
              </span>
              <span style={{ fontSize: 'var(--erp-text-small)', color: '#475569', fontWeight: 600, background: '#f1f5f9', padding: '3px 10px', borderRadius: '6px' }}>
                Received units: <strong style={{ color: '#1d4ed8' }}>{totals.totalQty + totals.totalFree}</strong>
              </span>
            </div>

            <div className="grn-table-scroll erp-table-scroll erp-table-frame">
              <table className="glass-table erp-table" style={{ margin: 0, minWidth: '600px', width: '100%' }}>
                <thead><tr>
                  <th className="erp-table-heading">Product code</th><th className="erp-table-heading">Product name</th><th className="grn-number erp-table-heading">Qty</th><th className="grn-number erp-table-heading">Unit cost</th>
                  <th className="grn-number erp-table-heading">MP%</th><th className="grn-number erp-table-heading">Selling price</th><th className="grn-number erp-table-heading erp-table-actions">Actions</th>
                </tr></thead>
                <tbody>
                  {formData.items.length === 0 && <tr><td colSpan="7" className="grn-empty erp-table-cell">Search a product and add it to the GRN.</td></tr>}
                  {formData.items.map((item, index) => <tr key={item.productId} className={editingLineIndex === index ? 'grn-editing-row' : ''}>
                    <td className="erp-table-cell"><strong className="grn-product-code">{item.productCode}</strong></td>
                    <td className="erp-table-cell">{item.tradeName || '—'}</td>
                    <td className="grn-number erp-table-cell">{item.quantityReceived}</td>
                    <td className="grn-number erp-table-cell">LKR {Number(item.unitCost || 0).toFixed(2)}</td>
                    <td className="grn-number erp-table-cell">{Number(item.markupPercent || 0).toFixed(2)}%</td>
                    <td className="grn-number erp-table-cell">LKR {Number(item.salePrice || 0).toFixed(2)}</td>
                    <td className="grn-number erp-table-cell erp-table-actions"><div className="grn-row-actions">
                      <button className="erp-table-icon-action" type="button" title="Edit line" aria-label={`Edit item ${index + 1}`} onClick={() => handleEditItem(index)}><Edit2 size={14} /></button>
                      <button className="erp-table-icon-action" data-tone="danger" type="button" title="Remove line" aria-label={`Remove item ${index + 1}`} onClick={() => requestRemove(index)}><Trash2 size={14} /></button>
                    </div></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </div>
            {/* Pinned actions */}
            <div
              className="grn-form-actions"
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                flexShrink: 0,
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="erp-button"
                  type="button"
                  onClick={() => setShowGrnForm(false)}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Back to GRNs
                </button>
                {editingGrnStatus !== 'PROCESSED' && <button
                  type="button"
                  onClick={() => handleSaveGrn(false)}
                  disabled={saving}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontSize: 'var(--erp-text-button)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {editingGrnStatus === 'CANCELLED' ? 'Save Changes' : editingGrnId ? 'Update Draft' : 'Save Draft'}
                </button>}
                <button
                  type="button"
                  onClick={() => handleSaveGrn(true)}
                  disabled={saving}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontSize: 'var(--erp-text-button)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <CheckCircle size={16} />
                  {saving ? 'Saving...' : editingGrnStatus === 'PROCESSED' ? 'Save Changes' : editingGrnStatus === 'CANCELLED' ? 'Save & Reprocess' : 'Save Inventory'}
                </button>
              </div>
            </div>
            </div>
          </div>
            </div>
          </div>
        </div>
      )}

      {/* EXCEL / CSV UPLOAD MODAL */}
      {showUploadModal && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1200, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: 'min(760px, 96vw)',
              maxWidth: '760px',
              maxHeight: 'calc(100vh - 24px)',
              overflowY: 'auto',
              padding: '24px',
              background: '#ffffff',
              borderRadius: '12px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileSpreadsheet size={24} color="#16a34a" />
                <h2 className="erp-dialog-title" style={{ color: '#0f172a', margin: 0 }}>
                  Upload GRN Spreadsheet
                </h2>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={22} />
              </button>
            </div>

            <p style={{ fontSize: 'var(--erp-text-button)', color: '#475569', marginBottom: '18px', lineHeight: 1.5 }}>
              Upload an Excel (.xlsx) or CSV sheet to fill product rows, supplier and remarks. Use one supplier per sheet. Enter quantities only for products being received; blank quantity rows are skipped. The GRN number is generated automatically when saving. Leave selling price blank to calculate cost + MP%. Prices are in LKR.
            </p>

            <div
              style={{
                border: '2px dashed #3b82f6',
                borderRadius: '12px',
                padding: '32px 24px',
                textAlign: 'center',
                background: '#eff6ff',
                marginBottom: '18px',
                cursor: 'pointer',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud size={42} color="#2563eb" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontWeight: 700, color: '#1e40af', fontSize: 'var(--erp-text-nav)' }}>
                Click to Select Spreadsheet File (.csv / .xlsx)
              </div>
              <div style={{ fontSize: 'var(--erp-text-body)', color: '#64748b', marginTop: '6px' }}>
                Columns: {GRN_SHEET_HEADERS.join(', ')}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                disabled={spreadsheetBusy}
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b' }}>Need a starting format?</span>
              <button
                type="button"
                className="btn btn-glass btn-sm erp-button"
                onClick={downloadGrnTemplate}
                disabled={spreadsheetBusy}
                style={{ padding: '6px 14px' }}
              >
                {spreadsheetBusy?'Please wait...':'Download Excel Template'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-glass erp-button" onClick={() => setShowUploadModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GRN INSPECTION MODAL (Modern, Large, High-Contrast for 45+ Decision Makers) */}
      {showGrnForm && removalDialog}
      {selectedGrn && (
        <GrnDetailsModal grn={selectedGrn} onClose={() => setSelectedGrn(null)}
          onPrint={() => handlePrintPdf(selectedGrn.id)} onCancel={() => handleOpenCancelModal(selectedGrn)}
          canManage={canEditGrn} processing={processingGrnId !== null}
          onEdit={() => { const grn = selectedGrn; setSelectedGrn(null); handleEditGrn(grn); }} />
      )}

      {cancellingGrn && <PurchasingStatusDialog
        pending={{type:'GRN',number:cancellingGrn.grnNumber,current:cancellingGrn.status,target:'CANCELLED',description:cancellingGrn.status==='PROCESSED'?'Cancelling reverses the received quantities from inventory. Every product must have enough available stock.':'This draft receipt will be cancelled. Enter the reason for the audit log.'}}
        title="Cancel GRN" confirmLabel="Confirm Cancellation" closeLabel="Close"
        reasonPlaceholder="Enter cancellation reason..." reason={cancelReason} onReasonChange={setCancelReason}
        busy={cancelLoading} onClose={()=>setCancellingGrn(null)} onConfirm={handleConfirmCancelGrn}/>}
      {statusChangeDialog}
    </div>
  );
});

export default GrnView;
