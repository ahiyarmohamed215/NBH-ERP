import React, { useState, useEffect } from 'react';
import { productApi, categoryApi, brandApi, warehouseApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  Package,
  Plus,
  Search,
  Edit2,
  CheckCircle,
  XCircle,
  RefreshCw,
  X,
  Eye,
  Trash2,
} from 'lucide-react';

export default function ProductsView({ isEmbedded = false }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    brandId: '',
    categoryId: '',
    warehouseId: '',
    unitOfMeasure: 'PCS',
    minStockLevel: '5',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  // View Details Modal State
  const [viewingProduct, setViewingProduct] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const { addToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, brandRes, whRes] = await Promise.all([
        productApi.getProducts({ size: 200 }),
        categoryApi.getActive(),
        brandApi.getActive(),
        warehouseApi.getAll(),
      ]);
      setProducts(prodRes.data?.content || prodRes.data || []);
      setCategories(catRes.data || []);
      setBrands(brandRes.data || []);
      setWarehouses(whRes.data || []);
    } catch (err) {
      addToast('Failed to load products: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const isProductActive = (p) => Boolean(p?.isActive ?? p?.active ?? false);

  const getBrandForProduct = (p) => {
    if (!p) return 'General';
    if (p.brandName) return p.brandName;
    if (p.brandId) {
      const found = brands.find((b) => String(b.id) === String(p.brandId));
      if (found) return found.name;
    }
    return 'General';
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    const defaultWh = warehouses[0];
    setFormData({
      sku: '',
      name: '',
      brandId: brands[0]?.id || '',
      categoryId: categories.length > 0 ? categories[0].id : '',
      warehouseId: defaultWh ? defaultWh.id : '',
      unitOfMeasure: 'PCS',
      minStockLevel: '5',
      description: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (prod) => {
    setEditingProduct(prod);
    const matchedWh = warehouses.find((w) => String(w.id) === String(prod.warehouseId || prod.defaultWarehouseId) || w.name === prod.warehouseName) || warehouses[0];
    setFormData({
      sku: prod.sku,
      name: prod.name,
      brandId: prod.brandId || (brands.find((b) => b.name === prod.brandName)?.id || (brands[0]?.id || '')),
      categoryId: prod.categoryId || (categories.find((c) => c.name === prod.categoryName)?.id || ''),
      warehouseId: prod.warehouseId || prod.defaultWarehouseId || (matchedWh ? matchedWh.id : ''),
      unitOfMeasure: prod.unitOfMeasure || 'PCS',
      minStockLevel: prod.minStockLevel?.toString() || '5',
      description: prod.description || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.sku || !formData.name) {
      addToast('SKU and Product Name are required', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        sku: formData.sku.trim().toUpperCase(),
        barcode: null,
        name: formData.name.trim(),
        brandId: formData.brandId ? Number(formData.brandId) : null,
        categoryId: formData.categoryId ? Number(formData.categoryId) : null,
        warehouseId: formData.warehouseId ? Number(formData.warehouseId) : null,
        defaultWarehouseId: formData.warehouseId ? Number(formData.warehouseId) : null,
        unitOfMeasure: formData.unitOfMeasure,
        minStockLevel: parseInt(formData.minStockLevel, 10) || 0,
        description: formData.description?.trim() || null,
      };

      if (editingProduct) {
        await productApi.update(editingProduct.id, payload);
        addToast(`Product "${payload.name}" updated successfully!`, 'success');
      } else {
        await productApi.create(payload);
        addToast(`Product "${payload.name}" created successfully!`, 'success');
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
      addToast(`Product status changed to ${currentStatus ? 'Inactive' : 'Active'}`, 'success');
      loadData();
    } catch (err) {
      addToast('Failed to toggle status: ' + err.message, 'error');
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Are you sure you want to permanently delete product "${p.name}" (${p.sku})? This action cannot be undone.`)) {
      return;
    }
    try {
      setDeletingId(p.id);
      await productApi.delete(p.id);
      addToast(`Product "${p.name}" deleted successfully`, 'success');
      loadData();
    } catch (err) {
      addToast(err.message || 'Delete failed', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredProducts = products.filter((p) => {
    const active = isProductActive(p);
    if (statusFilter === 'ACTIVE' && !active) return false;
    if (statusFilter === 'INACTIVE' && active) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.categoryName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeCount = products.filter(isProductActive).length;
  const inactiveCount = products.length - activeCount;

  return (
    <div style={{ padding: isEmbedded ? '0px' : '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Standalone Header (Shown only when not embedded in MastersView) */}
      {!isEmbedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <Package size={28} color="#2563eb" /> Product Catalog
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '6px 0 0 0' }}>
              Manage master product listings, category mappings, and directory specifications
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
      )}

      {/* Filter Toolbar */}
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '12px', color: '#94a3b8' }} />
          <input
            type="text"
            className="input-glass"
            style={{ paddingLeft: '42px' }}
            placeholder="Search products by SKU, name, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            STATUS:
          </span>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All ({products.length})
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

      {/* Table Card */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="glass-table">
            <thead>
              <tr>
                <th>Code / SKU</th>
                <th>Product Name</th>
                <th>Description / Note</th>
                <th>Brand</th>
                <th>Category</th>
                <th>Warehouse</th>
                <th>Unit</th>
                <th>Min Stock</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    Loading product catalog...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No products found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const active = isProductActive(p);
                  const pWhName = p.warehouseName || p.defaultWarehouseName || (warehouses.find(w => String(w.id) === String(p.warehouseId || p.defaultWarehouseId))?.name);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{p.sku}</td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</td>
                      <td
                        style={{
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
                      <td>
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
                      <td>
                        <span className="badge badge-info">{p.categoryName || 'General'}</span>
                      </td>
                      <td>
                        <span
                          style={{
                            backgroundColor: pWhName ? '#f0fdf4' : '#f8fafc',
                            color: pWhName ? '#15803d' : '#64748b',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            border: pWhName ? '1px solid #dcfce7' : '1px solid #e2e8f0',
                          }}
                        >
                          {pWhName || 'Main Warehouse'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{p.unitOfMeasure || 'PCS'}</td>
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
                            onClick={() => setViewingProduct(p)}
                            title="View product details"
                          >
                            <Eye size={14} /> View
                          </button>
                          <button
                            className="btn btn-glass btn-sm"
                            onClick={() => handleOpenEdit(p)}
                            title="Edit product"
                          >
                            <Edit2 size={14} /> Edit
                          </button>
                          <button
                            className="btn btn-glass btn-sm"
                            style={{ color: '#dc2626' }}
                            onClick={() => handleDelete(p)}
                            disabled={deletingId === p.id}
                            title="Delete product"
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
        </div>
      </div>

      {/* View Product Details Modal */}
      {viewingProduct && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{ width: 'min(820px, 96vw)', maxWidth: '820px', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 800, color: '#2563eb', letterSpacing: '0.05em' }}>
                  Product Specification & Status
                </span>
                <h2 style={{ fontSize: '1.45rem', color: '#0f172a', margin: '4px 0 0 0' }}>
                  {viewingProduct.name}
                </h2>
              </div>
              <button
                onClick={() => setViewingProduct(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Catalog Status</span>
                <div>
                  <button
                    type="button"
                    className={`badge ${isProductActive(viewingProduct) ? 'badge-success' : 'badge-danger'}`}
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
                      const active = isProductActive(viewingProduct);
                      await handleToggleActive(viewingProduct.id, active);
                      setViewingProduct(prev => prev ? ({ ...prev, active: !active, isActive: !active, is_active: !active, status: !active ? 'ACTIVE' : 'INACTIVE' }) : null);
                    }}
                    title={`Status: ${isProductActive(viewingProduct) ? 'Active' : 'Inactive'} (Click to toggle)`}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', display: 'inline-block' }} />
                    {isProductActive(viewingProduct) ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>SKU / Item Code</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8', fontSize: '0.95rem' }}>{viewingProduct.sku}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Brand</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{getBrandForProduct(viewingProduct)}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Category</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{viewingProduct.categoryName || 'General / Uncategorized'}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Unit of Measure</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{viewingProduct.unitOfMeasure || 'PCS'}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Default Warehouse</span>
                <span style={{ fontWeight: 600, color: '#15803d' }}>
                  {viewingProduct.warehouseName || viewingProduct.defaultWarehouseName || (warehouses.find(w => String(w.id) === String(viewingProduct.warehouseId || viewingProduct.defaultWarehouseId))?.name) || 'Main Warehouse'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Min Stock Alert</span>
                <span style={{ fontWeight: 700, color: viewingProduct.minStockLevel > 10 ? '#059669' : '#d97706' }}>
                  {viewingProduct.minStockLevel || 0} {viewingProduct.unitOfMeasure || 'PCS'}
                </span>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Description</span>
                <span style={{ color: '#334155', fontSize: '0.88rem' }}>{viewingProduct.description || 'No description provided.'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn btn-glass" onClick={() => setViewingProduct(null)}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const p = viewingProduct;
                  setViewingProduct(null);
                  handleOpenEdit(p);
                }}
              >
                <Edit2 size={16} /> Edit Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{ width: 'min(820px, 96vw)', maxWidth: '820px', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <h2 style={{ fontSize: '1.35rem', color: '#0f172a', margin: 0 }}>
                {editingProduct ? 'Edit' : 'Create New'} Product
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                    PRODUCT CODE (SKU) *
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
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
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
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                    BRAND *
                  </label>
                  <select
                    className="input-glass"
                    value={formData.brandId}
                    onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                    required
                  >
                    <option value="">-- Select Brand --</option>
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
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    required
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                    WAREHOUSE *
                  </label>
                  <select
                    className="input-glass"
                    value={formData.warehouseId}
                    onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                    required
                  >
                    <option value="">-- Select Warehouse --</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.code ? `(${w.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
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
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                    MIN STOCK ALERT LEVEL
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

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                  DESCRIPTION / NOTES
                </label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder="e.g. Heavy-duty construction grade, Shelf A-1"
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
