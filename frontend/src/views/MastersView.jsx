import React, { useState, useEffect } from 'react';
import {
  warehouseApi,
  categoryApi,
  customerApi,
  supplierApi,
  productApi,
} from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  Database,
  Building2,
  FolderTree,
  Users,
  Truck,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  X,
  Eye,
  Trash2,
  Package,
  Download,
  Award,
} from 'lucide-react';

const STORAGE_KEY_BRANDS = 'erp_brands_master_v1';
const STORAGE_KEY_PRODUCT_BRANDS = 'erp_product_brands_map_v1';
const INITIAL_BRANDS = [
  { id: 'brd-1', code: 'PRIMA', name: 'Prima', description: 'Flour, noodles & bakery essentials', isActive: true },
  { id: 'brd-2', code: 'MALIBAN', name: 'Maliban', description: 'Biscuits, crackers & confectionery', isActive: true },
  { id: 'brd-3', code: 'MUNCHEE', name: 'Munchee', description: 'CBL biscuits, snacks & wafers', isActive: true },
  { id: 'brd-4', code: 'NESTLE', name: 'Nestle', description: 'Dairy, Milo & nutritional foods', isActive: true },
  { id: 'brd-5', code: 'DEFAULT', name: 'General Brand', description: 'Standard / Unbranded items', isActive: true },
];

