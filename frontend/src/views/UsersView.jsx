import React, { useState, useEffect } from 'react';
import { userApi, roleApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import {
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Shield,
  Search,
  UserCheck,
  UserX,
  Plus,
  Edit2,
  X,
  Phone,
  Mail,
  User as UserIcon,
} from 'lucide-react';

export default function UsersView() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'all'
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Approval modal state
  const [approvingUser, setApprovingUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [submittingApproval, setSubmittingApproval] = useState(false);

  // Edit / Create user modal state
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
    roles: [],
  });
  const [savingUser, setSavingUser] = useState(false);

  const fetchUsersAndRoles = async () => {
    try {
      setLoading(true);
      const [pendingRes, allRes, rolesRes] = await Promise.all([
        userApi.getPending({ page: 0, size: 100 }),
        userApi.getAll({ page: 0, size: 100 }),
        roleApi.getAll(),
      ]);
      setPendingUsers(pendingRes.data?.content || []);
      setAllUsers(allRes.data?.content || []);
      setRoles(rolesRes.data || []);
    } catch (err) {
      addToast(err.message || 'Failed to fetch users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndRoles();
  }, []);

  const openApproveModal = (user) => {
    setApprovingUser(user);
    // Pre-select first non-admin role or ROLE_CASHIER if available
    if (roles.length > 0) {
      const defaultRole = roles.find((r) => r.name !== 'ROLE_ADMIN') || roles[0];
      setSelectedRoles([defaultRole.name]);
    } else {
      setSelectedRoles([]);
    }
  };

  const handleRoleToggle = (roleName) => {
    setSelectedRoles((prev) =>
      prev.includes(roleName)
        ? prev.filter((r) => r !== roleName)
        : [...prev, roleName]
    );
  };

  const submitApprove = async () => {
    if (selectedRoles.length === 0) {
      addToast('Please assign at least one role to this user', 'error');
      return;
    }

    try {
      setSubmittingApproval(true);
      await userApi.approve(approvingUser.id, selectedRoles);
      addToast(`User ${approvingUser.username} approved successfully!`, 'success');
      setApprovingUser(null);
      fetchUsersAndRoles();
    } catch (err) {
      addToast(err.message || 'Approval failed', 'error');
    } finally {
      setSubmittingApproval(false);
    }
  };

  const handleReject = async (user) => {
    if (!window.confirm(`Are you sure you want to reject registration for "${user.username}"?`)) return;

    try {
      await userApi.reject(user.id);
      addToast(`User ${user.username} registration was rejected.`, 'info');
      fetchUsersAndRoles();
    } catch (err) {
      addToast(err.message || 'Rejection failed', 'error');
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await userApi.toggleActive(user.id);
      addToast(`Toggled active status for ${user.username}`, 'success');
      fetchUsersAndRoles();
    } catch (err) {
      addToast(err.message || 'Failed to toggle status', 'error');
    }
  };

  // Direct User Create/Edit
  const openCreateUserModal = () => {
    setEditingUser(null);
    setUserFormData({
      username: '',
      fullName: '',
      email: '',
      phone: '',
      password: '',
      roles: roles.length > 0 ? [roles[0].name] : [],
    });
    setShowUserModal(true);
  };

  const openEditUserModal = (user) => {
    setEditingUser(user);
    setUserFormData({
      username: user.username,
      fullName: user.fullName || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      roles: user.roles || [],
    });
    setShowUserModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!editingUser && (!userFormData.username || !userFormData.password)) {
      addToast('Username and password are required', 'error');
      return;
    }

    try {
      setSavingUser(true);
      if (editingUser) {
        await userApi.update(editingUser.id, {
          fullName: userFormData.fullName,
          email: userFormData.email,
          phone: userFormData.phone,
          password: userFormData.password || undefined,
          roles: userFormData.roles,
        });
        addToast('User updated successfully', 'success');
      } else {
        await userApi.create({
          username: userFormData.username,
          fullName: userFormData.fullName,
          email: userFormData.email,
          phone: userFormData.phone,
          password: userFormData.password,
          roles: userFormData.roles,
        });
        addToast('User created successfully', 'success');
      }
      setShowUserModal(false);
      fetchUsersAndRoles();
    } catch (err) {
      addToast(err.message || 'Failed to save user', 'error');
    } finally {
      setSavingUser(false);
    }
  };

  const filteredUsers = allUsers.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.fullName && u.fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', color: '#0f172a', marginBottom: '4px' }}>User Administration</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Review new self-registered users, assign custom roles, and manage system accounts
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreateUserModal}>
          <Plus size={16} /> Create User Directly
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <button
          className={`nav-tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Clock size={16} />
          Pending Approvals
          {pendingUsers.length > 0 && (
            <span
              style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '9999px',
                padding: '1px 7px',
              }}
            >
              {pendingUsers.length}
            </span>
          )}
        </button>
        <button
          className={`nav-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Users size={16} />
          All Registered Users ({allUsers.length})
        </button>
      </div>

      {/* Tab 1: Pending Approvals */}
      {activeTab === 'pending' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading pending users...</div>
          ) : pendingUsers.length === 0 ? (
            <div
              className="glass-card"
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                backgroundColor: '#ffffff',
              }}
            >
              <CheckCircle size={44} color="#10b981" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '1.1rem', color: '#0f172a', marginBottom: '4px' }}>All Caught Up!</h3>
              <p style={{ color: '#64748b', fontSize: '0.88rem' }}>
                There are no pending user registration requests at this time.
              </p>
            </div>
          ) : (
            <div className="glass-card" style={{ backgroundColor: '#ffffff', overflow: 'hidden' }}>
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>USER / CONTACT</th>
                    <th>EMAIL</th>
                    <th>PHONE</th>
                    <th>REGISTERED ON</th>
                    <th>STATUS</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              backgroundColor: '#eff6ff',
                              color: '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                            }}
                          >
                            {user.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{user.fullName || user.username}</div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>@{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: '#475569' }}>{user.email}</td>
                      <td style={{ color: '#475569' }}>{user.phone || '—'}</td>
                      <td style={{ color: '#64748b', fontSize: '0.82rem' }}>
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Recent'}
                      </td>
                      <td>
                        <span className="badge badge-warning">Pending Approval</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => openApproveModal(user)}
                          >
                            <UserCheck size={14} /> Review & Approve
                          </button>
                          <button
                            className="btn btn-glass btn-sm"
                            style={{ color: '#ef4444', borderColor: '#fecaca' }}
                            onClick={() => handleReject(user)}
                          >
                            <UserX size={14} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: All Users */}
      {activeTab === 'all' && (
        <div>
          {/* Search bar */}
          <div className="glass-card" style={{ padding: '14px 20px', marginBottom: '16px', backgroundColor: '#ffffff' }}>
            <div style={{ position: 'relative', maxWidth: '360px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                className="input-glass"
                style={{ paddingLeft: '34px' }}
                placeholder="Search by name, username, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="glass-card" style={{ backgroundColor: '#ffffff', overflow: 'hidden' }}>
            <table className="glass-table">
              <thead>
                <tr>
                  <th>USER</th>
                  <th>EMAIL / CONTACT</th>
                  <th>ASSIGNED ROLES</th>
                  <th>APPROVAL</th>
                  <th>ACTIVE</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                          }}
                        >
                          {user.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{user.fullName || user.username}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: '#334155' }}>{user.email}</div>
                      {user.phone && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{user.phone}</div>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {user.roles && user.roles.length > 0 ? (
                          user.roles.map((r) => (
                            <span
                              key={r}
                              className="badge"
                              style={{
                                backgroundColor: r === 'ROLE_ADMIN' ? '#dbeafe' : '#f1f5f9',
                                color: r === 'ROLE_ADMIN' ? '#1e40af' : '#334155',
                                border: `1px solid ${r === 'ROLE_ADMIN' ? '#bfdbfe' : '#e2e8f0'}`,
                              }}
                            >
                              {r}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>None</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {user.approvalStatus === 'APPROVED' && (
                        <span className="badge badge-success">Approved</span>
                      )}
                      {user.approvalStatus === 'PENDING' && (
                        <span className="badge badge-warning">Pending</span>
                      )}
                      {user.approvalStatus === 'REJECTED' && (
                        <span className="badge badge-danger">Rejected</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleActive(user)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <span className={`badge ${user.isActive ? 'badge-success' : 'badge-danger'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-glass btn-sm"
                        onClick={() => openEditUserModal(user)}
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approval & Role Assignment Modal */}
      {approvingUser && (
        <div className="modal-backdrop" onClick={() => setApprovingUser(null)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '720px',
              backgroundColor: '#ffffff',
              borderRadius: '14px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 24px',
              borderBottom: '1px solid #e2e8f0',
            }}>
              <h3 style={{ fontSize: '1.2rem', color: '#0f172a' }}>
                Approve User & Assign Role
              </h3>
              <button
                onClick={() => setApprovingUser(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <div style={{
                backgroundColor: '#f8fafc',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '18px',
                border: '1px solid #e2e8f0',
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                  {approvingUser.fullName} (@{approvingUser.username})
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '3px' }}>
                  {approvingUser.email} {approvingUser.phone ? `• ${approvingUser.phone}` : ''}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                  SELECT ROLES TO ASSIGN *
                </label>
                <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '12px' }}>
                  Choose one or more roles for this user. Roles define what actions they can perform.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                  {roles.map((r) => {
                    const isChecked = selectedRoles.includes(r.name);
                    return (
                      <label
                        key={r.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          backgroundColor: isChecked ? '#eff6ff' : '#ffffff',
                          border: `1px solid ${isChecked ? '#3b82f6' : '#e2e8f0'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleRoleToggle(r.name)}
                          style={{ marginTop: '2px' }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a' }}>
                            {r.name}
                          </div>
                          {r.description && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                              {r.description}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

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
                onClick={() => setApprovingUser(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submittingApproval || selectedRoles.length === 0}
                onClick={submitApprove}
              >
                {submittingApproval ? 'Approving...' : 'Approve & Activate User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Create / Edit Modal */}
      {showUserModal && (
        <div className="modal-backdrop" onClick={() => setShowUserModal(false)}>
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '820px',
              backgroundColor: '#ffffff',
              borderRadius: '14px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 24px',
              borderBottom: '1px solid #e2e8f0',
            }}>
              <h3 style={{ fontSize: '1.2rem', color: '#0f172a' }}>
                {editingUser ? `Edit User: ${editingUser.username}` : 'Create System User'}
              </h3>
              <button
                onClick={() => setShowUserModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveUser}>
              <div style={{ padding: '20px 24px' }}>
                {!editingUser && (
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>
                      USERNAME *
                    </label>
                    <input
                      type="text"
                      className="input-glass"
                      placeholder="Username..."
                      value={userFormData.username}
                      onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                      required
                    />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>
                      FULL NAME *
                    </label>
                    <input
                      type="text"
                      className="input-glass"
                      placeholder="Full Name..."
                      value={userFormData.fullName}
                      onChange={(e) => setUserFormData({ ...userFormData, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>
                      EMAIL *
                    </label>
                    <input
                      type="email"
                      className="input-glass"
                      placeholder="Email address..."
                      value={userFormData.email}
                      onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>
                      PHONE
                    </label>
                    <input
                      type="text"
                      className="input-glass"
                      placeholder="Phone number..."
                      value={userFormData.phone}
                      onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>
                      {editingUser ? 'NEW PASSWORD (OPTIONAL)' : 'PASSWORD *'}
                    </label>
                    <input
                      type="password"
                      className="input-glass"
                      placeholder={editingUser ? 'Leave blank to keep current' : 'Min 6 characters'}
                      value={userFormData.password}
                      onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                      required={!editingUser}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                    ASSIGNED ROLES
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                    {roles.map((r) => {
                      const isChecked = userFormData.roles.includes(r.name);
                      return (
                        <label
                          key={r.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '7px 10px',
                            borderRadius: '6px',
                            backgroundColor: isChecked ? '#eff6ff' : '#ffffff',
                            border: `1px solid ${isChecked ? '#3b82f6' : '#e2e8f0'}`,
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setUserFormData((prev) => ({
                                ...prev,
                                roles: prev.roles.includes(r.name)
                                  ? prev.roles.filter((n) => n !== r.name)
                                  : [...prev.roles, r.name],
                              }));
                            }}
                          />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                            {r.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

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
                  onClick={() => setShowUserModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingUser}
                >
                  {savingUser ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
