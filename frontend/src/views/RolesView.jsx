import React, { useState, useEffect } from 'react';
import { roleApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import { ShieldCheck, Plus, Edit2, Trash2, X, Check, Search, Shield, ChevronRight, Eye } from 'lucide-react';

export default function RolesView() {
  const { addToast } = useToast();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [viewingRole, setViewingRole] = useState(null);
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
    <div
      style={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '20px 24px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header (Sticky / Fixed at Top) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexShrink: 0,
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>Role Management</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            Create and configure company roles with fine-grained access permissions
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateModal}
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
            flexShrink: 0,
          }}
        >
          <Plus size={16} /> Create New Role
        </button>
      </div>

      {/* Search Bar (Sticky / Fixed at Top) */}
      <div
        style={{
          padding: '10px 16px',
          marginBottom: '16px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8' }} />
          <input
            type="text"
            style={{
              width: '100%',
              height: '38px',
              padding: '0 32px 0 36px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.88rem',
              outline: 'none',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#0284c7';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(2, 132, 199, 0.15)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.boxShadow = 'none';
            }}
            placeholder="Search roles by title, permissions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
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
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>
          {filteredRoles.length} Role{filteredRoles.length === 1 ? '' : 's'} Configured
        </div>
      </div>

      {/* Roles Cards Grid (ONLY this section scrolls vertically!) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          paddingRight: '6px',
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading roles...</div>
        ) : filteredRoles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b', fontSize: '0.9rem' }}>
            No roles found matching "{searchQuery}".
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px', paddingBottom: '20px' }}>
            {filteredRoles.map((role) => {
              const isSystemAdmin = role.name === 'ROLE_ADMIN';
              return (
                <div
                  key={role.id}
                  onClick={() => setViewingRole(role)}
                  style={{
                    padding: '14px 16px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#93c5fd';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(2, 132, 199, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.02)';
                    e.currentTarget.style.transform = 'none';
                  }}
                  title="Click to view full role details & permissions"
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            backgroundColor: '#e0f2fe',
                            color: '#0284c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Shield size={15} />
                        </div>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.92rem',
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {role.name}
                        </span>
                      </div>
                      {isSystemAdmin && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #dbeafe',
                            flexShrink: 0,
                          }}
                        >
                          System
                        </span>
                      )}
                    </div>

                    <p
                      style={{
                        fontSize: '0.78rem',
                        color: '#64748b',
                        margin: '0 0 10px 0',
                        lineHeight: '1.35',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        minHeight: '32px',
                      }}
                    >
                      {role.description || 'No description provided'}
                    </p>

                    {/* Count only the permissions */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '8px',
                        borderTop: '1px solid #f1f5f9',
                        marginBottom: '8px',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: '#eff6ff',
                          color: '#0284c7',
                          border: '1px solid #bae6fd',
                          borderRadius: '5px',
                          padding: '2px 8px',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                        }}
                      >
                        <ShieldCheck size={12} color="#0284c7" />
                        {role.permissions?.length || 0} Permission{role.permissions?.length === 1 ? '' : 's'}
                      </span>

                      <span style={{ fontSize: '0.74rem', color: '#0284c7', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        View <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                    <button
                      type="button"
                      style={{
                        flex: 1,
                        height: '30px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '5px',
                        color: '#334155',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(role);
                      }}
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                    {!isSystemAdmin && (
                      <button
                        type="button"
                        style={{
                          width: '30px',
                          height: '30px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #fecaca',
                          borderRadius: '5px',
                          color: '#dc2626',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(role);
                        }}
                        title="Delete Role"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* View Role Full Details Popup Modal */}
      {viewingRole && (
        <div className="modal-backdrop" onClick={() => setViewingRole(null)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '720px',
              padding: '24px 28px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 35px -8px rgba(15, 23, 42, 0.2), 0 10px 15px -6px rgba(15, 23, 42, 0.08)',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '16px',
                borderBottom: '1px solid #e2e8f0',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: '#e0f2fe',
                    color: '#0284c7',
                    border: '1px solid #bae6fd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Shield size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                      {viewingRole.name}
                    </h2>
                    {viewingRole.name === 'ROLE_ADMIN' && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          backgroundColor: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #dbeafe',
                        }}
                      >
                        System Role
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    {viewingRole.description || 'No description provided'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const r = viewingRole;
                    setViewingRole(null);
                    openEditModal(r);
                  }}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#334155',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                  }}
                >
                  <Edit2 size={13} /> Edit Permissions
                </button>
                {viewingRole.name !== 'ROLE_ADMIN' && (
                  <button
                    type="button"
                    onClick={() => {
                      const r = viewingRole;
                      setViewingRole(null);
                      handleDelete(r);
                    }}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: '#dc2626',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingRole(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '4px',
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Permissions Count Banner */}
            <div
              style={{
                margin: '16px 0 12px 0',
                padding: '10px 14px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>
                Assigned Access Permissions
              </span>
              <span
                style={{
                  backgroundColor: '#e0f2fe',
                  color: '#0284c7',
                  border: '1px solid #bae6fd',
                  borderRadius: '9999px',
                  padding: '2px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {viewingRole.permissions?.length || 0} Total
              </span>
            </div>

            {/* Scrollable Permissions List */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                paddingRight: '6px',
              }}
            >
              {Object.entries(permissionsByModule).map(([mod, perms]) => {
                const assignedInMod = perms.filter((p) => (viewingRole.permissions || []).includes(p.name));
                if (assignedInMod.length === 0) return null;

                return (
                  <div
                    key={mod}
                    style={{
                      marginBottom: '16px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '14px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '10px',
                        borderBottom: '1px solid #f1f5f9',
                        paddingBottom: '6px',
                      }}
                    >
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>
                        {mod.replace('_', ' ')}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                        {assignedInMod.length} of {perms.length} active
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                      {assignedInMod.map((p) => (
                        <div
                          key={p.name}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 10px',
                            backgroundColor: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 500,
                            color: '#166534',
                          }}
                        >
                          <Check size={13} color="#16a34a" />
                          <span style={{ fontFamily: 'monospace' }}>{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {(!viewingRole.permissions || viewingRole.permissions.length === 0) && (
                <div style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '0.88rem' }}>
                  No permissions have been assigned to this role yet. Click "Edit Permissions" to add some.
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                paddingTop: '16px',
                borderTop: '1px solid #e2e8f0',
                marginTop: '12px',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setViewingRole(null)}
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '7px 18px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Role Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '920px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
              borderRadius: '14px',
            }}
            onClick={(e) => e.stopPropagation()}
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
