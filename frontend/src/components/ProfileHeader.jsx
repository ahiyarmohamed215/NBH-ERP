import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authApi, userApi } from '../api/apiClient';
import {
  User,
  Shield,
  LogOut,
  Settings,
  ChevronDown,
  X,
  Lock,
  Mail,
  Phone,
  Clock,
  ShieldCheck,
} from 'lucide-react';

export default function ProfileHeader({ onNavigate }) {
  const { user, logout, updateUser } = useAuth();
  const { addToast } = useToast();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const dropdownRef = useRef(null);

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
        .catch(() => { });
    }
  }, [isAdmin]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
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
    setDropdownOpen(false);
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
    <header
      className="glass-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '12px 32px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Right User Profile Circle */}
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: dropdownOpen ? '#f1f5f9' : 'transparent',
            border: '1px solid transparent',
            borderRadius: '9999px',
            padding: '4px 10px 4px 4px',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!dropdownOpen) e.currentTarget.style.backgroundColor = '#f8fafc';
          }}
          onMouseLeave={(e) => {
            if (!dropdownOpen) e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {/* Avatar Circle */}
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.95rem',
            }}
          >
            {initials}
          </div>

          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', lineHeight: 1.2 }}>
              {user?.fullName || user?.username}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 500 }}>
              {user?.roles?.[0]?.replace('ROLE_', '') || 'User'}
            </div>
          </div>

          <ChevronDown size={15} color="#475569" />
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div className="profile-dropdown">
            {/* Header info */}
            <div style={{ padding: '18px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                {user?.fullName || user?.username}
              </div>
              <div style={{ fontSize: '0.86rem', color: '#475569', marginTop: '3px' }}>
                {user?.email}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                {user?.roles?.map((r) => (
                  <span
                    key={r}
                    className="badge"
                    style={{
                      fontSize: '0.78rem',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      padding: '3px 8px',
                    }}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div style={{ padding: '8px 0' }}>
              <button
                type="button"
                onClick={openEditProfile}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '11px 18px',
                  fontSize: '0.92rem',
                  fontWeight: 500,
                  color: '#1e293b',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Settings size={17} color="#475569" />
                Profile Settings & Password
              </button>

              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onNavigate('users');
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 16px',
                      fontSize: '0.85rem',
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
                      setDropdownOpen(false);
                      onNavigate('roles');
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 16px',
                      fontSize: '0.85rem',
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
                    Manage Custom Roles
                  </button>
                </>
              )}
            </div>

            {/* Logout button */}
            <div style={{ borderTop: '1px solid #f1f5f9', padding: '6px 0' }}>
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 16px',
                  fontSize: '0.85rem',
                  color: '#ef4444',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: 500,
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
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <h3 style={{ fontSize: '1.2rem', color: '#0f172a' }}>Update Profile</h3>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div style={{ padding: '20px 24px' }}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>
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
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>
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

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>
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

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                    Change Password (Optional)
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '12px' }}>
                    Leave blank if you do not want to change your password.
                  </span>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
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
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
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
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                        CONFIRM NEW PASSWORD
                      </label>
                      <input
                        type="password"
                        className="input-glass"
                        value={editForm.confirmPassword}
                        onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                        placeholder="Re-type new password"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  padding: '14px 24px',
                  borderTop: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                }}
              >
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={() => setShowEditModal(false)}
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
    </header>
  );
}
