import React, { useState, useEffect } from 'react';
import {
  warehouseApi,
  categoryApi,
  customerApi,
  supplierApi,
  salesmanApi,
} from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  Database,
  Building2,
  FolderTree,
  Users,
  Truck,
  UserCheck,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  X
} from 'lucide-react';

export default function MastersView() {
  const [activeTab, setActiveTab] = useState('warehouses');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Data lists
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalForm, setModalForm] = useState({});
  const [saving, setSaving] = useState(false);

  const { addToast } = useToast();

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

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
      } else if (activeTab === 'salesmen') {
        const res = await salesmanApi.getAll();
        setSalesmen(res.data || []);
      }
    } catch (err) {
      addToast('Failed to load ' + activeTab + ': ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    if (activeTab === 'warehouses') {
      setModalForm({ code: '', name: '', address: '', contactNumber: '' });
    } else if (activeTab === 'categories') {
      setModalForm({ name: '', description: '' });
    } else if (activeTab === 'customers') {
      setModalForm({ code: '', name: '', phone: '', email: '', address: '', creditLimit: '0' });
    } else if (activeTab === 'suppliers') {
      setModalForm({ code: '', name: '', contactPerson: '', phone: '', email: '', address: '' });
    } else if (activeTab === 'salesmen') {
      setModalForm({ code: '', name: '', phone: '', commissionRate: '0' });
    }
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setModalForm({ ...item });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (activeTab === 'warehouses') {
        if (editingItem) {
          await warehouseApi.update(editingItem.id, modalForm);
        } else {
          await warehouseApi.create(modalForm);
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
          creditLimit: parseFloat(modalForm.creditLimit) || 0,
        };
        if (editingItem) {
          await customerApi.update(editingItem.id, payload);
        } else {
          await customerApi.create(payload);
        }
      } else if (activeTab === 'suppliers') {
        if (editingItem) {
          await supplierApi.update(editingItem.id, modalForm);
        } else {
          await supplierApi.create(modalForm);
        }
      } else if (activeTab === 'salesmen') {
        const payload = {
          ...modalForm,
          commissionRate: parseFloat(modalForm.commissionRate) || 0,
        };
        if (editingItem) {
          await salesmanApi.update(editingItem.id, payload);
        } else {
          await salesmanApi.create(payload);
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
      if (activeTab === 'salesmen') await salesmanApi.toggleActive(id);

      addToast(`Status updated to ${currentStatus ? 'Inactive' : 'Active'}`, 'success');
      loadTabData();
    } catch (err) {
      addToast('Status update failed: ' + err.message, 'error');
    }
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={28} color="#2563eb" /> Master Data Management
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Configure warehouses, product categories, customers, suppliers, and sales personnel
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-glass" onClick={loadTabData}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={18} /> Add New {activeTab.slice(0, -1)}
          </button>
        </div>
      </div>

      {/* Directory Tabs */}
      <div>
        <div className="glass-pill-bar">
          <button
            type="button"
            className={`glass-pill-btn ${activeTab === 'warehouses' ? 'active' : ''}`}
            onClick={() => setActiveTab('warehouses')}
          >
            <Building2 size={16} /> Warehouses
          </button>
          <button
            type="button"
            className={`glass-pill-btn ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            <FolderTree size={16} /> Categories
          </button>
          <button
            type="button"
            className={`glass-pill-btn ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            <Users size={16} /> Customers
          </button>
          <button
            type="button"
            className={`glass-pill-btn ${activeTab === 'suppliers' ? 'active' : ''}`}
            onClick={() => setActiveTab('suppliers')}
          >
            <Truck size={16} /> Suppliers
          </button>
        </div>
      </div>

      {/* Search toolbar */}
      <div className="glass-card" style={{ padding: '14px 20px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '12px', color: '#94a3b8' }} />
          <input
            type="text"
            className="input-glass"
            style={{ paddingLeft: '42px' }}
            placeholder={`Filter ${activeTab} records...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Tables based on activeTab */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {activeTab === 'warehouses' && (
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Warehouse Name</th>
                  <th>Address</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {warehouses
                  .filter((w) => w.name?.toLowerCase().includes(searchTerm.toLowerCase()) || w.code?.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((w) => (
                    <tr key={w.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{w.code}</td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{w.name}</td>
                      <td style={{ color: '#64748b' }}>{w.address || '—'}</td>
                      <td>{w.contactNumber || '—'}</td>
                      <td>
                        <span className={`badge ${w.active ? 'badge-success' : 'badge-danger'}`}>
                          {w.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-glass btn-sm" onClick={() => handleOpenEdit(w)}>
                            <Edit2 size={14} /> Edit
                          </button>
                          <button className="btn btn-sm btn-glass" onClick={() => handleToggleActive(w.id, w.active)}>
                            {w.active ? <XCircle size={14} color="#ef4444" /> : <CheckCircle size={14} color="#10b981" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'categories' && (
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
                {categories
                  .filter((c) => c.name?.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</td>
                      <td style={{ color: '#64748b' }}>{c.description || '—'}</td>
                      <td>
                        <span className={`badge ${c.active ? 'badge-success' : 'badge-danger'}`}>
                          {c.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-glass btn-sm" onClick={() => handleOpenEdit(c)}>
                            <Edit2 size={14} /> Edit
                          </button>
                          <button className="btn btn-sm btn-glass" onClick={() => handleToggleActive(c.id, c.active)}>
                            {c.active ? <XCircle size={14} color="#ef4444" /> : <CheckCircle size={14} color="#10b981" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'customers' && (
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th>Credit Limit</th>
                  <th>Current Credit</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers
                  .filter((c) => c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.code?.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{c.code}</td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</td>
                      <td>{c.phone || '—'}</td>
                      <td style={{ fontWeight: 600 }}>${Number(c.creditLimit || 0).toFixed(2)}</td>
                      <td style={{ color: c.currentCredit > 0 ? '#dc2626' : '#059669' }}>
                        ${Number(c.currentCredit || 0).toFixed(2)}
                      </td>
                      <td>
                        <span className={`badge ${c.active ? 'badge-success' : 'badge-danger'}`}>
                          {c.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-glass btn-sm" onClick={() => handleOpenEdit(c)}>
                            <Edit2 size={14} /> Edit
                          </button>
                          <button className="btn btn-sm btn-glass" onClick={() => handleToggleActive(c.id, c.active)}>
                            {c.active ? <XCircle size={14} color="#ef4444" /> : <CheckCircle size={14} color="#10b981" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'suppliers' && (
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Supplier Name</th>
                  <th>Contact Person</th>
                  <th>Phone / Email</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers
                  .filter((s) => s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || s.code?.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{s.code}</td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{s.name}</td>
                      <td>{s.contactPerson || '—'}</td>
                      <td>{s.phone || s.email || '—'}</td>
                      <td>
                        <span className={`badge ${s.active ? 'badge-success' : 'badge-danger'}`}>
                          {s.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-glass btn-sm" onClick={() => handleOpenEdit(s)}>
                            <Edit2 size={14} /> Edit
                          </button>
                          <button className="btn btn-sm btn-glass" onClick={() => handleToggleActive(s.id, s.active)}>
                            {s.active ? <XCircle size={14} color="#ef4444" /> : <CheckCircle size={14} color="#10b981" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'salesmen' && (
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Salesman Name</th>
                  <th>Phone</th>
                  <th>Commission Rate (%)</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {salesmen
                  .filter((sm) => sm.name?.toLowerCase().includes(searchTerm.toLowerCase()) || sm.code?.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((sm) => (
                    <tr key={sm.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{sm.code}</td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{sm.name}</td>
                      <td>{sm.phone || '—'}</td>
                      <td style={{ fontWeight: 600, color: '#2563eb' }}>{sm.commissionRate}%</td>
                      <td>
                        <span className={`badge ${sm.active ? 'badge-success' : 'badge-danger'}`}>
                          {sm.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-glass btn-sm" onClick={() => handleOpenEdit(sm)}>
                            <Edit2 size={14} /> Edit
                          </button>
                          <button className="btn btn-sm btn-glass" onClick={() => handleToggleActive(sm.id, sm.active)}>
                            {sm.active ? <XCircle size={14} color="#ef4444" /> : <CheckCircle size={14} color="#10b981" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="glass-modal" style={{ width: '100%', maxWidth: '560px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.3rem', color: '#0f172a' }}>
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
              {/* Dynamic inputs based on activeTab */}
              {activeTab === 'warehouses' && (
                <>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CODE *</label>
                    <input type="text" className="input-glass" value={modalForm.code || ''} onChange={(e) => setModalForm({ ...modalForm, code: e.target.value.toUpperCase() })} required />
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>NAME *</label>
                    <input type="text" className="input-glass" value={modalForm.name || ''} onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })} required />
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>ADDRESS</label>
                    <input type="text" className="input-glass" value={modalForm.address || ''} onChange={(e) => setModalForm({ ...modalForm, address: e.target.value })} />
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CONTACT NUMBER</label>
                    <input type="text" className="input-glass" value={modalForm.contactNumber || ''} onChange={(e) => setModalForm({ ...modalForm, contactNumber: e.target.value })} />
                  </div>
                </>
              )}

              {activeTab === 'categories' && (
                <>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CATEGORY NAME *</label>
                    <input type="text" className="input-glass" value={modalForm.name || ''} onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })} required />
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>DESCRIPTION</label>
                    <textarea rows="3" className="input-glass" value={modalForm.description || ''} onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })} />
                  </div>
                </>
              )}

              {activeTab === 'customers' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CODE *</label>
                      <input type="text" className="input-glass" value={modalForm.code || ''} onChange={(e) => setModalForm({ ...modalForm, code: e.target.value.toUpperCase() })} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CUSTOMER NAME *</label>
                      <input type="text" className="input-glass" value={modalForm.name || ''} onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })} required />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>PHONE</label>
                      <input type="text" className="input-glass" value={modalForm.phone || ''} onChange={(e) => setModalForm({ ...modalForm, phone: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CREDIT LIMIT ($)</label>
                      <input type="number" step="0.01" className="input-glass" value={modalForm.creditLimit || ''} onChange={(e) => setModalForm({ ...modalForm, creditLimit: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>ADDRESS</label>
                    <input type="text" className="input-glass" value={modalForm.address || ''} onChange={(e) => setModalForm({ ...modalForm, address: e.target.value })} />
                  </div>
                </>
              )}

              {activeTab === 'suppliers' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CODE *</label>
                      <input type="text" className="input-glass" value={modalForm.code || ''} onChange={(e) => setModalForm({ ...modalForm, code: e.target.value.toUpperCase() })} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>SUPPLIER NAME *</label>
                      <input type="text" className="input-glass" value={modalForm.name || ''} onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })} required />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CONTACT PERSON</label>
                      <input type="text" className="input-glass" value={modalForm.contactPerson || ''} onChange={(e) => setModalForm({ ...modalForm, contactPerson: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>PHONE</label>
                      <input type="text" className="input-glass" value={modalForm.phone || ''} onChange={(e) => setModalForm({ ...modalForm, phone: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>ADDRESS</label>
                    <input type="text" className="input-glass" value={modalForm.address || ''} onChange={(e) => setModalForm({ ...modalForm, address: e.target.value })} />
                  </div>
                </>
              )}

              {activeTab === 'salesmen' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CODE *</label>
                      <input type="text" className="input-glass" value={modalForm.code || ''} onChange={(e) => setModalForm({ ...modalForm, code: e.target.value.toUpperCase() })} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>SALESMAN NAME *</label>
                      <input type="text" className="input-glass" value={modalForm.name || ''} onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })} required />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>PHONE</label>
                      <input type="text" className="input-glass" value={modalForm.phone || ''} onChange={(e) => setModalForm({ ...modalForm, phone: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>COMMISSION RATE (%)</label>
                      <input type="number" step="0.1" className="input-glass" value={modalForm.commissionRate || ''} onChange={(e) => setModalForm({ ...modalForm, commissionRate: e.target.value })} />
                    </div>
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
