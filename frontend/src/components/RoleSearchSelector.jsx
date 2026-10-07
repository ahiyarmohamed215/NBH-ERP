import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Check, Shield, ChevronDown } from 'lucide-react';
import { roleApi } from '../api/apiClient';

export default function RoleSearchSelector({
  assignedRoles = [],
  allRoles = [],
  onChange,
  label = 'Assigned Roles / Groups',
  required = false,
  placeholder = 'Search role by name or description...',
  formatRoleName,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [backendRoles, setBackendRoles] = useState(null);
  const [isSearchingBackend, setIsSearchingBackend] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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
        // Fallback to local filter if backend fails
        console.warn('Backend role search error:', err);
      } finally {
        setIsSearchingBackend(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Combine and deduplicate roles
  const availableRoles = useMemo(() => {
    const baseList = backendRoles !== null ? backendRoles : allRoles;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return baseList;
    return baseList.filter((r) => {
      const name = (r.name || '').toLowerCase();
      const formatted = format(r.name).toLowerCase();
      const desc = (r.description || '').toLowerCase();
      return name.includes(q) || formatted.includes(q) || desc.includes(q);
    });
  }, [backendRoles, allRoles, searchQuery, format]);

  const handleToggleRole = (roleName) => {
    const isAlreadyAssigned = assignedRoles.includes(roleName);
    const updated = isAlreadyAssigned
      ? assignedRoles.filter((n) => n !== roleName)
      : [...assignedRoles, roleName];
    if (onChange) onChange(updated);
  };

  const handleRemoveRole = (roleName) => {
    if (onChange) {
      onChange(assignedRoles.filter((n) => n !== roleName));
    }
  };

  return (
    <div ref={containerRef} style={{ marginBottom: '20px', position: 'relative' }}>
      {label && (
        <label
          className="label"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
          }}
        >
          <span>
            {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
            {assignedRoles.length} {assignedRoles.length === 1 ? 'role assigned' : 'roles assigned'}
          </span>
        </label>
      )}

      {/* Selected Roles Badges (No Box Cards!) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          marginBottom: assignedRoles.length > 0 ? '8px' : '6px',
          minHeight: '26px',
          alignItems: 'center',
        }}
      >
        {assignedRoles.length === 0 ? (
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
            No roles currently assigned. Search below to assign a role.
          </span>
        ) : (
          assignedRoles.map((roleName) => (
            <span
              key={roleName}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '16px',
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                fontSize: '0.82rem',
                fontWeight: 600,
                boxShadow: '0 1px 2px rgba(37, 99, 235, 0.05)',
                transition: 'all 0.15s ease',
              }}
            >
              <Shield size={12} style={{ color: '#2563eb' }} />
              <span>{format(roleName)}</span>
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
                  color: '#3b82f6',
                  borderRadius: '50%',
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#3b82f6')}
                title={`Remove ${format(roleName)}`}
              >
                <X size={13} />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Search Input Bar */}
      <div style={{ position: 'relative' }}>
        <Search
          size={15}
          style={{
            position: 'absolute',
            left: '11px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: isOpen ? '#0284c7' : '#94a3b8',
            pointerEvents: 'none',
            transition: 'color 0.15s ease',
          }}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          style={{
            width: '100%',
            height: '38px',
            padding: '0 32px 0 34px',
            borderRadius: '7px',
            border: isOpen ? '1px solid #0284c7' : '1px solid #cbd5e1',
            boxShadow: isOpen ? '0 0 0 3px rgba(2, 132, 199, 0.15)' : 'none',
            fontSize: '0.86rem',
            backgroundColor: '#ffffff',
            boxSizing: 'border-box',
            outline: 'none',
            transition: 'all 0.15s ease',
          }}
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              inputRef.current?.focus();
            }}
            style={{
              position: 'absolute',
              right: '9px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Clear search"
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown
            size={14}
            style={{
              position: 'absolute',
              right: '11px',
              top: '50%',
              transform: `translateY(-50%) ${isOpen ? 'rotate(180deg)' : ''}`,
              color: '#94a3b8',
              pointerEvents: 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: '230px',
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.18), 0 4px 8px -2px rgba(15, 23, 42, 0.08)',
            zIndex: 1000,
          }}
        >
          {availableRoles.length === 0 ? (
            <div style={{ padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
              {isSearchingBackend ? 'Searching roles...' : `No roles found matching "${searchQuery}"`}
            </div>
          ) : (
            availableRoles.map((r) => {
              const roleKey = r.name;
              const isSelected = assignedRoles.includes(roleKey);
              return (
                <div
                  key={r.id || r.name}
                  onClick={() => handleToggleRole(roleKey)}
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#f0f9ff' : '#ffffff',
                    borderBottom: '1px solid #f1f5f9',
                    transition: 'background-color 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isSelected ? '#f0f9ff' : '#ffffff';
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#1e293b' }}>
                        {format(r.name)}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontFamily: 'monospace',
                          color: '#64748b',
                          backgroundColor: '#f1f5f9',
                          padding: '1px 5px',
                          borderRadius: '4px',
                        }}
                      >
                        {r.name}
                      </span>
                    </div>
                    {r.description && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: '#64748b',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.description}
                      </span>
                    )}
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    {isSelected ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                        }}
                      >
                        <Check size={12} /> Assigned
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          fontSize: '0.74rem',
                          fontWeight: 500,
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
      )}
    </div>
  );
}
