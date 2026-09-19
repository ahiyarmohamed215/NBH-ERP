import React, { useState, useEffect } from 'react';
import { roleApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import { ShieldCheck, Plus, Edit2, Trash2, X, Check, Search, Shield } from 'lucide-react';

export default function RolesView() {
  const { addToast } = useToast();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [],
  });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rolesRes, permsRes] = await Promise.all([
        roleApi.getAll(),
        roleApi.getPermissions(),
      ]);
      setRoles(rolesRes.data || []);
      setPermissions(permsRes.data || []);
    } catch (err) {
      addToast(err.message || 'Failed to load roles and permissions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      permissions: [],
    });
    setShowModal(true);
  };

  const openEditModal = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || [],
    });
    setShowModal(true);
  };

  const handleTogglePermission = (permName) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(permName);
      if (exists) {
        return { ...prev, permissions: prev.permissions.filter((p) => p !== permName) };
      } else {
        return { ...prev, permissions: [...prev.permissions, permName] };
      }
    });
  };

  const handleSelectAllInModule = (moduleName, modulePerms) => {
    const allModulePermNames = modulePerms.map((p) => p.name);
    const areAllSelected = allModulePermNames.every((name) => formData.permissions.includes(name));

    setFormData((prev) => {
      if (areAllSelected) {
        return {
          ...prev,
          permissions: prev.permissions.filter((p) => !allModulePermNames.includes(p)),
        };
      } else {
        const combined = new Set([...prev.permissions, ...allModulePermNames]);
        return {
          ...prev,
          permissions: Array.from(combined),
        };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingRole && !formData.name.trim()) {
      addToast('Role name is required', 'error');
      return;
    }

    try {
      setSaving(true);
      if (editingRole) {
        await roleApi.update(editingRole.id, {
          description: formData.description.trim(),
          permissions: formData.permissions,
        });
        addToast('Role updated successfully', 'success');
      } else {
        await roleApi.create({
          name: formData.name.trim(),
          description: formData.description.trim(),
          permissions: formData.permissions,
        });
        addToast('Custom role created successfully', 'success');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      addToast(err.message || 'Failed to save role', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role) => {
    if (!window.confirm(`Are you sure you want to delete role "${role.name}"?`)) return;
    try {
      await roleApi.delete(role.id);
      addToast('Role deleted successfully', 'success');
      fetchData();
    } catch (err) {
      addToast(err.message || 'Failed to delete role', 'error');
    }
  };

  // Group permissions by module
  const permissionsByModule = permissions.reduce((acc, perm) => {
    const mod = perm.module || 'OTHER';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(perm);
    return acc;
  }, {});

  const filteredRoles = roles.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', color: '#0f172a', marginBottom: '4px' }}>Role Management</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Create and configure company roles with fine-grained access permissions
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={16} /> Create New Role
        </button>
      </div>

      {/* Search Bar */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '20px', backgroundColor: '#ffffff' }}>
        <div style={{ position: 'relative', maxWidth: '380px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
          <input
            type="text"
            className="input-glass"
            style={{ paddingLeft: '34px' }}
            placeholder="Search roles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Roles Grid / Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading roles...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {filteredRoles.map((role) => {
            const isSystemAdmin = role.name === 'ROLE_ADMIN';
            return (
              <div
                key={role.id}
                className="glass-card"
                style={{
                  padding: '20px',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Shield size={18} color="#2563eb" />
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                        {role.name}
                      </span>
                    </div>
                    {isSystemAdmin && (
                      <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                        System Role
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '14px', minHeight: '38px' }}>
                    {role.description || 'No description provided'}
                  </p>

                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      PERMISSIONS ({role.permissions?.length || 0})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                      {role.permissions?.length > 0 ? (
                        role.permissions.map((p) => (
                          <span
                            key={p}
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            {p}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No permissions assigned</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '12px' }}>
                  <button
                    className="btn btn-glass btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => openEditModal(role)}
                  >
                    <Edit2 size={13} /> Edit Permissions
                  </button>
                  {!isSystemAdmin && (
                    <button
                      className="btn btn-glass btn-sm"
                      style={{ color: '#ef4444', borderColor: '#fecaca' }}
                      onClick={() => handleDelete(role)}
                      title="Delete Role"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Role Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 24px',
              borderBottom: '1px solid #e2e8f0',
            }}>
              <h3 style={{ fontSize: '1.2rem', color: '#0f172a' }}>
                {editingRole ? `Edit Role: ${editingRole.name}` : 'Create Custom Role'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', overflowY: 'auto', maxHeight: 'calc(90vh - 140px)' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>
                    ROLE NAME {!editingRole && '*'}
                  </label>
                  <input
                    type="text"
                    className="input-glass"
                    placeholder="e.g. INVENTORY_CLERK or Warehouse Operator"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!!editingRole}
                    required={!editingRole}
                  />
                  {!editingRole && (
                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '3px', display: 'block' }}>
                      Name will be prefixed with ROLE_ if not provided (e.g. ROLE_INVENTORY_CLERK).
                    </span>
                  )}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>
                    DESCRIPTION
                  </label>
                  <input
                    type="text"
                    className="input-glass"
                    placeholder="Brief description of this role's duties and access scope"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                        ASSIGN SYSTEM MODULES & PERMISSIONS
                      </label>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {formData.permissions.length} of {permissions.length} permissions enabled for this role
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, permissions: permissions.map((p) => p.name) }))}
                        className="btn btn-glass btn-sm"
                        style={{ fontSize: '0.75rem' }}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, permissions: [] }))}
                        className="btn btn-glass btn-sm"
                        style={{ fontSize: '0.75rem' }}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {Object.entries(permissionsByModule).map(([moduleName, perms]) => {
                      const modulePermNames = perms.map((p) => p.name);
                      const allSelected = modulePermNames.every((name) => formData.permissions.includes(name));
                      const someSelected = modulePermNames.some((name) => formData.permissions.includes(name));

                      const moduleInfoMap = {
                        DASHBOARD: { label: 'Executive Dashboard', desc: 'KPI cards, valuation summaries & operational overview' },
                        SALES: { label: 'Point of Sale (POS) & Sales Returns', desc: 'Cashier checkout, invoice creation, hold carts & credit notes' },
                        INVENTORY: { label: 'Stock & Inventory Management', desc: 'Warehouse stock balances, stock ledger & inventory adjustments' },
                        PRODUCT: { label: 'Products Catalog', desc: 'Product items, SKU, cost, pricing & categories' },
                        GRN: { label: 'Goods Received (GRN)', desc: 'Receive goods from suppliers and increment stock' },
                        GTN: { label: 'Stock Transfers (GTN)', desc: 'Inter-warehouse transfer notes and stock transit' },
                        PRN: { label: 'Purchase Returns (PRN)', desc: 'Return defective or excess goods back to suppliers' },
                        MASTER_DATA: { label: 'Master Data & Directories', desc: 'Warehouses, Customers, and Suppliers profiles' },
                        REPORT: { label: 'Reports & Analytics', desc: 'Sales performance, valuation reports, and audit logs' },
                        ADMINISTRATION: { label: 'User Administration & Roles', desc: 'Approve new signups, staff accounts, and custom roles' },
                      };

                      const info = moduleInfoMap[moduleName] || {
                        label: `Module: ${moduleName}`,
                        desc: 'System permissions for this feature',
                      };

                      return (
                        <div
                          key={moduleName}
                          style={{
                            border: `1px solid ${someSelected ? '#bfdbfe' : '#e2e8f0'}`,
                            borderRadius: '8px',
                            padding: '12px 14px',
                            backgroundColor: someSelected ? '#f8fafc' : '#ffffff',
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '10px',
                            paddingBottom: '8px',
                            borderBottom: '1px solid #e2e8f0',
                          }}>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b' }}>
                                {info.label}
                              </span>
                              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                {info.desc}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSelectAllInModule(moduleName, perms)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#2563eb',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {allSelected ? 'Deselect Module' : 'Enable Module'}
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
                            {perms.map((perm) => {
                              const isChecked = formData.permissions.includes(perm.name);
                              return (
                                <label
                                  key={perm.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '8px',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: isChecked ? '#eff6ff' : '#ffffff',
                                    border: `1px solid ${isChecked ? '#bfdbfe' : '#e2e8f0'}`,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleTogglePermission(perm.name)}
                                    style={{ marginTop: '3px' }}
                                  />
                                  <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>
                                      {perm.name}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                      {perm.description}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                padding: '14px 24px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
              }}>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
