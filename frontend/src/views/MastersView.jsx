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
} from 'lucide-react';

export default function MastersView({
  activeSubTab,
  onSubTabChange,
  isStandalone = false,
  allowedTabs = null,
  title = '',
  subtitle = '',
}) {
  const [activeTab, setActiveTab] = useState(() => activeSubTab || 'products');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Data lists
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalForm, setModalForm] = useState({});
  const [saving, setSaving] = useState(false);

  // View Details Modal State
  const [viewingItem, setViewingItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const { addToast } = useToast();

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
        categoryId: categories.length > 0 ? categories[0].id : '',
        unitOfMeasure: 'PCS',
        minStockLevel: '5',
        description: '',
      });
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
        categoryId: item.categoryId || (categories.find((c) => c.name === item.categoryName)?.id || ''),
        unitOfMeasure: item.unitOfMeasure || 'PCS',
        minStockLevel: item.minStockLevel?.toString() || '0',
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
        } else {
          await productApi.create(payload);
        }
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
      if (activeTab === 'warehouses') await warehouseApi.toggleActive(id);
      if (activeTab === 'categories') await categoryApi.toggleActive(id);
      if (activeTab === 'customers') await customerApi.toggleActive(id);
      if (activeTab === 'suppliers') await supplierApi.toggleActive(id);

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
  const filteredWarehouses = filterList(warehouses, ['name', 'code', 'contactNumber', 'phone', 'address']);
  const filteredCategories = filterList(categories, ['code', 'name', 'description']);
  const filteredCustomers = filterList(customers, ['name', 'code', 'customerCode', 'phone', 'contactPerson', 'email']);
  const filteredSuppliers = filterList(suppliers, ['name', 'code', 'supplierCode', 'contactPerson', 'phone', 'email']);

  const activeCount = currentItems.filter(isItemActive).length;
  const inactiveCount = currentItems.length - activeCount;

  const allTabs = [
    { id: 'products', label: 'Products', count: products.length, icon: Package },
    { id: 'warehouses', label: 'Warehouses', count: warehouses.length, icon: Building2 },
    { id: 'categories', label: 'Categories', count: categories.length, icon: FolderTree },
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
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            {getHeaderIcon()} {displayTitle}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '6px 0 0 0' }}>
            {displaySubtitle}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-glass" onClick={loadTabData} title="Refresh data">
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={18} /> Add New {activeTab === 'categories' ? 'Category' : activeTab === 'products' ? 'Product' : activeTab.slice(0, -1)}
          </button>
        </div>
      </div>

      {/* Directory Tabs (only if more than 1 tab visible) */}
      {visibleTabs.length > 1 && (
        <div>
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

      {/* Search & Status Filters Bar */}
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '12px', color: '#94a3b8' }} />
          <input
            type="text"
            className="input-glass"
            style={{ paddingLeft: '42px' }}
            placeholder={activeTab === 'products' ? 'Search products by SKU, name, category...' : `Search ${activeTab} by name, code, contact...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            STATUS:
          </span>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All ({currentItems.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'ACTIVE' ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setStatusFilter('ACTIVE')}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'INACTIVE' ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setStatusFilter('INACTIVE')}
          >
            Inactive ({inactiveCount})
          </button>
        </div>
      </div>

      {/* Master Data Tables */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
              Loading {activeTab} data...
            </div>
          )}

          {!loading && activeTab === 'products' && (
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Code / SKU</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Selling Price</th>
                  <th>Min Stock</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No products found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const active = isItemActive(p);
                    return (
                      <tr key={p.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{p.sku}</td>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</td>
                        <td>
                          <span className="badge badge-info">{p.categoryName || 'General'}</span>
                        </td>
                        <td style={{ fontWeight: 500 }}>{p.unitOfMeasure || 'PCS'}</td>
                        <td style={{ fontWeight: 700, color: '#0f172a' }}>
                          Rs. {Number(p.sellingPrice || 0).toFixed(2)}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: p.minStockLevel > 10 ? '#059669' : '#d97706' }}>
                            {p.minStockLevel || 0}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`badge ${active ? 'badge-success' : 'badge-danger'}`}
                            style={{
                              cursor: 'pointer',
                              border: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 10px',
                              transition: 'all 0.15s ease-in-out',
                            }}
                            onClick={() => handleToggleActive(p.id, active)}
                            title={`Status: ${active ? 'Active' : 'Inactive'} (Click to toggle)`}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', display: 'inline-block' }} />
                            {active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-glass btn-sm"
                              onClick={() => setViewingItem({ ...p, type: 'products' })}
                              title="View Details"
                            >
                              <Eye size={14} /> View
                            </button>
                            <button
                              className="btn btn-glass btn-sm"
                              onClick={() => handleOpenEdit(p)}
                              title="Edit Product"
                            >
                              <Edit2 size={14} /> Edit
                            </button>
                            <button
                              className="btn btn-glass btn-sm"
                              style={{ color: '#dc2626' }}
                              onClick={() => handleDelete(p)}
                              disabled={deletingId === p.id}
                              title="Delete Product"
                            >
                              <Trash2 size={14} />
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
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Warehouse Name</th>
                  <th>Address</th>
                  <th>Contact Number</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarehouses.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No warehouses found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredWarehouses.map((w) => {
                    const active = isItemActive(w);
                    const contact = w.contactNumber || w.phone || '—';
                    return (
                      <tr key={w.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{w.code}</td>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{w.name}</td>
                        <td style={{ color: '#64748b' }}>{w.address || '—'}</td>
                        <td style={{ fontWeight: 500 }}>{contact}</td>
                        <td>
                          {w.isPrimary ? (
                            <span className="badge badge-info">Primary</span>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Standard</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`badge ${active ? 'badge-success' : 'badge-danger'}`}
                            style={{
                              cursor: 'pointer',
                              border: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 10px',
                              transition: 'all 0.15s ease-in-out',
                            }}
                            onClick={() => handleToggleActive(w.id, active)}
                            title={`Status: ${active ? 'Active' : 'Inactive'} (Click to toggle)`}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', display: 'inline-block' }} />
                            {active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-glass btn-sm"
                              onClick={() => setViewingItem({ ...w, type: 'warehouses' })}
                              title="View Details"
                            >
                              <Eye size={14} /> View
                            </button>
                            <button
                              className="btn btn-glass btn-sm"
                              onClick={() => handleOpenEdit(w)}
                              title="Edit Warehouse"
                            >
                              <Edit2 size={14} /> Edit
                            </button>
                            <button
                              className="btn btn-glass btn-sm"
                              style={{ color: '#dc2626' }}
                              onClick={() => handleDelete(w)}
                              disabled={deletingId === w.id}
                              title="Delete Warehouse"
                            >
                              <Trash2 size={14} />
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
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Category Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No categories found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((c) => {
                    const active = isItemActive(c);
                    return (
                      <tr key={c.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{c.code}</td>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</td>
                        <td style={{ color: '#64748b' }}>{c.description || '—'}</td>
                        <td>
                          <button
                            type="button"
                            className={`badge ${active ? 'badge-success' : 'badge-danger'}`}
                            style={{
                              cursor: 'pointer',
                              border: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 10px',
                              transition: 'all 0.15s ease-in-out',
                            }}
                            onClick={() => handleToggleActive(c.id, active)}
                            title={`Status: ${active ? 'Active' : 'Inactive'} (Click to toggle)`}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', display: 'inline-block' }} />
                            {active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-glass btn-sm"
                              onClick={() => setViewingItem({ ...c, type: 'categories' })}
                              title="View Details"
                            >
                              <Eye size={14} /> View
                            </button>
                            <button
                              className="btn btn-glass btn-sm"
                              onClick={() => handleOpenEdit(c)}
                              title="Edit Category"
                            >
                              <Edit2 size={14} /> Edit
                            </button>
                            <button
                              className="btn btn-glass btn-sm"
                              style={{ color: '#dc2626' }}
                              onClick={() => handleDelete(c)}
                              disabled={deletingId === c.id}
                              title="Delete Category"
                            >
                              <Trash2 size={14} />
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
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Customer Name</th>
                  <th>Contact Person</th>
                  <th>Phone / Email</th>
                  <th>Credit Limit</th>
                  <th>Current Balance</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No customers found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => {
                    const active = isItemActive(c);
                    const code = c.code || c.customerCode;
                    return (
                      <tr key={c.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{code}</td>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</td>
                        <td>{c.contactPerson || '—'}</td>
                        <td>{c.phone || c.email || '—'}</td>
                        <td style={{ fontWeight: 600 }}>${Number(c.creditLimit || 0).toFixed(2)}</td>
                        <td style={{ color: (c.currentBalance || c.currentCredit) > 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>
                          ${Number(c.currentBalance || c.currentCredit || 0).toFixed(2)}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`badge ${active ? 'badge-success' : 'badge-danger'}`}
                            style={{
                              cursor: 'pointer',
                              border: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 10px',
                              transition: 'all 0.15s ease-in-out',
                            }}
                            onClick={() => handleToggleActive(c.id, active)}
                            title={`Status: ${active ? 'Active' : 'Inactive'} (Click to toggle)`}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', display: 'inline-block' }} />
                            {active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-glass btn-sm"
                              onClick={() => setViewingItem({ ...c, code, type: 'customers' })}
                              title="View Details"
                            >
                              <Eye size={14} /> View
                            </button>
                            <button
                              className="btn btn-glass btn-sm"
                              onClick={() => handleOpenEdit({ ...c, code })}
                              title="Edit Customer"
                            >
                              <Edit2 size={14} /> Edit
                            </button>
                            <button
                              className="btn btn-glass btn-sm"
                              style={{ color: '#dc2626' }}
                              onClick={() => handleDelete(c)}
                              disabled={deletingId === c.id}
                              title="Delete Customer"
                            >
                              <Trash2 size={14} />
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
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Supplier Name</th>
                  <th>Contact Person</th>
                  <th>Phone / Email</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No suppliers found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((s) => {
                    const active = isItemActive(s);
                    const code = s.code || s.supplierCode;
                    return (
                      <tr key={s.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{code}</td>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{s.name}</td>
                        <td>{s.contactPerson || '—'}</td>
                        <td>{s.phone || s.email || '—'}</td>
                        <td style={{ color: '#64748b' }}>{s.address || '—'}</td>
                        <td>
                          <button
                            type="button"
                            className={`badge ${active ? 'badge-success' : 'badge-danger'}`}
                            style={{
                              cursor: 'pointer',
                              border: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 10px',
                              transition: 'all 0.15s ease-in-out',
                            }}
                            onClick={() => handleToggleActive(s.id, active)}
                            title={`Status: ${active ? 'Active' : 'Inactive'} (Click to toggle)`}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', display: 'inline-block' }} />
                            {active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-glass btn-sm"
                              onClick={() => setViewingItem({ ...s, code, type: 'suppliers' })}
                              title="View Details"
                            >
                              <Eye size={14} /> View
                            </button>
                            <button
                              className="btn btn-glass btn-sm"
                              onClick={() => handleOpenEdit({ ...s, code })}
                              title="Edit Supplier"
                            >
                              <Edit2 size={14} /> Edit
                            </button>
                            <button
                              className="btn btn-glass btn-sm"
                              style={{ color: '#dc2626' }}
                              onClick={() => handleDelete(s)}
                              disabled={deletingId === s.id}
                              title="Delete Supplier"
                            >
                              <Trash2 size={14} />
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
                        CATEGORY
                      </label>
                      <select
                        className="input-glass"
                        value={modalForm.categoryId || ''}
                        onChange={(e) => setModalForm({ ...modalForm, categoryId: e.target.value })}
                      >
                        <option value="">Select Category...</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
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
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
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
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                        DESCRIPTION / NOTES
                      </label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="Specifications, size, packaging details..."
                        value={modalForm.description || ''}
                        onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(37, 99, 235, 0.05)',
                      borderRadius: '8px',
                      border: '1px solid rgba(37, 99, 235, 0.15)',
                      fontSize: '0.8rem',
                      color: '#2563eb',
                      marginBottom: '20px',
                    }}
                  >
                    <strong>Pricing & Stock:</strong> Managed automatically via Goods Received Notes (Inward GRN). Base selling price is recorded upon inventory intake.
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
}
