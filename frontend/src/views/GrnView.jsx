import React, { useState, useEffect, useRef } from 'react';
import { grnApi, supplierApi, warehouseApi, productApi, inventoryApi, pdfApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  FileCheck,
  Plus,
  Search,
  Printer,
  CheckCircle,
  Trash2,
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
} from 'lucide-react';

const GRN_TYPES = [
  'Standard Inward',
  'Direct Purchase',
  'Consignment Intake',
  'Inter-Branch Transfer In',
  'Import Shipment',
  'Sample / Promotional',
];

export default function GrnView() {
  const [grns, setGrns] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouseStock, setWarehouseStock] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  // Split-view Left Panel: GRN Header Form State
  const [formData, setFormData] = useState({
    grnNumber: '',
    grnDate: new Date().toISOString().split('T')[0],
    supplierId: '',
    warehouseId: '',
    grnType: GRN_TYPES[0],
    supplierInvoiceNumber: '',
    remarks: '',
    items: [],
  });

  // Staging line workstation state for adding items one by one
  const [stagingItem, setStagingItem] = useState({
    productId: '',
    productCode: '',
    tradeName: '',
    categoryName: '',
    unitOfMeasure: 'PCS',
    // Quantity Section
    quantity: 1,
    freeQuantity: 0,
    currentQuantity: 0,
    packQty: 1,
    packSize: 1,
    purchaseValue: 0,
    discountPercent: 0,
    discountAmount: 0,
    amount: 0,
    // Price Section
    costPrice: 0,
    salePrice: 0,
    creditPrice: 0,
    markupPrice: 0,
    wholesalePrice: 0,
    gpPercent: 0,
    freeCostPrice: 0,
    priceCode: '',
    // Last GRN Quantity & Price Details
    lastGrnQuantity: null,
    lastGrnFreeQty: null,
    lastGrnItemCount: null,
    lastGrnRealCost: null,
    lastGrnSalePrice: null,
    lastGrnDiscount: null,
    lastGrnSupplierCost: null,
  });

  // Search filter for product staging selection
  const [productQuery, setProductQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

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
        stockMap[b.productId] = b.quantity || 0;
      });
      setWarehouseStock(stockMap);
      return stockMap;
    } catch (err) {
      console.error('Failed to load warehouse stock:', err);
      return {};
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [grnRes, supRes, whRes, prodRes] = await Promise.all([
        grnApi.search({ size: 100 }),
        supplierApi.getActive(),
        warehouseApi.getActive(),
        productApi.getProducts({ size: 300, activeOnly: true }),
      ]);

      const gList = grnRes.data?.content || grnRes.data || [];
      const sList = supRes.data || [];
      const wList = whRes.data || [];
      const pList = prodRes.data?.content || prodRes.data || [];

      setGrns(gList);
      setSuppliers(sList);
      setWarehouses(wList);
      setProducts(pList);

      const targetWh = formData.warehouseId || (wList.find((w) => w.isPrimary)?.id || (wList.length > 0 ? wList[0].id : ''));
      const targetSup = formData.supplierId || (sList.length > 0 ? sList[0].id : '');

      setFormData((prev) => ({
        ...prev,
        warehouseId: prev.warehouseId || targetWh,
        supplierId: prev.supplierId || targetSup,
      }));

      const stockMap = await loadStockForWarehouse(targetWh);

      // Initialize default staging product if available
      if (pList.length > 0 && !stagingItem.productId) {
        selectProductForStaging(pList[0], targetWh, stockMap, gList);
      }
    } catch (err) {
      addToast('Failed to load GRN intake data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleWarehouseChange = async (whId) => {
    setFormData((prev) => ({ ...prev, warehouseId: whId }));
    const stockMap = await loadStockForWarehouse(whId);
    if (stagingItem.productId) {
      setStagingItem((prev) => ({
        ...prev,
        currentQuantity: stockMap[prev.productId] || 0,
      }));
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

  const selectProductForStaging = (prod, whId = formData.warehouseId, stockMap = warehouseStock, grnList = grns) => {
    if (!prod) return;
    const currentStock = stockMap[prod.id] || 0;
    const cost = Number(prod.costPrice) || 0;
    const sale = Number(prod.sellingPrice) || 0;
    const wholesale = Number(prod.wholesalePrice) || (sale ? sale * 0.9 : cost * 1.15);
    const credit = Number(prod.creditPrice) || (sale ? sale * 1.05 : cost * 1.25);
    const markup = sale > cost ? sale - cost : 0;
    const gp = sale > 0 ? ((sale - cost) / sale) * 100 : 0;

    const hist = findLastGrnDetails(prod.id, grnList);

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

    setProductQuery(`${prod.sku} — ${prod.name}`);
    setShowProductDropdown(false);
  };

  // Recalculate staging calculations whenever quantities, prices, or discounts change
  const handleStagingChange = (field, value) => {
    setStagingItem((prev) => {
      const updated = { ...prev, [field]: value };

      let qty = field === 'quantity' ? Math.max(0, parseInt(value, 10) || 0) : prev.quantity;
      let free = field === 'freeQuantity' ? Math.max(0, parseInt(value, 10) || 0) : prev.freeQuantity;
      let cost = field === 'costPrice' ? Math.max(0, parseFloat(value) || 0) : prev.costPrice;
      let sale = field === 'salePrice' ? Math.max(0, parseFloat(value) || 0) : prev.salePrice;
      let packQ = field === 'packQty' ? Math.max(1, parseInt(value, 10) || 1) : prev.packQty;
      let packS = field === 'packSize' ? Math.max(1, parseInt(value, 10) || 1) : prev.packSize;

      // If user altered packQty or packSize, auto update quantity
      if (field === 'packQty' || field === 'packSize') {
        qty = packQ * packS;
        updated.quantity = qty;
      }

      const grossValue = qty * cost;
      updated.purchaseValue = grossValue;

      let discPct = prev.discountPercent;
      let discAmt = prev.discountAmount;

      if (field === 'discountPercent') {
        discPct = Math.max(0, Math.min(100, parseFloat(value) || 0));
        discAmt = (grossValue * discPct) / 100;
        updated.discountPercent = discPct;
        updated.discountAmount = discAmt;
      } else if (field === 'discountAmount') {
        discAmt = Math.max(0, parseFloat(value) || 0);
        discPct = grossValue > 0 ? (discAmt / grossValue) * 100 : 0;
        updated.discountAmount = discAmt;
        updated.discountPercent = Number(discPct.toFixed(2));
      } else {
        discAmt = (grossValue * discPct) / 100;
        updated.discountAmount = discAmt;
      }

      const netAmount = Math.max(0, grossValue - discAmt);
      updated.amount = netAmount;

      // Price and GP metrics
      const markup = sale > cost ? sale - cost : 0;
      updated.markupPrice = Number(markup.toFixed(2));

      const gp = sale > 0 ? ((sale - cost) / sale) * 100 : 0;
      updated.gpPercent = Number(gp.toFixed(1));

      const totalEffectiveUnits = qty + free;
      const freeCost = totalEffectiveUnits > 0 ? netAmount / totalEffectiveUnits : cost;
      updated.freeCostPrice = Number(freeCost.toFixed(2));

      return updated;
    });
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
      items: [...prev.items, newItem],
    }));

    addToast(`Added "${stagingItem.tradeName}" to GRN intake!`, 'success');

    // Reset staging item for next scan/search
    const nextProd = products.find((p) => p.id !== stagingItem.productId) || products[0];
    if (nextProd) {
      selectProductForStaging(nextProd);
    }
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
    const defaultSup = suppliers.length > 0 ? suppliers[0].id : '';
    const defaultWh = warehouses.find((w) => w.isPrimary)?.id || (warehouses.length > 0 ? warehouses[0].id : '');

    setFormData({
      grnNumber: '',
      grnDate: new Date().toISOString().split('T')[0],
      supplierId: defaultSup,
      warehouseId: defaultWh,
      grnType: GRN_TYPES[0],
      supplierInvoiceNumber: '',
      remarks: '',
      items: [],
    });

    if (products.length > 0) {
      selectProductForStaging(products[0], defaultWh);
    }
  };

  const handleSaveGrn = async (processImmediately = true) => {
    if (!formData.supplierId || !formData.warehouseId) {
      addToast('Please select both Supplier and Warehouse', 'error');
      return;
    }
    if (formData.items.length === 0) {
      addToast('Add at least one product item to the GRN', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        supplierId: Number(formData.supplierId),
        warehouseId: Number(formData.warehouseId),
        supplierInvoiceNumber: formData.supplierInvoiceNumber.trim() || null,
        receivedDate: formData.grnDate || new Date().toISOString().split('T')[0],
        notes: `Type: ${formData.grnType} | Ref: ${formData.supplierInvoiceNumber || 'N/A'}${formData.remarks ? ' | ' + formData.remarks : ''}`,
        items: formData.items.map((it) => ({
          productId: Number(it.productId),
          quantityReceived: Number(it.quantityReceived) + (Number(it.freeQuantity) || 0), // Include free issue into received inventory count
          unitCost: Number(it.unitCost),
          notes: it.notes,
        })),
      };

      const res = await grnApi.create(payload, processImmediately);
      const grnNum = res.data?.grnNumber || 'GRN';

      addToast(
        `GRN ${grnNum} ${processImmediately ? 'processed! Inventory posted to warehouse.' : 'saved as draft.'}`,
        'success'
      );

      resetAll();
      loadData();
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
        items: [...prev.items, ...parsedItems],
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
    return (
      g.grnNumber?.toLowerCase().includes(q) ||
      g.supplierName?.toLowerCase().includes(q) ||
      g.warehouseName?.toLowerCase().includes(q) ||
      g.supplierInvoiceNumber?.toLowerCase().includes(q)
    );
  });

  const totals = calculateGrandTotals();

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.7rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <FileCheck size={26} color="#2563eb" /> Goods Received Notes (GRN)
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
            Inward inventory intake — record new stock intake with comprehensive quantity and price economics above, and view or print recorded GRNs below
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-glass"
            onClick={() => setShowUploadModal(true)}
            title="Upload Excel or CSV Sheet"
          >
            <FileSpreadsheet size={16} color="#16a34a" /> Upload Excel Sheet
          </button>
          <button className="btn btn-glass" onClick={loadData} title="Refresh records">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Vertical Stack: GRN Intake UP, View GRNs DOWN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* TOP SECTION: Comprehensive GRN Intake Workstation (Full Width) */}
        <div
          className="glass-card"
          style={{
            width: '100%',
            padding: '24px',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {/* SECTION 1: Common Header Controls (Date, Warehouse, Supplier, Type, Invoice #) */}
          <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
              <Package size={17} color="#2563eb" />
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                1. Inward Shipment & Warehouse Details
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px' }}>
              {/* GRN Date */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  GRN DATE *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="date"
                    className="input-glass"
                    style={{ fontSize: '0.88rem', padding: '7px 10px', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600, color: '#0f172a' }}
                    value={formData.grnDate}
                    onChange={(e) => setFormData({ ...formData, grnDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Destination Warehouse */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  DESTINATION WAREHOUSE *
                </label>
                <select
                  className="input-glass"
                  style={{ fontSize: '0.88rem', padding: '7px 10px', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600, color: '#0f172a' }}
                  value={formData.warehouseId}
                  onChange={(e) => handleWarehouseChange(e.target.value)}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.isPrimary ? '(Primary)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Supplier */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  SUPPLIER *
                </label>
                <select
                  className="input-glass"
                  style={{ fontSize: '0.88rem', padding: '7px 10px', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600, color: '#0f172a' }}
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code || s.supplierCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* GRN Type */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  GRN TYPE *
                </label>
                <select
                  className="input-glass"
                  style={{ fontSize: '0.88rem', padding: '7px 10px', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600, color: '#0f172a' }}
                  value={formData.grnType}
                  onChange={(e) => setFormData({ ...formData, grnType: e.target.value })}
                >
                  {GRN_TYPES.map((t, i) => (
                    <option key={i} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Supplier Invoice / Ref # */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  SUPPLIER INVOICE #
                </label>
                <input
                  type="text"
                  className="input-glass"
                  style={{ fontSize: '0.88rem', padding: '7px 10px', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600, color: '#0f172a' }}
                  placeholder="e.g. INV-89241"
                  value={formData.supplierInvoiceNumber}
                  onChange={(e) => setFormData({ ...formData, supplierInvoiceNumber: e.target.value })}
                />
              </div>

              {/* Remarks / Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  REMARKS / NOTES
                </label>
                <input
                  type="text"
                  className="input-glass"
                  style={{ fontSize: '0.88rem', padding: '7px 10px', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600, color: '#0f172a' }}
                  placeholder="Delivery note / batch ref..."
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Item Entry Workstation (Search Product, Quantities, Prices, Last GRN Comparison) */}
          <div
            style={{
              padding: '18px',
              borderRadius: '10px',
              background: '#ffffff',
              border: '2px solid #3b82f6',
              boxShadow: '0 4px 16px rgba(37, 99, 235, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Product Code & Trade Name Search */}
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.3px' }}>
                  <Search size={16} /> 2. ITEM CODE (SKU) & TRADE NAME *
                </label>
                {stagingItem.productId && (
                  <span style={{ fontSize: '0.82rem', background: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: '6px', fontWeight: 800, border: '1px solid #bfdbfe' }}>
                    Current Warehouse Stock: <strong>{stagingItem.currentQuantity}</strong> {stagingItem.unitOfMeasure}
                  </span>
                )}
              </div>

              <input
                type="text"
                className="input-glass"
                style={{ width: '100%', fontSize: '0.95rem', fontWeight: 600, padding: '9px 14px', height: '42px', borderRadius: '8px', border: '1.5px solid #93c5fd' }}
                placeholder="Type Product Code (SKU) or Trade Name to search inventory..."
                value={productQuery}
                onFocus={() => setShowProductDropdown(true)}
                onChange={(e) => {
                  setProductQuery(e.target.value);
                  setShowProductDropdown(true);
                }}
              />

              {showProductDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 20,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    maxHeight: '240px',
                    overflowY: 'auto',
                    boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
                    marginTop: '4px',
                  }}
                >
                  {filteredProducts.length === 0 ? (
                    <div style={{ padding: '14px', fontSize: '0.86rem', color: '#64748b', textAlign: 'center' }}>
                      No matching products found.
                    </div>
                  ) : (
                    filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => selectProductForStaging(p)}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f1f5f9',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.88rem',
                          transition: 'background 0.12s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                      >
                        <div>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8', fontSize: '0.9rem' }}>
                            {p.sku}
                          </span>{' '}
                          — <span style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 500 }}>
                          Cost: <strong style={{ color: '#0f172a' }}>${Number(p.costPrice || 0).toFixed(2)}</strong> | Stock: <strong style={{ color: '#2563eb' }}>{warehouseStock[p.id] || 0}</strong>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* QUANTITY & PRICE 2-COLUMN GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px' }}>
              {/* QUANTITY SECTION */}
              <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={14} color="#2563eb" /> Quantity & Pack Breakdown
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: '10px' }}>
                  {/* Quantity */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      QUANTITY *
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="input-glass"
                      style={{ padding: '6px 10px', fontSize: '0.92rem', fontWeight: 700, height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      value={stagingItem.quantity}
                      onChange={(e) => handleStagingChange('quantity', e.target.value)}
                    />
                  </div>

                  {/* Free Quantity */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#15803d', marginBottom: '3px' }}>
                      FREE QTY (FOC)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="input-glass"
                      style={{ padding: '6px 10px', fontSize: '0.92rem', color: '#15803d', fontWeight: 700, height: '36px', borderRadius: '6px', border: '1.5px solid #86efac', background: '#f0fdf4' }}
                      value={stagingItem.freeQuantity}
                      onChange={(e) => handleStagingChange('freeQuantity', e.target.value)}
                    />
                  </div>

                  {/* Pack Qty */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      PACK QTY
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="input-glass"
                      style={{ padding: '6px 10px', fontSize: '0.9rem', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      value={stagingItem.packQty}
                      onChange={(e) => handleStagingChange('packQty', e.target.value)}
                    />
                  </div>

                  {/* Pack Size */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      PACK SIZE
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="input-glass"
                      style={{ padding: '6px 10px', fontSize: '0.9rem', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      value={stagingItem.packSize}
                      onChange={(e) => handleStagingChange('packSize', e.target.value)}
                    />
                  </div>

                  {/* Purchase Value (Gross) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      PURCHASE VALUE
                    </label>
                    <div style={{ padding: '7px 10px', background: '#e2e8f0', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', height: '36px', display: 'flex', alignItems: 'center' }}>
                      ${Number(stagingItem.purchaseValue || 0).toFixed(2)}
                    </div>
                  </div>

                  {/* Discount % */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      DISCOUNT %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      className="input-glass"
                      style={{ padding: '6px 10px', fontSize: '0.9rem', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      value={stagingItem.discountPercent}
                      onChange={(e) => handleStagingChange('discountPercent', e.target.value)}
                    />
                  </div>

                  {/* Discount # (Amount) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      DISCOUNT # ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input-glass"
                      style={{ padding: '6px 10px', fontSize: '0.9rem', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      value={stagingItem.discountAmount}
                      onChange={(e) => handleStagingChange('discountAmount', e.target.value)}
                    />
                  </div>

                  {/* Net Amount */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#1d4ed8', marginBottom: '3px' }}>
                      NET AMOUNT ($)
                    </label>
                    <div style={{ padding: '7px 10px', background: '#dbeafe', borderRadius: '6px', fontSize: '0.95rem', fontWeight: 800, color: '#1d4ed8', height: '36px', display: 'flex', alignItems: 'center', border: '1px solid #bfdbfe' }}>
                      ${Number(stagingItem.amount || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Last GRN Quantity Details Card */}
                <div
                  style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '14px',
                    fontSize: '0.78rem',
                    color: '#334155',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 800, color: '#0f172a' }}>
                    <History size={14} color="#2563eb" /> Last GRN Qty Details:
                  </div>
                  <div>
                    Last Qty:{' '}
                    <strong style={{ color: '#0f172a', fontSize: '0.84rem' }}>
                      {stagingItem.lastGrnQuantity !== null ? `${stagingItem.lastGrnQuantity}` : '—'}
                    </strong>
                  </div>
                  <div>
                    Last Free Qty:{' '}
                    <strong style={{ color: '#15803d', fontSize: '0.84rem' }}>
                      {stagingItem.lastGrnFreeQty !== null ? `${stagingItem.lastGrnFreeQty}` : '0'}
                    </strong>
                  </div>
                  <div>
                    Last Order Count:{' '}
                    <strong style={{ color: '#0f172a', fontSize: '0.84rem' }}>
                      {stagingItem.lastGrnItemCount !== null ? `${stagingItem.lastGrnItemCount} items` : '—'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* PRICE SECTION */}
              <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={14} color="#2563eb" /> Price & Margin Economics
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: '10px' }}>
                  {/* Cost Price */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      COST PRICE *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input-glass"
                      style={{ padding: '6px 10px', fontSize: '0.92rem', fontWeight: 700, height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      value={stagingItem.costPrice}
                      onChange={(e) => handleStagingChange('costPrice', e.target.value)}
                    />
                  </div>

                  {/* Sale Price */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      SALE PRICE *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input-glass"
                      style={{ padding: '6px 10px', fontSize: '0.92rem', fontWeight: 700, height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      value={stagingItem.salePrice}
                      onChange={(e) => handleStagingChange('salePrice', e.target.value)}
                    />
                  </div>

                  {/* Credit Price */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      CREDIT PRICE
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input-glass"
                      style={{ padding: '6px 10px', fontSize: '0.9rem', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      value={stagingItem.creditPrice}
                      onChange={(e) => handleStagingChange('creditPrice', e.target.value)}
                    />
                  </div>

                  {/* Markup Price */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      MARKUP PRICE
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-glass"
                      style={{ padding: '6px 10px', fontSize: '0.9rem', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      value={stagingItem.markupPrice}
                      onChange={(e) => handleStagingChange('markupPrice', e.target.value)}
                    />
                  </div>

                  {/* Wholesale Price */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      WHOLESALE
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input-glass"
                      style={{ padding: '6px 10px', fontSize: '0.9rem', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      value={stagingItem.wholesalePrice}
                      onChange={(e) => handleStagingChange('wholesalePrice', e.target.value)}
                    />
                  </div>

                  {/* GP% */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      GP %
                    </label>
                    <div
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '0.92rem',
                        fontWeight: 800,
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: stagingItem.gpPercent >= 20 ? '#dcfce7' : stagingItem.gpPercent >= 10 ? '#fef3c7' : '#fee2e2',
                        color: stagingItem.gpPercent >= 20 ? '#15803d' : stagingItem.gpPercent >= 10 ? '#b45309' : '#b91c1c',
                        border: stagingItem.gpPercent >= 20 ? '1px solid #86efac' : stagingItem.gpPercent >= 10 ? '1px solid #fde68a' : '1px solid #fecaca',
                      }}
                    >
                      {stagingItem.gpPercent}%
                    </div>
                  </div>

                  {/* Free Cost Price */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#0369a1', marginBottom: '3px' }}>
                      FREE COST PRICE
                    </label>
                    <div style={{ padding: '6px 10px', background: '#e0f2fe', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 800, color: '#0369a1', height: '36px', display: 'flex', alignItems: 'center', border: '1px solid #bae6fd' }}>
                      ${Number(stagingItem.freeCostPrice || 0).toFixed(2)}
                    </div>
                  </div>

                  {/* Price Code */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      PRICE CODE
                    </label>
                    <input
                      type="text"
                      className="input-glass"
                      style={{ padding: '6px 10px', fontSize: '0.9rem', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      placeholder="e.g. PC-01"
                      value={stagingItem.priceCode}
                      onChange={(e) => handleStagingChange('priceCode', e.target.value)}
                    />
                  </div>
                </div>

                {/* Last GRN Price Details Card */}
                <div
                  style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '14px',
                    fontSize: '0.78rem',
                    color: '#334155',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 800, color: '#0f172a' }}>
                    <TrendingUp size={14} color="#2563eb" /> Last GRN Price Details:
                  </div>
                  <div>
                    Real Cost:{' '}
                    <strong style={{ color: '#0f172a', fontSize: '0.84rem' }}>
                      {stagingItem.lastGrnRealCost !== null ? `$${Number(stagingItem.lastGrnRealCost).toFixed(2)}` : '—'}
                    </strong>
                  </div>
                  <div>
                    Sale Price:{' '}
                    <strong style={{ color: '#0f172a', fontSize: '0.84rem' }}>
                      {stagingItem.lastGrnSalePrice !== null ? `$${Number(stagingItem.lastGrnSalePrice).toFixed(2)}` : '—'}
                    </strong>
                  </div>
                  <div>
                    Discount:{' '}
                    <strong style={{ color: '#2563eb', fontSize: '0.84rem' }}>
                      {stagingItem.lastGrnDiscount || '—'}
                    </strong>
                  </div>
                  <div>
                    Supplier Cost:{' '}
                    <strong style={{ color: '#0f172a', fontSize: '0.84rem' }}>
                      {stagingItem.lastGrnSupplierCost !== null ? `$${Number(stagingItem.lastGrnSupplierCost).toFixed(2)}` : '—'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Add Item Button */}
            <button
              type="button"
              className="btn btn-primary"
              style={{
                height: '44px',
                fontSize: '0.96rem',
                fontWeight: 800,
                justifyContent: 'center',
                background: '#2563eb',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
              }}
              onClick={handleAddItemToGrn}
            >
              <Plus size={18} /> + Add Item to GRN List
            </button>
          </div>

          {/* SECTION 3: Added Items Grid */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#1e293b' }}>
                ADDED GRN INWARD ITEMS ({formData.items.length})
              </span>
              <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600, background: '#f1f5f9', padding: '3px 10px', borderRadius: '6px' }}>
                Total Received Units: <strong style={{ color: '#0f172a' }}>{totals.totalQty}</strong> + <strong style={{ color: '#15803d' }}>{totals.totalFree} FOC</strong> = <strong style={{ color: '#1d4ed8' }}>{totals.totalQty + totals.totalFree} units</strong>
              </span>
            </div>

            {formData.items.length === 0 ? (
              <div
                style={{
                  padding: '28px 16px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: '1.5px dashed #cbd5e1',
                  color: '#64748b',
                  fontSize: '0.88rem',
                }}
              >
                No items added yet. Search a product above and click <strong>"+ Add Item to GRN List"</strong> or upload an Excel sheet.
              </div>
            ) : (
              <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                <table className="glass-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 14px' }}>Product</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px' }}>Free</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px' }}>Unit Cost</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px' }}>Disc ($)</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px' }}>Net Total</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px' }}>GP%</th>
                      <th style={{ padding: '10px 14px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((it, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                            {it.tradeName}
                          </div>
                          <div style={{ fontFamily: 'monospace', fontSize: '0.76rem', color: '#2563eb' }}>
                            {it.productCode} {it.priceCode ? `• ${it.priceCode}` : ''}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.88rem', padding: '10px 14px' }}>{it.quantityReceived}</td>
                        <td style={{ textAlign: 'right', color: '#15803d', fontWeight: 700, fontSize: '0.88rem', padding: '10px 14px' }}>
                          {it.freeQuantity || '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.88rem', padding: '10px 14px' }}>${Number(it.unitCost).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', color: '#475569', fontSize: '0.88rem', padding: '10px 14px' }}>
                          {it.discountAmount > 0 ? `$${it.discountAmount.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 900, color: '#1d4ed8', fontSize: '0.92rem', padding: '10px 14px' }}>
                          ${Number(it.amount).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.88rem', padding: '10px 14px', color: it.gpPercent >= 20 ? '#15803d' : '#b45309' }}>
                          {it.gpPercent}%
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 14px' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '5px' }}
                            title="Remove line"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION 4: Grand Totals Bar */}
          <div
            style={{
              padding: '16px 20px',
              background: '#f8fafc',
              borderRadius: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: '1.5px solid #cbd5e1',
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>GROSS PURCHASE VALUE</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>
                ${totals.grossValue.toFixed(2)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>TOTAL DISCOUNT</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                -${totals.totalDiscount.toFixed(2)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>NET PAYABLE TO SUPPLIER</div>
              <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#1d4ed8', marginTop: '2px' }}>
                ${totals.netPayable.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Submission Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 2, height: '46px', fontSize: '0.95rem', fontWeight: 800, justifyContent: 'center', background: '#2563eb' }}
              onClick={() => handleSaveGrn(true)}
              disabled={saving}
              title="Processes inventory intake immediately and posts stock to warehouse"
            >
              <CheckCircle size={17} />
              {saving ? 'Processing...' : 'Process to Stock & Ledger'}
            </button>
            <button
              type="button"
              className="btn btn-glass"
              style={{ flex: 1, height: '46px', fontSize: '0.92rem', fontWeight: 700, justifyContent: 'center' }}
              onClick={() => handleSaveGrn(false)}
              disabled={saving}
              title="Save as pending draft"
            >
              Save as Draft
            </button>
          </div>
        </div>

        {/* BOTTOM SECTION: View Recorded GRNs (Full Width Down Below) */}
        <div
          className="glass-card"
          style={{
            width: '100%',
            padding: '24px',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <FileCheck size={22} color="#2563eb" /> View Recorded Goods Received Notes (GRN)
              </h2>
              <p style={{ color: '#475569', fontSize: '0.84rem', margin: '3px 0 0 0' }}>
                Click on any GRN row below to open and view its full item breakdown, or click the printer icon to print PDF directly
              </p>
            </div>
            <button className="btn btn-glass btn-sm" onClick={loadData} title="Refresh records" style={{ height: '36px', padding: '6px 14px', fontSize: '0.84rem' }}>
              <RefreshCw size={14} /> Refresh List
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ position: 'relative', flex: '1 1 340px', maxWidth: '520px' }}>
              <Search size={17} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8' }} />
              <input
                type="text"
                className="input-glass"
                style={{ paddingLeft: '38px', width: '100%', fontSize: '0.88rem', height: '40px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                placeholder="Search GRNs by #, supplier, warehouse, invoice..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <span style={{ fontSize: '0.84rem', color: '#475569', fontWeight: 700 }}>
              Showing {filteredGrns.length} records
            </span>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
            <table className="glass-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 14px' }}>GRN Number</th>
                  <th style={{ padding: '12px 14px' }}>Supplier</th>
                  <th style={{ padding: '12px 14px' }}>Warehouse</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px' }}>Total Cost</th>
                  <th style={{ padding: '12px 14px' }}>Date</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      Loading GRN records...
                    </td>
                  </tr>
                ) : filteredGrns.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No GRN records found. Fill the intake form above to add a GRN.
                    </td>
                  </tr>
                ) : (
                  filteredGrns.map((g) => (
                    <tr
                      key={g.id}
                      onClick={() => handleInspectGrn(g.id)}
                      style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
                      title="Click row to view complete GRN details"
                    >
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>
                          {g.grnNumber}
                        </span>
                        {g.supplierInvoiceNumber && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            Inv: {g.supplierInvoiceNumber}
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{g.supplierName}</td>
                      <td>{g.warehouseName}</td>
                      <td>
                        {g.status === 'PROCESSED' ? (
                          <span className="badge badge-success">Processed</span>
                        ) : g.status === 'DRAFT' ? (
                          <span className="badge badge-warning">Draft</span>
                        ) : (
                          <span className="badge badge-danger">{g.status}</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>
                        ${Number(g.totalAmount || 0).toFixed(2)}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {g.receivedDate || (g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '—')}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-glass btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintPdf(g.id);
                          }}
                          title="Print / View GRN PDF"
                          style={{ padding: '5px 9px' }}
                        >
                          <Printer size={15} color="#2563eb" />
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

      {/* EXCEL / CSV UPLOAD MODAL */}
      {showUploadModal && (
        <div className="modal-backdrop" onClick={() => setShowUploadModal(false)}>
          <div
            className="glass-modal"
            style={{ width: '100%', maxWidth: '580px', padding: '24px', background: '#ffffff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={22} color="#16a34a" />
                <h2 style={{ fontSize: '1.25rem', color: '#0f172a', margin: 0 }}>
                  Upload GRN Spreadsheet
                </h2>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '16px' }}>
              Upload your Excel (.xlsx / .csv) sheet or paste comma-separated product data to automatically import all line items into the GRN intake form.
            </p>

            <div
              style={{
                border: '2px dashed #3b82f6',
                borderRadius: '10px',
                padding: '24px',
                textAlign: 'center',
                background: '#eff6ff',
                marginBottom: '16px',
                cursor: 'pointer',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud size={36} color="#2563eb" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.9rem' }}>
                Click to Select Spreadsheet File (.csv / .xlsx)
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Need a starting format?</span>
              <button
                type="button"
                className="btn btn-glass btn-sm"
                onClick={downloadSampleCsv}
                style={{ fontSize: '0.78rem' }}
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
        <div className="modal-backdrop" onClick={() => setSelectedGrn(null)}>
          <div
            className="glass-modal"
            style={{ width: '100%', maxWidth: '860px', padding: '28px', background: '#ffffff', borderRadius: '12px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Title and Document Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  INWARD GOODS RECEIVED NOTE
                </span>
                <h2 style={{ fontSize: '1.6rem', color: '#0f172a', margin: '3px 0 0 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Package size={26} color="#2563eb" /> {selectedGrn.grnNumber}
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => handleDownloadPdf(selectedGrn.id, selectedGrn.grnNumber)}
                  title="Download PDF file to computer"
                  style={{ fontSize: '0.88rem', fontWeight: 700, color: '#15803d', borderColor: '#86efac', padding: '8px 14px' }}
                >
                  <Download size={16} color="#15803d" /> Download PDF
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handlePrintPdf(selectedGrn.id)}
                  title="Open system print dialog directly"
                  style={{ fontSize: '0.88rem', fontWeight: 700, padding: '8px 16px' }}
                >
                  <Printer size={16} /> Print Direct
                </button>
                <button
                  onClick={() => setSelectedGrn(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                  title="Close window"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* High-Contrast Decision Highlight Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
              <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                  TOTAL INWARD VALUE
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1d4ed8', marginTop: '4px' }}>
                  ${Number(selectedGrn.totalAmount || 0).toFixed(2)}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#3b82f6', marginTop: '2px' }}>
                  Total billed intake for this consignment
                </div>
              </div>

              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  CONSIGNMENT STATUS
                </div>
                <div style={{ marginTop: '8px' }}>
                  <span
                    className={`badge ${selectedGrn.status === 'PROCESSED' ? 'badge-success' : 'badge-warning'}`}
                    style={{ fontSize: '0.92rem', padding: '5px 12px', fontWeight: 800 }}
                  >
                    {selectedGrn.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '6px' }}>
                  {selectedGrn.status === 'PROCESSED' ? 'Inventory posted to live stock' : 'Draft / pending approval'}
                </div>
              </div>

              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  DESTINATION WAREHOUSE
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                  {selectedGrn.warehouseName}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  Received Date: {selectedGrn.receivedDate || (selectedGrn.createdAt ? new Date(selectedGrn.createdAt).toLocaleDateString() : '—')}
                </div>
              </div>
            </div>

            {/* Supplier & Consignment Metadata */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', background: '#f8fafc', padding: '14px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px', fontSize: '0.9rem' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>SUPPLIER / VENDOR</div>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.02rem', marginTop: '2px' }}>
                  {selectedGrn.supplierName}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Code: {selectedGrn.supplierCode || 'N/A'}</div>
              </div>

              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>SUPPLIER INVOICE / DC #</div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem', marginTop: '2px' }}>
                  {selectedGrn.supplierInvoiceNumber || '—'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Vendor delivery reference</div>
              </div>

              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>RECORDED BY</div>
                <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                  {selectedGrn.createdBy || 'System Administrator'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  {selectedGrn.createdAt ? new Date(selectedGrn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
            </div>

            {selectedGrn.notes && (
              <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fef3c7', marginBottom: '18px', fontSize: '0.86rem', color: '#92400e' }}>
                <span style={{ fontWeight: 700 }}>Notes / Remarks:</span> {selectedGrn.notes}
              </div>
            )}

            {/* Line Items Table (Spacious, High Contrast) */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Consignment Line Items ({selectedGrn.items?.length || 0} products)
                </h3>
              </div>

              <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="glass-table" style={{ margin: 0 }}>
                  <thead style={{ background: '#f1f5f9' }}>
                    <tr>
                      <th style={{ padding: '12px 14px', color: '#334155', fontWeight: 800, fontSize: '0.82rem' }}>#</th>
                      <th style={{ padding: '12px 14px', color: '#334155', fontWeight: 800, fontSize: '0.82rem' }}>Product Description</th>
                      <th style={{ padding: '12px 14px', color: '#334155', fontWeight: 800, fontSize: '0.82rem' }}>Product Code (SKU)</th>
                      <th style={{ padding: '12px 14px', color: '#334155', fontWeight: 800, fontSize: '0.82rem', textAlign: 'right' }}>Received Qty</th>
                      <th style={{ padding: '12px 14px', color: '#334155', fontWeight: 800, fontSize: '0.82rem', textAlign: 'right' }}>Unit Cost</th>
                      <th style={{ padding: '12px 14px', color: '#334155', fontWeight: 800, fontSize: '0.82rem', textAlign: 'right' }}>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGrn.items?.map((it, idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '0.86rem' }}>{idx + 1}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>
                          {it.productName}
                        </td>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#1d4ed8', fontWeight: 600, fontSize: '0.86rem' }}>
                          {it.productSku || '—'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                          {it.quantityReceived} {it.unitOfMeasure || ''}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: '#334155', fontSize: '0.9rem' }}>
                          ${Number(it.unitCost || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#1d4ed8', fontSize: '1rem' }}>
                          ${Number(it.totalCost || (it.quantityReceived * it.unitCost) || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Bottom Footer Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '16px' }}>
              <div style={{ fontSize: '1.05rem', color: '#334155', fontWeight: 700 }}>
                Consignment Total: <strong style={{ color: '#1d4ed8', fontSize: '1.3rem', fontWeight: 900 }}>${Number(selectedGrn.totalAmount || 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => handleDownloadPdf(selectedGrn.id, selectedGrn.grnNumber)}
                  style={{ fontWeight: 700, color: '#15803d', borderColor: '#86efac' }}
                >
                  <Download size={15} color="#15803d" /> Download PDF
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handlePrintPdf(selectedGrn.id)}
                  style={{ fontWeight: 700 }}
                >
                  <Printer size={15} /> Print Direct
                </button>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setSelectedGrn(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
