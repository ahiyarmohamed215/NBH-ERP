import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authApi, userApi } from '../api/apiClient';
import {
  User,
  LogOut,
  Settings,
  ChevronUp,
  X,
  Clock,
  ShieldCheck,
  Keyboard,
  HelpCircle,
  PhoneCall,
  Mail,
  BookOpen,
} from 'lucide-react';

export default function SidebarProfile({ onNavigate, onOpenShortcuts }) {
  const { user, logout, updateUser } = useAuth();
  const { addToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const menuRef = useRef(null);

  const [editForm, setEditForm] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState(false);

  // Check pending approval count for admin badge
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') || user?.permissions?.includes('USER_MANAGE');

  useEffect(() => {
    if (isAdmin) {
      userApi
        .getPending({ page: 0, size: 1 })
        .then((res) => {
          setPendingCount(res.data?.totalElements || 0);
        })
        .catch(() => {});
    }
  }, [isAdmin]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openEditProfile = () => {
    setEditForm({
      fullName: user?.fullName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setMenuOpen(false);
    setShowEditModal(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editForm.fullName.trim() || !editForm.email.trim()) {
      addToast('Full name and email are required', 'error');
      return;
    }

    if (editForm.newPassword) {
      if (!editForm.currentPassword) {
        addToast('Please enter your current password to set a new password', 'error');
        return;
      }
      if (editForm.newPassword.length < 6) {
        addToast('New password must be at least 6 characters', 'error');
        return;
      }
      if (editForm.newPassword !== editForm.confirmPassword) {
        addToast('New passwords do not match', 'error');
        return;
      }
    }

    try {
      setSaving(true);
      const res = await authApi.updateProfile({
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        currentPassword: editForm.currentPassword || undefined,
        newPassword: editForm.newPassword || undefined,
      });
      if (updateUser) {
        updateUser(res.data);
      }
      addToast('Profile updated successfully!', 'success');
      setShowEditModal(false);
    } catch (err) {
      addToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const initials = (user?.fullName || user?.username || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      ref={menuRef}
      style={{
        borderTop: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        position: 'relative',
        flexShrink: 0,
        marginTop: 'auto',
      }}
    >
      {/* Upward Profile Menu Popover */}
      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '8px',
            right: '8px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          {/* User Details Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
            <div style={{ fontWeight: 700, fontSize: '0.94rem', color: '#0f172a' }}>
              {user?.fullName || user?.username}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px', wordBreak: 'break-all' }}>
              {user?.email}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {user?.roles?.map((r) => (
                  <span
                    key={r}
                    className="badge"
                    style={{
                      fontSize: '0.74rem',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      padding: '2px 6px',
                    }}
                  >
                    {r.replace('ROLE_', '')}
                  </span>
                ))}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>v1.2 ERP</span>
            </div>
          </div>

          {/* Quick Action Items */}
          <div style={{ padding: '6px 0' }}>
            <button
              type="button"
              onClick={openEditProfile}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 16px',
                fontSize: '0.88rem',
                fontWeight: 500,
                color: '#334155',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Settings size={16} color="#64748b" />
              Profile Settings & Password
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigate('users');
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 16px',
                    fontSize: '0.86rem',
                    color: '#334155',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Clock size={15} color="#64748b" />
                    Pending Approvals
                  </span>
                  {pendingCount > 0 && (
                    <span
                      style={{
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        borderRadius: '9999px',
                        padding: '1px 6px',
                      }}
                    >
                      {pendingCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigate('roles');
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 16px',
                    fontSize: '0.86rem',
                    color: '#334155',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <ShieldCheck size={15} color="#64748b" />
                  Custom Roles & Perms
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                if (onOpenShortcuts) onOpenShortcuts();
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 16px',
                fontSize: '0.86rem',
                color: '#334155',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Keyboard size={16} color="#64748b" />
                Keyboard Shortcuts
              </span>
              <span className="erp-kbd">F1</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setShowHelpModal(true);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 16px',
                fontSize: '0.86rem',
                color: '#334155',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <HelpCircle size={16} color="#64748b" />
              Help & Support
            </button>
          </div>

          {/* Sign Out Action */}
          <div style={{ borderTop: '1px solid #f1f5f9', padding: '6px 0' }}>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 16px',
                fontSize: '0.86rem',
                color: '#ef4444',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: 600,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <LogOut size={15} />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Profile Trigger Button in Sidebar with Integrated Connected Status */}
      <div
        onClick={() => setMenuOpen(!menuOpen)}
        style={{
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          backgroundColor: menuOpen ? '#f1f5f9' : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!menuOpen) e.currentTarget.style.backgroundColor = '#f8fafc';
        }}
        onMouseLeave={(e) => {
          if (!menuOpen) e.currentTarget.style.backgroundColor = 'transparent';
        }}
        title="Click for profile settings & sign out"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          {/* Avatar Circle with Online Connected Indicator Badge */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.88rem',
              }}
            >
              {initials}
            </div>
            {/* Green Connected Indicator Dot */}
            <span
              style={{
                position: 'absolute',
                bottom: '-1px',
                right: '-1px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                border: '2px solid #ffffff',
                display: 'block',
              }}
              title="System Connected"
            />
          </div>

          <div className="profile-details" style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: '0.88rem',
                color: '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.fullName || user?.username}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#64748b' }}>
              <span>{user?.roles?.[0]?.replace('ROLE_', '') || 'User'}</span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#059669', fontWeight: 600 }}>Connected</span>
            </div>
          </div>
        </div>

        <ChevronUp size={16} color="#64748b" className="profile-details" style={{ flexShrink: 0 }} />
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-backdrop">
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#ffffff',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <h3 style={{ fontSize: '1.15rem', color: '#0f172a' }}>Update Profile</h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div style={{ padding: '18px 20px' }}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    FULL NAME *
                  </label>
                  <input
                    type="text"
                    className="input-glass"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    required
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    EMAIL ADDRESS *
                  </label>
                  <input
                    type="email"
                    className="input-glass"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                  />
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    PHONE NUMBER
                  </label>
                  <input
                    type="text"
                    className="input-glass"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="+94 77 123 4567"
                  />
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                    Change Password (Optional)
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '10px' }}>
                    Leave blank if you do not want to change your password.
                  </span>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      CURRENT PASSWORD
                    </label>
                    <input
                      type="password"
                      className="input-glass"
                      value={editForm.currentPassword}
                      onChange={(e) => setEditForm({ ...editForm, currentPassword: e.target.value })}
                      placeholder="Current password"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        NEW PASSWORD
                      </label>
                      <input
                        type="password"
                        className="input-glass"
                        value={editForm.newPassword}
                        onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                        placeholder="Min 6 characters"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        CONFIRM NEW
                      </label>
                      <input
                        type="password"
                        className="input-glass"
                        value={editForm.confirmPassword}
                        onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                        placeholder="Repeat new password"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  padding: '14px 20px',
                  borderTop: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                  borderBottomLeftRadius: '8px',
                  borderBottomRightRadius: '8px',
                }}
              >
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Help & Support Modal */}
      {showHelpModal && (
        <div className="modal-backdrop" onClick={() => setShowHelpModal(false)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#ffffff',
              padding: '24px 28px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '14px',
                borderBottom: '1px solid #e2e8f0',
                marginBottom: '18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <HelpCircle size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', color: '#0f172a', margin: 0 }}>
                    Help & Enterprise Support
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    NBH ERP System Assistance & Documentation
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', marginBottom: '6px' }}>
                  <PhoneCall size={16} color="#2563eb" /> IT Operations Hotline
                </div>
                <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                  Direct Phone: <strong>+94 11 234 5678</strong> (Mon - Sat, 8:00 AM - 6:00 PM)
                </div>
                <div style={{ fontSize: '0.84rem', color: '#475569', marginTop: '2px' }}>
                  Internal Extension: <strong>Ext. 104 / 105</strong>
                </div>
              </div>

              <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', marginBottom: '6px' }}>
                  <Mail size={16} color="#2563eb" /> Email & Support Desk
                </div>
                <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                  Technical Support: <strong>support@nbh-erp.com</strong>
                </div>
                <div style={{ fontSize: '0.84rem', color: '#475569', marginTop: '2px' }}>
                  Administrator: <strong>admin@nbh-erp.com</strong>
                </div>
              </div>

              <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', marginBottom: '6px' }}>
                  <BookOpen size={16} color="#2563eb" /> System Quick Reference
                </div>
                <ul style={{ fontSize: '0.82rem', color: '#64748b', paddingLeft: '18px', margin: 0 }}>
                  <li>Press <strong>F1</strong> anytime to view all keyboard shortcuts.</li>
                  <li>Press <strong>F11</strong> to toggle full-screen distraction-free mode.</li>
                  <li>Press <strong>Ctrl + B</strong> to collapse/expand the sidebar.</li>
                  <li>Press <strong>Esc</strong> to dismiss any open modal or popover.</li>
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                <span style={{ fontSize: '0.8rem', color: '#065f46', fontWeight: 600 }}>System Status: Operational & Connected</span>
                <span style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 700 }}>v1.2</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowHelpModal(false)}
              >
                Close Support
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
