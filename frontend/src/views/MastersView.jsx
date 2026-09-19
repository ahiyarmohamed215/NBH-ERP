import React, { useState, useEffect } from 'react';
import {
  warehouseApi,
  categoryApi,
  customerApi,
  supplierApi,
} from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import ProductsView from './ProductsView';
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

export default function MastersView({ activeSubTab, onSubTabChange }) {
  const [activeTab, setActiveTab] = useState(() => activeSubTab || 'products');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Data lists
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

  useEffect(() => {
    if (activeTab !== 'products') {
      loadTabData();
    }
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
      if (activeTab === 'warehouses') {
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
    if (activeTab === 'warehouses') {
      setModalForm({ code: '', name: '', address: '', contactNumber: '', phone: '', isPrimary: false });
    } else if (activeTab === 'categories') {
      setModalForm({ name: '', description: '' });
    } else if (activeTab === 'customers') {
      setModalForm({ code: '', name: '', contactPerson: '', phone: '', email: '', address: '', creditLimit: '0' });
    } else if (activeTab === 'suppliers') {
      setModalForm({ code: '', name: '', contactPerson: '', phone: '', email: '', address: '' });
    }
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setModalForm({
      ...item,
      contactNumber: item.contactNumber || item.phone || '',
      phone: item.phone || item.contactNumber || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (activeTab === 'warehouses') {
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
        if (editingItem) {
          await categoryApi.update(editingItem.id, modalForm);
        } else {
          await categoryApi.create(modalForm);
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
    const itemName = item.name || item.code || 'this record';
    if (!window.confirm(`Are you sure you want to permanently delete "${itemName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      setDeletingId(item.id);
      if (activeTab === 'warehouses') await warehouseApi.delete(item.id);
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

  const filteredWarehouses = filterList(warehouses, ['name', 'code', 'contactNumber', 'phone', 'address']);
  const filteredCategories = filterList(categories, ['name', 'description']);
  const filteredCustomers = filterList(customers, ['name', 'code', 'customerCode', 'phone', 'contactPerson', 'email']);
  const filteredSuppliers = filterList(suppliers, ['name', 'code', 'supplierCode', 'contactPerson', 'phone', 'email']);

  const activeCount = currentItems.filter(isItemActive).length;
  const inactiveCount = currentItems.length - activeCount;

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Database size={28} color="#2563eb" /> Master Data Management
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '6px 0 0 0' }}>
            Enterprise management for products, warehouses, categories, customers, and suppliers
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-glass" onClick={loadTabData} title="Refresh data">
            <RefreshCw size={16} /> Refresh
          </button>
          {activeTab !== 'products' && (
            <button className="btn btn-primary" onClick={handleOpenAdd}>
              <Plus size={18} /> Add New {activeTab.slice(0, -1)}
            </button>
          )}
        </div>
      </div>

      {/* Directory Tabs */}
      <div>
        <div className="glass-pill-bar">
          <button
            type="button"
            className={`glass-pill-btn ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => handleTabChange('products')}
          >
            <Package size={16} /> Products
          </button>
          <button
            type="button"
            className={`glass-pill-btn ${activeTab === 'warehouses' ? 'active' : ''}`}
            onClick={() => handleTabChange('warehouses')}
          >
            <Building2 size={16} /> Warehouses ({warehouses.length})
          </button>
          <button
            type="button"
            className={`glass-pill-btn ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => handleTabChange('categories')}
          >
            <FolderTree size={16} /> Categories ({categories.length})
          </button>
          <button
            type="button"
            className={`glass-pill-btn ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => handleTabChange('customers')}
          >
            <Users size={16} /> Customers ({customers.length})
          </button>
          <button
            type="button"
            className={`glass-pill-btn ${activeTab === 'suppliers' ? 'active' : ''}`}
            onClick={() => handleTabChange('suppliers')}
          >
            <Truck size={16} /> Suppliers ({suppliers.length})
          </button>
        </div>
      </div>

      {/* If Products tab active, render embedded ProductsView */}
      {activeTab === 'products' ? (
        <ProductsView isEmbedded={true} />
      ) : (
        <>
          {/* Search & Status Filters Bar */}
          <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '12px', color: '#94a3b8' }} />
              <input
                type="text"
                className="input-glass"
                style={{ paddingLeft: '42px' }}
                placeholder={`Search ${activeTab} by name, code, contact...`}
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
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
              Loading {activeTab} data...
            </div>
          ) : activeTab === 'warehouses' && (
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
                          <span className={`badge ${active ? 'badge-success' : 'badge-danger'}`}>
                            {active ? 'Active' : 'Inactive'}
                          </span>
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
                              className="btn btn-sm btn-glass"
                              onClick={() => handleToggleActive(w.id, active)}
                              title={active ? 'Deactivate Warehouse' : 'Activate Warehouse'}
                            >
                              {active ? <XCircle size={14} color="#ef4444" /> : <CheckCircle size={14} color="#10b981" />}
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
                  <th>Category Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No categories found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((c) => {
                    const active = isItemActive(c);
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</td>
                        <td style={{ color: '#64748b' }}>{c.description || '—'}</td>
                        <td>
                          <span className={`badge ${active ? 'badge-success' : 'badge-danger'}`}>
                            {active ? 'Active' : 'Inactive'}
                          </span>
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
                              className="btn btn-sm btn-glass"
                              onClick={() => handleToggleActive(c.id, active)}
                              title={active ? 'Deactivate Category' : 'Activate Category'}
                            >
                              {active ? <XCircle size={14} color="#ef4444" /> : <CheckCircle size={14} color="#10b981" />}
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
                          <span className={`badge ${active ? 'badge-success' : 'badge-danger'}`}>
                            {active ? 'Active' : 'Inactive'}
                          </span>
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
                              className="btn btn-sm btn-glass"
                              onClick={() => handleToggleActive(c.id, active)}
                              title={active ? 'Deactivate Customer' : 'Activate Customer'}
                            >
                              {active ? <XCircle size={14} color="#ef4444" /> : <CheckCircle size={14} color="#10b981" />}
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
                          <span className={`badge ${active ? 'badge-success' : 'badge-danger'}`}>
                            {active ? 'Active' : 'Inactive'}
                          </span>
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
                              className="btn btn-sm btn-glass"
                              onClick={() => handleToggleActive(s.id, active)}
                              title={active ? 'Deactivate Supplier' : 'Activate Supplier'}
                            >
                              {active ? <XCircle size={14} color="#ef4444" /> : <CheckCircle size={14} color="#10b981" />}
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
      </>
      )}

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
                  <span className={`badge ${isItemActive(viewingItem) ? 'badge-success' : 'badge-danger'}`}>
                    {isItemActive(viewingItem) ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {(viewingItem.code || viewingItem.customerCode || viewingItem.supplierCode) && (
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Code / Identifier</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8', fontSize: '0.95rem' }}>
                    {viewingItem.code || viewingItem.customerCode || viewingItem.supplierCode}
                  </span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Name</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{viewingItem.name}</span>
              </div>

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
        <div className="modal-backdrop">
          <div className="glass-modal" style={{ width: '100%', maxWidth: '560px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.3rem', color: '#0f172a', margin: 0 }}>
                {editingItem ? 'Edit' : 'Create New'} {activeTab.slice(0, -1)}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              {activeTab === 'warehouses' && (
                <>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
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
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
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
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
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
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
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
                </>
              )}

              {activeTab === 'categories' && (
                <>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      CATEGORY NAME *
                    </label>
                    <input
                      type="text"
                      className="input-glass"
                      placeholder="e.g. Industrial Tools"
                      value={modalForm.name || ''}
                      onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      DESCRIPTION
                    </label>
                    <textarea
                      rows="3"
                      className="input-glass"
                      placeholder="e.g. Heavy-duty power tools and assembly equipment"
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
