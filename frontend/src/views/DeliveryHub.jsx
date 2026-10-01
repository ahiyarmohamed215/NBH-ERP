import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Truck,
  Users,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Plus,
  Search,
  FileText,
  ChevronRight,
  ArrowRight,
  Navigation,
  Eye,
  Printer,
  RefreshCw,
  SlidersHorizontal,
  Filter,
  ShieldCheck,
  PackageCheck,
  Building2,
  X,
  UserCheck,
  Gauge,
  Check,
  Info
} from 'lucide-react';
import { deliveryApi, deliveryRouteApi, vehicleApi, salesApi, customerGroupApi, printPdfDocument } from '../api/apiClient';
import api from '../api/apiClient';

export default function DeliveryHub({ activeSubTab = 'deliveries' }) {
  // Primary Tabs: 'deliveries' | 'routes' | 'vehicles'
  const [currentTab, setCurrentTab] = useState(activeSubTab || 'deliveries');

  useEffect(() => {
    if (activeSubTab) {
      if (activeSubTab === 'routes') setCurrentTab('routes');
      else if (activeSubTab === 'vehicles') setCurrentTab('vehicles');
      else setCurrentTab('deliveries');
    }
  }, [activeSubTab]);

  // Data states
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pendingInvoices, setPendingInvoices] = useState([]);

  // Toast notifications
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Filter & Search states for deliveries
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [routeFilter, setRouteFilter] = useState('ALL');

  // Modals state
  const [showCreateTripModal, setShowCreateTripModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showManifestModal, setShowManifestModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);

  // Form states: Create Delivery Trip
  const [newTripForm, setNewTripForm] = useState({
    warehouseId: '',
    routeId: '',
    vehicleId: '',
    driverId: '',
    assistantStaffId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    departureTime: '',
    selectedInvoiceIds: [],
    startOdometer: '',
    notes: '',
  });

  // Action form states
  const [dispatchForm, setDispatchForm] = useState({
    departureTime: new Date().toISOString().slice(0, 16),
    startOdometer: '',
    notes: '',
  });

  const [completeForm, setCompleteForm] = useState({
    returnTime: new Date().toISOString().slice(0, 16),
    endOdometer: '',
    notes: '',
  });

  const [cancelForm, setCancelForm] = useState({
    cancellationReason: '',
  });

  // Route Form State
  const [routeForm, setRouteForm] = useState({
    id: null,
    routeCode: '',
    routeName: '',
    description: '',
    area: '',
    startLocation: '',
    endLocation: '',
    estimatedDurationMinutes: '',
    deliveryDays: 'Monday, Wednesday, Friday',
    customerIds: [],
  });

  // Vehicle Form State
  const [vehicleForm, setVehicleForm] = useState({
    id: null,
    vehicleNumber: '',
    model: '',
    vehicleType: 'TRUCK',
    capacityKg: '',
    status: 'AVAILABLE',
    notes: '',
  });

  // Load all foundational data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        delivRes,
        routesRes,
        vehRes,
        sumRes,
        usersRes,
        whRes,
        custRes
      ] = await Promise.all([
        deliveryApi.search(),
        deliveryRouteApi.getAll(),
        vehicleApi.getAll(),
        deliveryApi.getSummary(),
        api.get('/users').catch(() => ({ data: { data: [] } })),
        api.get('/warehouses').catch(() => ({ data: { data: [] } })),
        api.get('/customers').catch(() => ({ data: { data: [] } }))
      ]);

      setDeliveries(delivRes.data?.data || []);
      setRoutes(routesRes.data?.data || []);
      setVehicles(vehRes.data?.data || []);
      setSummary(sumRes.data?.data || null);

      const uList = usersRes.data?.data || [];
      setEmployees(uList.filter(u => u.isActive !== false));

      const wList = whRes.data?.data || [];
      setWarehouses(wList);

      const cList = custRes.data?.data || [];
      setCustomers(cList);
    } catch (err) {
      console.error('Error fetching delivery data:', err);
      showToast('Failed to load delivery data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch pending invoices when opening Create Trip Modal
  const loadPendingInvoices = async () => {
    try {
      const res = await deliveryApi.getPendingInvoices();
      setPendingInvoices(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load pending invoices:', err);
      showToast('Could not load invoices for delivery', 'error');
    }
  };

  const handleOpenCreateTrip = () => {
    loadPendingInvoices();
    setNewTripForm({
      warehouseId: warehouses[0]?.id || '',
      routeId: routes[0]?.id || '',
      vehicleId: vehicles.find(v => v.status === 'AVAILABLE')?.id || vehicles[0]?.id || '',
      driverId: employees[0]?.id || '',
      assistantStaffId: employees[1]?.id || employees[0]?.id || '',
      scheduledDate: new Date().toISOString().split('T')[0],
      departureTime: '',
      selectedInvoiceIds: [],
      startOdometer: '',
      notes: '',
    });
    setShowCreateTripModal(true);
  };

  // Submit Create Delivery Trip
  const handleCreateDeliveryTrip = async (e) => {
    e.preventDefault();
    if (!newTripForm.driverId || !newTripForm.assistantStaffId) {
      showToast('Please assign two staff members (Driver and Assistant)', 'error');
      return;
    }
    if (String(newTripForm.driverId) === String(newTripForm.assistantStaffId)) {
      showToast('Primary driver and assistant must be two different staff members', 'error');
      return;
    }
    if (!newTripForm.selectedInvoiceIds || newTripForm.selectedInvoiceIds.length === 0) {
      showToast('Please select at least one sales invoice to load for delivery', 'error');
      return;
    }

    try {
      const payload = {
        warehouseId: newTripForm.warehouseId ? Number(newTripForm.warehouseId) : null,
        routeId: newTripForm.routeId ? Number(newTripForm.routeId) : null,
        vehicleId: newTripForm.vehicleId ? Number(newTripForm.vehicleId) : null,
        driverId: Number(newTripForm.driverId),
        assistantStaffId: Number(newTripForm.assistantStaffId),
        scheduledDate: newTripForm.scheduledDate,
        departureTime: newTripForm.departureTime || null,
        invoiceIds: newTripForm.selectedInvoiceIds.map(Number),
        startOdometer: newTripForm.startOdometer ? Number(newTripForm.startOdometer) : null,
        notes: newTripForm.notes,
      };

      await deliveryApi.create(payload);
      showToast('Delivery trip created & invoices loaded successfully!', 'success');
      setShowCreateTripModal(false);
      fetchData();
    } catch (err) {
      console.error('Error creating delivery trip:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to create trip';
      showToast(msg, 'error');
    }
  };

  // Dispatch Action ("When it goes")
  const handleOpenDispatch = (trip) => {
    setSelectedTrip(trip);
    setDispatchForm({
      departureTime: new Date().toISOString().slice(0, 16),
      startOdometer: trip.startOdometer || '',
      notes: trip.notes || '',
    });
    setShowDispatchModal(true);
  };

  const handleConfirmDispatch = async () => {
    if (!selectedTrip) return;
    try {
      await deliveryApi.dispatch(selectedTrip.id, {
        departureTime: dispatchForm.departureTime ? `${dispatchForm.departureTime}:00` : null,
        startOdometer: dispatchForm.startOdometer ? Number(dispatchForm.startOdometer) : null,
        notes: dispatchForm.notes,
      });
      showToast(`Trip ${selectedTrip.deliveryNumber} dispatched on route!`, 'success');
      setShowDispatchModal(false);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Dispatch failed', 'error');
    }
  };

  // Complete Action ("When it returns & deliver")
  const handleOpenComplete = (trip) => {
    setSelectedTrip(trip);
    setCompleteForm({
      returnTime: new Date().toISOString().slice(0, 16),
      endOdometer: trip.endOdometer || '',
      notes: '',
    });
    setShowCompleteModal(true);
  };

  const handleConfirmComplete = async () => {
    if (!selectedTrip) return;
    try {
      await deliveryApi.complete(selectedTrip.id, {
        returnTime: completeForm.returnTime ? `${completeForm.returnTime}:00` : null,
        endOdometer: completeForm.endOdometer ? Number(completeForm.endOdometer) : null,
        notes: completeForm.notes,
      });
      showToast(`Trip ${selectedTrip.deliveryNumber} completed! All invoices marked delivered.`, 'success');
      setShowCompleteModal(false);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Completion failed', 'error');
    }
  };

  // Cancel Action
  const handleOpenCancel = (trip) => {
    setSelectedTrip(trip);
    setCancelForm({ cancellationReason: '' });
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedTrip) return;
    if (!cancelForm.cancellationReason.trim()) {
      showToast('Please provide a reason for cancelling this delivery', 'error');
      return;
    }
    try {
      await deliveryApi.cancel(selectedTrip.id, {
        cancellationReason: cancelForm.cancellationReason,
      });
      showToast(`Trip ${selectedTrip.deliveryNumber} cancelled. Invoices restored to pending.`, 'info');
      setShowCancelModal(false);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Cancellation failed', 'error');
    }
  };

  // Route Management
  const handleOpenCreateRoute = () => {
    setRouteForm({
      id: null,
      routeCode: '',
      routeName: '',
      description: '',
      area: '',
      startLocation: '',
      endLocation: '',
      estimatedDurationMinutes: '',
      deliveryDays: 'Monday, Wednesday, Friday',
      customerIds: [],
    });
    setShowRouteModal(true);
  };

  const handleOpenEditRoute = (r) => {
    setRouteForm({
      id: r.id,
      routeCode: r.routeCode,
      routeName: r.routeName,
      description: r.description || '',
      area: r.area || '',
      startLocation: r.startLocation || '',
      endLocation: r.endLocation || '',
      estimatedDurationMinutes: r.estimatedDurationMinutes || '',
      deliveryDays: r.deliveryDays || '',
      customerIds: r.customerIds || [],
    });
    setShowRouteModal(true);
  };

  const handleSaveRoute = async (e) => {
    e.preventDefault();
    if (!routeForm.routeName.trim()) {
      showToast('Route name is required', 'error');
      return;
    }
    try {
      const payload = {
        routeCode: routeForm.routeCode || undefined,
        routeName: routeForm.routeName.trim(),
        description: routeForm.description,
        area: routeForm.area,
        startLocation: routeForm.startLocation,
        endLocation: routeForm.endLocation,
        estimatedDurationMinutes: routeForm.estimatedDurationMinutes ? Number(routeForm.estimatedDurationMinutes) : null,
        deliveryDays: routeForm.deliveryDays,
        customerIds: routeForm.customerIds,
      };

      if (routeForm.id) {
        await deliveryRouteApi.update(routeForm.id, payload);
        showToast('Delivery route updated successfully', 'success');
      } else {
        await deliveryRouteApi.create(payload);
        showToast('New delivery route created successfully', 'success');
      }
      setShowRouteModal(false);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save route', 'error');
    }
  };

  // Vehicle Management
  const handleOpenCreateVehicle = () => {
    setVehicleForm({
      id: null,
      vehicleNumber: '',
      model: '',
      vehicleType: 'TRUCK',
      capacityKg: '',
      status: 'AVAILABLE',
      notes: '',
    });
    setShowVehicleModal(true);
  };

  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    if (!vehicleForm.vehicleNumber.trim() || !vehicleForm.model.trim()) {
      showToast('Vehicle plate number and model are required', 'error');
      return;
    }
    try {
      const payload = {
        vehicleNumber: vehicleForm.vehicleNumber.trim().toUpperCase(),
        model: vehicleForm.model.trim(),
        vehicleType: vehicleForm.vehicleType,
        capacityKg: vehicleForm.capacityKg ? Number(vehicleForm.capacityKg) : null,
        status: vehicleForm.status,
        notes: vehicleForm.notes,
      };
      if (vehicleForm.id) {
        await vehicleApi.update(vehicleForm.id, payload);
        showToast('Vehicle updated successfully', 'success');
      } else {
        await vehicleApi.create(payload);
        showToast('Vehicle added to delivery fleet', 'success');
      }
      setShowVehicleModal(false);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save vehicle', 'error');
    }
  };

  // Filtered deliveries list
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      const matchSearch =
        !searchTerm ||
        d.deliveryNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.assistantStaffName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.routeName?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'ALL' || d.status === statusFilter;
      const matchRoute = routeFilter === 'ALL' || String(d.routeId) === String(routeFilter);

      return matchSearch && matchStatus && matchRoute;
    });
  }, [deliveries, searchTerm, statusFilter, routeFilter]);

  // Helpers
  const formatDuration = (mins) => {
    if (!mins && mins !== 0) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  const formatTimeStr = (isoStr) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Toast popup */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            padding: '12px 20px',
            borderRadius: '8px',
            backgroundColor: toast.type === 'error' ? '#ef4444' : toast.type === 'info' ? '#0284c7' : '#10b981',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.9rem',
            boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.message}
        </div>
      )}

      {/* Header & Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Truck size={28} color="#0284c7" />
            Delivery & Distribution Management
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>
            Dispatch warehouse orders, assign two-person delivery crews, plan delivery routes, and track vehicle trip durations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={15} /> Refresh
          </button>

          {currentTab === 'deliveries' && (
            <button
              type="button"
              onClick={handleOpenCreateTrip}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '6px',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
              }}
            >
              <Plus size={17} /> Schedule Delivery Trip
            </button>
          )}

          {currentTab === 'routes' && (
            <button
              type="button"
              onClick={handleOpenCreateRoute}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '6px',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Plus size={17} /> + Create Delivery Route
            </button>
          )}

          {currentTab === 'vehicles' && (
            <button
              type="button"
              onClick={handleOpenCreateVehicle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '6px',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Plus size={17} /> + Add Vehicle
            </button>
          )}
        </div>
      </div>

      {/* KPI Metric Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {/* Card 1: In Transit / On Route */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #bfdbfe',
            padding: '16px 20px',
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.05)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0369a1', letterSpacing: '0.04em' }}>
              ON ROUTE / IN TRANSIT
            </span>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#0284c7',
                boxShadow: '0 0 0 4px rgba(2, 132, 199, 0.25)',
              }}
            />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0284c7' }}>
            {summary?.inTransitCount || 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Vehicles dispatched on active customer routes
          </div>
        </div>

        {/* Card 2: Delivered & Completed */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #bbf7d0',
            padding: '16px 20px',
            boxShadow: '0 2px 6px rgba(16, 185, 129, 0.05)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#15803d', letterSpacing: '0.04em' }}>
              DELIVERED & COMPLETED
            </span>
            <CheckCircle2 size={18} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#16a34a' }}>
            {summary?.deliveredCount || 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Trips returned & customer invoices delivered
          </div>
        </div>

        {/* Card 3: Scheduled / Loading in Warehouse */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #fed7aa',
            padding: '16px 20px',
            boxShadow: '0 2px 6px rgba(249, 115, 22, 0.05)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c2410c', letterSpacing: '0.04em' }}>
              SCHEDULED / LOADING
            </span>
            <Clock size={18} color="#ea580c" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ea580c' }}>
            {summary?.scheduledCount || 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Trips planned awaiting warehouse departure
          </div>
        </div>

        {/* Card 4: Invoices Ready for Delivery */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '16px 20px',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', letterSpacing: '0.04em' }}>
              PENDING INVOICE DELIVERIES
            </span>
            <PackageCheck size={18} color="#64748b" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>
            {summary?.pendingInvoicesForDeliveryCount || 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Invoices awaiting vehicle & route dispatch
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '20px',
        }}
      >
        <button
          type="button"
          onClick={() => setCurrentTab('deliveries')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: currentTab === 'deliveries' ? '3px solid #0284c7' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: currentTab === 'deliveries' ? '#0284c7' : '#64748b',
            fontWeight: currentTab === 'deliveries' ? 700 : 500,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Truck size={17} />
          Delivery Trips & Dispatches ({deliveries.length})
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('routes')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: currentTab === 'routes' ? '3px solid #0284c7' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: currentTab === 'routes' ? '#0284c7' : '#64748b',
            fontWeight: currentTab === 'routes' ? 700 : 500,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Navigation size={17} />
          Delivery Routes ({routes.length})
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('vehicles')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: currentTab === 'vehicles' ? '3px solid #0284c7' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: currentTab === 'vehicles' ? '#0284c7' : '#64748b',
            fontWeight: currentTab === 'vehicles' ? 700 : 500,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Gauge size={17} />
          Fleet Vehicles ({vehicles.length})
        </button>
      </div>

      {/* TAB 1: DELIVERIES LIST */}
      {currentTab === 'deliveries' && (
        <div>
          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: '#ffffff',
              padding: '14px 18px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              marginBottom: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search by trip #, vehicle, driver, helper, or route..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 12px 0 36px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.86rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#334155',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="ALL">All Trip Statuses</option>
                <option value="SCHEDULED">Scheduled / Loading</option>
                <option value="IN_TRANSIT">In Transit (On Route)</option>
                <option value="DELIVERED">Delivered & Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <select
                value={routeFilter}
                onChange={(e) => setRouteFilter(e.target.value)}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#334155',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="ALL">All Delivery Routes</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.routeCode} - {r.routeName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Delivery Trips Table */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>DELIVERY #</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>ROUTE & HUB</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>VEHICLE</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>CREW (2 STAFF)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>WHEN IT GOES / RETURNS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>TRIP DURATION</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>INVOICES</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>STATUS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveries.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                      <Truck size={36} color="#cbd5e1" style={{ marginBottom: '8px' }} />
                      <div style={{ fontWeight: 600, color: '#64748b' }}>No delivery dispatches found</div>
                      <div style={{ fontSize: '0.78rem' }}>Create a delivery trip above to assign vehicles and staff to customer invoices.</div>
                    </td>
                  </tr>
                ) : (
                  filteredDeliveries.map((trip) => {
                    const isInTransit = trip.status === 'IN_TRANSIT';
                    const isDelivered = trip.status === 'DELIVERED';
                    const isScheduled = trip.status === 'SCHEDULED';
                    const isCancelled = trip.status === 'CANCELLED';

                    return (
                      <tr
                        key={trip.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                      >
                        {/* Delivery Number */}
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0284c7' }}>
                          <span
                            onClick={() => {
                              setSelectedTrip(trip);
                              setShowManifestModal(true);
                            }}
                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            {trip.deliveryNumber}
                          </span>
                          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 400 }}>
                            {trip.scheduledDate}
                          </div>
                        </td>

                        {/* Route & Hub */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            {trip.routeName || 'Direct Dispatch'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Building2 size={12} />
                            {trip.warehouseName || 'Warehouse Depot'}
                          </div>
                        </td>

                        {/* Vehicle */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#334155' }}>
                            {trip.vehicleNumber || 'Unassigned'}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            {trip.vehicleModel || 'Fleet Lorry'}
                          </div>
                        </td>

                        {/* Crew (2 Staff Members) */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <UserCheck size={13} color="#0284c7" />
                              Driver: {trip.driverName || 'Staff 1'}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Users size={12} color="#64748b" />
                              Helper: {trip.assistantStaffName || 'Staff 2'}
                            </span>
                          </div>
                        </td>

                        {/* When it goes / returns */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontSize: '0.78rem', color: '#334155' }}>
                            <strong>Goes:</strong> {formatTimeStr(trip.departureTime)}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#334155' }}>
                            <strong>Returns:</strong> {formatTimeStr(trip.returnTime)}
                          </div>
                        </td>

                        {/* Trip Duration */}
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              backgroundColor: trip.tripDurationMinutes ? '#f0fdf4' : '#f8fafc',
                              color: trip.tripDurationMinutes ? '#16a34a' : '#94a3b8',
                              border: trip.tripDurationMinutes ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                            }}
                          >
                            <Clock size={12} />
                            {formatDuration(trip.tripDurationMinutes)}
                          </span>
                        </td>

                        {/* Invoices Count & Net Total */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>
                            {trip.totalInvoicesCount || trip.invoiceIds?.length || 0} invoice{trip.totalInvoicesCount === 1 ? '' : 's'}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                            ${Number(trip.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 16px' }}>
                          {isScheduled && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '9999px', fontSize: '0.74rem', fontWeight: 700, backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                              <Clock size={11} /> SCHEDULED
                            </span>
                          )}
                          {isInTransit && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '9999px', fontSize: '0.74rem', fontWeight: 700, backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                              <Truck size={11} /> ON ROUTE
                            </span>
                          )}
                          {isDelivered && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '9999px', fontSize: '0.74rem', fontWeight: 700, backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
                              <CheckCircle2 size={11} /> DELIVERED
                            </span>
                          )}
                          {isCancelled && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '9999px', fontSize: '0.74rem', fontWeight: 700, backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                              <XCircle size={11} /> CANCELLED
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            {/* If scheduled, allow dispatch ("Go") */}
                            {isScheduled && (
                              <button
                                type="button"
                                onClick={() => handleOpenDispatch(trip)}
                                style={{
                                  backgroundColor: '#0284c7',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '5px 10px',
                                  fontSize: '0.76rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Dispatch vehicle from warehouse"
                              >
                                <Navigation size={13} /> Dispatch
                              </button>
                            )}

                            {/* If in transit, allow complete ("Return & deliver") */}
                            {isInTransit && (
                              <button
                                type="button"
                                onClick={() => handleOpenComplete(trip)}
                                style={{
                                  backgroundColor: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '5px 10px',
                                  fontSize: '0.76rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Record vehicle return and mark invoices delivered"
                              >
                                <CheckCircle2 size={13} /> Return & Deliver
                              </button>
                            )}

                            {/* View manifest / sheet */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTrip(trip);
                                setShowManifestModal(true);
                              }}
                              style={{
                                backgroundColor: '#f1f5f9',
                                color: '#334155',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                padding: '5px 8px',
                                fontSize: '0.76rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                              title="View Dispatch Sheet & Delivery Manifest"
                            >
                              <FileText size={13} />
                            </button>

                            {/* Cancel button if not finished */}
                            {!isDelivered && !isCancelled && (
                              <button
                                type="button"
                                onClick={() => handleOpenCancel(trip)}
                                style={{
                                  backgroundColor: '#fff1f2',
                                  color: '#e11d48',
                                  border: '1px solid #fecdd3',
                                  borderRadius: '4px',
                                  padding: '5px 8px',
                                  fontSize: '0.76rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                                title="Cancel Delivery Trip"
                              >
                                <X size={13} />
                              </button>
                            )}
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
      )}

      {/* TAB 2: DELIVERY ROUTES SUB-NAV */}
      {currentTab === 'routes' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '16px',
            }}
          >
            {routes.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <Navigation size={36} color="#cbd5e1" style={{ marginBottom: '8px' }} />
                <div style={{ fontWeight: 600, color: '#64748b' }}>No delivery routes configured</div>
                <button
                  type="button"
                  onClick={handleOpenCreateRoute}
                  style={{ marginTop: '12px', padding: '8px 16px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  + Add First Delivery Route
                </button>
              </div>
            ) : (
              routes.map((route) => (
                <div
                  key={route.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    padding: '16px 18px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '4px' }}>
                        {route.routeCode}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        {route.customerCount || route.customerIds?.length || 0} customers on route
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
                      {route.routeName}
                    </h3>

                    <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                      {route.description || 'General commercial delivery route'}
                    </p>

                    <div style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                      <div>
                        <strong>Area:</strong> {route.area || 'All Territories'}
                      </div>
                      <div>
                        <strong>Days:</strong> {route.deliveryDays || 'Daily dispatch'}
                      </div>
                      {route.startLocation && (
                        <div>
                          <strong>Terminal:</strong> {route.startLocation} → {route.endLocation || 'End Hub'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEditRoute(route)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: '#334155',
                        cursor: 'pointer',
                      }}
                    >
                      Edit Route & Customers
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: FLEET VEHICLES */}
      {currentTab === 'vehicles' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>PLATE NUMBER</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>MODEL & MAKE</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>TYPE</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>PAYLOAD CAPACITY</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>STATUS</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>NOTES</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>{v.vehicleNumber}</td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>{v.model}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{v.vehicleType}</td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>{v.capacityKg ? `${v.capacityKg} kg` : 'Standard'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        backgroundColor: v.status === 'AVAILABLE' ? '#dcfce7' : v.status === 'ON_DELIVERY' ? '#e0f2fe' : '#fee2e2',
                        color: v.status === 'AVAILABLE' ? '#15803d' : v.status === 'ON_DELIVERY' ? '#0369a1' : '#b91c1c',
                      }}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.78rem' }}>{v.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: CREATE DELIVERY TRIP */}
      {showCreateTripModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck size={22} color="#0284c7" />
                  Schedule Delivery Trip (Warehouse Dispatch)
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                  Assign route, vehicle, two staff crew, and load customer invoices.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateTripModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateDeliveryTrip} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Row 1: Warehouse, Route, Scheduled Date */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                    Origin Warehouse *
                  </label>
                  <select
                    value={newTripForm.warehouseId}
                    onChange={(e) => setNewTripForm({ ...newTripForm, warehouseId: e.target.value })}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                    Delivery Route *
                  </label>
                  <select
                    value={newTripForm.routeId}
                    onChange={(e) => setNewTripForm({ ...newTripForm, routeId: e.target.value })}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                    required
                  >
                    <option value="">Select Route</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.routeCode} - {r.routeName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                    Scheduled Date *
                  </label>
                  <input
                    type="date"
                    value={newTripForm.scheduledDate}
                    onChange={(e) => setNewTripForm({ ...newTripForm, scheduledDate: e.target.value })}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                    required
                  />
                </div>
              </div>

              {/* Row 2: Vehicle & Planned Departure */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                    Select Vehicle *
                  </label>
                  <select
                    value={newTripForm.vehicleId}
                    onChange={(e) => setNewTripForm({ ...newTripForm, vehicleId: e.target.value })}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                    required
                  >
                    <option value="">Select Vehicle</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehicleNumber} ({v.model} - {v.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                    Planned Departure Time ("When it goes")
                  </label>
                  <input
                    type="datetime-local"
                    value={newTripForm.departureTime}
                    onChange={(e) => setNewTripForm({ ...newTripForm, departureTime: e.target.value })}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Two Assigned Staff Members (Required by user requirement) */}
              <div
                style={{
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '8px',
                  padding: '14px',
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0369a1', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={16} />
                  Assigned Crew (Two Staff Members Required for Delivery)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                      Primary Staff 1: Driver *
                    </label>
                    <select
                      value={newTripForm.driverId}
                      onChange={(e) => setNewTripForm({ ...newTripForm, driverId: e.target.value })}
                      style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #93c5fd', padding: '0 10px', fontSize: '0.85rem', backgroundColor: '#ffffff' }}
                      required
                    >
                      <option value="">Select Primary Driver</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fullName || emp.username} ({emp.employeeCode || 'Emp #' + emp.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                      Secondary Staff 2: Delivery Assistant / Helper *
                    </label>
                    <select
                      value={newTripForm.assistantStaffId}
                      onChange={(e) => setNewTripForm({ ...newTripForm, assistantStaffId: e.target.value })}
                      style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #93c5fd', padding: '0 10px', fontSize: '0.85rem', backgroundColor: '#ffffff' }}
                      required
                    >
                      <option value="">Select Delivery Assistant</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fullName || emp.username} ({emp.employeeCode || 'Emp #' + emp.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Invoices Selection List (Warehouse loading) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                    Load Customer Sales Invoices ({pendingInvoices.length} Available in Warehouse) *
                  </label>
                  <div style={{ fontSize: '0.78rem', color: '#0284c7', fontWeight: 600 }}>
                    Selected: {newTripForm.selectedInvoiceIds.length} invoice(s)
                  </div>
                </div>

                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '8px',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  {pendingInvoices.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                      No unassigned completed sales invoices currently ready for delivery.
                    </div>
                  ) : (
                    pendingInvoices.map((inv) => {
                      const isSelected = newTripForm.selectedInvoiceIds.includes(inv.id);
                      return (
                        <label
                          key={inv.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 10px',
                            backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                            borderRadius: '4px',
                            marginBottom: '4px',
                            cursor: 'pointer',
                            border: isSelected ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                            fontSize: '0.82rem',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewTripForm({
                                  ...newTripForm,
                                  selectedInvoiceIds: [...newTripForm.selectedInvoiceIds, inv.id],
                                });
                              } else {
                                setNewTripForm({
                                  ...newTripForm,
                                  selectedInvoiceIds: newTripForm.selectedInvoiceIds.filter((id) => id !== inv.id),
                                });
                              }
                            }}
                          />
                          <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                              <strong>{inv.invoiceNumber}</strong> — {inv.customerName} ({inv.customerCode})
                            </div>
                            <div style={{ fontWeight: 700, color: '#0369a1' }}>
                              ${Number(inv.netTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Notes & Starting Odometer */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                    Starting Odometer (km)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 45210"
                    value={newTripForm.startOdometer}
                    onChange={(e) => setNewTripForm({ ...newTripForm, startOdometer: e.target.value })}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                    Loading / Dispatch Notes
                  </label>
                  <input
                    type="text"
                    placeholder="Special instructions, gate pass #, fragile handling..."
                    value={newTripForm.notes}
                    onChange={(e) => setNewTripForm({ ...newTripForm, notes: e.target.value })}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateTripModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Confirm & Schedule Delivery Trip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DISPATCH TRIP ("When it goes") */}
      {showDispatchModal && selectedTrip && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '480px', width: '100%', padding: '24px', boxShadow: '0 20px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={22} color="#0284c7" />
              Dispatch Delivery Trip: {selectedTrip.deliveryNumber}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '18px' }}>
              Record the vehicle departure time. Assigned invoices will update to <strong>OUT FOR DELIVERY</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Departure Time ("When it goes") *
                </label>
                <input
                  type="datetime-local"
                  value={dispatchForm.departureTime}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, departureTime: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Current Odometer (km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={dispatchForm.startOdometer}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, startOdometer: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDispatch}
                style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: COMPLETE TRIP ("When it returns & trip duration") */}
      {showCompleteModal && selectedTrip && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '480px', width: '100%', padding: '24px', boxShadow: '0 20px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={22} color="#16a34a" />
              Complete Delivery: {selectedTrip.deliveryNumber}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '18px' }}>
              Record return time and finalize trip. All loaded customer invoices will be marked <strong>DELIVERED</strong> and the trip duration will be recorded automatically.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Return Time ("When it returns") *
                </label>
                <input
                  type="datetime-local"
                  value={completeForm.returnTime}
                  onChange={(e) => setCompleteForm({ ...completeForm, returnTime: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Final Odometer (km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={completeForm.endOdometer}
                  onChange={(e) => setCompleteForm({ ...completeForm, endOdometer: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowCompleteModal(false)}
                style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmComplete}
                style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Confirm Return & Deliver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CANCEL TRIP */}
      {showCancelModal && selectedTrip && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '440px', width: '100%', padding: '24px', boxShadow: '0 20px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#b91c1c', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={22} color="#b91c1c" />
              Cancel Delivery Trip
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '16px' }}>
              Are you sure you want to cancel trip <strong>{selectedTrip.deliveryNumber}</strong>? All {selectedTrip.totalInvoicesCount || 0} assigned invoices will revert to <strong>PENDING</strong> so they can be dispatched later.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Cancellation Reason *
              </label>
              <textarea
                rows={3}
                placeholder="Reason for cancellation (e.g. vehicle breakdown, weather, customer request)..."
                value={cancelForm.cancellationReason}
                onChange={(e) => setCancelForm({ cancellationReason: e.target.value })}
                style={{ width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px 10px', fontSize: '0.85rem' }}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                No, Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: PRINTABLE DELIVERY MANIFEST / DISPATCH SHEET */}
      {showManifestModal && selectedTrip && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0284c7', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  DELIVERY DISPATCH MANIFEST
                </h2>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                  Trip Number: <strong>{selectedTrip.deliveryNumber}</strong> | Status: <strong>{selectedTrip.status}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  <Printer size={14} /> Print Sheet
                </button>
                <button
                  type="button"
                  onClick={() => setShowManifestModal(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Trip Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.84rem' }}>
              <div><strong>Route:</strong> {selectedTrip.routeName || 'Direct Route'}</div>
              <div><strong>Vehicle:</strong> {selectedTrip.vehicleNumber} ({selectedTrip.vehicleModel})</div>
              <div><strong>Primary Driver:</strong> {selectedTrip.driverName || 'Staff 1'}</div>
              <div><strong>Delivery Assistant:</strong> {selectedTrip.assistantStaffName || 'Staff 2'}</div>
              <div><strong>Departure ("Goes"):</strong> {formatTimeStr(selectedTrip.departureTime)}</div>
              <div><strong>Return ("Returns"):</strong> {formatTimeStr(selectedTrip.returnTime)}</div>
              <div><strong>Duration:</strong> {formatDuration(selectedTrip.tripDurationMinutes)}</div>
              <div><strong>Total Net Value:</strong> ${Number(selectedTrip.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>

            {/* Invoices list */}
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', margin: '0 0 10px 0' }}>
              Loaded Invoices ({selectedTrip.invoices?.length || selectedTrip.totalInvoicesCount || 0})
            </h4>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '24px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px' }}>Invoice #</th>
                  <th style={{ padding: '8px 10px' }}>Customer Name</th>
                  <th style={{ padding: '8px 10px' }}>Address</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Delivery Status</th>
                </tr>
              </thead>
              <tbody>
                {(selectedTrip.invoices || []).map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0284c7' }}>{inv.invoiceNumber}</td>
                    <td style={{ padding: '8px 10px' }}>{inv.customerName}</td>
                    <td style={{ padding: '8px 10px', color: '#64748b' }}>{inv.address || 'Standard Delivery'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>${Number(inv.netTotal || 0).toFixed(2)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#dcfce7', color: '#15803d' }}>
                        {inv.deliveryStatus || selectedTrip.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signatures */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', paddingTop: '30px', borderTop: '1px dashed #cbd5e1', textAlign: 'center', fontSize: '0.78rem', color: '#64748b' }}>
              <div>
                <div style={{ borderTop: '1px solid #000', paddingTop: '6px', fontWeight: 600 }}>Warehouse Dispatcher</div>
              </div>
              <div>
                <div style={{ borderTop: '1px solid #000', paddingTop: '6px', fontWeight: 600 }}>Driver Signature</div>
              </div>
              <div>
                <div style={{ borderTop: '1px solid #000', paddingTop: '6px', fontWeight: 600 }}>Assistant Signature</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: CREATE / EDIT DELIVERY ROUTE */}
      {showRouteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '580px', width: '100%', padding: '24px', boxShadow: '0 20px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {routeForm.id ? 'Edit Delivery Route' : 'Create Delivery Route'}
              </h3>
              <button type="button" onClick={() => setShowRouteModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveRoute} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Route Code</label>
                  <input
                    type="text"
                    placeholder="e.g. DR-001"
                    value={routeForm.routeCode}
                    onChange={(e) => setRouteForm({ ...routeForm, routeCode: e.target.value })}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Route Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Southern Coastal Express"
                    value={routeForm.routeName}
                    onChange={(e) => setRouteForm({ ...routeForm, routeName: e.target.value })}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Area / Province</label>
                <input
                  type="text"
                  placeholder="e.g. Western Province / Southern Highway"
                  value={routeForm.area}
                  onChange={(e) => setRouteForm({ ...routeForm, area: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Delivery Days</label>
                <input
                  type="text"
                  placeholder="e.g. Monday, Wednesday, Friday"
                  value={routeForm.deliveryDays}
                  onChange={(e) => setRouteForm({ ...routeForm, deliveryDays: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Route coverage details and drop off notes..."
                  value={routeForm.description}
                  onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })}
                  style={{ width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px 10px', fontSize: '0.85rem' }}
                />
              </div>

              {/* Assign Customers to this Route */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Assign Customers along this Route ({routeForm.customerIds?.length || 0} assigned)
                </label>
                <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px', backgroundColor: '#f8fafc' }}>
                  {customers.map((c) => {
                    const isChecked = routeForm.customerIds.includes(c.id);
                    return (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRouteForm({ ...routeForm, customerIds: [...routeForm.customerIds, c.id] });
                            } else {
                              setRouteForm({ ...routeForm, customerIds: routeForm.customerIds.filter(id => id !== c.id) });
                            }
                          }}
                        />
                        <span>{c.name} ({c.customerCode || c.code}) - {c.address || 'No address'}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowRouteModal(false)}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: CREATE VEHICLE */}
      {showVehicleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '440px', width: '100%', padding: '24px', boxShadow: '0 20px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 16px 0' }}>
              Add Delivery Fleet Vehicle
            </h3>
            <form onSubmit={handleSaveVehicle} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Plate Number *</label>
                <input
                  type="text"
                  placeholder="e.g. WP-CAB-4821"
                  value={vehicleForm.vehicleNumber}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleNumber: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Model & Make *</label>
                <input
                  type="text"
                  placeholder="e.g. Isuzu Elf 4-Ton Truck"
                  value={vehicleForm.model}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Type</label>
                  <select
                    value={vehicleForm.vehicleType}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleType: e.target.value })}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.85rem' }}
                  >
                    <option value="TRUCK">TRUCK</option>
                    <option value="LORRY">LORRY</option>
                    <option value="VAN">VAN</option>
                    <option value="MOTORCYCLE">MOTORCYCLE</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Payload Capacity (kg)</label>
                  <input
                    type="number"
                    placeholder="e.g. 4000"
                    value={vehicleForm.capacityKg}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, capacityKg: e.target.value })}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Notes</label>
                <input
                  type="text"
                  placeholder="Condition, registration expiration..."
                  value={vehicleForm.notes}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Register Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
