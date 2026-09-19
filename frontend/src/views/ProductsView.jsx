import React, { useState, useEffect } from 'react';
import { productApi, categoryApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  Package,
  Plus,
  Search,
  Edit2,
  CheckCircle,
  XCircle,
  Layers,
  DollarSign,
  AlertCircle,
  RefreshCw,
  X
} from 'lucide-react';

export default function ProductsView() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    categoryId: '',
    unitOfMeasure: 'PCS',
    costPrice: '',
    sellingPrice: '',
    minStockLevel: '5',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const { addToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes] = await Promise.all([
        productApi.getProducts({ size: 100 }),
        categoryApi.getActive(),
      ]);
      setProducts(prodRes.data?.content || prodRes.data || []);
      setCategories(catRes.data || []);
    } catch (err) {
      addToast('Failed to load products: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      sku: '',
      name: '',
      categoryId: categories.length > 0 ? categories[0].id : '',
      unitOfMeasure: 'PCS',
      costPrice: '',
      sellingPrice: '',
      minStockLevel: '5',
      description: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (prod) => {
    setEditingProduct(prod);
    setFormData({
      sku: prod.sku,
      name: prod.name,
      categoryId: prod.categoryId || (categories.find(c => c.name === prod.categoryName)?.id || ''),
      unitOfMeasure: prod.unitOfMeasure || 'PCS',
      costPrice: prod.costPrice?.toString() || '',
      sellingPrice: prod.sellingPrice?.toString() || '',
      minStockLevel: prod.minStockLevel?.toString() || '0',
      description: prod.description || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.sku || !formData.name || !formData.sellingPrice) {
      addToast('SKU, Product Name, and Selling Price are required', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        sku: formData.sku.trim(),
        barcode: null,
        name: formData.name.trim(),
        categoryId: formData.categoryId ? Number(formData.categoryId) : null,
        unitOfMeasure: formData.unitOfMeasure,
        costPrice: parseFloat(formData.costPrice) || 0,
        sellingPrice: parseFloat(formData.sellingPrice) || 0,
        minStockLevel: parseInt(formData.minStockLevel, 10) || 0,
        description: formData.description.trim() || null,
      };

      if (editingProduct) {
        await productApi.update(editingProduct.id, payload);
        addToast(`Product ${payload.name} updated successfully!`, 'success');
      } else {
        await productApi.create(payload);
        addToast(`Product ${payload.name} created successfully!`, 'success');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to save product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      await productApi.toggleActive(id);
      addToast(`Product status updated`, 'info');
      loadData();
    } catch (err) {
      addToast('Failed to toggle status: ' + err.message, 'error');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesActive =
      filterActive === 'all'
        ? true
        : filterActive === 'active'
        ? p.active
        : !p.active;
    return matchesSearch && matchesActive;
  });

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={28} color="#2563eb" /> Product Catalog
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Manage master product listings, categorizations, and pricing
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-glass" onClick={loadData} title="Reload list">
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={18} /> New Product
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '12px', color: '#94a3b8' }} />
          <input
            type="text"
            className="input-glass"
            style={{ paddingLeft: '42px' }}
            placeholder="Search by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>STATUS:</span>
          <button
            className={`btn btn-sm ${filterActive === 'all' ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setFilterActive('all')}
          >
            All ({products.length})
          </button>
          <button
            className={`btn btn-sm ${filterActive === 'active' ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setFilterActive('active')}
          >
            Active ({products.filter(p => p.active).length})
          </button>
          <button
            className={`btn btn-sm ${filterActive === 'inactive' ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setFilterActive('inactive')}
          >
            Inactive ({products.filter(p => !p.active).length})
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="glass-table">
            <thead>
              <tr>
                <th>Product / SKU</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Min Stock</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    Loading product catalog...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No products found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#2563eb', fontFamily: 'monospace' }}>
                        {p.sku}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-info">{p.categoryName || 'General'}</span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{p.unitOfMeasure || 'PCS'}</td>
                    <td style={{ color: '#64748b' }}>${Number(p.costPrice || 0).toFixed(2)}</td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>
                      ${Number(p.sellingPrice || 0).toFixed(2)}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: p.minStockLevel > 10 ? '#059669' : '#d97706' }}>
                        {p.minStockLevel || 0}
                      </span>
                    </td>
                    <td>
                      {p.active ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-danger">Inactive</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-glass btn-sm"
                          onClick={() => handleOpenEdit(p)}
                          title="Edit product"
                        >
                          <Edit2 size={14} /> Edit
                        </button>
                        <button
                          className={`btn btn-sm ${p.active ? 'btn-glass' : 'btn-primary'}`}
                          onClick={() => handleToggleActive(p.id, p.active)}
                          title={p.active ? 'Deactivate product' : 'Activate product'}
                        >
                          {p.active ? <XCircle size={14} color="#ef4444" /> : <CheckCircle size={14} />}
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

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="glass-modal" style={{ width: '100%', maxWidth: '640px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.3rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={22} color="#2563eb" />
                {editingProduct ? 'Edit Product Details' : 'Create New Master Product'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  SKU / CODE *
                </label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder="e.g. PRD-001"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                  required
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  PRODUCT NAME *
                </label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder="e.g. Industrial Steel Pipe 2 inch"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    CATEGORY
                  </label>
                  <select
                    className="input-glass"
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  >
                    <option value="">-- Uncategorized --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    UNIT OF MEASURE
                  </label>
                  <select
                    className="input-glass"
                    value={formData.unitOfMeasure}
                    onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                  >
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="BOX">BOX (Boxes)</option>
                    <option value="KG">KG (Kilograms)</option>
                    <option value="MTR">MTR (Meters)</option>
                    <option value="LTR">LTR (Liters)</option>
                    <option value="SET">SET (Sets)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    COST PRICE ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-glass"
                    placeholder="0.00"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    SELLING PRICE ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-glass"
                    placeholder="0.00"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    MIN STOCK ALERT
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input-glass"
                    placeholder="5"
                    value={formData.minStockLevel}
                    onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  DESCRIPTION / NOTES
                </label>
                <textarea
                  className="input-glass"
                  rows="2"
                  placeholder="Optional product specifications, dimensions, supplier references..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : (editingProduct ? 'Update Product' : 'Create Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
