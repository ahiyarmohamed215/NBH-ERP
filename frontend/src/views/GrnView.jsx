import { mergeGrnItems, calculateGrnStaging, buildGrnItemsPayload } from '../utils/grnItems';
import './GrnView.css';
import { formatBusinessDate } from '../utils/invoiceMapping';
import React, { useState, useEffect, useRef } from 'react';
import { grnApi, supplierApi, productApi, inventoryApi, pdfApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { canEditModule } from '../utils/permissionUtils';
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
  Download,
  Edit2,
  XCircle,
  AlertTriangle,
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
  const canEditGrn = canEditModule(user, 'GRN');
  const [showGrnForm, setShowGrnForm] = useState(false);
  useEffect(() => {
    props.onFormModeChange?.(showGrnForm);
  }, [showGrnForm, props.onFormModeChange]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [grns, setGrns] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingGrnId, setEditingGrnId] = useState(null);
  const [cancellingGrn, setCancellingGrn] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Staging line workstation state for adding items one by one
  const [stagingItem, setStagingItem] = useState({ ...INITIAL_STAGING_ITEM });
  const [productQuery, setProductQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productSearchRef = useRef(null);

  const resetStagingItem = () => {
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
  const [csvRawText, setCsvRawText] = useState('');
  const fileInputRef = useRef(null);

  // Inspection modal state for viewing a clicked GRN record
  const [selectedGrn, setSelectedGrn] = useState(null);

  const { addToast } = useToast();

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
          if (matched.notes) {
            const freeM = matched.notes.match(/Free:\s*([\d.]+)/i);
            if (freeM) lastFree = parseFloat(freeM[1]);
            const discM = matched.notes.match(/Disc:\s*([\d.]+%?)/i);
            if (discM) lastDisc = discM[1];
            const saleM = matched.notes.match(/Sale:\s*([\d.]+)/i);
            if (saleM) lastSale = parseFloat(saleM[1]);
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

  const selectProductForStaging = async (prod) => {
    if (!prod) return;
    const warehouseId = prod.defaultWarehouseId || prod.warehouseId;
    if (!warehouseId) {
      addToast('Set a default warehouse on this product before creating a GRN.', 'error');
      return;
    }
    const existingWarehouse = formData.items.map(item => products.find(p => String(p.id) === String(item.productId)))
      .find(p => p?.defaultWarehouseId || p?.warehouseId);
    if (existingWarehouse && String(existingWarehouse.defaultWarehouseId || existingWarehouse.warehouseId) !== String(warehouseId)) {
      addToast('Use a separate GRN for products in a different warehouse.', 'error');
      return;
    }
    const currentStock = null;
    const cost = Number(prod.costPrice) || 0;
    const sale = Number(prod.sellingPrice) || 0;
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
      creditPrice: Number(credit.toFixed(2)),
      markupPrice: Number(markup.toFixed(2)),
      wholesalePrice: Number(wholesale.toFixed(2)),
      gpPercent: Number(gp.toFixed(1)),
      freeCostPrice: Number(freeCost.toFixed(2)),
      priceCode: '',
      ...hist,
    });

    setProductQuery('');
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
    if (stagingItem.quantity <= 0 && stagingItem.freeQuantity <= 0) {
      addToast('Enter a valid received or free quantity', 'error');
      return;
    }
    if (stagingItem.costPrice < 0) {
      addToast('Cost price cannot be negative', 'error');
      return;
    }

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
      creditPrice: Number(stagingItem.creditPrice),
      wholesalePrice: Number(stagingItem.wholesalePrice),
      purchaseValue: Number(stagingItem.purchaseValue),
      discountPercent: Number(stagingItem.discountPercent) || 0,
      discountAmount: Number(stagingItem.discountAmount) || 0,
      amount: Number(stagingItem.amount),
      gpPercent: Number(stagingItem.gpPercent),
      freeCostPrice: Number(stagingItem.freeCostPrice),
      priceCode: stagingItem.priceCode || '',
      notes: `Pack: ${stagingItem.packQty}x${stagingItem.packSize} | Free: ${stagingItem.freeQuantity} | Disc: ${stagingItem.discountPercent}% ($${stagingItem.discountAmount.toFixed(2)}) | Sale: $${stagingItem.salePrice.toFixed(2)} | GP: ${stagingItem.gpPercent.toFixed(1)}% | Code: ${stagingItem.priceCode || 'N/A'}`,
    };

    setFormData((prev) => ({
      ...prev,
      items: mergeGrnItems([...prev.items, newItem]),
    }));

    addToast(`Added "${stagingItem.tradeName}" to GRN intake!`, 'success');

    // Reset staging item for next scan/search
    resetStagingItem();
  };

  const handleRemoveItem = (index) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated.splice(index, 1);
      return { ...prev, items: updated };
    });
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

  const handleSaveGrn = async (processImmediately = true) => {
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

    try {
      setSaving(true);
      const payload = {
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
        `GRN ${grnNum} ${processImmediately ? 'processed! Inventory posted to warehouse.' : (editingGrnId ? 'draft updated successfully!' : 'saved as draft.')}`,
        'success'
      );

      resetAll();
      loadData();
      setShowGrnForm(false);
    } catch (err) {
      addToast(err.message || 'Failed to save GRN', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintPdf = (id) => {
    pdfApi.printGrn(id);
  };

  const handleDownloadPdf = (id, grnNumber) => {
    pdfApi.downloadGrn(id, grnNumber);
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
    if (!canEditGrn) {
      addToast('Permission denied: Only permissible staff can edit GRNs', 'error');
      return;
    }
    if (g.status === 'PROCESSED') {
      addToast(`GRN ${g.grnNumber} is already processed and posted to inventory. Cannot be modified.`, 'info');
      handleInspectGrn(g.id);
      return;
    }
    try {
      const res = await grnApi.getById(g.id);
      const fullGrn = res.data;
      setEditingGrnId(g.id);
      setFormData({
        grnNumber: fullGrn.grnNumber || '',
        grnDate: fullGrn.receivedDate || formatBusinessDate(),
        purchaseOrderId: fullGrn.purchaseOrderId || '',
        supplierId: fullGrn.supplierId || '',
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
          salePrice: 0,
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
        `GRN ${cancellingGrn.grnNumber} has been cancelled and inventory reversed!`,
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

  // CSV / Excel parse and import
  const handleParseCsv = (content) => {
    try {
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        addToast('CSV file is empty or missing data rows', 'warning');
        return;
      }

      // Expected headers: SKU/Code, Name, Qty, FreeQty, CostPrice, SalePrice, Discount%
      const parsedItems = [];
      let headerSkipped = false;

      for (const line of lines) {
        if (!headerSkipped) {
          headerSkipped = true;
          continue;
        }

        const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length < 3) continue;

        const codeOrSku = cols[0];
        const qty = parseInt(cols[2], 10) || 1;
        const freeQty = parseInt(cols[3], 10) || 0;
        const costPrice = parseFloat(cols[4]) || 0;
        const salePrice = parseFloat(cols[5]) || 0;
        const discountPct = parseFloat(cols[6]) || 0;

        // Match product by SKU or Name
        const matched = products.find(
          (p) =>
            p.sku?.toLowerCase() === codeOrSku.toLowerCase() ||
            p.name?.toLowerCase() === codeOrSku.toLowerCase() ||
            (cols[1] && p.name?.toLowerCase() === cols[1].toLowerCase())
        );

        if (matched) {
          const grossVal = qty * (costPrice || matched.costPrice || 0);
          const discAmt = (grossVal * discountPct) / 100;
          const netAmt = grossVal - discAmt;
          const finalCost = costPrice || matched.costPrice || 0;
          const finalSale = salePrice || matched.sellingPrice || 0;
          const gp = finalSale > 0 ? ((finalSale - finalCost) / finalSale) * 100 : 0;
          const totalUnits = qty + freeQty;
          const freeCost = totalUnits > 0 ? netAmt / totalUnits : finalCost;

          parsedItems.push({
            productId: matched.id,
            productCode: matched.sku,
            tradeName: matched.name,
            unitOfMeasure: matched.unitOfMeasure || 'PCS',
            quantityReceived: qty,
            freeQuantity: freeQty,
            packQty: 1,
            packSize: 1,
            unitCost: finalCost,
            salePrice: finalSale,
            creditPrice: finalSale * 1.05,
            wholesalePrice: finalSale * 0.9,
            purchaseValue: grossVal,
            discountPercent: discountPct,
            discountAmount: discAmt,
            amount: netAmt,
            gpPercent: Number(gp.toFixed(1)),
            freeCostPrice: Number(freeCost.toFixed(2)),
            priceCode: 'CSV-IMPORT',
            notes: `Imported via Spreadsheet | Free: ${freeQty} | Disc: ${discountPct}% | Sale: $${finalSale}`,
          });
        }
      }

      if (parsedItems.length === 0) {
        addToast('No products matched from the uploaded spreadsheet. Verify Product Codes / SKUs.', 'error');
        return;
      }

      setFormData((prev) => ({
        ...prev,
        items: mergeGrnItems([...prev.items, ...parsedItems]),
      }));

      addToast(`Successfully imported ${parsedItems.length} items from spreadsheet!`, 'success');
      setShowUploadModal(false);
      setCsvRawText('');
    } catch (err) {
      addToast('Failed to parse spreadsheet: ' + err.message, 'error');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      setCsvRawText(text);
      handleParseCsv(text);
    };
    reader.readAsText(file);
  };

  const downloadSampleCsv = () => {
    const sampleHeaders = 'ProductCode,TradeName,Quantity,FreeQuantity,CostPrice,SalePrice,DiscountPercent\n';
    const sampleRows = products.slice(0, 3).map((p) =>
      `${p.sku},"${p.name}",10,2,${p.costPrice || 10},${p.sellingPrice || 15},5`
    ).join('\n') || 'SKU-001,"Sample Product",10,1,25.00,35.00,5';

    const blob = new Blob([sampleHeaders + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_grn_intake.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredProducts = products.filter((p) => {
    const q = productQuery.toLowerCase();
    return (
      p.sku?.toLowerCase().includes(q) ||
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
    );
  });

  const filteredGrns = grns.filter((g) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !q ||
      g.grnNumber?.toLowerCase().includes(q) ||
      g.supplierName?.toLowerCase().includes(q) ||
      g.warehouseName?.toLowerCase().includes(q) ||
      g.supplierInvoiceNumber?.toLowerCase().includes(q);

    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PROCESSED' && g.status === 'PROCESSED') ||
      (statusFilter === 'DRAFT' && g.status === 'DRAFT') ||
      (statusFilter === 'CANCELLED' && g.status === 'CANCELLED');

    return matchSearch && matchStatus;
  });

  const handleExportCSV = () => {
    if (filteredGrns.length === 0) {
      addToast('No GRN records to export', 'warning');
      return;
    }
    const headers = 'GRN Number,Supplier,Warehouse,Status,Total Cost,Date,Invoice Number\n';
    const rows = filteredGrns.map((g) =>
      `"${g.grnNumber || ''}","${g.supplierName || ''}","${g.warehouseName || ''}","${g.status || ''}",${Number(g.totalAmount || 0).toFixed(2)},"${g.receivedDate || ''}","${g.supplierInvoiceNumber || ''}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `grn_records_${formatBusinessDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('GRN records exported to CSV', 'success');
  };

  const totals = calculateGrandTotals();

  return (
    <div
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
              <input
                type="text"
                placeholder="Search GRNs by #, supplier, warehouse, invoice..."
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

            {/* Right Controls: Filters, Upload, Export, Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
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
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="PROCESSED">Processed</option>
                <option value="DRAFT">Draft</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              {(statusFilter !== 'ALL' || searchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');
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
                  title="Reset all filters to default"
                >
                  <X size={13} /> Reset
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  resetAll();
                  setShowGrnForm(true);
                }}
                style={{
                  height: '38px',
                  padding: '0 16px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.2)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
              >
                <Plus size={16} /> + Create GRN
              </button>

              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                style={{
                  height: '38px',
                  padding: '0 14px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#16a34a',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
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
                onClick={handleExportCSV}
                style={{
                  height: '38px',
                  padding: '0 14px',
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
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
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
                title="Export GRNs to CSV"
              >
                <Download size={14} /> Export
              </button>

              <button
                type="button"
                onClick={loadData}
                style={{
                  height: '38px',
                  padding: '0 14px',
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
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
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
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>

          {/* GRN Table (Fixed Table Frame, Sticky Header, Internal Scroll for Data Rows Only) */}
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
              <table style={{ width: '100%', minWidth: '840px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                    <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      GRN NUMBER
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      SUPPLIER
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      WAREHOUSE
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      STATUS
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>
                      TOTAL COST
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      DATE
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        Loading GRN records...
                      </td>
                    </tr>
                  ) : filteredGrns.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        No GRN records found. Click <strong>+ New Inward GRN Intake</strong> to create a new intake.
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
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                            {g.grnNumber}
                          </span>
                          {g.supplierInvoiceNumber && (
                            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                              Inv: {g.supplierInvoiceNumber}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                          {g.supplierName || '—'}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#334155', fontSize: '0.84rem' }}>
                          {g.warehouseName || '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor:
                                g.status === 'PROCESSED'
                                  ? '#dcfce7'
                                  : g.status === 'CANCELLED'
                                  ? '#ffe4e6'
                                  : '#fef3c7',
                              color:
                                g.status === 'PROCESSED'
                                  ? '#16a34a'
                                  : g.status === 'CANCELLED'
                                  ? '#e11d48'
                                  : '#d97706',
                              border:
                                g.status === 'PROCESSED'
                                  ? '1px solid #bbf7d0'
                                  : g.status === 'CANCELLED'
                                  ? '1px solid #fecdd3'
                                  : '1px solid #fde68a',
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor:
                                  g.status === 'PROCESSED'
                                  ? '#16a34a'
                                  : g.status === 'CANCELLED'
                                  ? '#e11d48'
                                  : '#d97706',
                                display: 'inline-block',
                              }}
                            />
                            {g.status || 'DRAFT'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a', textAlign: 'right', fontSize: '0.85rem' }}>
                          ${Number(g.totalAmount || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#64748b' }}>
                          {g.receivedDate || (g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '—')}
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            {g.status === 'DRAFT' && canEditGrn && (
                              <button
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
                                title="Edit Draft GRN"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            <button
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
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {editingGrnId ? `Edit Draft Goods Received Note (GRN) — ${formData.grnNumber}` : 'Create Goods Received Note (GRN)'}
                  </h2>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '1px 0 0 0' }}>
                    Inward delivery workstation — stock updates, unit pricing & consignment verification
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  style={{
                    height: '32px',
                    padding: '0 10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
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
          <div className="grn-header-fields">
            <label>Supplier *<select className="input-glass" value={formData.supplierId} onChange={e => setFormData({...formData, supplierId:e.target.value})}>
              <option value="">Select supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
            <label>GRN type<select className="input-glass" value={formData.grnType} onChange={e => setFormData({...formData, grnType:e.target.value})}>
              {GRN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select></label>
            <label>Supplier invoice<input className="input-glass" maxLength={100} placeholder="Invoice reference" value={formData.supplierInvoiceNumber} onChange={e => setFormData({...formData, supplierInvoiceNumber:e.target.value})} /></label>
            <label>Remarks / notes<input className="input-glass" placeholder="Delivery note or remarks" value={formData.remarks} onChange={e => setFormData({...formData, remarks:e.target.value})} /></label>
            <label>GRN date *<input className="input-glass" type="date" required value={formData.grnDate} onChange={e => setFormData({...formData, grnDate:e.target.value})} /></label>
          </div>
          <div className="grn-workspace">
          {/* Product search and entry */}
          <div className="grn-entry"
            style={{
              padding: '14px 16px',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Row 1: Product Search Input */}
            <div ref={productSearchRef} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Search size={15} color="#2563eb" /> Product search & intake
                </label>
                {stagingItem.productId && (
                  <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle size={13} /> Product selected
                  </span>
                )}
              </div>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search
                  size={16}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }}
                />
                <input
                  type="text"
                  className="input-glass"
                  style={{
                    width: '100%',
                    fontSize: '0.9rem',
                    padding: '8px 36px 8px 36px',
                    height: '40px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontWeight: 500,
                    background: stagingItem.productId ? '#f8fafc' : '#ffffff',
                  }}
                  placeholder={
                    stagingItem.productId
                      ? `${stagingItem.productCode} — ${stagingItem.tradeName} (Click to change / search again)`
                      : 'Search product by SKU, trade name or barcode...'
                  }
                  value={productQuery}
                  onFocus={() => setShowProductDropdown(true)}
                  onChange={(e) => {
                    setProductQuery(e.target.value);
                    setShowProductDropdown(true);
                  }}
                />
                {productQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductQuery('');
                      setShowProductDropdown(false);
                    }}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px',
                    }}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Dropdown Results */}
              {showProductDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 40,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.12)',
                    marginTop: '4px',
                  }}
                >
                  {filteredProducts.length === 0 ? (
                    <div style={{ padding: '14px', fontSize: '0.84rem', color: '#64748b', textAlign: 'center' }}>
                      No matching products found.
                    </div>
                  ) : (
                    filteredProducts.slice(0, 50).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => selectProductForStaging(p)}
                        style={{
                          padding: '9px 14px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f1f5f9',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.86rem',
                          backgroundColor: stagingItem.productId === p.id ? '#eff6ff' : '#ffffff',
                          transition: 'background 0.12s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = stagingItem.productId === p.id ? '#eff6ff' : '#ffffff')}
                      >
                        <div>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', fontSize: '0.84rem' }}>
                            {p.sku}
                          </span>{' '}
                          — <span style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: '12px' }}>
                          <span>Last cost: <strong style={{ color: '#0f172a' }}>${Number(p.costPrice || 0).toFixed(2)}</strong></span>
                          <span>Selling: <strong>${Number(p.sellingPrice || 0).toFixed(2)}</strong></span>
                          <span>{p.defaultWarehouseName || 'No default warehouse'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="grn-selected-product">
              <span title={stagingItem.tradeName}>{stagingItem.productId ? `${stagingItem.productCode} — ${stagingItem.tradeName}` : 'Select a product to add a receipt line'}</span>

            </div>

            {stagingItem.productId && (
              <div className="grn-product-summary" aria-live="polite">
                <div><span>Last cost price</span><strong>{stagingItem.lastCostPrice == null ? 'Unavailable' : '$' + Number(stagingItem.lastCostPrice).toFixed(2)}</strong></div>
                <div><span>Available qty</span><strong>{stagingItem.stockLoading ? 'Loading…' : stagingItem.currentQuantity == null ? 'Unavailable' : stagingItem.currentQuantity + ' ' + stagingItem.unitOfMeasure}</strong></div>
                <div><span>Current selling price</span><strong>{stagingItem.currentSellingPrice == null ? 'Unavailable' : '$' + Number(stagingItem.currentSellingPrice).toFixed(2)}</strong></div>
              </div>
            )}

            <div className="grn-line-fields">
              {[
                ['quantity', 'RECEIVED QTY *', 0, '1'],
                ['freeQuantity', 'FREE (FOC)', 0, '1'],
                ['costPrice', 'UNIT COST ($) *', 0, '0.01'],
                ['discountPercent', 'DISCOUNT %', 0, '0.1'],
                ['salePrice', 'SELLING PRICE ($)', 0, '0.01'],
              ].map(([field, label, min, step]) => (
                <label key={field}>{label}
                  <input className="input-glass" type="number" min={min} step={step}
                    max={field === 'discountPercent' ? 100 : undefined}
                    value={stagingItem[field]} onChange={e => handleStagingChange(field, e.target.value)} />
                </label>
              ))}
              <label>LINE TOTAL<output className="grn-line-total">${Number(stagingItem.amount || 0).toFixed(2)}</output></label>
            </div>
            <button type="button" className="btn btn-primary grn-add-item" disabled={!stagingItem.productId || saving} onClick={handleAddItemToGrn}>
              <Plus size={16} /> Add item
            </button>
          </div>

          {/* Received items */}
          <div className="grn-items">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1e293b' }}>
                Received items ({formData.items.length})
              </span>
              <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, background: '#f1f5f9', padding: '3px 10px', borderRadius: '6px' }}>
                Total Received Units: <strong style={{ color: '#0f172a' }}>{totals.totalQty}</strong> + <strong style={{ color: '#15803d' }}>{totals.totalFree} FOC</strong> = <strong style={{ color: '#1d4ed8' }}>{totals.totalQty + totals.totalFree} units</strong>
              </span>
            </div>

            {formData.items.length === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1.5px dashed #cbd5e1',
                  color: '#64748b',
                  fontSize: '0.86rem',
                }}
              >
                No items added yet. Search a product and click <strong>"Add item"</strong> or upload a sheet.
              </div>
            ) : (
              <div className="grn-table-scroll">
                <table className="glass-table" style={{ margin: 0, minWidth: '650px', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px 12px', width: '40px' }}>#</th>
                      <th style={{ padding: '8px 12px' }}>Product</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px' }}>Free</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px' }}>Unit Cost</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px' }}>Disc ($)</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px' }}>Net Total</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px' }}>GP%</th>
                      <th style={{ padding: '8px 12px', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((it, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '8px 12px', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.86rem' }}>
                            {it.tradeName}
                          </div>
                          <div style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: '#2563eb' }}>
                            {it.productCode} {it.priceCode ? `• ${it.priceCode}` : ''}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.86rem', padding: '8px 12px' }}>{it.quantityReceived}</td>
                        <td style={{ textAlign: 'right', color: '#15803d', fontWeight: 700, fontSize: '0.86rem', padding: '8px 12px' }}>
                          {it.freeQuantity || '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.86rem', padding: '8px 12px' }}>${Number(it.unitCost).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', color: '#475569', fontSize: '0.86rem', padding: '8px 12px' }}>
                          {it.discountAmount > 0 ? `$${it.discountAmount.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 900, color: '#1d4ed8', fontSize: '0.9rem', padding: '8px 12px' }}>
                          ${Number(it.amount).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.86rem', padding: '8px 12px', color: it.gpPercent >= 20 ? '#15803d' : '#b45309' }}>
                          {it.gpPercent}%
                        </td>
                        <td style={{ textAlign: 'right', padding: '8px 12px' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                            title="Remove line"
                          >
                            <X size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
            </div>
          </div>

            </div>
            {/* Pinned totals and actions */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>ITEMS:</span>{' '}
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{formData.items.length} ({totals.totalQty + totals.totalFree} units)</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>GROSS:</span>{' '}
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>${totals.grossValue.toFixed(2)}</strong>
                </div>
                {totals.totalDiscount > 0 && (
                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>DISC:</span>{' '}
                    <strong style={{ fontSize: '0.9rem', color: '#16a34a' }}>-${totals.totalDiscount.toFixed(2)}</strong>
                  </div>
                )}
                <div>
                  <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>NET PAYABLE:</span>{' '}
                  <strong style={{ fontSize: '1.25rem', color: '#0284c7', fontWeight: 900 }}>${totals.netPayable.toFixed(2)}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowGrnForm(false)}
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
                  Back to GRNs
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveGrn(false)}
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
                  {editingGrnId ? 'Update Draft' : 'Save Draft'}
                </button>
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
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <CheckCircle size={16} />
                  {saving ? 'Saving Inventory...' : 'Save Inventory'}
                </button>
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
                <h2 style={{ fontSize: '1.35rem', color: '#0f172a', margin: 0 }}>
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

            <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '18px', lineHeight: 1.5 }}>
              Upload your Excel (.xlsx / .csv) sheet or paste comma-separated product data to automatically import all line items into the GRN intake form.
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
              <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.98rem' }}>
                Click to Select Spreadsheet File (.csv / .xlsx)
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '6px' }}>
                File columns: ProductCode, TradeName, Quantity, FreeQty, CostPrice, SalePrice, Discount%
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Need a starting format?</span>
              <button
                type="button"
                className="btn btn-glass btn-sm"
                onClick={downloadSampleCsv}
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
              >
                Download Sample CSV Template
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-glass" onClick={() => setShowUploadModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GRN INSPECTION MODAL (Modern, Large, High-Contrast for 45+ Decision Makers) */}
      {selectedGrn && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: 'min(1040px, 96vw)',
              maxWidth: '1040px',
              height: 'min(92vh, calc(100vh - 24px))',
              maxHeight: 'calc(100vh - 24px)',
              background: '#ffffff',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Title and Quick Document Action Buttons (Sticky Top) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e2e8f0',
                padding: '12px 18px',
                flexShrink: 0,
                backgroundColor: '#ffffff',
                gap: '10px',
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  INWARD GOODS RECEIVED NOTE
                </span>
                <h2 style={{ fontSize: '1.25rem', color: '#0f172a', margin: '1px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={20} color="#2563eb" /> {selectedGrn.grnNumber}
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => handleDownloadPdf(selectedGrn.id, selectedGrn.grnNumber)}
                  title="Download PDF file to computer"
                  style={{ fontSize: '0.82rem', fontWeight: 700, color: '#15803d', borderColor: '#86efac', padding: '6px 11px' }}
                >
                  <Download size={13} color="#15803d" /> PDF
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handlePrintPdf(selectedGrn.id)}
                  title="Open system print dialog directly"
                  style={{ fontSize: '0.82rem', fontWeight: 700, padding: '6px 13px' }}
                >
                  <Printer size={13} /> Print
                </button>
                <button
                  onClick={() => setSelectedGrn(null)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Close window"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Scrollable Modal Content */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                backgroundColor: '#ffffff',
              }}
            >
              {/* Cancellation Status Banner */}
              {selectedGrn.status === 'CANCELLED' && (
                <div
                  style={{
                    padding: '12px 16px',
                    background: '#fff1f2',
                    borderRadius: '8px',
                    border: '1px solid #fecdd3',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#be123c', fontWeight: 800, fontSize: '0.92rem' }}>
                    <XCircle size={17} /> Consignment Cancelled & Live Stock Reversed
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#9f1239' }}>
                    <strong>Cancelled By:</strong> {selectedGrn.cancelledBy || 'User'} &nbsp;|&nbsp;{' '}
                    <strong>Cancelled At:</strong> {selectedGrn.cancelledAt ? new Date(selectedGrn.cancelledAt).toLocaleString() : '—'}
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#9f1239' }}>
                    <strong>Cancellation Reason:</strong> {selectedGrn.cancelReason || 'No reason specified'}
                  </div>
                </div>
              )}

              {/* High-Contrast Decision Highlight Tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '14px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                    TOTAL INWARD VALUE
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1d4ed8', marginTop: '3px' }}>
                    ${Number(selectedGrn.totalAmount || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: '2px' }}>
                    Total billed intake for this consignment
                  </div>
                </div>

                <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    CONSIGNMENT STATUS
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    <span
                      style={{
                        fontSize: '0.88rem',
                        padding: '4px 10px',
                        fontWeight: 800,
                        display: 'inline-block',
                        borderRadius: '6px',
                        backgroundColor:
                          selectedGrn.status === 'PROCESSED'
                            ? '#dcfce7'
                            : selectedGrn.status === 'CANCELLED'
                            ? '#ffe4e6'
                            : '#fef3c7',
                        color:
                          selectedGrn.status === 'PROCESSED'
                            ? '#16a34a'
                            : selectedGrn.status === 'CANCELLED'
                            ? '#e11d48'
                            : '#d97706',
                        border:
                          selectedGrn.status === 'PROCESSED'
                            ? '1px solid #bbf7d0'
                            : selectedGrn.status === 'CANCELLED'
                            ? '1px solid #fecdd3'
                            : '1px solid #fde68a',
                      }}
                    >
                      {selectedGrn.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    {selectedGrn.status === 'PROCESSED'
                      ? 'Inventory posted to live stock'
                      : selectedGrn.status === 'CANCELLED'
                      ? 'Consignment cancelled & stock reversed'
                      : 'Draft / pending approval'}
                  </div>
                </div>

                <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    DESTINATION WAREHOUSE
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '3px' }}>
                    {selectedGrn.warehouseName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    Received Date: {selectedGrn.receivedDate || (selectedGrn.createdAt ? new Date(selectedGrn.createdAt).toLocaleDateString() : '—')}
                  </div>
                </div>
              </div>

              {/* Supplier & Consignment Metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.88rem' }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>SUPPLIER / VENDOR</div>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.96rem', marginTop: '2px' }}>
                    {selectedGrn.supplierName}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#64748b' }}>Code: {selectedGrn.supplierCode || 'N/A'}</div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>SUPPLIER INVOICE / DC #</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.94rem', marginTop: '2px' }}>
                    {selectedGrn.supplierInvoiceNumber || '—'}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#64748b' }}>Vendor delivery reference</div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>RECORDED BY</div>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                    {selectedGrn.createdBy || 'System Administrator'}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                    {selectedGrn.createdAt ? new Date(selectedGrn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              </div>

              {selectedGrn.notes && (
                <div style={{ padding: '8px 12px', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fef3c7', fontSize: '0.84rem', color: '#92400e' }}>
                  <span style={{ fontWeight: 700 }}>Notes / Remarks:</span> {selectedGrn.notes}
                </div>
              )}

              {/* Line Items Table (with overflowX: auto) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Consignment Line Items ({selectedGrn.items?.length || 0} products)
                  </h3>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflowX: 'auto', maxWidth: '100%' }}>
                  <table className="glass-table" style={{ margin: 0, minWidth: '600px' }}>
                    <thead style={{ background: '#f1f5f9' }}>
                      <tr>
                        <th style={{ padding: '10px 12px', color: '#334155', fontWeight: 800, fontSize: '0.78rem' }}>#</th>
                        <th style={{ padding: '10px 12px', color: '#334155', fontWeight: 800, fontSize: '0.78rem' }}>Product Description</th>
                        <th style={{ padding: '10px 12px', color: '#334155', fontWeight: 800, fontSize: '0.78rem' }}>Code (SKU)</th>
                        <th style={{ padding: '10px 12px', color: '#334155', fontWeight: 800, fontSize: '0.78rem', textAlign: 'right' }}>Received Qty</th>
                        <th style={{ padding: '10px 12px', color: '#334155', fontWeight: 800, fontSize: '0.78rem', textAlign: 'right' }}>Unit Cost</th>
                        <th style={{ padding: '10px 12px', color: '#334155', fontWeight: 800, fontSize: '0.78rem', textAlign: 'right' }}>Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedGrn.items?.map((it, idx) => (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.82rem' }}>{idx + 1}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                            {it.productName}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#1d4ed8', fontWeight: 600, fontSize: '0.82rem' }}>
                            {it.productSku || '—'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                            {it.quantityReceived} {it.unitOfMeasure || ''}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#334155', fontSize: '0.86rem' }}>
                            ${Number(it.unitCost || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#1d4ed8', fontSize: '0.94rem' }}>
                            ${Number(it.totalCost || (it.quantityReceived * it.unitCost) || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Bottom Footer Actions (Sticky Bottom) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid #e2e8f0',
                padding: '12px 20px',
                backgroundColor: '#f8fafc',
                flexShrink: 0,
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '0.98rem', color: '#334155', fontWeight: 700 }}>
                Consignment Total: <strong style={{ color: '#1d4ed8', fontSize: '1.25rem', fontWeight: 900 }}>${Number(selectedGrn.totalAmount || 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedGrn.status === 'PROCESSED' && (
                  <button
                    type="button"
                    onClick={() => handleOpenCancelModal(selectedGrn)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#fff1f2',
                      color: '#e11d48',
                      border: '1px solid #fecdd3',
                      borderRadius: '6px',
                      padding: '7px 14px',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ffe4e6')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff1f2')}
                    title="Cancel GRN and reverse live stock"
                  >
                    <RotateCcw size={14} /> Cancel GRN
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => handleDownloadPdf(selectedGrn.id, selectedGrn.grnNumber)}
                  style={{ fontSize: '0.84rem', fontWeight: 700, color: '#15803d', borderColor: '#86efac', padding: '7px 12px' }}
                >
                  <Download size={14} color="#15803d" /> PDF
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handlePrintPdf(selectedGrn.id)}
                  style={{ fontSize: '0.84rem', fontWeight: 700, padding: '7px 14px' }}
                >
                  <Printer size={14} /> Print
                </button>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setSelectedGrn(null)}
                  style={{ fontSize: '0.84rem', padding: '7px 14px' }}
                >
                  Back to GRNs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL GRN MODAL DIALOG */}
      {cancellingGrn && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1250, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: 'min(520px, 96vw)',
              maxWidth: '520px',
              maxHeight: 'calc(100vh - 24px)',
              overflowY: 'auto',
              padding: '24px',
              background: '#ffffff',
              borderRadius: '12px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e11d48', marginBottom: '14px' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '1.22rem', fontWeight: 800, color: '#0f172a' }}>
                Cancel GRN {cancellingGrn.grnNumber}
              </h3>
            </div>

            <div style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '16px', lineHeight: 1.5 }}>
              {cancellingGrn.status === 'PROCESSED' ? (
                <div style={{ padding: '10px 14px', background: '#fff1f2', borderRadius: '6px', border: '1px solid #fecdd3', color: '#be123c' }}>
                  Cancelling this processed GRN will deduct received quantities from warehouse live inventory.
                  If available stock in <strong>{cancellingGrn.warehouseName}</strong> is insufficient, the cancellation will be rejected.
                </div>
              ) : (
                <div>
                  Are you sure you want to cancel draft GRN <strong>{cancellingGrn.grnNumber}</strong>?
                </div>
              )}
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Reason for Cancellation <span style={{ color: '#e11d48' }}>*</span>
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter cancellation reason (e.g., incorrect supplier delivery, wrong pricing, damaged goods returned)..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#0284c7')}
                onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-glass"
                disabled={cancelLoading}
                onClick={() => setCancellingGrn(null)}
              >
                Close
              </button>
              <button
                type="button"
                disabled={cancelLoading || !cancelReason.trim()}
                onClick={handleConfirmCancelGrn}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#e11d48',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: cancelLoading || !cancelReason.trim() ? 'not-allowed' : 'pointer',
                  opacity: cancelLoading || !cancelReason.trim() ? 0.6 : 1,
                }}
              >
                {cancelLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default GrnView;
