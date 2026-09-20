import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import MastersView from './MastersView';
import {
  warehouseApi,
  productApi,
  adjustmentApi,
} from '../api/apiClient';
import {
  SlidersHorizontal,
  Building2,
  Package,
  Tag,
  LayoutGrid,
  Bookmark,
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
} from 'lucide-react';

const STORAGE_KEY_ADJUSTMENTS = 'erp_inventory_adjustments_records_v1';
const STORAGE_KEY_BRANDS = 'erp_inventory_brands_v1';
const STORAGE_KEY_RESERVED = 'erp_inventory_reserved_stock_v1';

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

const INITIAL_BRANDS = [
  { id: 'brd-1', code: 'BRD-001', name: 'Anchor', description: 'Dairy and nutrition products', isActive: true },
  { id: 'brd-2', code: 'BRD-002', name: 'Munchee', description: 'Biscuits, wafers and confectionery', isActive: true },
  { id: 'brd-3', code: 'BRD-003', name: 'Maliban', description: 'Baked goods and crackers', isActive: true },
  { id: 'brd-4', code: 'BRD-004', name: 'Elephant House', description: 'Beverages and ice creams', isActive: true },
  { id: 'brd-5', code: 'BRD-005', name: 'Nestle', description: 'Packaged foods and cereals', isActive: true },
];

const INITIAL_RESERVED = [
  {
    id: 'res-1',
    refNo: 'HOLD-POS-104',
    productName: 'Board A',
    sku: '001',
    warehouse: 'Warehouse 1',
    quantity: 12,
    reason: 'Held POS Cart #104',
    reservedAt: '2026-09-20 10:15',
    status: 'HELD',
  },
  {
    id: 'res-2',
    refNo: 'GTN-RES-42',
    productName: 'තිරිඟු 100g',
    sku: '001',
    warehouse: 'Warehouse 1',
    quantity: 50,
    reason: 'Stock Transfer in Transit to Regional Hub',
    reservedAt: '2026-09-19 14:30',
    status: 'IN_TRANSIT',
  },
];