const MastersView = React.forwardRef(function MastersView({
  activeSubTab,
  onSubTabChange,
  isStandalone = false,
  allowedTabs = null,
  title = '',
  subtitle = '',
  hideHeader = false,
}, ref) {
  const [activeTab, setActiveTab] = useState(() => activeSubTab || 'products');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Data lists
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BRANDS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_BRANDS;
  });
  const [productBrandsMap, setProductBrandsMap] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRODUCT_BRANDS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return {};
  });
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const getBrandForProduct = (p) => {
    if (!p) return 'General';
    const bId = productBrandsMap[p.id] || productBrandsMap[p.sku] || p.brandId || p.brand;
    if (bId) {
      const found = brands.find((b) => String(b.id) === String(bId) || b.code === bId || b.name === bId);
      if (found) return found.name;
      return bId;
    }
    return 'General';
  };

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalForm, setModalForm] = useState({});
  const [saving, setSaving] = useState(false);

  // View Details Modal State
  const [viewingItem, setViewingItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const { addToast } = useToast();

  React.useImperativeHandle(ref, () => ({
    openAdd: handleOpenAdd,
    refresh: loadTabData,
  }));

  useEffect(() => {
    if (activeSubTab) {
      setActiveTab(activeSubTab);
    }
  }, [activeSubTab]);

  // Initial load of counts for all tabs so pill badges show real numbers immediately
  useEffect(() => {
    const loadAllCounts = async () => {
      try {
        const [wRes, cRes, cuRes, sRes, pRes] = await Promise.allSettled([
          warehouseApi.getAll(),
          categoryApi.getAll(),
          customerApi.getAll(),
          supplierApi.getAll(),
          productApi.getProducts({ size: 300 }),
        ]);
        if (wRes.status === 'fulfilled') setWarehouses(wRes.value.data || []);
        if (cRes.status === 'fulfilled') setCategories(cRes.value.data || []);
        if (cuRes.status === 'fulfilled') setCustomers(cuRes.value.data || []);
        if (sRes.status === 'fulfilled') setSuppliers(sRes.value.data || []);
        if (pRes.status === 'fulfilled') setProducts(pRes.value.data?.content || pRes.value.data || []);
      } catch (e) {
        // silent fallback
      }
    };
    loadAllCounts();
  }, []);

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setStatusFilter('ALL');
    setSearchTerm('');
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  const loadTabData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'products') {
        const [pRes, cRes] = await Promise.all([
          productApi.getProducts({ size: 300 }),
          categories.length === 0 ? categoryApi.getAll() : Promise.resolve({ data: categories }),
        ]);
        setProducts(pRes.data?.content || pRes.data || []);
        if (categories.length === 0 && cRes.data) {
          setCategories(cRes.data || []);
        }
      } else if (activeTab === 'warehouses') {
        const res = await warehouseApi.getAll();
        setWarehouses(res.data || []);
      } else if (activeTab === 'categories') {
        const res = await categoryApi.getAll();
        setCategories(res.data || []);
      } else if (activeTab === 'customers') {
        const res = await customerApi.getAll();
        setCustomers(res.data || []);
      } else if (activeTab === 'suppliers') {
        const res = await supplierApi.getAll();
        setSuppliers(res.data || []);
      }
    } catch (err) {
      addToast('Failed to load ' + activeTab + ': ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const isItemActive = (item) => Boolean(item?.isActive ?? item?.active ?? false);

  const handleOpenAdd = () => {
    setEditingItem(null);
    if (activeTab === 'products') {
      setModalForm({
        sku: '',
        name: '',
        brandId: brands.length > 0 ? brands[0].id : '',
        categoryId: categories.length > 0 ? categories[0].id : '',
        unitOfMeasure: 'PCS',
        minStockLevel: '5',
        description: '',
      });
    } else if (activeTab === 'brands') {
      setModalForm({ code: '', name: '', description: '' });
    } else if (activeTab === 'warehouses') {
      setModalForm({ code: '', name: '', address: '', contactNumber: '', phone: '', isPrimary: false });
    } else if (activeTab === 'categories') {
      setModalForm({ code: '', name: '', description: '' });
    } else if (activeTab === 'customers') {
      setModalForm({ code: '', name: '', contactPerson: '', phone: '', email: '', address: '', creditLimit: '0' });
    } else if (activeTab === 'suppliers') {
      setModalForm({ code: '', name: '', contactPerson: '', phone: '', email: '', address: '' });
    }
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    if (activeTab === 'products') {
      setModalForm({
        sku: item.sku || '',
        name: item.name || '',
        brandId: productBrandsMap[item.id] || productBrandsMap[item.sku] || item.brandId || item.brand || (brands[0]?.id || ''),
        categoryId: item.categoryId || (categories.find((c) => c.name === item.categoryName)?.id || ''),
        unitOfMeasure: item.unitOfMeasure || 'PCS',
        minStockLevel: item.minStockLevel?.toString() || '0',
        description: item.description || '',
      });
    } else if (activeTab === 'brands') {
      setModalForm({
        code: item.code || '',
        name: item.name || '',
        description: item.description || '',
      });
    } else {
      setModalForm({
        ...item,
        contactNumber: item.contactNumber || item.phone || '',
        phone: item.phone || item.contactNumber || '',
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (activeTab === 'products') {
        if (!modalForm.sku || !modalForm.name) {
          addToast('SKU and Product Name are required', 'error');
          setSaving(false);
          return;
        }
        const payload = {
          sku: (modalForm.sku || '').trim().toUpperCase(),
          barcode: null,
          name: (modalForm.name || '').trim(),
          categoryId: modalForm.categoryId ? Number(modalForm.categoryId) : null,
          unitOfMeasure: modalForm.unitOfMeasure || 'PCS',
          costPrice: editingItem ? (parseFloat(editingItem.costPrice) || 0) : 0,
          sellingPrice: editingItem ? (parseFloat(editingItem.sellingPrice) || 0) : 0,
          minStockLevel: parseInt(modalForm.minStockLevel, 10) || 0,
          description: modalForm.description?.trim() || null,
        };
        if (editingItem) {
          await productApi.update(editingItem.id, payload);
          if (modalForm.brandId) {
            const updatedMap = { ...productBrandsMap, [editingItem.id]: modalForm.brandId, [payload.sku]: modalForm.brandId };
            setProductBrandsMap(updatedMap);
            localStorage.setItem(STORAGE_KEY_PRODUCT_BRANDS, JSON.stringify(updatedMap));
          }
        } else {
          const res = await productApi.create(payload);
          const newId = res.data?.id || res.data?.content?.id || payload.sku;
          if (modalForm.brandId) {
            const updatedMap = { ...productBrandsMap, [newId]: modalForm.brandId, [payload.sku]: modalForm.brandId };
            setProductBrandsMap(updatedMap);
            localStorage.setItem(STORAGE_KEY_PRODUCT_BRANDS, JSON.stringify(updatedMap));
          }
        }
      } else if (activeTab === 'brands') {
        if (!modalForm.name?.trim()) {
          addToast('Brand name is required', 'error');
          setSaving(false);
          return;
        }
        const bCode = modalForm.code?.trim().toUpperCase() || modalForm.name.trim().toUpperCase().slice(0, 10);
        if (editingItem) {
          const updated = brands.map((b) =>
            b.id === editingItem.id
              ? { ...b, code: bCode, name: modalForm.name.trim(), description: modalForm.description || '' }
              : b
          );
          setBrands(updated);
          localStorage.setItem(STORAGE_KEY_BRANDS, JSON.stringify(updated));
          addToast('Brand updated successfully!', 'success');
        } else {
          const newBrand = {
            id: `brd-${Date.now()}`,
            code: bCode,
            name: modalForm.name.trim(),
            description: modalForm.description || '',
            isActive: true,
          };
          const updated = [newBrand, ...brands];
          setBrands(updated);
          localStorage.setItem(STORAGE_KEY_BRANDS, JSON.stringify(updated));
          addToast('Brand created successfully!', 'success');
        }
        setShowModal(false);
        setSaving(false);
        return;
      } else if (activeTab === 'warehouses') {
        const payload = {
          ...modalForm,
          contactNumber: modalForm.contactNumber || modalForm.phone || '',
          phone: modalForm.contactNumber || modalForm.phone || '',
        };
        if (editingItem) {
          await warehouseApi.update(editingItem.id, payload);
        } else {
          await warehouseApi.create(payload);
        }
      } else if (activeTab === 'categories') {
        const payload = {
          code: (modalForm.code || '').trim().toUpperCase(),
          name: (modalForm.name || '').trim(),
          description: modalForm.description || '',
        };
        if (editingItem) {
          await categoryApi.update(editingItem.id, payload);
        } else {
          await categoryApi.create(payload);
        }
      } else if (activeTab === 'customers') {
        const payload = {
          ...modalForm,
          customerCode: modalForm.code || modalForm.customerCode || '',
          creditLimit: parseFloat(modalForm.creditLimit) || 0,
        };
        if (editingItem) {
          await customerApi.update(editingItem.id, payload);
        } else {
          await customerApi.create(payload);
        }
      } else if (activeTab === 'suppliers') {
        const payload = {
          ...modalForm,
          supplierCode: modalForm.code || modalForm.supplierCode || '',
        };
        if (editingItem) {
          await supplierApi.update(editingItem.id, payload);
        } else {
          await supplierApi.create(payload);
        }
      }

      addToast(`Record saved successfully!`, 'success');
      setShowModal(false);
      loadTabData();
    } catch (err) {
      addToast(err.message || 'Operation failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      if (activeTab === 'products') await productApi.toggleActive(id);
      else if (activeTab === 'brands') {
        const updated = brands.map((b) => (b.id === id ? { ...b, isActive: !b.isActive } : b));
        setBrands(updated);
        localStorage.setItem(STORAGE_KEY_BRANDS, JSON.stringify(updated));
        addToast(`Brand status updated`, 'success');
        return;
      }
      else if (activeTab === 'warehouses') await warehouseApi.toggleActive(id);
      else if (activeTab === 'categories') await categoryApi.toggleActive(id);
      else if (activeTab === 'customers') await customerApi.toggleActive(id);
      else if (activeTab === 'suppliers') await supplierApi.toggleActive(id);

      addToast(`Status changed to ${currentStatus ? 'Inactive' : 'Active'}`, 'success');
      loadTabData();
    } catch (err) {
      addToast('Status update failed: ' + err.message, 'error');
    }
  };

  const handleDelete = async (item) => {
    const itemName = item.name || item.code || item.sku || 'this record';
    if (!window.confirm(`Are you sure you want to permanently delete "${itemName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      setDeletingId(item.id);
      if (activeTab === 'products') await productApi.delete(item.id);
      else if (activeTab === 'brands') {
        const updated = brands.filter((b) => b.id !== item.id);
        setBrands(updated);
        localStorage.setItem(STORAGE_KEY_BRANDS, JSON.stringify(updated));
        addToast(`Brand "${itemName}" deleted successfully`, 'success');
        return;
      }
      else if (activeTab === 'warehouses') await warehouseApi.delete(item.id);
      else if (activeTab === 'categories') await categoryApi.delete(item.id);
      else if (activeTab === 'customers') await customerApi.delete(item.id);
      else if (activeTab === 'suppliers') await supplierApi.delete(item.id);

      addToast(`"${itemName}" deleted successfully`, 'success');
      loadTabData();
    } catch (err) {
      addToast(err.message || 'Delete failed', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Get current active tab list
  const getCurrentItems = () => {
    switch (activeTab) {
      case 'products': return products;
      case 'brands': return brands;
      case 'warehouses': return warehouses;
      case 'categories': return categories;
      case 'customers': return customers;
      case 'suppliers': return suppliers;
      default: return [];
    }
  };

  const currentItems = getCurrentItems();

  // Status-filtered and search-filtered lists
  const filterList = (list, searchFields) => {
    return list.filter((item) => {
      const active = isItemActive(item);
      if (statusFilter === 'ACTIVE' && !active) return false;
      if (statusFilter === 'INACTIVE' && active) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return searchFields.some((field) => {
          const val = item[field];
          return val && String(val).toLowerCase().includes(q);
        });
      }
      return true;
    });
  };

  const filteredProducts = filterList(products, ['name', 'sku', 'categoryName', 'description']);
  const filteredBrands = filterList(brands, ['code', 'name', 'description']);
  const filteredWarehouses = filterList(warehouses, ['name', 'code', 'contactNumber', 'phone', 'address']);
  const filteredCategories = filterList(categories, ['code', 'name', 'description']);
  const filteredCustomers = filterList(customers, ['name', 'code', 'customerCode', 'phone', 'contactPerson', 'email']);
  const filteredSuppliers = filterList(suppliers, ['name', 'code', 'supplierCode', 'contactPerson', 'phone', 'email']);

  const activeCount = currentItems.filter(isItemActive).length;
  const inactiveCount = currentItems.length - activeCount;

  const downloadCSV = (headers, rows, filename) => {
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Records exported to CSV', 'success');
  };

  const handleExportCSV = () => {
    let itemsToExport = [];
    let headers = [];
    let filename = `${activeTab}_export_${new Date().toISOString().slice(0, 10)}.csv`;

    if (activeTab === 'products') {
      itemsToExport = filteredProducts;
      headers = ['SKU', 'Name', 'Description / Note', 'Brand', 'Category', 'Unit', 'Min Stock', 'Status'];
      if (itemsToExport.length === 0) {
        addToast('No products to export', 'error');
        return;
      }
      const rows = itemsToExport.map((p) => [
        `"${p.sku || ''}"`,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${(p.description || p.notes || p.note || '').replace(/"/g, '""')}"`,
        `"${getBrandForProduct(p)}"`,
        `"${p.categoryName || 'General'}"`,
        `"${p.unitOfMeasure || 'PCS'}"`,
        p.minStockLevel || 0,
        isItemActive(p) ? 'Active' : 'Inactive',
      ]);
      downloadCSV(headers, rows, filename);
    } else if (activeTab === 'brands') {
      itemsToExport = filteredBrands;
      headers = ['Brand Code', 'Brand Name', 'Description', 'Status'];
      if (itemsToExport.length === 0) {
        addToast('No brands to export', 'error');
        return;
      }
      const rows = itemsToExport.map((b) => [
        `"${b.code || ''}"`,
        `"${(b.name || '').replace(/"/g, '""')}"`,
        `"${(b.description || '').replace(/"/g, '""')}"`,
        isItemActive(b) ? 'Active' : 'Inactive',
      ]);
      downloadCSV(headers, rows, filename);
    } else if (activeTab === 'warehouses') {
      itemsToExport = filteredWarehouses;
      headers = ['Code', 'Name', 'Address', 'Contact Number', 'Status'];
      if (itemsToExport.length === 0) {
        addToast('No warehouses to export', 'error');
        return;
      }
      const rows = itemsToExport.map((w) => [
        `"${w.code || ''}"`,
        `"${(w.name || '').replace(/"/g, '""')}"`,
        `"${(w.address || '').replace(/"/g, '""')}"`,
        `"${w.contactNumber || w.phone || ''}"`,
        isItemActive(w) ? 'Active' : 'Inactive',
      ]);
      downloadCSV(headers, rows, filename);
    } else if (activeTab === 'categories') {
      itemsToExport = filteredCategories;
      headers = ['Code', 'Name', 'Description', 'Status'];
      if (itemsToExport.length === 0) {
        addToast('No categories to export', 'error');
        return;
      }
      const rows = itemsToExport.map((c) => [
        `"${c.code || ''}"`,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.description || '').replace(/"/g, '""')}"`,
        isItemActive(c) ? 'Active' : 'Inactive',
      ]);
      downloadCSV(headers, rows, filename);
    } else if (activeTab === 'suppliers') {
      itemsToExport = filteredSuppliers;
      headers = ['Code', 'Name', 'Contact Person', 'Phone', 'Email', 'Status'];
      if (itemsToExport.length === 0) {
        addToast('No suppliers to export', 'error');
        return;
      }
      const rows = itemsToExport.map((s) => [
        `"${s.code || s.supplierCode || ''}"`,
        `"${(s.name || '').replace(/"/g, '""')}"`,
        `"${(s.contactPerson || '').replace(/"/g, '""')}"`,
        `"${s.phone || ''}"`,
        `"${s.email || ''}"`,
        isItemActive(s) ? 'Active' : 'Inactive',
      ]);
      downloadCSV(headers, rows, filename);
    }
  };

  const allTabs = [
    { id: 'products', label: 'Products', count: products.length, icon: Package },
    { id: 'brands', label: 'Brands', count: brands.length, icon: Award },
    { id: 'categories', label: 'Categories', count: categories.length, icon: FolderTree },
    { id: 'warehouses', label: 'Warehouses', count: warehouses.length, icon: Building2 },
    { id: 'customers', label: 'Customers', count: customers.length, icon: Users },
    { id: 'suppliers', label: 'Suppliers', count: suppliers.length, icon: Truck },
  ];

  const visibleTabs = allowedTabs ? allTabs.filter((t) => allowedTabs.includes(t.id)) : allTabs;

  const displayTitle =
    title ||
    (isStandalone
      ? activeTab === 'customers'
        ? 'Customer Management'
        : activeTab === 'suppliers'
        ? 'Supplier Directory'
        : activeTab === 'warehouses'
        ? 'Warehouse Locations'
        : activeTab === 'products'
        ? 'Products & Categories'
        : activeTab === 'categories'
        ? 'Product Categories'
        : 'Master Data Management'
      : 'Master Data Management');

  const displaySubtitle =
    subtitle ||
    (isStandalone
      ? activeTab === 'customers'
        ? 'Manage customer records, credit balances, terms, and contact profiles'
        : activeTab === 'suppliers'
        ? 'Manage procurement vendors, contact personnel, and addresses'
        : activeTab === 'warehouses'
        ? 'Manage storage centers, fulfillment hubs, and stock locations'
        : activeTab === 'products'
        ? 'Manage master product catalog, categories, pricing, and stock limits'
        : 'Enterprise catalog and records management'
      : 'Enterprise management for products, warehouses, categories, customers, and suppliers');

  const getHeaderIcon = () => {
    if (activeTab === 'customers') return <Users size={28} color="#2563eb" />;
    if (activeTab === 'suppliers') return <Truck size={28} color="#2563eb" />;
    if (activeTab === 'warehouses') return <Building2 size={28} color="#2563eb" />;
    if (activeTab === 'products' || activeTab === 'categories') return <Package size={28} color="#2563eb" />;
    return <Database size={28} color="#2563eb" />;
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
        gap: '16px',
        padding: isStandalone ? '0' : '24px 32px',
        overflow: 'hidden',
      }}
    >
      {/* Header (Fixed / Sticky at Top) */}
      {!hideHeader && (
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
              {displayTitle}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
              {displaySubtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
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
            <Plus size={17} /> Add {activeTab === 'categories' ? 'Category' : activeTab === 'products' ? 'Product' : activeTab === 'warehouses' ? 'Warehouse' : activeTab === 'customers' ? 'Customer' : activeTab === 'suppliers' ? 'Supplier' : activeTab.slice(0, -1)}
          </button>
        </div>
      )}

      {/* Directory Tabs (only if more than 1 tab visible) */}
      {visibleTabs.length > 1 && (
        <div style={{ flexShrink: 0 }}>
          <div className="glass-pill-bar">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`glass-pill-btn ${isActive ? 'active' : ''}`}
                  onClick={() => handleTabChange(tab.id)}
                >
                  <Icon size={16} /> {tab.label} ({tab.count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Bar & Action Buttons (Fixed / Sticky - Customer/Employee Look) */}
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
            placeholder={
              activeTab === 'products'
                ? 'Search products by SKU, name, category...'
                : activeTab === 'warehouses'
                ? 'Search warehouses by code, name, address, contact...'
                : activeTab === 'categories'
                ? 'Search categories by code, name, description...'
                : `Search ${activeTab} by name, code, contact...`
            }
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

        {/* Right Controls: Status Filter, Reset, Export CSV (icon only), & Refresh (icon only) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
          {/* Status Filter Dropdown */}
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
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#0284c7';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(2, 132, 199, 0.15)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.03)';
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          {/* Reset Filters button */}
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
            title={`Export ${activeTab} to CSV`}
          >
            <Download size={15} />
          </button>

          {/* Refresh Records - Icon only */}
          <button
            type="button"
            onClick={loadTabData}
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

      {/* Master Data Tables (Fixed Frame, Sticky Header, Internal Scroll for Data Rows Only) */}
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
          {loading && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
              Loading {activeTab} data...
            </div>
          )}

          {!loading && activeTab === 'products' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CODE / SKU</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PRODUCT NAME</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DESCRIPTION / NOTE</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>BRAND</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CATEGORY</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>UNIT</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>MIN STOCK</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                      No products found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const active = isItemActive(p);
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setViewingItem({ ...p, type: 'products' })}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        title="Click row to view product details"
                      >
                        <td style={{ padding: '12px 18px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{p.sku}</td>
                        <td style={{ padding: '12px 18px', fontWeight: 600, color: '#0f172a' }}>{p.name}</td>
                        <td
                          style={{
                            padding: '12px 18px',
                            fontSize: '0.85rem',
                            color: '#475569',
                            maxWidth: '220px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={p.description || p.notes || p.note || ''}
                        >
                          {p.description || p.notes || p.note || '—'}
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <span
                            style={{
                              backgroundColor: '#f1f5f9',
                              color: '#334155',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            {getBrandForProduct(p)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px' }}>
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
                            {p.categoryName || 'General'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px', fontWeight: 500, color: '#475569' }}>{p.unitOfMeasure || 'PCS'}</td>
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{ fontWeight: 600, color: p.minStockLevel > 10 ? '#16a34a' : '#d97706' }}>
                            {p.minStockLevel || 0}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(p.id, active);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              color: active ? '#16a34a' : '#dc2626',
                              whiteSpace: 'nowrap',
                            }}
                            title={`Status: ${active ? 'Active' : 'Inactive'} (Click to toggle)`}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: active ? '#16a34a' : '#dc2626',
                                display: 'inline-block',
                              }}
                            />
                            {active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(p);
                              }}
                              style={{
                                width: '30px',
                                height: '30px',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
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
                                e.currentTarget.style.color = '#475569';
                              }}
                              title="Edit Product"
                            >
                              <Edit2 size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(p);
                              }}
                              disabled={deletingId === p.id}
                              style={{
                                width: '30px',
                                height: '30px',
                                background: '#ffffff',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#dc2626',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#fef2f2';
                                e.currentTarget.style.borderColor = '#f87171';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#ffffff';
                                e.currentTarget.style.borderColor = '#fecaca';
                              }}
                              title="Delete Product"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {!loading && activeTab === 'brands' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>BRAND CODE</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>BRAND NAME</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DESCRIPTION / NOTES</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredBrands.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                      No brands found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBrands.map((b) => {
                    const active = isItemActive(b);
                    return (
                      <tr
                        key={b.id}
                        onClick={() => setViewingItem({ ...b, type: 'brands' })}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        title="Click row to view brand details"
                      >
                        <td style={{ padding: '12px 18px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{b.code}</td>
                        <td style={{ padding: '12px 18px', fontWeight: 600, color: '#0f172a' }}>{b.name}</td>
                        <td style={{ padding: '12px 18px', color: '#64748b' }}>{b.description || '—'}</td>
                        <td style={{ padding: '12px 18px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(b.id, active);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              color: active ? '#16a34a' : '#dc2626',
                              whiteSpace: 'nowrap',
                            }}
                            title={`Status: ${active ? 'Active' : 'Inactive'} (Click to toggle)`}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: active ? '#16a34a' : '#dc2626',
                              }}
                            />
                            {active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <div
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(b)}
                              style={{
                                width: '30px',
                                height: '30px',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#0284c7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                              }}
                              title="Edit Brand"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(b)}
                              style={{
                                width: '30px',
                                height: '30px',
                                background: '#ffffff',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#dc2626',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                              }}
                              title="Delete Brand"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {!loading && activeTab === 'warehouses' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CODE</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>WAREHOUSE NAME</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ADDRESS</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CONTACT NUMBER</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarehouses.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                      No warehouses found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredWarehouses.map((w) => {
                    const active = isItemActive(w);
                    const contact = w.contactNumber || w.phone || '—';
                    return (
                      <tr
                        key={w.id}
                        onClick={() => setViewingItem({ ...w, type: 'warehouses' })}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        title="Click row to view warehouse details"
                      >
                        <td style={{ padding: '12px 18px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{w.code}</td>
                        <td style={{ padding: '12px 18px', fontWeight: 600, color: '#0f172a' }}>{w.name}</td>
                        <td style={{ padding: '12px 18px', color: '#64748b' }}>{w.address || '—'}</td>
                        <td style={{ padding: '12px 18px', fontWeight: 500, color: '#334155' }}>{contact}</td>
                        <td style={{ padding: '12px 18px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(w.id, active);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              color: active ? '#16a34a' : '#dc2626',
                              whiteSpace: 'nowrap',
                            }}
                            title={`Status: ${active ? 'Active' : 'Inactive'} (Click to toggle)`}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: active ? '#16a34a' : '#dc2626',
                                display: 'inline-block',
                              }}
                            />
                            {active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(w);
                              }}
                              style={{
                                width: '30px',
                                height: '30px',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
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
                                e.currentTarget.style.color = '#475569';
                              }}
                              title="Edit Warehouse"
                            >
                              <Edit2 size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(w);
                              }}
                              disabled={deletingId === w.id}
                              style={{
                                width: '30px',
                                height: '30px',
                                background: '#ffffff',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#dc2626',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#fef2f2';
                                e.currentTarget.style.borderColor = '#f87171';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#ffffff';
                                e.currentTarget.style.borderColor = '#fecaca';
                              }}
                              title="Delete Warehouse"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {!loading && activeTab === 'categories' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CODE</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CATEGORY NAME</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>DESCRIPTION</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                      No categories found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((c) => {
                    const active = isItemActive(c);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setViewingItem({ ...c, type: 'categories' })}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        title="Click row to view category details"
                      >
                        <td style={{ padding: '12px 18px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{c.code}</td>
                        <td style={{ padding: '12px 18px', fontWeight: 600, color: '#0f172a' }}>{c.name}</td>
                        <td style={{ padding: '12px 18px', color: '#64748b' }}>{c.description || '—'}</td>
                        <td style={{ padding: '12px 18px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(c.id, active);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              color: active ? '#16a34a' : '#dc2626',
                              whiteSpace: 'nowrap',
                            }}
                            title={`Status: ${active ? 'Active' : 'Inactive'} (Click to toggle)`}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: active ? '#16a34a' : '#dc2626',
                                display: 'inline-block',
                              }}
                            />
                            {active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(c);
                              }}
                              style={{
                                width: '30px',
                                height: '30px',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
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
                                e.currentTarget.style.color = '#475569';
                              }}
                              title="Edit Category"
                            >
                              <Edit2 size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(c);
                              }}
                              disabled={deletingId === c.id}
                              style={{
                                width: '30px',
                                height: '30px',
                                background: '#ffffff',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#dc2626',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#fef2f2';
                                e.currentTarget.style.borderColor = '#f87171';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#ffffff';
                                e.currentTarget.style.borderColor = '#fecaca';
                              }}
                              title="Delete Category"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {!loading && activeTab === 'customers' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CODE</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER NAME</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CONTACT PERSON</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PHONE / EMAIL</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CREDIT LIMIT</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CURRENT BALANCE</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                      No customers found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => {
                    const active = isItemActive(c);
                    const code = c.code || c.customerCode;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setViewingItem({ ...c, code, type: 'customers' })}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        title="Click row to view customer details"
                      >
                        <td style={{ padding: '12px 18px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{code}</td>
                        <td style={{ padding: '12px 18px', fontWeight: 600, color: '#0f172a' }}>{c.name}</td>
                        <td style={{ padding: '12px 18px', color: '#475569' }}>{c.contactPerson || '—'}</td>
                        <td style={{ padding: '12px 18px', color: '#475569' }}>{c.phone || c.email || '—'}</td>
                        <td style={{ padding: '12px 18px', fontWeight: 600, color: '#334155' }}>Rs. {Number(c.creditLimit || 0).toFixed(2)}</td>
                        <td style={{ padding: '12px 18px', color: (c.currentBalance || c.currentCredit) > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                          Rs. {Number(c.currentBalance || c.currentCredit || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(c.id, active);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              color: active ? '#16a34a' : '#dc2626',
                              whiteSpace: 'nowrap',
                            }}
                            title={`Status: ${active ? 'Active' : 'Inactive'} (Click to toggle)`}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: active ? '#16a34a' : '#dc2626',
                                display: 'inline-block',
                              }}
                            />
                            {active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit({ ...c, code });
                              }}
                              style={{
                                width: '30px',
                                height: '30px',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
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
                                e.currentTarget.style.color = '#475569';
                              }}
                              title="Edit Customer"
                            >
                              <Edit2 size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(c);
                              }}
                              disabled={deletingId === c.id}
                              style={{
                                width: '30px',
                                height: '30px',
                                background: '#ffffff',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#dc2626',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#fef2f2';
                                e.currentTarget.style.borderColor = '#f87171';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#ffffff';
                                e.currentTarget.style.borderColor = '#fecaca';
                              }}
                              title="Delete Customer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {!loading && activeTab === 'suppliers' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CODE</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>SUPPLIER NAME</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CONTACT PERSON</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PHONE / EMAIL</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ADDRESS</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                  <th style={{ padding: '12px 18px', fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#fafbfc', zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                      No suppliers found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((s) => {
                    const active = isItemActive(s);
                    const code = s.code || s.supplierCode;
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setViewingItem({ ...s, code, type: 'suppliers' })}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        title="Click row to view supplier details"
                      >
                        <td style={{ padding: '12px 18px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{code}</td>
                        <td style={{ padding: '12px 18px', fontWeight: 600, color: '#0f172a' }}>{s.name}</td>
                        <td style={{ padding: '12px 18px', color: '#475569' }}>{s.contactPerson || '—'}</td>
                        <td style={{ padding: '12px 18px', color: '#475569' }}>{s.phone || s.email || '—'}</td>
                        <td style={{ padding: '12px 18px', color: '#64748b' }}>{s.address || '—'}</td>
                        <td style={{ padding: '12px 18px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(s.id, active);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              color: active ? '#16a34a' : '#dc2626',
                              whiteSpace: 'nowrap',
                            }}
                            title={`Status: ${active ? 'Active' : 'Inactive'} (Click to toggle)`}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: active ? '#16a34a' : '#dc2626',
                                display: 'inline-block',
                              }}
                            />
                            {active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit({ ...s, code });
                              }}
                              style={{
                                width: '30px',
                                height: '30px',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
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
                                e.currentTarget.style.color = '#475569';
                              }}
                              title="Edit Supplier"
                            >
                              <Edit2 size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(s);
                              }}
                              disabled={deletingId === s.id}
                              style={{
                                width: '30px',
                                height: '30px',
                                background: '#ffffff',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#dc2626',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#fef2f2';
                                e.currentTarget.style.borderColor = '#f87171';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#ffffff';
                                e.currentTarget.style.borderColor = '#fecaca';
                              }}
                              title="Delete Supplier"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* View Details Modal */}
      {viewingItem && (
        <div className="modal-backdrop" onClick={() => setViewingItem(null)}>
          <div
            className="glass-modal"
            style={{ width: '100%', maxWidth: '820px', padding: '30px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 800, color: '#2563eb', letterSpacing: '0.05em' }}>
                  {viewingItem.type?.slice(0, -1)} Master Details
                </span>
                <h2 style={{ fontSize: '1.45rem', color: '#0f172a', margin: '4px 0 0 0' }}>
                  {viewingItem.name || viewingItem.code}
                </h2>
              </div>
              <button
                onClick={() => setViewingItem(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Status</span>
                <div>
                  <button
                    type="button"
                    className={`badge ${isItemActive(viewingItem) ? 'badge-success' : 'badge-danger'}`}
                    style={{
                      cursor: 'pointer',
                      border: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 10px',
                      transition: 'all 0.15s ease-in-out',
                    }}
                    onClick={async () => {
                      const active = isItemActive(viewingItem);
                      await handleToggleActive(viewingItem.id, active);
                      setViewingItem(prev => prev ? ({ ...prev, active: !active, isActive: !active, is_active: !active, status: !active ? 'ACTIVE' : 'INACTIVE' }) : null);
                    }}
                    title={`Status: ${isItemActive(viewingItem) ? 'Active' : 'Inactive'} (Click to toggle)`}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', display: 'inline-block' }} />
                    {isItemActive(viewingItem) ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>

              {(viewingItem.code || viewingItem.sku || viewingItem.customerCode || viewingItem.supplierCode) && (
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Code / Identifier</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8', fontSize: '0.95rem' }}>
                    {viewingItem.code || viewingItem.sku || viewingItem.customerCode || viewingItem.supplierCode}
                  </span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Name</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{viewingItem.name}</span>
              </div>

              {viewingItem.type === 'products' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Category</span>
                    <span style={{ fontWeight: 600 }}>{viewingItem.categoryName || 'General / Uncategorized'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Unit of Measure</span>
                    <span style={{ fontWeight: 600 }}>{viewingItem.unitOfMeasure || 'PCS'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Selling Price</span>
                    <span style={{ fontWeight: 800, color: '#1d4ed8', fontSize: '1.05rem' }}>
                      Rs. {Number(viewingItem.sellingPrice || 0).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Cost Price</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>
                      Rs. {Number(viewingItem.costPrice || 0).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Min Stock Alert</span>
                    <span style={{ fontWeight: 700, color: viewingItem.minStockLevel > 10 ? '#059669' : '#d97706' }}>
                      {viewingItem.minStockLevel || 0} {viewingItem.unitOfMeasure || 'PCS'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Price Protocol</span>
                    <span style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600 }}>Dynamic GRN Inward</span>
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Description</span>
                    <span>{viewingItem.description || 'No description provided.'}</span>
                  </div>
                </>
              )}

              {viewingItem.type === 'warehouses' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Contact Number</span>
                    <span style={{ fontWeight: 500 }}>{viewingItem.contactNumber || viewingItem.phone || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Address</span>
                    <span>{viewingItem.address || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Primary Facility</span>
                    <span>{viewingItem.isPrimary ? 'Yes (Primary Enterprise Warehouse)' : 'No (Standard Branch)'}</span>
                  </div>
                </>
              )}

              {viewingItem.type === 'categories' && (
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Description</span>
                  <span>{viewingItem.description || 'No description provided.'}</span>
                </div>
              )}

              {viewingItem.type === 'customers' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Contact Person</span>
                    <span>{viewingItem.contactPerson || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Phone</span>
                    <span>{viewingItem.phone || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Email</span>
                    <span>{viewingItem.email || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Address</span>
                    <span>{viewingItem.address || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Credit Limit</span>
                    <span style={{ fontWeight: 600 }}>${Number(viewingItem.creditLimit || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Current Balance</span>
                    <span style={{ fontWeight: 600, color: (viewingItem.currentBalance || viewingItem.currentCredit) > 0 ? '#dc2626' : '#059669' }}>
                      ${Number(viewingItem.currentBalance || viewingItem.currentCredit || 0).toFixed(2)}
                    </span>
                  </div>
                </>
              )}

              {viewingItem.type === 'suppliers' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Contact Person</span>
                    <span>{viewingItem.contactPerson || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Phone</span>
                    <span>{viewingItem.phone || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Email</span>
                    <span>{viewingItem.email || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Address</span>
                    <span>{viewingItem.address || '—'}</span>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn btn-glass" onClick={() => setViewingItem(null)}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const item = viewingItem;
                  setViewingItem(null);
                  handleOpenEdit(item);
                }}
              >
                <Edit2 size={16} /> Edit Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div
            className="glass-modal"
            style={{ width: '100%', maxWidth: '820px', padding: '30px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <h2 style={{ fontSize: '1.35rem', color: '#0f172a', margin: 0 }}>
                {editingItem ? 'Edit' : 'Create New'} {activeTab === 'categories' ? 'Category' : activeTab === 'products' ? 'Product' : activeTab.slice(0, -1)}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              {activeTab === 'products' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                        PRODUCT CODE (SKU) *
                      </label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. SKU-PROD-001"
                        value={modalForm.sku || ''}
                        onChange={(e) => setModalForm({ ...modalForm, sku: e.target.value.toUpperCase() })}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                        PRODUCT NAME *
                      </label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. Standard Cement 50kg"
                        value={modalForm.name || ''}
                        onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                        BRAND *
                      </label>
                      <select
                        className="input-glass"
                        value={modalForm.brandId || ''}
                        onChange={(e) => setModalForm({ ...modalForm, brandId: e.target.value })}
                        required
                      >
                        <option value="">Select Brand...</option>
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                        CATEGORY *
                      </label>
                      <select
                        className="input-glass"
                        value={modalForm.categoryId || ''}
                        onChange={(e) => setModalForm({ ...modalForm, categoryId: e.target.value })}
                        required
                      >
                        <option value="">Select Category...</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                        UNIT OF MEASURE
                      </label>
                      <select
                        className="input-glass"
                        value={modalForm.unitOfMeasure || 'PCS'}
                        onChange={(e) => setModalForm({ ...modalForm, unitOfMeasure: e.target.value })}
                      >
                        {['PCS', 'BOX', 'KG', 'LTR', 'MTR', 'PKT', 'DOZ', 'SET', 'BAG', 'ROLL'].map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                        MIN STOCK ALERT LEVEL
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="input-glass"
                        value={modalForm.minStockLevel || '0'}
                        onChange={(e) => setModalForm({ ...modalForm, minStockLevel: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                      DESCRIPTION / NOTE
                    </label>
                    <textarea
                      className="input-glass"
                      rows="2"
                      placeholder="Optional notes or product specifications"
                      value={modalForm.description || ''}
                      onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                    />
                  </div>
                </>
              )}

              {activeTab === 'brands' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                        BRAND CODE (ID) *
                      </label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. PRIMA"
                        value={modalForm.code || ''}
                        onChange={(e) => setModalForm({ ...modalForm, code: e.target.value.toUpperCase() })}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                        BRAND NAME *
                      </label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. Prima Flour & Mills"
                        value={modalForm.name || ''}
                        onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                      DESCRIPTION / NOTES
                    </label>
                    <input
                      type="text"
                      className="input-glass"
                      placeholder="e.g. Wheat flour, bakery supplies, noodles and pre-mixes"
                      value={modalForm.description || ''}
                      onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                    />
                  </div>
                </>
              )}

              {activeTab === 'warehouses' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                        WAREHOUSE CODE *
                      </label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. WH-001"
                        value={modalForm.code || ''}
                        onChange={(e) => setModalForm({ ...modalForm, code: e.target.value.toUpperCase() })}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                        WAREHOUSE NAME *
                      </label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. Central Logistics Hub"
                        value={modalForm.name || ''}
                        onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                        CONTACT NUMBER
                      </label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. +94 77 123 4567"
                        value={modalForm.contactNumber || modalForm.phone || ''}
                        onChange={(e) => setModalForm({ ...modalForm, contactNumber: e.target.value, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                        FACILITY ADDRESS
                      </label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. 100 Port Access Road, Colombo"
                        value={modalForm.address || ''}
                        onChange={(e) => setModalForm({ ...modalForm, address: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'categories' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                        CATEGORY CODE (ID) *
                      </label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. CAT-001"
                        value={modalForm.code || ''}
                        onChange={(e) => setModalForm({ ...modalForm, code: e.target.value.toUpperCase() })}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                        CATEGORY NAME *
                      </label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. Industrial Tools & Parts"
                        value={modalForm.name || ''}
                        onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                      DESCRIPTION
                    </label>
                    <input
                      type="text"
                      className="input-glass"
                      placeholder="e.g. Heavy-duty tools, fixtures, and power assembly equipment"
                      value={modalForm.description || ''}
                      onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                    />
                  </div>
                </>
              )}

              {activeTab === 'customers' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CODE</label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. CUST-0001"
                        value={modalForm.code || modalForm.customerCode || ''}
                        onChange={(e) => setModalForm({ ...modalForm, code: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CUSTOMER NAME *</label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. Apex Engineering Ltd"
                        value={modalForm.name || ''}
                        onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CONTACT PERSON</label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. John Doe"
                        value={modalForm.contactPerson || ''}
                        onChange={(e) => setModalForm({ ...modalForm, contactPerson: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>PHONE</label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. +94 77 123 4567"
                        value={modalForm.phone || ''}
                        onChange={(e) => setModalForm({ ...modalForm, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>EMAIL</label>
                      <input
                        type="email"
                        className="input-glass"
                        placeholder="e.g. billing@apex.com"
                        value={modalForm.email || ''}
                        onChange={(e) => setModalForm({ ...modalForm, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CREDIT LIMIT ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-glass"
                        placeholder="0.00"
                        value={modalForm.creditLimit ?? ''}
                        onChange={(e) => setModalForm({ ...modalForm, creditLimit: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>BILLING ADDRESS</label>
                    <input
                      type="text"
                      className="input-glass"
                      placeholder="e.g. 45 Galle Road, Colombo"
                      value={modalForm.address || ''}
                      onChange={(e) => setModalForm({ ...modalForm, address: e.target.value })}
                    />
                  </div>
                </>
              )}

              {activeTab === 'suppliers' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CODE</label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. SUPP-0001"
                        value={modalForm.code || modalForm.supplierCode || ''}
                        onChange={(e) => setModalForm({ ...modalForm, code: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>SUPPLIER NAME *</label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. Global Steels Corp"
                        value={modalForm.name || ''}
                        onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CONTACT PERSON</label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. Robert Smith"
                        value={modalForm.contactPerson || ''}
                        onChange={(e) => setModalForm({ ...modalForm, contactPerson: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>PHONE</label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="e.g. +94 11 234 5678"
                        value={modalForm.phone || ''}
                        onChange={(e) => setModalForm({ ...modalForm, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>EMAIL</label>
                    <input
                      type="email"
                      className="input-glass"
                      placeholder="e.g. orders@globalsteels.com"
                      value={modalForm.email || ''}
                      onChange={(e) => setModalForm({ ...modalForm, email: e.target.value })}
                    />
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>SUPPLIER ADDRESS</label>
                    <input
                      type="text"
                      className="input-glass"
                      placeholder="e.g. 12 Industrial Zone, Kandy"
                      value={modalForm.address || ''}
                      onChange={(e) => setModalForm({ ...modalForm, address: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-glass" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});

export default MastersView;
