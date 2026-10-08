import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Check, Shield, ShieldCheck, Lock, Sparkles, Filter } from 'lucide-react';
import { roleApi } from '../api/apiClient';

// Helper component to highlight matching search characters
function HighlightText({ text, query }) {
  if (!text) return null;
  if (!query || !query.trim()) return <>{text}</>;
  const trimmed = query.trim();
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = String(text).split(regex);

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark
            key={i}
            style={{
              backgroundColor: '#fef08a',
              color: '#854d0e',
              padding: '0 2px',
              borderRadius: '2px',
              fontWeight: 700,
            }}
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export default function RoleSearchSelector({
  assignedRoles = [],
  allRoles = [],
  onChange,
  label = 'Assign Roles & Permissions',
  required = false,
  placeholder = 'Search roles by title, code (e.g. ROLE_SALES), or keywords...',
  formatRoleName,
  isSuperAdmin = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'selected' | 'unassigned'
  const [backendRoles, setBackendRoles] = useState(null);
  const [isSearchingBackend, setIsSearchingBackend] = useState(false);
  const inputRef = useRef(null);

  const defaultFormatRoleName = (rName) => {
    if (!rName) return 'Role';
    if (rName.startsWith('ROLE_')) {
      const clean = rName.replace('ROLE_', '');
      return clean.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
    }
    return rName;
  };

  const format = formatRoleName || defaultFormatRoleName;

  // Search backend when query changes (debounced)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setBackendRoles(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setIsSearchingBackend(true);
        const res = await roleApi.getAll({ search: searchQuery.trim() });
        if (res.data && Array.isArray(res.data)) {
          setBackendRoles(res.data);
        }
      } catch (err) {
        console.warn('Backend role search error:', err);
      } finally {
        setIsSearchingBackend(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Combine and deduplicate roles
  const combinedRoles = useMemo(() => {
    const baseList = backendRoles !== null ? backendRoles : allRoles;
    const roleMap = new Map();
    baseList.forEach((r) => roleMap.set(r.name, r));
    assignedRoles.forEach((rName) => {
      if (!roleMap.has(rName)) {
        roleMap.set(rName, { name: rName, description: 'Assigned system role', permissions: [] });
      }
    });
    return Array.from(roleMap.values());
  }, [backendRoles, allRoles, assignedRoles]);

  // Filter based on search query and active tab
  const filteredRoles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return combinedRoles.filter((r) => {
      const isSelected = assignedRoles.includes(r.name);
      if (filterTab === 'selected' && !isSelected) return false;
      if (filterTab === 'unassigned' && isSelected) return false;

      if (!q) return true;
      const name = (r.name || '').toLowerCase();
      const formatted = format(r.name).toLowerCase();
      const desc = (r.description || '').toLowerCase();
      return name.includes(q) || formatted.includes(q) || desc.includes(q);
    });
  }, [combinedRoles, assignedRoles, filterTab, searchQuery, format]);

  const handleToggleRole = (roleName) => {
    const isSuperAdminRole = roleName === 'ROLE_SUPER_ADMIN' || roleName === 'SUPER_ADMIN';
    if (isSuperAdmin && isSuperAdminRole && assignedRoles.includes(roleName)) {
      // Cannot remove super admin role for super admin user
      return;
    }

    const isAlreadyAssigned = assignedRoles.includes(roleName);
    const updated = isAlreadyAssigned
      ? assignedRoles.filter((n) => n !== roleName)
      : [...assignedRoles, roleName];
    if (onChange) onChange(updated);
  };

  const handleRemoveRole = (roleName) => {
    const isSuperAdminRole = roleName === 'ROLE_SUPER_ADMIN' || roleName === 'SUPER_ADMIN';
    if (isSuperAdmin && isSuperAdminRole) {
      return;
    }
    if (onChange) {
      onChange(assignedRoles.filter((n) => n !== roleName));
    }
  };

  const selectedCount = assignedRoles.length;
  const unassignedCount = Math.max(0, combinedRoles.length - selectedCount);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '14px' }}>
      {/* Top Label and Count */}
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
          </label>
          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              padding: '2px 9px',
              borderRadius: '9999px',
              backgroundColor: selectedCount > 0 ? '#eff6ff' : '#f1f5f9',
              color: selectedCount > 0 ? '#0284c7' : '#64748b',
              border: `1px solid ${selectedCount > 0 ? '#bae6fd' : '#e2e8f0'}`,
            }}
          >
            {selectedCount} {selectedCount === 1 ? 'Role Assigned' : 'Roles Assigned'}
          </span>
        </div>
      )}

      {/* Selected Roles Chips Container */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={14} color="#0284c7" />
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Assigned Roles ({selectedCount})
            </span>
          </div>

          {selectedCount > 0 && !isSuperAdmin && (
            <button
              type="button"
              onClick={() => onChange && onChange([])}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px 6px',
                color: '#64748b',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600,
                borderRadius: '4px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.backgroundColor = '#fee2e2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#64748b';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Clear all
            </button>
          )}
        </div>

        {selectedCount === 0 ? (
          <div
            style={{
              fontSize: '0.82rem',
              color: '#94a3b8',
              fontStyle: 'italic',
              padding: '8px 10px',
              backgroundColor: '#ffffff',
              borderRadius: '6px',
              border: '1px dashed #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={14} color="#94a3b8" />
            <span>No roles assigned yet. Search and select roles below to grant permissions.</span>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              maxHeight: '115px',
              overflowY: 'auto',
              padding: '2px',
            }}
          >
            {assignedRoles.map((roleName) => {
              const isSuperAdminRole = roleName === 'ROLE_SUPER_ADMIN' || roleName === 'SUPER_ADMIN';
              const isLocked = isSuperAdmin && isSuperAdminRole;

              return (
                <div
                  key={roleName}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ShieldCheck size={13} color="#0284c7" />
                  <span>{format(roleName)}</span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontFamily: 'monospace',
                      color: '#64748b',
                      backgroundColor: '#f1f5f9',
                      padding: '1px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {roleName}
                  </span>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveRole(roleName);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94a3b8',
                        borderRadius: '50%',
                        lineHeight: 1,
                        marginLeft: '2px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#ef4444';
                        e.currentTarget.style.backgroundColor = '#fee2e2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#94a3b8';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title={`Remove ${format(roleName)}`}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Enhanced Search Input & Filter Tabs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
        {/* Search Bar */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#0284c7',
              pointerEvents: 'none',
            }}
          />
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: '42px',
              padding: '0 38px 0 40px',
              borderRadius: '8px',
              border: '1.5px solid #cbd5e1',
              fontSize: '0.88rem',
              backgroundColor: '#ffffff',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'all 0.15s ease',
              color: '#0f172a',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#0284c7';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.15)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                padding: '4px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.color = '#0f172a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#64748b';
              }}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Quick Pills and Match Counter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: filterTab === 'all' ? '1px solid #0284c7' : '1px solid #e2e8f0',
                backgroundColor: filterTab === 'all' ? '#f0f9ff' : '#ffffff',
                color: filterTab === 'all' ? '#0284c7' : '#64748b',
                fontSize: '0.78rem',
                fontWeight: filterTab === 'all' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              All Roles ({combinedRoles.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('selected')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: filterTab === 'selected' ? '1px solid #0284c7' : '1px solid #e2e8f0',
                backgroundColor: filterTab === 'selected' ? '#f0f9ff' : '#ffffff',
                color: filterTab === 'selected' ? '#0284c7' : '#64748b',
                fontSize: '0.78rem',
                fontWeight: filterTab === 'selected' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Selected ({selectedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('unassigned')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: filterTab === 'unassigned' ? '1px solid #0284c7' : '1px solid #e2e8f0',
                backgroundColor: filterTab === 'unassigned' ? '#f0f9ff' : '#ffffff',
                color: filterTab === 'unassigned' ? '#0284c7' : '#64748b',
                fontSize: '0.78rem',
                fontWeight: filterTab === 'unassigned' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Available ({unassignedCount})
            </button>
          </div>

          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {isSearchingBackend ? (
              <span style={{ color: '#0284c7', fontWeight: 600 }}>Searching server...</span>
            ) : searchQuery ? (
              <span>Found <strong>{filteredRoles.length}</strong> matching {filteredRoles.length === 1 ? 'role' : 'roles'}</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Embedded Searchable Roles List */}
      <div
        style={{
          flex: 1,
          minHeight: '220px',
          overflowY: 'auto',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {filteredRoles.length === 0 ? (
          <div
            style={{
              padding: '36px 16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              color: '#64748b',
              margin: 'auto 0',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
              }}
            >
              <Search size={22} />
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
              {searchQuery ? `No roles matching "${searchQuery}"` : 'No roles found in this filter'}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '320px' }}>
              {searchQuery
                ? 'Check the spelling or try searching with a different keyword or system code.'
                : 'Switch filter tabs above to see other roles.'}
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  marginTop: '4px',
                  fontSize: '0.8rem',
                  color: '#0284c7',
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  padding: '5px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Clear Search Query
              </button>
            )}
          </div>
        ) : (
          filteredRoles.map((r, idx) => {
            const roleKey = r.name;
            const isSelected = assignedRoles.includes(roleKey);
            const isSuperAdminRole = roleKey === 'ROLE_SUPER_ADMIN' || roleKey === 'SUPER_ADMIN';
            const isLocked = isSuperAdmin && isSuperAdminRole;
            const permsCount = r.permissions?.length || 0;

            return (
              <div
                key={r.id || r.name || idx}
                onClick={() => !isLocked && handleToggleRole(roleKey)}
                style={{
                  padding: '11px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  cursor: isLocked ? 'default' : 'pointer',
                  backgroundColor: isSelected ? '#f0f9ff' : '#ffffff',
                  borderBottom: idx < filteredRoles.length - 1 ? '1px solid #f1f5f9' : 'none',
                  borderLeft: isSelected ? '3px solid #0284c7' : '3px solid transparent',
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected && !isLocked) e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected && !isLocked) e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                {/* Left: Checkbox & Role Details */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0, flex: 1 }}>
                  {/* Visual Checkbox */}
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      marginTop: '2px',
                      borderRadius: '5px',
                      border: isSelected ? '1.5px solid #0284c7' : '1.5px solid #cbd5e1',
                      backgroundColor: isSelected ? '#0284c7' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {isSelected && <Check size={13} color="#ffffff" strokeWidth={3} />}
                  </div>

                  {/* Role Title, Code, Description and Perms */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                        <HighlightText text={format(r.name)} query={searchQuery} />
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontFamily: 'monospace',
                          color: '#475569',
                          backgroundColor: '#f1f5f9',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: 500,
                        }}
                      >
                        <HighlightText text={r.name} query={searchQuery} />
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '1px' }}>
                      {r.description && (
                        <span
                          style={{
                            fontSize: '0.78rem',
                            color: '#64748b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '380px',
                          }}
                          title={r.description}
                        >
                          <HighlightText text={r.description} query={searchQuery} />
                        </span>
                      )}
                      {permsCount > 0 && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: '#0284c7',
                            backgroundColor: '#f0f9ff',
                            border: '1px solid #bae6fd',
                            padding: '0 6px',
                            borderRadius: '4px',
                            fontWeight: 600,
                          }}
                        >
                          {permsCount} {permsCount === 1 ? 'perm' : 'perms'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: State indicator button */}
                <div style={{ flexShrink: 0 }}>
                  {isSelected ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 9px',
                        borderRadius: '6px',
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                      }}
                    >
                      <Check size={11} /> Assigned
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 9px',
                        borderRadius: '6px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: '#475569',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#0284c7';
                        e.currentTarget.style.color = '#ffffff';
                        e.currentTarget.style.borderColor = '#0284c7';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.color = '#475569';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                    >
                      + Assign
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