export default function InventoryHub({ activeSubTab = 'adjustments', onSubTabChange }) {
  const { user } = useAuth();
  const { addToast } = useToast();

  const INVENTORY_TABS = [
    { id: 'adjustments', label: 'Stock Adjustment', icon: SlidersHorizontal },
    { id: 'warehouses', label: 'Warehouses', icon: Building2 },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'brands', label: 'Brands', icon: Tag },
    { id: 'categories', label: 'Categories', icon: LayoutGrid },
    { id: 'reserved', label: 'Reserved', icon: Bookmark },
  ];

  const [currentTab, setCurrentTab] = useState(() => {
    if (activeSubTab && INVENTORY_TABS.some((t) => t.id === activeSubTab)) {
      return activeSubTab;
    }
    return 'adjustments';
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

  // Load warehouses and products for select dropdowns
  useEffect(() => {
    const loadMasters = async () => {
      try {
        const [wRes, pRes] = await Promise.allSettled([
          warehouseApi.getAll(),
          productApi.getProducts({ size: 250 }),
        ]);
        if (wRes.status === 'fulfilled') setWarehousesList(wRes.value.data || []);
        if (pRes.status === 'fulfilled') setProductsList(pRes.value.data?.content || pRes.value.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    loadMasters();
  }, []);

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

  // -------------------------------------------------------------
  // BRANDS TAB STATE & LOGIC
  // -------------------------------------------------------------
  const [brands, setBrands] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BRANDS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_BRANDS;
  });

  const [brandSearch, setBrandSearch] = useState('');
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [brandForm, setBrandForm] = useState({ code: '', name: '', description: '' });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_BRANDS, JSON.stringify(brands));
    } catch (e) {
      console.error(e);
    }
  }, [brands]);

  const filteredBrands = useMemo(() => {
    return brands.filter((b) => {
      if (!brandSearch.trim()) return true;
      const q = brandSearch.toLowerCase();
      return b.code.toLowerCase().includes(q) || b.name.toLowerCase().includes(q);
    });
  }, [brands, brandSearch]);

  const handleOpenAddBrand = () => {
    setEditingBrand(null);
    setBrandForm({
      code: `BRD-00${brands.length + 1}`,
      name: '',
      description: '',
    });
    setShowBrandModal(true);
  };

  const handleOpenEditBrand = (b) => {
    setEditingBrand(b);
    setBrandForm({
      code: b.code,
      name: b.name,
      description: b.description || '',
    });
    setShowBrandModal(true);
  };

  const handleSaveBrand = (e) => {
    e.preventDefault();
    if (!brandForm.name.trim()) {
      addToast('Brand name is required', 'error');
      return;
    }
    if (editingBrand) {
      setBrands((prev) =>
        prev.map((b) => (b.id === editingBrand.id ? { ...b, ...brandForm } : b))
      );
      addToast('Brand updated successfully', 'success');
    } else {
      const newB = {
        id: `brd-${Date.now()}`,
        code: brandForm.code.trim().toUpperCase(),
        name: brandForm.name.trim(),
        description: brandForm.description.trim(),
        isActive: true,
      };
      setBrands([...brands, newB]);
      addToast('Brand created successfully', 'success');
    }
    setShowBrandModal(false);
  };

  const handleToggleBrandActive = (id, currentStatus) => {
    setBrands((prev) =>
      prev.map((b) => (b.id === id ? { ...b, isActive: !currentStatus } : b))
    );
    addToast(`Brand status changed to ${currentStatus ? 'Inactive' : 'Active'}`, 'success');
  };

  const handleDeleteBrand = (b) => {
    if (!window.confirm(`Are you sure you want to delete brand "${b.name}"?`)) return;
    setBrands((prev) => prev.filter((item) => item.id !== b.id));
    addToast('Brand deleted', 'success');
  };

  // -------------------------------------------------------------
  // RESERVED STOCK TAB STATE & LOGIC
  // -------------------------------------------------------------
  const [reservedStock, setReservedStock] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RESERVED);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_RESERVED;
  });

  const [reservedSearch, setReservedSearch] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_RESERVED, JSON.stringify(reservedStock));
    } catch (e) {
      console.error(e);
    }
  }, [reservedStock]);

  const filteredReserved = useMemo(() => {
    return reservedStock.filter((r) => {
      if (!reservedSearch.trim()) return true;
      const q = reservedSearch.toLowerCase();
      return (
        r.refNo.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        r.warehouse.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
      );
    });
  }, [reservedStock, reservedSearch]);

  const handleReleaseReserved = (id) => {
    if (!window.confirm('Are you sure you want to release this stock reservation back to available inventory?')) return;
    setReservedStock((prev) => prev.filter((r) => r.id !== id));
    addToast('Stock reservation released back to active inventory', 'success');
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
      {/* Main Page Title matching user screenshot */}
      <div style={{ marginBottom: '14px', flexShrink: 0 }}>
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
      </div>

      {/* Sub-Navigation Tabs matching user screenshot */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '28px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '20px',
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
                borderBottom: isActive ? '2px solid #0284c7' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: isActive ? '#0284c7' : '#64748b',
                fontSize: '0.92rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={17} color={isActive ? '#0284c7' : '#64748b'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. STOCK ADJUSTMENT TAB (Matches user screenshot) */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'adjustments' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          {/* Top Filter Bar matching user screenshot */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              flexShrink: 0,
            }}
          >
            {/* Search records input */}
            <div style={{ flex: 2, minWidth: '260px', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                Search records
              </label>
              <div style={{ position: 'relative' }}>
                <Search
                  size={15}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  placeholder="Record #, product, SKU, batch, warehouse, reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.86rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Type filter */}
            <div style={{ flex: 1, minWidth: '130px' }}>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '0.86rem',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All types</option>
                <option value="Addition">Addition</option>
                <option value="Reduction">Reduction</option>
              </select>
            </div>

            {/* Warehouse filter */}
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                Warehouse
              </label>
              <select
                value={filterWarehouse}
                onChange={(e) => setFilterWarehouse(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '0.86rem',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All warehouses</option>
                {warehousesList.map((w) => (
                  <option key={w.id} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reason filter */}
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                Reason
              </label>
              <select
                value={filterReason}
                onChange={(e) => setFilterReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '0.86rem',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All reasons</option>
                {uniqueReasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear filters button */}
            <div style={{ alignSelf: 'flex-end', paddingTop: '20px' }}>
              <button
                type="button"
                className="btn btn-glass"
                onClick={handleClearFilters}
                style={{ padding: '8px 14px', fontSize: '0.86rem' }}
              >
                <X size={14} /> Clear filters
              </button>
            </div>
          </div>

          {/* Adjustment Records Card */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '20px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '16px',
                flexShrink: 0,
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                  Adjustment Records
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.86rem', margin: 0 }}>
                  Posted additions and reductions will appear here with their warehouse, batch, reason, quantities, serials, and user.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenCreateRecord}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 18px',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(2,132,199,0.2)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
              >
                <Plus size={16} /> Create Record
              </button>
            </div>

            {/* Adjustment Records Table */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px' }}>Record #</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px' }}>Date</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px' }}>Type</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px' }}>Warehouse</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px' }}>SKU</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px' }}>Product name</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px' }}>Batch</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px', textAlign: 'right' }}>Quantity</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px' }}>Reason</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdjustments.map((rec, idx) => {
                    const isAddition = rec.type === 'Addition';

                    return (
                      <tr
                        key={rec.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#fafafa')}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                          {rec.recordNo}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>
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
                        <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 500 }}>
                          {rec.warehouse}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#64748b' }}>
                          {rec.sku}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                          {rec.productName}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#475569' }}>
                          {rec.batch}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: isAddition ? '#16a34a' : '#dc2626', fontFamily: 'monospace' }}>
                          {rec.quantity > 0 ? `+${rec.quantity}` : rec.quantity}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>
                          {rec.reason}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-glass btn-sm"
                            onClick={() => setViewingRecord(rec)}
                            title="View Record Details"
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredAdjustments.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                        No adjustment records found matching selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. WAREHOUSES TAB */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'warehouses' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <MastersView
            activeSubTab="warehouses"
            isStandalone={true}
            allowedTabs={['warehouses']}
            title="Warehouse Locations"
            subtitle="Manage distribution centers, storerooms, fulfillment facilities and branch storage"
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. PRODUCTS TAB */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'products' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <MastersView
            activeSubTab="products"
            isStandalone={true}
            allowedTabs={['products']}
            title="Master Product Directory"
            subtitle="Manage inventory items, SKUs, barcode tracking, pricing, and stock limits"
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. BRANDS TAB */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'brands' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '20px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '16px',
                flexShrink: 0,
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                  Product Brands
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.86rem', margin: 0 }}>
                  Manage product manufacturer brands, trade names, and product line classifications.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenAddBrand}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 18px',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} /> Add Brand
              </button>
            </div>

            {/* Brand Search Bar */}
            <div style={{ maxWidth: '340px', position: 'relative', marginBottom: '16px', flexShrink: 0 }}>
              <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search brand code, brand name..."
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
              />
            </div>

            {/* Brands Table */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px' }}>Brand Code</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px' }}>Brand Name</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px' }}>Description</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px', textAlign: 'center' }}>Status</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBrands.map((b, idx) => (
                    <tr
                      key={b.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                        {b.code}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                        {b.name}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {b.description || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className={`badge ${b.isActive ? 'badge-success' : 'badge-danger'}`}
                          style={{
                            cursor: 'pointer',
                            border: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                          }}
                          onClick={() => handleToggleBrandActive(b.id, b.isActive)}
                          title={`Status: ${b.isActive ? 'Active' : 'Inactive'} (Click to toggle)`}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', display: 'inline-block' }} />
                          {b.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-glass btn-sm"
                            onClick={() => handleOpenEditBrand(b)}
                            title="Edit Brand"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-glass btn-sm"
                            style={{ color: '#dc2626' }}
                            onClick={() => handleDeleteBrand(b)}
                            title="Delete Brand"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredBrands.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                        No brands found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. CATEGORIES TAB */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'categories' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <MastersView
            activeSubTab="categories"
            isStandalone={true}
            allowedTabs={['categories']}
            title="Product Categories"
            subtitle="Manage product departments, item taxonomies, and group hierarchies"
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. RESERVED STOCK TAB */}
      {/* ------------------------------------------------------------- */}
      {currentTab === 'reserved' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '20px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '16px',
                flexShrink: 0,
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                  Reserved Inventory Ledger
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.86rem', margin: 0 }}>
                  Items locked for held sales bills, active warehouse transfers, and customer quotation reserves.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '6px 12px', fontSize: '0.82rem', fontWeight: 700 }}>
                  {reservedStock.length} Active Reservations
                </span>
              </div>
            </div>

            {/* Reserved Search */}
            <div style={{ maxWidth: '340px', position: 'relative', marginBottom: '16px', flexShrink: 0 }}>
              <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search reference, product, warehouse..."
                value={reservedSearch}
                onChange={(e) => setReservedSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
              />
            </div>

            {/* Reserved Table */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px' }}>Reference #</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px' }}>Product Name</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px' }}>SKU</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px' }}>Warehouse</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px', textAlign: 'right' }}>Reserved Qty</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px' }}>Reason / Allocation</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px' }}>Reserved At</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, padding: '12px 16px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReserved.map((r, idx) => (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#d97706', fontFamily: 'monospace' }}>
                        {r.refNo}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                        {r.productName}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#64748b' }}>
                        {r.sku}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155' }}>
                        {r.warehouse}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
                        {r.quantity}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        {r.reason}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.8rem' }}>
                        {r.reservedAt}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleReleaseReserved(r.id)}
                          style={{
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fca5a5',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          title="Release reserved stock back to available inventory"
                        >
                          Release Stock
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredReserved.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                        No stock currently on reserve.
                      </td>
                    </tr>
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
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>Create Stock Adjustment Record</h3>
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
                  Post Adjustment Record
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
      {/* MODAL: Add / Edit Brand */}
      {/* ------------------------------------------------------------- */}
      {showBrandModal && (
        <div className="modal-backdrop" onClick={() => setShowBrandModal(false)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '28px',
              borderRadius: '14px',
              backgroundColor: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Tag size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                    {editingBrand ? 'Edit Brand' : 'Add New Brand'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBrandModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveBrand} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Brand Code *
                </label>
                <input
                  type="text"
                  value={brandForm.code}
                  onChange={(e) => setBrandForm({ ...brandForm, code: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Brand Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Anchor, Munchee, Maliban"
                  value={brandForm.name}
                  onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={brandForm.description}
                  onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.86rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setShowBrandModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
                >
                  {editingBrand ? 'Save Changes' : 'Create Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
