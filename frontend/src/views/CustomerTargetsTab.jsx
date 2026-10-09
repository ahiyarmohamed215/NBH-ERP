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
        gap: '16px',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        paddingBottom: '32px',
      }}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. TOP BANNER / TOOLBAR CARD
         ───────────────────────────────────────────────────────────── */}
      <div
        className="glass-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          boxShadow: '0 2px 8px -2px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
            }}
          >
            <Target size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.22rem', fontWeight: 700, color: '#0f172a' }}>
                Customer Range & Targets
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '20px',
                  background: '#e0f2fe',
                  color: '#0369a1',
                }}
              >
                POS & Sales Milestone System
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Create customer spending milestones and progressive discount range tiers for salesmen and POS billing
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={loadTargets}
            disabled={loading}
            className="secondary-button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontWeight: 600,
            }}
            title="Refresh targets"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.86rem',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                border: 'none',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                fontWeight: 700,
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
              }}
            >
              <Plus size={16} />
              <span>New Range & Target</span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. KPI SUMMARY METRIC CARDS
         ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px',
        }}
      >
        {/* Total Targets */}
        <div
          style={{
            background: '#ffffff',
            padding: '14px 18px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Total Targets
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
              {metrics.total}
            </div>
          </div>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: '#f1f5f9',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={18} />
          </div>
        </div>

        {/* Active Targets */}
        <div
          style={{
            background: '#ffffff',
            padding: '14px 18px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Active Running
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>
              {metrics.active}
            </div>
          </div>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={18} />
          </div>
        </div>

        {/* Achieved Goals */}
        <div
          style={{
            background: '#ffffff',
            padding: '14px 18px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Targets Achieved
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
              {metrics.achieved}
            </div>
          </div>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: '#dcfce7',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Award size={18} />
          </div>
        </div>

        {/* Max Discount Available */}
        <div
          style={{
            background: '#ffffff',
            padding: '14px 18px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Top Reward Tier
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
              {metrics.maxDisc > 0 ? `${metrics.maxDisc}% Off` : 'None'}
            </div>
          </div>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: '#fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Percent size={18} />
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. FILTER BAR
         ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#ffffff',
          padding: '12px 16px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search targets by name, code, customer or salesman..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              fontSize: '0.84rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '9px',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '7px 10px',
              fontSize: '0.82rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#334155',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
            <option value="ACHIEVED">Achieved Only</option>
          </select>
        </div>

        {/* Customer Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Customer:</span>
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            style={{
              padding: '7px 10px',
              fontSize: '0.82rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#334155',
              fontWeight: 500,
              maxWidth: '180px',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Salesman Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Sales Rep:</span>
          <select
            value={salesmanFilter}
            onChange={(e) => setSalesmanFilter(e.target.value)}
            style={{
              padding: '7px 10px',
              fontSize: '0.82rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#334155',
              fontWeight: 500,
              maxWidth: '180px',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Sales Reps</option>
            {salesmen.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

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
              background: 'none',
              border: 'none',
              color: '#0284c7',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. TARGETS CARDS LIST
         ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 500 }}>Loading customer range targets...</p>
        </div>
      ) : filteredTargets.length === 0 ? (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '2px dashed #cbd5e1',
            padding: '60px 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '14px',
            }}
          >
            <Target size={28} />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#0f172a', fontWeight: 700 }}>
            No Customer Targets Found
          </h3>
          <p style={{ margin: '0 0 18px', color: '#64748b', fontSize: '0.86rem', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
            {searchTerm || statusFilter !== 'ALL'
              ? 'No targets match your current search and filters. Try clearing filters.'
              : 'Create sales targets with progressive discount range tiers for customers to incentivize bulk purchases in POS mode.'}
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} /> Create First Range Target
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                  background: '#ffffff',
                  border: isCompleted ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  boxShadow: '0 2px 6px -1px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Top Achieved Ribbon */}
                {isCompleted && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '0',
                      right: '0',
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '3px 18px',
                      borderBottomLeftRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)',
                    }}
                  >
                    <Award size={11} /> Target Goal Achieved!
                  </div>
                )}

                {/* Header Row: Title, Badges & Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    paddingRight: isCompleted ? '110px' : '0',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: '#f1f5f9',
                          color: '#334155',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {target.targetCode}
                      </span>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                        {target.name}
                      </h3>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: target.isActive ? '#dcfce7' : '#f1f5f9',
                          color: target.isActive ? '#15803d' : '#64748b',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: target.isActive ? '#16a34a' : '#94a3b8',
                          }}
                        />
                        {target.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {target.daysRemaining !== undefined && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: target.daysRemaining > 0 ? '#eff6ff' : '#fee2e2',
                            color: target.daysRemaining > 0 ? '#1d4ed8' : '#b91c1c',
                          }}
                        >
                          {target.daysRemaining > 0 ? `${target.daysRemaining} days left` : 'Expired'}
                        </span>
                      )}
                    </div>
                    {target.description && (
                      <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                        {target.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedTargetDetail(target)}
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: '#0284c7',
                        background: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="View full progress breakdown"
                    >
                      <Info size={13} /> View Progress
                    </button>

                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(target)}
                          style={{
                            padding: '6px 10px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: '#334155',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Edit target configuration"
                        >
                          <Edit2 size={13} /> Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleActive(target)}
                          style={{
                            padding: '6px 10px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: target.isActive ? '#d97706' : '#16a34a',
                            background: target.isActive ? '#fffbeb' : '#f0fdf4',
                            border: '1px solid',
                            borderColor: target.isActive ? '#fde68a' : '#bbf7d0',
                            borderRadius: '6px',
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
                            padding: '6px 8px',
                            color: '#ef4444',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                          title="Deactivate target"
                        >
                          <Trash2 size={13} />
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
                    gap: '16px',
                    flexWrap: 'wrap',
                    padding: '8px 12px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    color: '#475569',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Users size={14} style={{ color: '#0284c7' }} />
                    <span style={{ fontWeight: 600, color: '#64748b' }}>Scope:</span>
                    <strong style={{ color: '#0f172a' }}>
                      {target.customerName ? (
                        `${target.customerName} (${target.customerCode || 'CUST'})`
                      ) : target.customerGroupName ? (
                        `Group: ${target.customerGroupName}`
                      ) : (
                        <span style={{ color: '#0369a1', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                          Store-wide (All Customers)
                        </span>
                      )}
                    </strong>
                  </div>

                  {target.salesmanName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <User size={14} style={{ color: '#059669' }} />
                      <span style={{ fontWeight: 600, color: '#64748b' }}>Assigned Rep:</span>
                      <strong style={{ color: '#0f172a' }}>{target.salesmanName}</strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Calendar size={14} style={{ color: '#d97706' }} />
                    <span style={{ fontWeight: 600, color: '#64748b' }}>Period:</span>
                    <strong style={{ color: '#334155' }}>
                      {target.startDate} to {target.endDate}
                    </strong>
                  </div>
                </div>

                {/* Progress Bar & Numeric Metrics */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Achieved Sales:</span>{' '}
                      <strong style={{ fontSize: '1.08rem', color: '#0f172a', fontWeight: 800 }}>
                        Rs. {achieved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>{' '}
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        / Goal: Rs. {goal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '0.95rem',
                          fontWeight: 800,
                          color: percentage >= 100 ? '#16a34a' : percentage >= 50 ? '#0284c7' : '#d97706',
                        }}
                      >
                        {percentage}% Achieved
                      </span>
                    </div>
                  </div>

                  {/* Gradient Progress Bar */}
                  <div
                    style={{
                      height: '9px',
                      background: '#e2e8f0',
                      borderRadius: '5px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, Math.max(0, percentage))}%`,
                        background:
                          percentage >= 100
                            ? 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)'
                            : 'linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)',
                        borderRadius: '5px',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Progressive Slabs / Ranges Track */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                      Target Range Tiers & Progressive Rewards
                    </div>
                    {currentTier && (
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: '#15803d',
                          background: '#dcfce7',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Check size={12} /> {currentTier.tierName} Unlocked ({currentTier.discountPercentage}% Discount)!
                      </span>
                    )}
                  </div>

                  {/* Tiers Horizontal Strip */}
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
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: isAchievedTier
                              ? '1.5px solid #86efac'
                              : isNext
                              ? '1.5px dashed #0284c7'
                              : '1px solid #e2e8f0',
                            background: isAchievedTier
                              ? 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)'
                              : isNext
                              ? 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)'
                              : '#fafafa',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            position: 'relative',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: isAchievedTier ? '#15803d' : isNext ? '#0369a1' : '#475569',
                              }}
                            >
                              {tier.tierName}
                            </span>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: isAchievedTier ? '#22c55e' : isNext ? '#0284c7' : '#94a3b8',
                                color: '#ffffff',
                              }}
                            >
                              {tier.discountPercentage > 0 ? `${tier.discountPercentage}%` : `Rs. ${tier.discountAmount}`}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            Range: Rs. {Number(tier.minAmount).toLocaleString()}
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
          5. ADD / EDIT TARGET MODAL
         ───────────────────────────────────────────────────────────── */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
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
              borderRadius: '16px',
              maxWidth: '820px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: '#0284c7',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Target size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                    {editingTarget ? 'Edit Customer Target & Ranges' : 'New Customer Target & Ranges'}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
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
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveTarget} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Row 1: Target Name & Code */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
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
                      padding: '9px 12px',
                      fontSize: '0.86rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Target Code (Auto if blank)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TGT-2026-0001"
                    value={formData.targetCode}
                    onChange={(e) => setFormData({ ...formData, targetCode: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '0.86rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Target Scope Selection */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Target Scope (Who does this target apply to?)
                </label>
                <div style={{ display: 'flex', gap: '18px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', cursor: 'pointer', color: '#0f172a' }}>
                    <input
                      type="radio"
                      name="scopeType"
                      checked={formData.scopeType === 'CUSTOMER'}
                      onChange={() => setFormData({ ...formData, scopeType: 'CUSTOMER' })}
                    />
                    Specific Customer
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', cursor: 'pointer', color: '#0f172a' }}>
                    <input
                      type="radio"
                      name="scopeType"
                      checked={formData.scopeType === 'GROUP'}
                      onChange={() => setFormData({ ...formData, scopeType: 'GROUP' })}
                    />
                    Customer Group
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', cursor: 'pointer', color: '#0f172a' }}>
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
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Select Customer *
                    </label>
                    <select
                      value={formData.customerId}
                      onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                      required={formData.scopeType === 'CUSTOMER'}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
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
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Select Customer Group *
                    </label>
                    <select
                      value={formData.customerGroupId}
                      onChange={(e) => setFormData({ ...formData, customerGroupId: e.target.value })}
                      required={formData.scopeType === 'GROUP'}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Assigned Sales Rep / Salesman (Optional)
                  </label>
                  <select
                    value={formData.salesmanId}
                    onChange={(e) => setFormData({ ...formData, salesmanId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '0.85rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
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
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
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
                      padding: '9px 12px',
                      fontSize: '0.86rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontWeight: 700,
                    }}
                  />
                </div>
              </div>

              {/* Row 4: Date Range & Quick Presets */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                    Target Period Dates *
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setDatePreset('thisMonth')}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        color: '#334155',
                      }}
                    >
                      This Month
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset('nextQuarter')}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        color: '#334155',
                      }}
                    >
                      Quarterly (90 Days)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset('thisYear')}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        color: '#334155',
                      }}
                    >
                      Full Year
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Start Date:</span>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        marginTop: '3px',
                      }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>End Date:</span>
                    <input
                      type="date"
                      required
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        marginTop: '3px',
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
                  background: '#f8fafc',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                      Range Slabs & Progressive Discount Tiers
                    </h4>
                    <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                      When customer purchases reach each range, the unlocked discount applies automatically
                    </p>
                  </div>

                  {/* Preset Buttons */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('standard3')}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: '#e0f2fe',
                        color: '#0369a1',
                        border: '1px solid #bae6fd',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      ⚡ 3-Tier (3%, 5%, 8%)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('executive4')}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: '#fef3c7',
                        color: '#b45309',
                        border: '1px solid #fde68a',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      👑 4-Tier (2%, 5%, 8%, 12%)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('booster')}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: '#f3e8ff',
                        color: '#7e22ce',
                        border: '1px solid #e9d5ff',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      🚀 Volume (5%, 10%)
                    </button>
                  </div>
                </div>

                {/* Tiers List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {formData.tiers.map((tier, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#ffffff',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.5fr auto',
                        gap: '8px',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Tier Name:</span>
                        <input
                          type="text"
                          value={tier.tierName}
                          onChange={(e) => handleTierChange(idx, 'tierName', e.target.value)}
                          placeholder="e.g. Silver Tier"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            fontSize: '0.8rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                          }}
                        />
                      </div>

                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Min Spend (Rs.):</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tier.minAmount}
                          onChange={(e) => handleTierChange(idx, 'minAmount', e.target.value)}
                          placeholder="0"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            fontSize: '0.8rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontWeight: 600,
                          }}
                        />
                      </div>

                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Max Spend (Rs.):</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tier.maxAmount}
                          onChange={(e) => handleTierChange(idx, 'maxAmount', e.target.value)}
                          placeholder="Unlimited"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            fontSize: '0.8rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                          }}
                        />
                      </div>

                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Discount (%):</span>
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
                            padding: '6px 8px',
                            fontSize: '0.8rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontWeight: 700,
                            color: '#0284c7',
                          }}
                        />
                      </div>

                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Reward Note:</span>
                        <input
                          type="text"
                          value={tier.rewardDescription}
                          onChange={(e) => handleTierChange(idx, 'rewardDescription', e.target.value)}
                          placeholder="e.g. 5% off POS orders"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            fontSize: '0.8rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                          }}
                        />
                      </div>

                      <div style={{ paddingTop: '14px' }}>
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
                          <Trash2 size={15} />
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
                    gap: '6px',
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: '#0284c7',
                    background: '#ffffff',
                    border: '1px dashed #0284c7',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    marginTop: '4px',
                  }}
                >
                  <Plus size={14} /> Add Another Range Tier
                </button>
              </div>

              {/* Status toggle & Notes */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="isActiveTarget"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="isActiveTarget" style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}>
                  Target is Active and available in POS
                </label>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  paddingTop: '12px',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '9px 18px',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
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
                    padding: '9px 22px',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
                  }}
                >
                  {saving ? <RefreshCw size={15} className="animate-spin" /> : <Check size={16} />}
                  <span>{editingTarget ? 'Update Target & Ranges' : 'Save Range Target'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. VIEW DETAIL MODAL
         ───────────────────────────────────────────────────────────── */}
      {selectedTargetDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
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
              borderRadius: '16px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={20} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                  Target Progress: {selectedTargetDetail.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTargetDetail(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Achievement Summary Card */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#ffffff',
                  padding: '18px 20px',
                  borderRadius: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Sales Achieved in Period
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '2px' }}>
                    Rs. {Number(selectedTargetDetail.currentAchievedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '4px' }}>
                    Target Goal: Rs. {Number(selectedTargetDetail.targetAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({selectedTargetDetail.achievementPercentage}%)
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>Unlocked Discount</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fef08a' }}>
                    {selectedTargetDetail.currentDiscountPercentage > 0 ? `${selectedTargetDetail.currentDiscountPercentage}%` : '0%'}
                  </div>
                  <div style={{ fontSize: '0.74rem', opacity: 0.9 }}>
                    {selectedTargetDetail.currentAchievedTier ? selectedTargetDetail.currentAchievedTier.tierName : 'Base (No discount)'}
                  </div>
                </div>
              </div>

              {/* Slabs Breakdown */}
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
                  Range Slabs & Unlocking Status
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(selectedTargetDetail.tiers || []).map((tr) => (
                    <div
                      key={tr.id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: tr.isAchieved ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                        background: tr.isAchieved ? '#f0fdf4' : '#fafafa',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem', color: tr.isAchieved ? '#15803d' : '#334155' }}>
                          {tr.tierName}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          Range: Rs. {Number(tr.minAmount).toLocaleString()} - {tr.maxAmount ? `Rs. ${Number(tr.maxAmount).toLocaleString()}` : 'Unlimited'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: tr.isAchieved ? '#16a34a' : '#64748b' }}>
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

              <div style={{ textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => setSelectedTargetDetail(null)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    cursor: 'pointer',
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
