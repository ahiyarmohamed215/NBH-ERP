import React, { useState, useEffect, useMemo } from 'react';
import {
  customerTargetApi,
} from '../api/apiClient';
import {
  Target,
  Plus,
  Edit2,
  Trash2,
  Search,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  User,
  Users,
  Award,
  TrendingUp,
  Percent,
  Check,
  ChevronRight,
  Info,
  DollarSign,
  Sparkles,
  Zap,
  Sliders,
  ShieldAlert,
  ArrowUpRight,
  Layers,
} from 'lucide-react';

export default function CustomerTargetsTab({
  customers = [],
  salesmen = [],
  routes = [],
  canEdit = true,
  addToast,
}) {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE' | 'ACHIEVED'
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [salesmanFilter, setSalesmanFilter] = useState('ALL');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  // Detail Modal State
  const [selectedTargetDetail, setSelectedTargetDetail] = useState(null);

  // Target Form
  const defaultForm = {
    targetCode: '',
    name: '',
    description: '',
    scopeType: 'CUSTOMER', // 'CUSTOMER' | 'GROUP' | 'ALL'
    customerId: '',
    customerGroupId: '',
    salesmanId: '',
    targetType: 'TOTAL_SALES',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    targetAmount: '50000',
    rewardType: 'PERCENTAGE_DISCOUNT',
    isActive: true,
    tiers: [
      {
        tierLevel: 1,
        tierName: 'Tier 1 (Bronze)',
        minAmount: '10000',
        maxAmount: '25000',
        discountPercentage: '3',
        discountAmount: '0',
        rewardDescription: '3% Discount on orders',
      },
      {
        tierLevel: 2,
        tierName: 'Tier 2 (Silver)',
        minAmount: '25001',
        maxAmount: '50000',
        discountPercentage: '5',
        discountAmount: '0',
        rewardDescription: '5% Discount on orders',
      },
      {
        tierLevel: 3,
        tierName: 'Tier 3 (Gold)',
        minAmount: '50001',
        maxAmount: '',
        discountPercentage: '8',
        discountAmount: '0',
        rewardDescription: '8% VIP Discount on orders',
      },
    ],
  };

  const [formData, setFormData] = useState(defaultForm);

  // Customer search inside modal
  const [custModalSearch, setCustModalSearch] = useState('');

  const loadTargets = async () => {
    setLoading(true);
    try {
      const res = await customerTargetApi.getAll(false);
      const data = res?.data?.data || res?.data || [];
      setTargets(Array.isArray(data) ? data : []);
    } catch (err) {
      if (addToast) addToast('Unable to load customer range information. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTargets();
  }, []);

  // Listen for target updates from event bus
  useEffect(() => {
    const handleUpdate = () => loadTargets();
    window.addEventListener('erp:targets_updated', handleUpdate);
    return () => window.removeEventListener('erp:targets_updated', handleUpdate);
  }, []);

  // Filtered targets
  const filteredTargets = useMemo(() => {
    return targets.filter((t) => {
      // Search query
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchName = t.name?.toLowerCase().includes(q);
        const matchCode = t.targetCode?.toLowerCase().includes(q);
        const matchCust = t.customerName?.toLowerCase().includes(q) || t.customerCode?.toLowerCase().includes(q);
        const matchSales = t.salesmanName?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchCust && !matchSales) return false;
      }

      // Status
      if (statusFilter === 'ACTIVE' && !t.isActive) return false;
      if (statusFilter === 'INACTIVE' && t.isActive) return false;
      if (statusFilter === 'ACHIEVED' && !t.isTargetAchieved) return false;

      // Customer
      if (customerFilter !== 'ALL' && String(t.customerId) !== String(customerFilter)) return false;

      // Salesman
      if (salesmanFilter !== 'ALL' && String(t.salesmanId) !== String(salesmanFilter)) return false;

      return true;
    });
  }, [targets, searchTerm, statusFilter, customerFilter, salesmanFilter]);

  // Overall metrics
  const metrics = useMemo(() => {
    const total = targets.length;
    const active = targets.filter((t) => t.isActive).length;
    const achieved = targets.filter((t) => t.isTargetAchieved).length;
    let maxDisc = 0;
    targets.forEach((t) => {
      (t.tiers || []).forEach((tier) => {
        const disc = Number(tier.discountPercentage || 0);
        if (disc > maxDisc) maxDisc = disc;
      });
    });
    return { total, active, achieved, maxDisc };
  }, [targets]);

  const handleOpenCreateModal = () => {
    setEditingTarget(null);
    setFormData(defaultForm);
    setCustModalSearch('');
    setShowModal(true);
  };

  const handleOpenEditModal = (target) => {
    setEditingTarget(target);
    setCustModalSearch('');

    let scope = 'ALL';
    if (target.customerId) scope = 'CUSTOMER';
    else if (target.customerGroupId) scope = 'GROUP';

    const tiers = (target.tiers || []).map((tr) => ({
      tierLevel: tr.tierLevel || 1,
      tierName: tr.tierName || '',
      minAmount: tr.minAmount !== undefined ? String(tr.minAmount) : '0',
      maxAmount: tr.maxAmount !== undefined && tr.maxAmount !== null ? String(tr.maxAmount) : '',
      discountPercentage: tr.discountPercentage !== undefined ? String(tr.discountPercentage) : '0',
      discountAmount: tr.discountAmount !== undefined ? String(tr.discountAmount) : '0',
      rewardDescription: tr.rewardDescription || '',
    }));

    setFormData({
      targetCode: target.targetCode || '',
      name: target.name || '',
      description: target.description || '',
      scopeType: scope,
      customerId: target.customerId ? String(target.customerId) : '',
      customerGroupId: target.customerGroupId ? String(target.customerGroupId) : '',
      salesmanId: target.salesmanId ? String(target.salesmanId) : '',
      targetType: target.targetType || 'TOTAL_SALES',
      startDate: target.startDate || '',
      endDate: target.endDate || '',
      targetAmount: target.targetAmount !== undefined ? String(target.targetAmount) : '0',
      rewardType: target.rewardType || 'PERCENTAGE_DISCOUNT',
      isActive: target.isActive !== undefined ? target.isActive : true,
      tiers: tiers.length > 0 ? tiers : defaultForm.tiers,
    });

    setShowModal(true);
  };

  const handleToggleActive = async (target) => {
    try {
      await customerTargetApi.toggleActive(target.id);
      if (addToast) addToast(`Target ${target.targetCode} status updated`, 'success');
      loadTargets();
    } catch (err) {
      if (addToast) addToast('Error updating status: ' + (err.message || 'Error'), 'error');
    }
  };

  const handleDelete = async (target) => {
    if (!window.confirm(`Are you sure you want to deactivate target "${target.name}" (${target.targetCode})?`)) {
      return;
    }
    try {
      await customerTargetApi.delete(target.id);
      if (addToast) addToast(`Target ${target.targetCode} deactivated`, 'success');
      loadTargets();
    } catch (err) {
      if (addToast) addToast('Error deactivating target: ' + (err.message || 'Error'), 'error');
    }
  };

  // Add / remove / update tiers
  const handleAddTier = () => {
    const nextLevel = formData.tiers.length + 1;
    setFormData((prev) => ({
      ...prev,
      tiers: [
        ...prev.tiers,
        {
          tierLevel: nextLevel,
          tierName: `Tier ${nextLevel}`,
          minAmount: '',
          maxAmount: '',
          discountPercentage: '5',
          discountAmount: '0',
          rewardDescription: 'Tier discount reward',
        },
      ],
    }));
  };

  const handleRemoveTier = (index) => {
    if (formData.tiers.length <= 1) {
      if (addToast) addToast('A target must have at least one discount range tier.', 'warning');
      return;
    }
    setFormData((prev) => {
      const updated = prev.tiers.filter((_, i) => i !== index).map((tier, idx) => ({
        ...tier,
        tierLevel: idx + 1,
      }));
      return { ...prev, tiers: updated };
    });
  };

  const handleTierChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.tiers];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, tiers: updated };
    });
  };

  // Preset loaders
  const handleApplyPreset = (presetType) => {
    if (presetType === 'standard3') {
      setFormData((prev) => ({
        ...prev,
        tiers: [
          { tierLevel: 1, tierName: 'Bronze Tier', minAmount: '10000', maxAmount: '25000', discountPercentage: '3', discountAmount: '0', rewardDescription: '3% Discount' },
          { tierLevel: 2, tierName: 'Silver Tier', minAmount: '25001', maxAmount: '50000', discountPercentage: '5', discountAmount: '0', rewardDescription: '5% Discount' },
          { tierLevel: 3, tierName: 'Gold Tier', minAmount: '50001', maxAmount: '', discountPercentage: '8', discountAmount: '0', rewardDescription: '8% VIP Discount' },
        ],
      }));
      if (addToast) addToast('Applied Standard 3-Tier Preset (3%, 5%, 8%)', 'info');
    } else if (presetType === 'executive4') {
      setFormData((prev) => ({
        ...prev,
        tiers: [
          { tierLevel: 1, tierName: 'Starter (Bronze)', minAmount: '5000', maxAmount: '15000', discountPercentage: '2', discountAmount: '0', rewardDescription: '2% Discount' },
          { tierLevel: 2, tierName: 'Silver Tier', minAmount: '15001', maxAmount: '35000', discountPercentage: '5', discountAmount: '0', rewardDescription: '5% Discount' },
          { tierLevel: 3, tierName: 'Gold Tier', minAmount: '35001', maxAmount: '75000', discountPercentage: '8', discountAmount: '0', rewardDescription: '8% Discount' },
          { tierLevel: 4, tierName: 'Platinum Elite', minAmount: '75001', maxAmount: '', discountPercentage: '12', discountAmount: '0', rewardDescription: '12% Top Tier Discount' },
        ],
      }));
      if (addToast) addToast('Applied Executive 4-Tier Preset (2%, 5%, 8%, 12%)', 'info');
    } else if (presetType === 'booster') {
      setFormData((prev) => ({
        ...prev,
        tiers: [
          { tierLevel: 1, tierName: 'Volume Milestone 1', minAmount: '15000', maxAmount: '40000', discountPercentage: '5', discountAmount: '0', rewardDescription: '5% Volume Discount' },
          { tierLevel: 2, tierName: 'Volume Milestone 2', minAmount: '40001', maxAmount: '', discountPercentage: '10', discountAmount: '0', rewardDescription: '10% Super Saver' },
        ],
      }));
      if (addToast) addToast('Applied Volume Milestone Preset (5%, 10%)', 'info');
    }
  };

  const handleSaveTarget = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      if (addToast) addToast('Target name is required', 'error');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      if (addToast) addToast('Start date and end date are required', 'error');
      return;
    }
    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      if (addToast) addToast('Start date cannot be after end date', 'error');
      return;
    }
    if (!formData.targetAmount || Number(formData.targetAmount) <= 0) {
      if (addToast) addToast('Please enter a valid target goal amount', 'error');
      return;
    }

    // Format tiers payload
    const formattedTiers = formData.tiers.map((t, idx) => ({
      tierLevel: idx + 1,
      tierName: t.tierName || `Tier ${idx + 1}`,
      minAmount: Number(t.minAmount) || 0,
      maxAmount: t.maxAmount !== '' && t.maxAmount !== null && t.maxAmount !== undefined ? Number(t.maxAmount) : null,
      discountPercentage: Number(t.discountPercentage) || 0,
      discountAmount: Number(t.discountAmount) || 0,
      rewardDescription: t.rewardDescription || '',
    }));

    const payload = {
      targetCode: formData.targetCode.trim() || undefined,
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      customerId: formData.scopeType === 'CUSTOMER' && formData.customerId ? Number(formData.customerId) : null,
      customerGroupId: formData.scopeType === 'GROUP' && formData.customerGroupId ? Number(formData.customerGroupId) : null,
      salesmanId: formData.salesmanId ? Number(formData.salesmanId) : null,
      targetType: formData.targetType,
      startDate: formData.startDate,
      endDate: formData.endDate,
      targetAmount: Number(formData.targetAmount) || 0,
      rewardType: formData.rewardType,
      isActive: formData.isActive,
      tiers: formattedTiers,
    };

    setSaving(true);
    try {
      if (editingTarget) {
        await customerTargetApi.update(editingTarget.id, payload);
        if (addToast) addToast(`Target "${payload.name}" updated successfully!`, 'success');
      } else {
        await customerTargetApi.create(payload);
        if (addToast) addToast(`Target "${payload.name}" created successfully!`, 'success');
      }
      setShowModal(false);
      loadTargets();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error saving target';
      if (addToast) addToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Helper date presets for form
  const setDatePreset = (preset) => {
    const today = new Date();
    let s = new Date(today);
    let e = new Date(today);

    if (preset === 'thisMonth') {
      s = new Date(today.getFullYear(), today.getMonth(), 1);
      e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (preset === 'nextQuarter') {
      s = new Date(today.getFullYear(), today.getMonth(), 1);
      e = new Date(today.getFullYear(), today.getMonth() + 3, 0);
    } else if (preset === 'thisYear') {
      s = new Date(today.getFullYear(), 0, 1);
      e = new Date(today.getFullYear(), 11, 31);
    }
    setFormData((prev) => ({
      ...prev,
      startDate: s.toISOString().split('T')[0],
      endDate: e.toISOString().split('T')[0],
    }));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        paddingBottom: '24px',
      }}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. TOOLBAR (Search, Filters, Reset, Refresh & New Target Action)
         ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          width: '100%',
          boxSizing: 'border-box',
          flexWrap: 'wrap',
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: '1 1 auto' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', width: '220px', minWidth: '160px' }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: '8px',
                top: '9px',
                color: '#94a3b8',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Search targets or customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                height: '32px',
                padding: '0 24px 0 26px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                fontSize: '0.8rem',
                outline: 'none',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: 0,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Status Select */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              height: '32px',
              padding: '0 24px 0 8px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '0.8rem',
              fontFamily: 'inherit',
              fontWeight: 500,
              color: '#334155',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              outline: 'none',
              boxSizing: 'border-box',
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 6px center',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
            <option value="ACHIEVED">Achieved Only</option>
          </select>

          {/* Customer Select */}
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            style={{
              height: '32px',
              padding: '0 24px 0 8px',
              maxWidth: '160px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '0.8rem',
              fontFamily: 'inherit',
              fontWeight: 500,
              color: '#334155',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              outline: 'none',
              boxSizing: 'border-box',
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 6px center',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
          >
            <option value="ALL">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Salesman Select */}
          <select
            value={salesmanFilter}
            onChange={(e) => setSalesmanFilter(e.target.value)}
            style={{
              height: '32px',
              padding: '0 24px 0 8px',
              maxWidth: '160px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '0.8rem',
              fontFamily: 'inherit',
              fontWeight: 500,
              color: '#334155',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              outline: 'none',
              boxSizing: 'border-box',
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 6px center',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
          >
            <option value="ALL">All Sales Reps</option>
            {salesmen.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Reset Filters Button */}
          {(searchTerm || statusFilter !== 'ALL' || customerFilter !== 'ALL' || salesmanFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setCustomerFilter('ALL');
                setSalesmanFilter('ALL');
              }}
              style={{
                height: '32px',
                padding: '0 8px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f1f5f9',
                color: '#64748b',
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                whiteSpace: 'nowrap',
              }}
              title="Reset filters"
            >
              <X size={12} /> Reset
            </button>
          )}
        </div>

        {/* Right Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 600,
              color: '#64748b',
              backgroundColor: '#f1f5f9',
              padding: '4px 8px',
              borderRadius: '9999px',
              whiteSpace: 'nowrap',
            }}
          >
            {filteredTargets.length} {filteredTargets.length === 1 ? 'Target' : 'Targets'}
          </span>

          <button
            type="button"
            onClick={loadTargets}
            disabled={loading}
            style={{
              height: '32px',
              width: '32px',
              minWidth: '32px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: 0,
              color: '#334155',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
            }}
            title="Refresh targets"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              style={{
                height: '32px',
                padding: '0 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 2px rgba(2, 132, 199, 0.2)',
              }}
            >
              <Plus size={14} /> New Range & Target
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. TARGETS CARDS LIST
         ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '50px 20px',
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px auto', display: 'block' }} />
          <p style={{ margin: 0, fontSize: '0.86rem', fontWeight: 500 }}>Loading customer range targets...</p>
        </div>
      ) : filteredTargets.length === 0 ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '50px 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: '#e0f2fe',
              color: '#0284c7',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
            }}
          >
            <Target size={22} />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>
            No Customer Targets Found
          </h3>
          <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '0.82rem', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
            {searchTerm || statusFilter !== 'ALL' || customerFilter !== 'ALL' || salesmanFilter !== 'ALL'
              ? 'No targets match your current search and filters. Try clearing filters.'
              : 'Create sales targets with progressive discount range tiers for customers to incentivize bulk purchases in POS mode.'}
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              style={{
                height: '32px',
                padding: '0 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Plus size={14} /> Create First Range Target
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredTargets.map((target) => {
            const achieved = Number(target.currentAchievedAmount || 0);
            const goal = Number(target.targetAmount || 0);
            const percentage = Number(target.achievementPercentage || 0);
            const isCompleted = target.isTargetAchieved;
            const currentTier = target.currentAchievedTier;
            const nextTier = target.nextTier;
            const neededForNext = Number(target.amountNeededForNextTier || 0);

            return (
              <div
                key={target.id}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* Header Row: Title, Badges & Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: '#f1f5f9',
                        color: '#1e293b',
                        border: '1px solid #cbd5e1',
                      }}
                    >
                      {target.targetCode}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#0f172a' }}>
                      {target.name}
                    </h3>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '1px 7px',
                        borderRadius: '9999px',
                        backgroundColor: target.isActive ? '#dcfce7' : '#f1f5f9',
                        color: target.isActive ? '#15803d' : '#64748b',
                        border: `1px solid ${target.isActive ? '#bbf7d0' : '#e2e8f0'}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: target.isActive ? '#16a34a' : '#94a3b8',
                        }}
                      />
                      {target.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {isCompleted && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '1px 8px',
                          borderRadius: '9999px',
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          border: '1px solid #bbf7d0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <CheckCircle2 size={11} /> Goal Achieved
                      </span>
                    )}
                    {target.daysRemaining !== undefined && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '1px 7px',
                          borderRadius: '9999px',
                          backgroundColor: target.daysRemaining > 0 ? '#e0f2fe' : '#fee2e2',
                          color: target.daysRemaining > 0 ? '#0369a1' : '#b91c1c',
                          border: `1px solid ${target.daysRemaining > 0 ? '#bae6fd' : '#fecaca'}`,
                        }}
                      >
                        {target.daysRemaining > 0 ? `${target.daysRemaining} days left` : 'Expired'}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedTargetDetail(target)}
                      style={{
                        height: '28px',
                        padding: '0 8px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        color: '#0284c7',
                        backgroundColor: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="View full progress breakdown"
                    >
                      <Info size={12} /> Progress
                    </button>

                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(target)}
                          style={{
                            height: '28px',
                            padding: '0 8px',
                            fontSize: '0.76rem',
                            fontWeight: 500,
                            color: '#334155',
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Edit target configuration"
                        >
                          <Edit2 size={12} /> Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleActive(target)}
                          style={{
                            height: '28px',
                            padding: '0 8px',
                            fontSize: '0.76rem',
                            fontWeight: 500,
                            color: target.isActive ? '#d97706' : '#16a34a',
                            backgroundColor: target.isActive ? '#fffbeb' : '#f0fdf4',
                            border: `1px solid ${target.isActive ? '#fde68a' : '#bbf7d0'}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          title={target.isActive ? 'Deactivate target' : 'Activate target'}
                        >
                          {target.isActive ? 'Pause' : 'Activate'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(target)}
                          style={{
                            height: '28px',
                            width: '28px',
                            color: '#ef4444',
                            backgroundColor: '#ffffff',
                            border: '1px solid #fee2e2',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                          }}
                          title="Deactivate target"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Scope & Metadata Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    flexWrap: 'wrap',
                    padding: '6px 10px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '6px',
                    border: '1px solid #f1f5f9',
                    fontSize: '0.78rem',
                    color: '#475569',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Users size={13} style={{ color: '#0284c7' }} />
                    <span style={{ fontWeight: 600, color: '#64748b' }}>Scope:</span>
                    <strong style={{ color: '#0f172a' }}>
                      {target.customerName ? (
                        `${target.customerName} (${target.customerCode || 'CUST'})`
                      ) : target.customerGroupName ? (
                        `Group: ${target.customerGroupName}`
                      ) : (
                        <span style={{ color: '#0369a1', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                          Store-wide (All Customers)
                        </span>
                      )}
                    </strong>
                  </div>

                  {target.salesmanName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <User size={13} style={{ color: '#059669' }} />
                      <span style={{ fontWeight: 600, color: '#64748b' }}>Sales Rep:</span>
                      <strong style={{ color: '#0f172a' }}>{target.salesmanName}</strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Calendar size={13} style={{ color: '#d97706' }} />
                    <span style={{ fontWeight: 600, color: '#64748b' }}>Period:</span>
                    <strong style={{ color: '#334155', fontFamily: 'monospace' }}>
                      {target.startDate} to {target.endDate}
                    </strong>
                  </div>

                  {target.description && (
                    <div style={{ color: '#64748b', fontSize: '0.76rem', marginLeft: 'auto' }}>
                      {target.description}
                    </div>
                  )}
                </div>

                {/* Progress Bar & Numeric Metrics */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      <span>Achieved: </span>
                      <strong style={{ fontSize: '0.96rem', color: '#0f172a', fontFamily: 'monospace', fontWeight: 700 }}>
                        Rs. {achieved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                      <span> / Goal: </span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                        Rs. {goal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '0.86rem',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          color: percentage >= 100 ? '#16a34a' : '#0284c7',
                        }}
                      >
                        {percentage}% Achieved
                      </span>
                    </div>
                  </div>

                  {/* Clean Progress Bar (Customer History theme) */}
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: '#f1f5f9',
                      borderRadius: '9999px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, Math.max(0, percentage))}%`,
                        backgroundColor: percentage >= 100 ? '#16a34a' : '#0284c7',
                        borderRadius: '9999px',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Progressive Slabs / Ranges Track */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Target Range Tiers & Progressive Rewards
                    </span>
                    {currentTier && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: '#15803d',
                          backgroundColor: '#dcfce7',
                          border: '1px solid #bbf7d0',
                          padding: '1px 7px',
                          borderRadius: '9999px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Check size={11} /> {currentTier.tierName} Unlocked ({currentTier.discountPercentage}% Discount)
                      </span>
                    )}
                  </div>

                  {/* Tiers Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`,
                      gap: '8px',
                    }}
                  >
                    {(target.tiers || []).map((tier, tIdx) => {
                      const isAchievedTier = Boolean(tier.isAchieved);
                      const isNext = !isAchievedTier && nextTier && nextTier.id === tier.id;

                      return (
                        <div
                          key={tier.id || tIdx}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: isAchievedTier
                              ? '1px solid #bbf7d0'
                              : isNext
                              ? '1px dashed #0284c7'
                              : '1px solid #e2e8f0',
                            backgroundColor: isAchievedTier
                              ? '#f0fdf4'
                              : isNext
                              ? '#f0f9ff'
                              : '#f8fafc',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span
                              style={{
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                color: isAchievedTier ? '#15803d' : isNext ? '#0369a1' : '#334155',
                              }}
                            >
                              {tier.tierName}
                            </span>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                fontFamily: 'monospace',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: isAchievedTier ? '#dcfce7' : isNext ? '#e0f2fe' : '#e2e8f0',
                                color: isAchievedTier ? '#15803d' : isNext ? '#0284c7' : '#475569',
                              }}
                            >
                              {tier.discountPercentage > 0 ? `${tier.discountPercentage}%` : `Rs. ${tier.discountAmount}`}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                            Rs. {Number(tier.minAmount).toLocaleString()}
                            {tier.maxAmount ? ` - ${Number(tier.maxAmount).toLocaleString()}` : '+'}
                          </div>

                          {/* Status Footer */}
                          <div style={{ marginTop: '2px', fontSize: '0.68rem', fontWeight: 600 }}>
                            {isAchievedTier ? (
                              <span style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Check size={11} /> Unlocked in POS
                              </span>
                            ) : isNext ? (
                              <span style={{ color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Sparkles size={11} /> Needs Rs. {neededForNext.toLocaleString()} more
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Locked</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. ADD / EDIT TARGET MODAL
         ───────────────────────────────────────────────────────────── */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              maxWidth: '820px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #cbd5e1',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                borderTopLeftRadius: '10px',
                borderTopRightRadius: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    backgroundColor: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Target size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                    {editingTarget ? 'Edit Customer Target & Ranges' : 'New Customer Target & Ranges'}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                    Configure sales target milestones and tiered discount rewards
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveTarget} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Row 1: Target Name & Code */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Target Name / Promotion Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Q1 Growth Target, Monthly Loyalty Milestone..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: '100%',
                      height: '34px',
                      padding: '0 10px',
                      fontSize: '0.82rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#cbd5e1')}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Target Code (Auto if blank)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TGT-2026-0001"
                    value={formData.targetCode}
                    onChange={(e) => setFormData({ ...formData, targetCode: e.target.value })}
                    style={{
                      width: '100%',
                      height: '34px',
                      padding: '0 10px',
                      fontSize: '0.82rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'monospace',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#cbd5e1')}
                  />
                </div>
              </div>

              {/* Row 2: Target Scope Selection */}
              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Target Scope (Who does this target apply to?)
                </label>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer', color: '#0f172a' }}>
                    <input
                      type="radio"
                      name="scopeType"
                      checked={formData.scopeType === 'CUSTOMER'}
                      onChange={() => setFormData({ ...formData, scopeType: 'CUSTOMER' })}
                    />
                    Specific Customer
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer', color: '#0f172a' }}>
                    <input
                      type="radio"
                      name="scopeType"
                      checked={formData.scopeType === 'GROUP'}
                      onChange={() => setFormData({ ...formData, scopeType: 'GROUP' })}
                    />
                    Customer Group
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer', color: '#0f172a' }}>
                    <input
                      type="radio"
                      name="scopeType"
                      checked={formData.scopeType === 'ALL'}
                      onChange={() => setFormData({ ...formData, scopeType: 'ALL', customerId: '', customerGroupId: '' })}
                    />
                    Store-wide (All Customers)
                  </label>
                </div>

                {formData.scopeType === 'CUSTOMER' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                      Select Customer *
                    </label>
                    <select
                      value={formData.customerId}
                      onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                      required={formData.scopeType === 'CUSTOMER'}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 10px',
                        fontSize: '0.82rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.customerCode || 'CUST'}) • Phone: {c.phone || '-'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.scopeType === 'GROUP' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                      Select Customer Group *
                    </label>
                    <select
                      value={formData.customerGroupId}
                      onChange={(e) => setFormData({ ...formData, customerGroupId: e.target.value })}
                      required={formData.scopeType === 'GROUP'}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 10px',
                        fontSize: '0.82rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <option value="">-- Choose Customer Group --</option>
                      {routes.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.groupName || g.name} ({g.groupCode || 'GRP'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Row 3: Assigned Salesman & Target Goal */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Assigned Sales Rep / Salesman (Optional)
                  </label>
                  <select
                    value={formData.salesmanId}
                    onChange={(e) => setFormData({ ...formData, salesmanId: e.target.value })}
                    style={{
                      width: '100%',
                      height: '34px',
                      padding: '0 10px',
                      fontSize: '0.82rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <option value="">-- No Specific Sales Rep --</option>
                    {salesmen.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role || 'Sales Rep'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Overall Target Amount (Rs.) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 50000"
                    value={formData.targetAmount}
                    onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                    style={{
                      width: '100%',
                      height: '34px',
                      padding: '0 10px',
                      fontSize: '0.82rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#cbd5e1')}
                  />
                </div>
              </div>

              {/* Row 4: Date Range & Quick Presets */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Target Period Dates *
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setDatePreset('thisMonth')}
                      style={{
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        color: '#334155',
                        fontWeight: 500,
                      }}
                    >
                      This Month
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset('nextQuarter')}
                      style={{
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        color: '#334155',
                        fontWeight: 500,
                      }}
                    >
                      Quarterly (90 Days)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset('thisYear')}
                      style={{
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        color: '#334155',
                        fontWeight: 500,
                      }}
                    >
                      Full Year
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Start Date:</span>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 10px',
                        fontSize: '0.82rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        marginTop: '3px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>End Date:</span>
                    <input
                      type="date"
                      required
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 10px',
                        fontSize: '0.82rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        marginTop: '3px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* ─────────────────────────────────────────────────────────
                  Range Slabs & Progressive Discount Tiers Builder
                 ───────────────────────────────────────────────────────── */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                      Range Slabs & Progressive Discount Tiers
                    </h4>
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                      When customer purchases reach each range, the unlocked discount applies automatically
                    </p>
                  </div>

                  {/* Preset Buttons */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('standard3')}
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        backgroundColor: '#e0f2fe',
                        color: '#0369a1',
                        border: '1px solid #bae6fd',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      3-Tier (3%, 5%, 8%)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('executive4')}
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        backgroundColor: '#fef3c7',
                        color: '#b45309',
                        border: '1px solid #fde68a',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      4-Tier (2%, 5%, 8%, 12%)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('booster')}
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        backgroundColor: '#f3e8ff',
                        color: '#7e22ce',
                        border: '1px solid #e9d5ff',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Volume (5%, 10%)
                    </button>
                  </div>
                </div>

                {/* Tiers List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {formData.tiers.map((tier, idx) => (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: '#ffffff',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.5fr auto',
                        gap: '6px',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Tier Name:</span>
                        <input
                          type="text"
                          value={tier.tierName}
                          onChange={(e) => handleTierChange(idx, 'tierName', e.target.value)}
                          placeholder="e.g. Silver Tier"
                          style={{
                            width: '100%',
                            height: '30px',
                            padding: '0 6px',
                            fontSize: '0.78rem',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div>
                        <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Min Spend (Rs.):</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tier.minAmount}
                          onChange={(e) => handleTierChange(idx, 'minAmount', e.target.value)}
                          placeholder="0"
                          style={{
                            width: '100%',
                            height: '30px',
                            padding: '0 6px',
                            fontSize: '0.78rem',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            fontWeight: 600,
                            fontFamily: 'monospace',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div>
                        <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Max Spend (Rs.):</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tier.maxAmount}
                          onChange={(e) => handleTierChange(idx, 'maxAmount', e.target.value)}
                          placeholder="Unlimited"
                          style={{
                            width: '100%',
                            height: '30px',
                            padding: '0 6px',
                            fontSize: '0.78rem',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            fontFamily: 'monospace',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div>
                        <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Discount (%):</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={tier.discountPercentage}
                          onChange={(e) => handleTierChange(idx, 'discountPercentage', e.target.value)}
                          placeholder="0"
                          style={{
                            width: '100%',
                            height: '30px',
                            padding: '0 6px',
                            fontSize: '0.78rem',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            fontWeight: 700,
                            color: '#0284c7',
                            fontFamily: 'monospace',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div>
                        <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Reward Note:</span>
                        <input
                          type="text"
                          value={tier.rewardDescription}
                          onChange={(e) => handleTierChange(idx, 'rewardDescription', e.target.value)}
                          placeholder="e.g. 5% off POS orders"
                          style={{
                            width: '100%',
                            height: '30px',
                            padding: '0 6px',
                            fontSize: '0.78rem',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div style={{ paddingTop: '12px' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveTier(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title="Remove tier"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddTier}
                  style={{
                    alignSelf: 'flex-start',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    color: '#0284c7',
                    backgroundColor: '#ffffff',
                    border: '1px dashed #0284c7',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginTop: '2px',
                  }}
                >
                  <Plus size={13} /> Add Another Range Tier
                </button>
              </div>

              {/* Status toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="isActiveTarget"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                />
                <label htmlFor="isActiveTarget" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}>
                  Target is Active and available in POS
                </label>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  paddingTop: '12px',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    height: '34px',
                    padding: '0 14px',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    height: '34px',
                    padding: '0 18px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: '0 1px 2px rgba(2, 132, 199, 0.2)',
                  }}
                >
                  {saving ? <RefreshCw size={13} className="spin" /> : <Check size={14} />}
                  <span>{editingTarget ? 'Update Target & Ranges' : 'Save Range Target'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. VIEW DETAIL MODAL
         ───────────────────────────────────────────────────────────── */}
      {selectedTargetDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedTargetDetail(null);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              maxWidth: '640px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #cbd5e1',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
                borderTopLeftRadius: '10px',
                borderTopRightRadius: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                  Target Progress: {selectedTargetDetail.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTargetDetail(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Achievement Summary Card (Matches Customer History KPI card) */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '8px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Sales Achieved
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a', marginTop: '3px' }}>
                    Rs. {Number(selectedTargetDetail.currentAchievedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '8px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Target Goal
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'monospace', color: '#0284c7', marginTop: '3px' }}>
                    Rs. {Number(selectedTargetDetail.targetAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                    {selectedTargetDetail.achievementPercentage}% of goal
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Unlocked Discount
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'monospace', color: '#16a34a', marginTop: '3px' }}>
                    {selectedTargetDetail.currentDiscountPercentage > 0 ? `${selectedTargetDetail.currentDiscountPercentage}%` : '0%'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    {selectedTargetDetail.currentAchievedTier ? selectedTargetDetail.currentAchievedTier.tierName : 'Base tier'}
                  </div>
                </div>
              </div>

              {/* Slabs Breakdown */}
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.76rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Range Slabs & Unlocking Status
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(selectedTargetDetail.tiers || []).map((tr) => (
                    <div
                      key={tr.id}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: tr.isAchieved ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                        backgroundColor: tr.isAchieved ? '#f0fdf4' : '#f8fafc',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: tr.isAchieved ? '#15803d' : '#0f172a' }}>
                          {tr.tierName}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                          Range: Rs. {Number(tr.minAmount).toLocaleString()} - {tr.maxAmount ? `Rs. ${Number(tr.maxAmount).toLocaleString()}` : 'Unlimited'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem', fontFamily: 'monospace', color: tr.isAchieved ? '#16a34a' : '#475569' }}>
                          {tr.discountPercentage}% Discount
                        </div>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: tr.isAchieved ? '#16a34a' : '#94a3b8',
                          }}
                        >
                          {tr.isAchieved ? '✓ UNLOCKED' : 'LOCKED'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ textAlign: 'right', paddingTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedTargetDetail(null)}
                  style={{
                    height: '32px',
                    padding: '0 14px',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer',
                    color: '#334155',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
