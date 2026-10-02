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
  Info,
  Radio,
  Compass,
  Wifi,
  Layers,
  Activity,
  Download,
} from 'lucide-react';
import { deliveryApi, deliveryRouteApi, vehicleApi, salesApi, customerGroupApi, printPdfDocument } from '../api/apiClient';
import api from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { canEditModule } from '../utils/permissionUtils';

export default function DeliveryHub({ activeSubTab = 'deliveries' }) {
  const { user } = useAuth();
  const canEditDelivery = canEditModule(user, 'DELIVERY');
  // Primary Tabs: 'deliveries' | 'routes' | 'vehicles' | 'gps-tracking'
  const [currentTab, setCurrentTab] = useState(activeSubTab || 'deliveries');

  useEffect(() => {
    if (activeSubTab) {
      if (activeSubTab === 'routes') setCurrentTab('routes');
      else if (activeSubTab === 'vehicles') setCurrentTab('vehicles');
      else if (activeSubTab === 'gps-tracking') setCurrentTab('gps-tracking');
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

  // Route Form State (matching CustomersHub Customer Groups system)
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [routeEditForm, setRouteEditForm] = useState({
    id: null,
    name: '',
    routeCode: '',
    description: '',
    area: '',
    deliveryDays: 'Monday, Wednesday, Friday',
    assignedStaffId: '',
    selectedCustomerIds: [],
  });
  const [customerSearchInRoute, setCustomerSearchInRoute] = useState('');
  const [showAssignCustomerModal, setShowAssignCustomerModal] = useState(false);
  const [assignCustomerSearch, setAssignCustomerSearch] = useState('');
  const [routeSearchTerm, setRouteSearchTerm] = useState('');

  // Keep routeForm as compatibility alias
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

      const rawRoutes = routesRes.data?.data || routesRes.data || [];
      const normalizedRoutes = (Array.isArray(rawRoutes) ? rawRoutes : []).map((r) => ({
        id: r.id,
        routeCode: r.routeCode || '',
        routeName: r.routeName || r.name || '',
        name: r.routeName || r.name || '',
        description: r.description || '',
        area: r.area || '',
        deliveryDays: r.deliveryDays || '',
        startLocation: r.startLocation || '',
        endLocation: r.endLocation || '',
        assignedStaffId: r.assignedStaffId ? String(r.assignedStaffId) : '',
        assignedStaffName: r.assignedStaffName || '',
        salesmanId: r.assignedStaffId ? String(r.assignedStaffId) : '',
        salesmanName: r.assignedStaffName || '',
        customerCount: r.customerCount != null ? r.customerCount : ((r.customerIds || []).length),
        customerIds: (r.customerIds || []).map(String),
        createdAt: r.createdAt || '',
      }));
      setRoutes(normalizedRoutes);

      setVehicles(vehRes.data?.data || []);
      setSummary(sumRes.data?.data || null);

      const rawUsers = usersRes.data?.data?.content || usersRes.data?.data || usersRes.data?.content || usersRes.data || [];
      const userList = Array.isArray(rawUsers) ? rawUsers : [];
      setEmployees(userList.filter((u) => u.isActive !== false));

      const wList = whRes.data?.data || whRes.data || [];
      setWarehouses(Array.isArray(wList) ? wList : []);

      const cList = custRes.data?.data || custRes.data || [];
      setCustomers(Array.isArray(cList) ? cList : []);
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

  // -------------------------------------------------------------
  // Route / Group Management Actions (matching CustomersHub System)
  // -------------------------------------------------------------
  const isCustomerActive = (c) => Boolean(c?.isActive ?? c?.active ?? true);

  // Filtered Routes based on route search term
  const filteredRoutes = useMemo(() => {
    const q = routeSearchTerm.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter((r) => {
      const assignedStaff = employees.find((s) => String(s.id) === String(r.assignedStaffId || r.salesmanId));
      const repName = (r.assignedStaffName || r.salesmanName || assignedStaff?.fullName || assignedStaff?.name || '').toLowerCase();
      const name = (r.routeName || r.name || '').toLowerCase();
      const code = (r.routeCode || '').toLowerCase();
      const desc = (r.description || '').toLowerCase();
      const area = (r.area || '').toLowerCase();
      const days = (r.deliveryDays || '').toLowerCase();
      return name.includes(q) || code.includes(q) || repName.includes(q) || desc.includes(q) || area.includes(q) || days.includes(q);
    });
  }, [routes, routeSearchTerm, employees]);

  // Assigned customers memo for Route View
  const assignedCustomerList = useMemo(() => {
    if (!selectedRoute && !isCreatingRoute) return [];
    const selectedSet = new Set((routeEditForm.selectedCustomerIds || []).map((id) => String(id)));
    let list = customers.filter((c) => selectedSet.has(String(c.id)));
    if (customerSearchInRoute.trim()) {
      const q = customerSearchInRoute.trim().toLowerCase();
      list = list.filter(
        (c) =>
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.code && c.code.toLowerCase().includes(q)) ||
          (c.customerCode && c.customerCode.toLowerCase().includes(q)) ||
          (c.phone && c.phone.toLowerCase().includes(q)) ||
          (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
          (c.address && c.address.toLowerCase().includes(q))
      );
    }
    return list;
  }, [customers, routeEditForm.selectedCustomerIds, customerSearchInRoute, selectedRoute, isCreatingRoute]);

  // Available customers for Assign Customer popup
  const availableCustomersToAssign = useMemo(() => {
    if (!showAssignCustomerModal) return [];
    const q = assignCustomerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.customerCode && c.customerCode.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }, [customers, assignCustomerSearch, showAssignCustomerModal]);

  const handleOpenRouteView = (route) => {
    setSelectedRoute(route);
    setIsCreatingRoute(false);
    setRouteEditForm({
      id: route.id,
      name: route.routeName || route.name || '',
      routeCode: route.routeCode || '',
      description: route.description || '',
      area: route.area || '',
      deliveryDays: route.deliveryDays || 'Monday, Wednesday, Friday',
      assignedStaffId: route.assignedStaffId ? String(route.assignedStaffId) : '',
      selectedCustomerIds: (route.customerIds || []).map(String),
    });
    setCustomerSearchInRoute('');
    setShowAssignCustomerModal(false);
    setAssignCustomerSearch('');
  };

  const handleOpenCreateRouteView = () => {
    setSelectedRoute(null);
    setIsCreatingRoute(true);
    setRouteEditForm({
      id: null,
      name: '',
      routeCode: '',
      description: '',
      area: '',
      deliveryDays: 'Monday, Wednesday, Friday',
      assignedStaffId: '',
      selectedCustomerIds: [],
    });
    setCustomerSearchInRoute('');
    setShowAssignCustomerModal(false);
    setAssignCustomerSearch('');
  };

  const handleCloseRouteView = () => {
    setSelectedRoute(null);
    setIsCreatingRoute(false);
    setCustomerSearchInRoute('');
    setShowAssignCustomerModal(false);
    setAssignCustomerSearch('');
  };

  const handleSaveRouteView = async (e) => {
    if (e) e.preventDefault();
    if (!isCreatingRoute && !canEditDelivery) {
      showToast('Permission denied: Only authorized staff can edit existing delivery routes.', 'error');
      return;
    }
    if (!routeEditForm.name.trim()) {
      showToast('Delivery route name is required', 'error');
      return;
    }

    const assignedStaff = employees.find((em) => String(em.id) === String(routeEditForm.assignedStaffId));
    const staffName = assignedStaff?.fullName || assignedStaff?.name || '';
    const staffIdNum = routeEditForm.assignedStaffId ? Number(routeEditForm.assignedStaffId) : null;
    const customerIdsNum = (routeEditForm.selectedCustomerIds || []).map((id) => Number(id)).filter(Boolean);

    const payload = {
      routeName: routeEditForm.name.trim(),
      name: routeEditForm.name.trim(),
      routeCode: routeEditForm.routeCode ? routeEditForm.routeCode.trim() : undefined,
      description: routeEditForm.description ? routeEditForm.description.trim() : '',
      area: routeEditForm.area ? routeEditForm.area.trim() : '',
      deliveryDays: routeEditForm.deliveryDays ? routeEditForm.deliveryDays.trim() : '',
      assignedStaffId: staffIdNum,
      customerIds: customerIdsNum,
    };

    try {
      if (isCreatingRoute) {
        const res = await deliveryRouteApi.create(payload);
        const created = res.data?.data || res.data || res;
        const normalized = {
          id: created.id,
          name: created.routeName || created.name,
          routeName: created.routeName || created.name,
          routeCode: created.routeCode || '',
          description: created.description || '',
          area: created.area || routeEditForm.area,
          deliveryDays: created.deliveryDays || routeEditForm.deliveryDays,
          assignedStaffId: created.assignedStaffId ? String(created.assignedStaffId) : (staffIdNum ? String(staffIdNum) : ''),
          assignedStaffName: created.assignedStaffName || staffName,
          salesmanId: created.assignedStaffId ? String(created.assignedStaffId) : (staffIdNum ? String(staffIdNum) : ''),
          salesmanName: created.assignedStaffName || staffName,
          customerCount: created.customerCount != null ? created.customerCount : customerIdsNum.length,
          customerIds: (created.customerIds || customerIdsNum).map(String),
          createdAt: created.createdAt || new Date().toISOString(),
        };
        setRoutes((prev) => [...prev, normalized]);
        showToast(`Delivery route "${normalized.name}" created successfully!`, 'success');
      } else if (selectedRoute) {
        const res = await deliveryRouteApi.update(selectedRoute.id, payload);
        const updated = res.data?.data || res.data || res;
        const normalized = {
          id: updated.id,
          name: updated.routeName || updated.name,
          routeName: updated.routeName || updated.name,
          routeCode: updated.routeCode || '',
          description: updated.description || '',
          area: updated.area || routeEditForm.area,
          deliveryDays: updated.deliveryDays || routeEditForm.deliveryDays,
          assignedStaffId: updated.assignedStaffId ? String(updated.assignedStaffId) : (staffIdNum ? String(staffIdNum) : ''),
          assignedStaffName: updated.assignedStaffName || staffName,
          salesmanId: updated.assignedStaffId ? String(updated.assignedStaffId) : (staffIdNum ? String(staffIdNum) : ''),
          salesmanName: updated.assignedStaffName || staffName,
          customerCount: updated.customerCount != null ? updated.customerCount : customerIdsNum.length,
          customerIds: (updated.customerIds || customerIdsNum).map(String),
          createdAt: selectedRoute.createdAt || new Date().toISOString(),
        };
        setRoutes((prev) => prev.map((r) => (r.id === selectedRoute.id ? normalized : r)));
        showToast(`Delivery route "${normalized.name}" updated successfully!`, 'success');
      }
      handleCloseRouteView();
      fetchData();
    } catch (err) {
      showToast('Error saving delivery route: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  const handleExportRoutesCSV = () => {
    if (routes.length === 0) {
      showToast('No delivery routes to export', 'error');
      return;
    }
    const headers = ['Route Name', 'Route Code', 'Assigned Staff', 'Area', 'Delivery Days', 'Total Customers', 'Description'];
    const rows = (filteredRoutes.length > 0 ? filteredRoutes : routes).map((r) => {
      const assignedStaff = employees.find((e) => String(e.id) === String(r.assignedStaffId || r.salesmanId));
      const staffName = r.assignedStaffName || assignedStaff?.fullName || assignedStaff?.name || 'Unassigned';
      const count = r.customerIds?.length || r.customerCount || 0;
      return [
        `"${(r.routeName || r.name || '').replace(/"/g, '""')}"`,
        `"${(r.routeCode || '').replace(/"/g, '""')}"`,
        `"${staffName.replace(/"/g, '""')}"`,
        `"${(r.area || '').replace(/"/g, '""')}"`,
        `"${(r.deliveryDays || '').replace(/"/g, '""')}"`,
        count,
        `"${(r.description || '').replace(/"/g, '""')}"`,
      ];
    });
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `delivery_routes_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Delivery routes exported to CSV', 'success');
  };

  // Compatibility aliases
  const handleOpenCreateRoute = () => handleOpenCreateRouteView();
  const handleOpenEditRoute = (r) => handleOpenRouteView(r);
  const handleSaveRoute = handleSaveRouteView;

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
    <div
      style={{
        padding: '24px 32px',
        flex: 1,
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#f8fafc',
        fontFamily: "var(--font-sans, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
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

      {/* Page Header (Fixed / Sticky to Desktop Screen - Matching CustomersHub) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px',
          flexShrink: 0,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#0f172a',
              margin: '0 0 4px 0',
              letterSpacing: '-0.02em',
            }}
          >
            Delivery Management
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
            Dispatch warehouse orders, assign delivery staff and vehicles, plan delivery routes, and track vehicle trips.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchData}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={15} /> Refresh
          </button>

          {currentTab === 'deliveries' && (
            <button
              type="button"
              onClick={handleOpenCreateTrip}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.88rem',
                padding: '9px 18px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Plus size={17} /> Schedule Delivery Trip
            </button>
          )}

          {currentTab === 'routes' && (
            <button
              type="button"
              onClick={handleOpenCreateRouteView}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.88rem',
                padding: '9px 18px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Plus size={17} /> Create Delivery Route
            </button>
          )}

          {currentTab === 'vehicles' && (
            <button
              type="button"
              onClick={handleOpenCreateVehicle}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.88rem',
                padding: '9px 18px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Plus size={17} /> Add Vehicle
            </button>
          )}
        </div>
      </div>

      {/* Subtabs Bar (Underline Style matching CustomersHub - Fixed / Sticky) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '16px',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => setCurrentTab('deliveries')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: currentTab === 'deliveries' ? '2.5px solid #0284c7' : '2.5px solid transparent',
            padding: '10px 4px',
            fontSize: '0.92rem',
            fontWeight: currentTab === 'deliveries' ? 700 : 500,
            color: currentTab === 'deliveries' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-1px',
          }}
        >
          <Truck size={16} /> Delivery Trips ({deliveries.length})
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('routes')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: currentTab === 'routes' ? '2.5px solid #0284c7' : '2.5px solid transparent',
            padding: '10px 4px',
            fontSize: '0.92rem',
            fontWeight: currentTab === 'routes' ? 700 : 500,
            color: currentTab === 'routes' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-1px',
          }}
        >
          <Navigation size={16} /> Delivery Routes ({routes.length})
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('vehicles')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: currentTab === 'vehicles' ? '2.5px solid #0284c7' : '2.5px solid transparent',
            padding: '10px 4px',
            fontSize: '0.92rem',
            fontWeight: currentTab === 'vehicles' ? 700 : 500,
            color: currentTab === 'vehicles' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-1px',
          }}
        >
          <Gauge size={16} /> Fleet Vehicles ({vehicles.length})
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('gps-tracking')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: currentTab === 'gps-tracking' ? '2.5px solid #0284c7' : '2.5px solid transparent',
            padding: '10px 4px',
            fontSize: '0.92rem',
            fontWeight: currentTab === 'gps-tracking' ? 700 : 500,
            color: currentTab === 'gps-tracking' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-1px',
          }}
        >
          <Radio size={16} color={currentTab === 'gps-tracking' ? '#0284c7' : '#64748b'} />
          Live GPS Tracking
          <span
            style={{
              fontSize: '0.66rem',
              fontWeight: 800,
              backgroundColor: currentTab === 'gps-tracking' ? '#e0f2fe' : '#f1f5f9',
              color: currentTab === 'gps-tracking' ? '#0284c7' : '#64748b',
              border: `1px solid ${currentTab === 'gps-tracking' ? '#bae6fd' : '#cbd5e1'}`,
              borderRadius: '9999px',
              padding: '2px 8px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Coming Soon
          </span>
        </button>
      </div>

      {/* TAB 1: DELIVERIES LIST */}
      {currentTab === 'deliveries' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
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

                            {/* Live GPS Track (Coming Soon) */}
                            {isInTransit && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentTab('gps-tracking');
                                  showToast(`Live GPS tracking for trip ${trip.tripNumber || ''} is in preview. Feature coming soon!`, 'info');
                                }}
                                style={{
                                  backgroundColor: '#f0f9ff',
                                  color: '#0284c7',
                                  border: '1px solid #bae6fd',
                                  borderRadius: '4px',
                                  padding: '5px 8px',
                                  fontSize: '0.76rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Live GPS Tracking (Coming Soon)"
                              >
                                <Radio size={12} color="#0284c7" /> Track
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

      {/* TAB 2: DELIVERY ROUTES (MATCHING CUSTOMER GROUPS UI) */}
      {currentTab === 'routes' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Header row with Title, subtitle and Create Route button */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px',
              flexWrap: 'wrap',
              gap: '12px',
              flexShrink: 0,
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
                Delivery Routes
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.86rem', margin: 0 }}>
                Organize delivery destinations into routes and assign a dedicated staff member to manage each route.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateRouteView}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '9px 18px',
                fontWeight: 600,
                fontSize: '0.88rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
            >
              <Plus size={16} /> Create Delivery Route
            </button>
          </div>

          {/* Routes Toolbar: Search Input + Export CSV Icon */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            {/* Search bar filling width */}
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search
                size={17}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '11px',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search delivery routes by name, code, assigned staff, area..."
                value={routeSearchTerm}
                onChange={(e) => setRouteSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 38px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0284c7';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(2, 132, 199, 0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.02)';
                }}
              />
              {routeSearchTerm && (
                <button
                  type="button"
                  onClick={() => setRouteSearchTerm('')}
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
                  title="Clear search text"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Right Controls: Export CSV Icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleExportRoutesCSV}
                style={{
                  height: '38px',
                  width: '38px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: 0,
                  color: '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#64748b';
                }}
                title="Export delivery routes to CSV"
              >
                <Download size={15} />
              </button>
            </div>
          </div>

          {/* Routes Cards Grid Scroll Container (Only cards scroll) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '14px',
                paddingBottom: '16px',
              }}
            >
              {filteredRoutes.length === 0 ? (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    textAlign: 'center',
                    padding: '48px 20px',
                    color: '#64748b',
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.875rem',
                  }}
                >
                  No delivery routes found matching current search.
                </div>
              ) : (
                filteredRoutes.map((route) => {
                  const count = route.customerIds?.length || route.customerCount || 0;
                  const assignedStaff = employees.find((s) => String(s.id) === String(route.assignedStaffId || route.salesmanId));
                  const repName = route.assignedStaffName || route.salesmanName || assignedStaff?.fullName || assignedStaff?.name;

                  return (
                    <div
                      key={route.id}
                      onClick={() => handleOpenRouteView(route)}
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        padding: '16px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                        minHeight: '140px',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#0284c7';
                        e.currentTarget.style.boxShadow = '0 4px 14px rgba(2, 132, 199, 0.12)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                      }}
                    >
                      <div>
                        {/* Card Top: Route Name & User Count Badge */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {route.routeName || route.name}
                            </h3>
                            {route.routeCode && (
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  backgroundColor: '#f1f5f9',
                                  color: '#475569',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontFamily: 'monospace',
                                  flexShrink: 0,
                                }}
                              >
                                {route.routeCode}
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: '#f0f9ff',
                              color: '#0284c7',
                              border: '1px solid #bae6fd',
                              borderRadius: '9999px',
                              padding: '2px 8px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            <Users size={12} />
                            {count} customer{count === 1 ? '' : 's'}
                          </div>
                        </div>

                        {/* Description */}
                        <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                          {route.description || 'No description added'}
                        </p>

                        {/* Area & Delivery Days Info */}
                        {(route.area || route.deliveryDays) && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px', fontSize: '0.75rem', color: '#64748b' }}>
                            {route.area && (
                              <span style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '1px 6px', borderRadius: '4px' }}>
                                <strong>Area:</strong> {route.area}
                              </span>
                            )}
                            {route.deliveryDays && (
                              <span style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '1px 6px', borderRadius: '4px' }}>
                                <strong>Days:</strong> {route.deliveryDays}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Responsible Staff */}
                        <p
                          style={{
                            color: repName ? '#0369a1' : '#64748b',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            margin: '0 0 12px 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <UserCheck size={14} color={repName ? '#0284c7' : '#94a3b8'} />
                          {repName ? `Assigned Staff: ${repName}` : 'No staff member assigned'}
                        </p>
                      </div>

                      {/* Card Footer: Manage link */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingTop: '10px',
                          borderTop: '1px solid #f1f5f9',
                        }}
                      >
                        <span style={{ fontSize: '0.82rem', color: '#0284c7', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Manage Delivery Route →
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
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

      {/* TAB 4: LIVE GPS FLEET TRACKING (COMING SOON PREVIEW) */}
      {currentTab === 'gps-tracking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Banner */}
          <div
            style={{
              backgroundColor: '#0f172a',
              color: '#ffffff',
              borderRadius: '12px',
              padding: '24px 28px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Background glowing gradient accents */}
            <div
              style={{
                position: 'absolute',
                top: '-60px',
                right: '-60px',
                width: '220px',
                height: '220px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(2, 132, 199, 0.35) 0%, rgba(2, 132, 199, 0) 70%)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '-40px',
                left: '20%',
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0) 70%)',
                pointerEvents: 'none',
              }}
            />

            <div style={{ position: 'relative', zIndex: 1, maxWidth: '680px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Feature Preview
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#4ade80',
                    border: '1px solid rgba(74, 222, 128, 0.3)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '9999px',
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: '#22c55e',
                      boxShadow: '0 0 6px #22c55e',
                    }}
                  />
                  TELEMETRY ENGINE READY
                </span>
              </div>

              <h2 style={{ margin: '0 0 8px 0', fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Radio size={24} color="#38bdf8" />
                Live Fleet GPS Tracking & Telemetry
              </h2>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem', lineHeight: '1.5' }}>
                Track delivery vehicles in real-time, view live breadcrumb route trails, monitor driver speeds, and receive automated geofenced arrival alerts as staff reach customer shops.
              </p>
            </div>

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rollout Status</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#38bdf8' }}>Scheduled for Upcoming Release</div>
                </div>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(2, 132, 199, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38bdf8',
                  }}
                >
                  <MapPin size={20} />
                </div>
              </div>

              <button
                type="button"
                onClick={() => showToast('GPS Fleet Tracking is scheduled on your roadmap. Architecture and backend endpoints ready!', 'success')}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
              >
                <CheckCircle2 size={14} /> Coming Soon (Prioritized)
              </button>
            </div>
          </div>

          {/* Interactive Simulated Live Fleet Tracking Control Canvas */}
          <div
            style={{
              backgroundColor: '#0b1329',
              borderRadius: '12px',
              border: '1px solid #1e293b',
              padding: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Control Bar Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #1e293b', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(2, 132, 199, 0.2)',
                    color: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Activity size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f8fafc' }}>
                    Active Route Telemetry Preview • Trip #TRIP-2026-004
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Live Simulated GPS Feed • Carrier: WP-NA-4491 (Toyota Dyna 3-Ton)
                  </div>
                </div>
              </div>

              {/* Status Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#94a3b8',
                    border: '1px solid #334155',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Wifi size={13} color="#22c55e" /> GPS Fix: 3D High Accuracy (11 Sats)
                </span>
                <span
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#94a3b8',
                    border: '1px solid #334155',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Compass size={13} color="#38bdf8" /> Heading: 68° ENE
                </span>
                <span
                  style={{
                    backgroundColor: 'rgba(2, 132, 199, 0.15)',
                    color: '#38bdf8',
                    border: '1px solid #0284c7',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                  }}
                >
                  Speed: 42 km/h
                </span>
              </div>
            </div>

            {/* Simulated Tactical Map Canvas */}
            <div
              style={{
                height: '380px',
                width: '100%',
                borderRadius: '10px',
                backgroundColor: '#0a0f1d',
                border: '1px solid #1e293b',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* SVG Map Grid & City Streets Simulation */}
              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.6 }}>
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.8" />
                  </pattern>
                  <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0284c7" />
                    <stop offset="50%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Simulated Arterial Roads */}
                <path d="M 50 200 Q 250 120 480 180 T 780 150 T 1100 240" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
                <path d="M 200 40 Q 280 180 320 340" fill="none" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" />
                <path d="M 600 50 Q 640 180 700 350" fill="none" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" />
                <path d="M 400 320 Q 700 280 1000 310" fill="none" stroke="#1e293b" strokeWidth="5" strokeLinecap="round" />

                {/* Traveled Route Path (Solid Blue) */}
                <path
                  d="M 120 180 Q 250 130 380 160 T 560 170"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="4"
                  strokeLinecap="round"
                />

                {/* Remaining Planned Route Path (Dashed Cyan) */}
                <path
                  d="M 560 170 Q 700 150 820 210 T 960 190"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3"
                  strokeDasharray="6,6"
                  strokeLinecap="round"
                />

                {/* Geofence Perimeter Around Next Stop */}
                <circle cx="820" cy="210" r="42" fill="rgba(56, 189, 248, 0.08)" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3" />
              </svg>

              {/* Waypoint Pin 1: Origin Warehouse */}
              <div
                style={{
                  position: 'absolute',
                  left: '100px',
                  top: '150px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    marginBottom: '4px',
                    border: '1px solid #334155',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Central Warehouse (Start 08:30)
                </div>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 12px rgba(2, 132, 199, 0.8)',
                  }}
                >
                  <Building2 size={14} />
                </div>
              </div>

              {/* Waypoint Pin 2: Customer Stop 1 (Delivered) */}
              <div
                style={{
                  position: 'absolute',
                  left: '360px',
                  top: '130px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'rgba(22, 163, 74, 0.9)',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    marginBottom: '4px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ✓ Stop 1: Cargills Food City (Delivered)
                </div>
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 8px rgba(22, 163, 74, 0.6)',
                  }}
                >
                  <Check size={12} />
                </div>
              </div>

              {/* Animated Live Vehicle Marker (Currently on Road) */}
              <div
                style={{
                  position: 'absolute',
                  left: '540px',
                  top: '135px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  zIndex: 10,
                }}
              >
                {/* Live Vehicle Telemetry Popover */}
                <div
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #38bdf8',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#ffffff',
                    fontSize: '0.74rem',
                    marginBottom: '6px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: '#38bdf8' }}>
                    <Truck size={13} />
                    <span>WP-NA-4491 • Moving (42 km/h)</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>
                    Driver: Kamal Perera • Next: Keells Super (ETA 6m)
                  </div>
                </div>

                {/* Pulsing Radar Ring & Truck Dot */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div
                    style={{
                      position: 'absolute',
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(56, 189, 248, 0.25)',
                      animation: 'ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite',
                    }}
                  />
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#38bdf8',
                      color: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 16px #38bdf8',
                      zIndex: 2,
                    }}
                  >
                    <Truck size={17} />
                  </div>
                </div>
              </div>

              {/* Waypoint Pin 3: Customer Stop 2 (Approaching Next) */}
              <div
                style={{
                  position: 'absolute',
                  left: '800px',
                  top: '180px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'rgba(234, 88, 12, 0.9)',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    marginBottom: '4px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Stop 2: Keells Super (Next - 1.8 km)
                </div>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#ea580c',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 10px rgba(234, 88, 12, 0.7)',
                  }}
                >
                  <MapPin size={13} />
                </div>
              </div>

              {/* Waypoint Pin 4: Final Stop (Pending) */}
              <div
                style={{
                  position: 'absolute',
                  left: '940px',
                  top: '160px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#334155',
                    color: '#94a3b8',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    marginBottom: '4px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Stop 3: City Mart (Pending)
                </div>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#475569',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MapPin size={11} />
                </div>
              </div>

              {/* Map Floating HUD Info Card */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  left: '16px',
                  backgroundColor: 'rgba(15, 23, 42, 0.88)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  gap: '16px',
                  fontSize: '0.74rem',
                  color: '#cbd5e1',
                }}
              >
                <div>
                  <span style={{ color: '#64748b' }}>Route:</span> <strong>Colombo Metro North</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Progress:</span> <strong style={{ color: '#22c55e' }}>1 / 3 Delivered (33%)</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Elapsed:</span> <strong>1h 14m</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Remaining ETA:</span> <strong>~45 mins</strong>
                </div>
              </div>
            </div>

            {/* Bottom 3 Capability Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '14px',
                marginTop: '4px',
              }}
            >
              <div
                style={{
                  backgroundColor: '#111c38',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: 700, fontSize: '0.86rem' }}>
                  <Wifi size={16} /> Driver Mobile GPS ($0 Hardware Cost)
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.45 }}>
                  Delivery drivers simply open the delivery link on their smartphone. Phone automatically transmits GPS coordinates every 20 seconds during the active trip.
                </p>
              </div>

              <div
                style={{
                  backgroundColor: '#111c38',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80', fontWeight: 700, fontSize: '0.86rem' }}>
                  <Radio size={16} /> OBD-II / Hardwired Vehicle GPS
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.45 }}>
                  Integrates with standard 4G vehicle GPS trackers. Tamper-proof 24/7 fleet location, vehicle battery, ignition status, and odometer logging.
                </p>
              </div>

              <div
                style={{
                  backgroundColor: '#111c38',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: 700, fontSize: '0.86rem' }}>
                  <Navigation size={16} /> Geofencing & Proof of Delivery
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.45 }}>
                  Detects when vehicles enter within 150m of a customer shop. Delivery reps can collect signatures and photo receipts directly on-site.
                </p>
              </div>
            </div>
          </div>
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

      {/* ------------------------------------------------------------- */}
      {/* MODAL 6: DELIVERY ROUTE VIEW POPUP (SPLIT 2 COLUMNS)          */}
      {/* ------------------------------------------------------------- */}
      {(selectedRoute || isCreatingRoute) && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '1040px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 35px -8px rgba(15, 23, 42, 0.2), 0 10px 15px -6px rgba(15, 23, 42, 0.08)',
              height: 'min(640px, 86vh)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '14px 22px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  {isCreatingRoute ? 'Create Delivery Route' : `Manage Delivery Route: ${routeEditForm.name}`}
                </h3>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: '#f0f9ff',
                    color: '#0284c7',
                    border: '1px solid #bae6fd',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                  }}
                >
                  {routeEditForm.selectedCustomerIds.length} Assigned
                </span>
              </div>
              <button
                type="button"
                onClick={handleCloseRouteView}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Split into Two Columns */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(280px, 340px) 1fr',
                gap: '20px',
                padding: '18px 22px',
                overflow: 'hidden',
                flex: 1,
                minHeight: 0,
              }}
            >
              {/* LEFT COLUMN: Text Fields & Settings (Sticky/Fixed - No Scroll) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  overflowY: 'auto',
                }}
              >
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: '14px' }}>
                    Delivery Route Details
                  </div>

                  {/* Route Code Input */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                      Route Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DR-001"
                      value={routeEditForm.routeCode}
                      onChange={(e) => setRouteEditForm({ ...routeEditForm, routeCode: e.target.value })}
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Route Name Input */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                      Route Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Colombo Western Corridor"
                      value={routeEditForm.name}
                      onChange={(e) => setRouteEditForm({ ...routeEditForm, name: e.target.value })}
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Responsible Staff Dropdown */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                      Assigned Staff Member / Driver
                    </label>
                    <select
                      value={routeEditForm.assignedStaffId}
                      onChange={(e) => setRouteEditForm({ ...routeEditForm, assignedStaffId: e.target.value })}
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 28px 0 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 10px center',
                      }}
                    >
                      <option value="">None (Unassigned)</option>
                      {employees.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullName || s.name} {s.role ? `— ${s.role}` : (s.employeeCode ? `(${s.employeeCode})` : '')}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Area / Territory */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                      Territory / Area
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Western Province / Colombo 01-15"
                      value={routeEditForm.area}
                      onChange={(e) => setRouteEditForm({ ...routeEditForm, area: e.target.value })}
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Delivery Days */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                      Delivery Days
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Monday, Wednesday, Friday"
                      value={routeEditForm.deliveryDays}
                      onChange={(e) => setRouteEditForm({ ...routeEditForm, deliveryDays: e.target.value })}
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Description Input */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                      Route Description / Notes
                    </label>
                    <textarea
                      rows="3"
                      placeholder="e.g. Daily wholesale distribution to supermarkets and convenience stores"
                      value={routeEditForm.description}
                      onChange={(e) => setRouteEditForm({ ...routeEditForm, description: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.86rem',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Assigned Customers Table & Workspace */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  minHeight: 0,
                  height: '100%',
                }}
              >
                {/* Top Row: Small Route Summary on Table Side & Assign Customer Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  {/* Small Route Summary */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                      Route Summary:
                    </span>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        backgroundColor: '#f0f9ff',
                        color: '#0284c7',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        border: '1px solid #bae6fd',
                      }}
                    >
                      {routeEditForm.selectedCustomerIds.length} Assigned Customer{routeEditForm.selectedCustomerIds.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* Assign Customer Button (Opens Small Popup) */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignCustomerModal(true);
                      setAssignCustomerSearch('');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0 14px',
                      height: '34px',
                      borderRadius: '6px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(2, 132, 199, 0.25)',
                      transition: 'background-color 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
                  >
                    <Plus size={14} /> Assign Customer
                  </button>
                </div>

                {/* Table Side Search with Small Icon */}
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '10px',
                      color: '#94a3b8',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search assigned customers..."
                    value={customerSearchInRoute}
                    onChange={(e) => setCustomerSearchInRoute(e.target.value)}
                    style={{
                      width: '100%',
                      height: '34px',
                      padding: '0 28px 0 30px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.82rem',
                      backgroundColor: '#ffffff',
                      boxSizing: 'border-box',
                    }}
                  />
                  {customerSearchInRoute && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearchInRoute('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '8px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94a3b8',
                        padding: 0,
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Assigned Customers Table Container */}
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#ffffff',
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#f8fafc' }}>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px', fontWeight: 600 }}>Customer</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600 }}>Contact / Phone</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600 }}>Status</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignedCustomerList.length === 0 ? (
                          <tr>
                            <td colSpan="4" style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                <Users size={28} color="#cbd5e1" />
                                <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.86rem' }}>
                                  {customerSearchInRoute ? 'No matching assigned customers found' : 'No customers assigned yet'}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                  {customerSearchInRoute
                                    ? 'Try adjusting your search query above.'
                                    : 'Click the "Assign Customer" button above to search and add customers to this route.'}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          assignedCustomerList.map((c) => (
                            <tr
                              key={c.id}
                              style={{ borderBottom: '1px solid #f1f5f9' }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div
                                    style={{
                                      width: '26px',
                                      height: '26px',
                                      borderRadius: '50%',
                                      backgroundColor: '#e0f2fe',
                                      color: '#0284c7',
                                      border: '1px solid #bae6fd',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 600,
                                      fontSize: '0.74rem',
                                    }}
                                  >
                                    {(c.name || 'C').slice(0, 1).toUpperCase()}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                                      {c.code || c.customerCode}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '8px 12px', color: '#334155' }}>
                                <div>{c.contactPerson || '—'}</div>
                                {c.phone && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{c.phone}</div>}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    padding: '2px 7px',
                                    borderRadius: '9999px',
                                    backgroundColor: isCustomerActive(c) ? '#dcfce7' : '#fee2e2',
                                    color: isCustomerActive(c) ? '#15803d' : '#b91c1c',
                                  }}
                                >
                                  {isCustomerActive(c) ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRouteEditForm({
                                      ...routeEditForm,
                                      selectedCustomerIds: routeEditForm.selectedCustomerIds.filter((id) => id !== String(c.id)),
                                    });
                                  }}
                                  style={{
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: '#dc2626',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    padding: '3px 6px',
                                    borderRadius: '4px',
                                  }}
                                  title="Remove customer from route"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 22px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={handleCloseRouteView}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRouteView}
                disabled={!isCreatingRoute && !canEditDelivery}
                title={!isCreatingRoute && !canEditDelivery ? 'Only authorized staff can edit routes' : ''}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: !isCreatingRoute && !canEditDelivery ? '#94a3b8' : '#0284c7',
                  color: '#ffffff',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: !isCreatingRoute && !canEditDelivery ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (isCreatingRoute || canEditDelivery) e.currentTarget.style.backgroundColor = '#0369a1';
                }}
                onMouseLeave={(e) => {
                  if (isCreatingRoute || canEditDelivery) e.currentTarget.style.backgroundColor = '#0284c7';
                }}
              >
                <Check size={16} />
                {isCreatingRoute ? 'Save New Delivery Route' : (!canEditDelivery ? 'View Only (Restricted)' : 'Update Delivery Route')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SMALL POPUP: Search & Assign Customers to Route               */}
      {/* ------------------------------------------------------------- */}
      {showAssignCustomerModal && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1150, backgroundColor: 'rgba(15, 23, 42, 0.55)', overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 35px -8px rgba(15, 23, 42, 0.25), 0 10px 15px -6px rgba(15, 23, 42, 0.1)',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                  Assign Customers to Route
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Search and add customers to {routeEditForm.name || 'this delivery route'}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignCustomerModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
              <div style={{ position: 'relative' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '10px',
                    color: '#94a3b8',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="text"
                  placeholder="Search by name, code, phone, address..."
                  value={assignCustomerSearch}
                  onChange={(e) => setAssignCustomerSearch(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 28px 0 32px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                  }}
                />
                {assignCustomerSearch && (
                  <button
                    type="button"
                    onClick={() => setAssignCustomerSearch('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '8px',
                      background: 'transparent',
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
            </div>

            {/* Customers List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px', maxHeight: '360px' }}>
              {availableCustomersToAssign.length === 0 ? (
                <div style={{ padding: '30px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>
                  No matching customers found.
                </div>
              ) : (
                availableCustomersToAssign.map((c) => {
                  const isAssigned = routeEditForm.selectedCustomerIds.includes(String(c.id));
                  const otherRoutes = routes.filter(
                    (r) => r.id !== (selectedRoute?.id) && r.customerIds && r.customerIds.includes(String(c.id))
                  );

                  return (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            backgroundColor: '#e0f2fe',
                            color: '#0284c7',
                            border: '1px solid #bae6fd',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                            fontSize: '0.74rem',
                            flexShrink: 0,
                          }}
                        >
                          {(c.name || 'C').slice(0, 1).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{c.code || c.customerCode}</span>
                            {c.phone && <span>• {c.phone}</span>}
                            {otherRoutes.length > 0 && (
                              <span style={{ color: '#1d4ed8', backgroundColor: '#eff6ff', border: '1px solid #dbeafe', padding: '1px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 500 }}>
                                Also in: {otherRoutes.map((r) => r.routeName || r.name).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (isAssigned) {
                            setRouteEditForm({
                              ...routeEditForm,
                              selectedCustomerIds: routeEditForm.selectedCustomerIds.filter((id) => id !== String(c.id)),
                            });
                          } else {
                            setRouteEditForm({
                              ...routeEditForm,
                              selectedCustomerIds: [...routeEditForm.selectedCustomerIds, String(c.id)],
                            });
                          }
                        }}
                        style={{
                          marginLeft: '10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          borderRadius: '5px',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: isAssigned ? '1px solid #bbf7d0' : 'none',
                          backgroundColor: isAssigned ? '#f0fdf4' : '#0284c7',
                          color: isAssigned ? '#15803d' : '#ffffff',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isAssigned ? (
                          <>
                            <Check size={12} /> Assigned
                          </>
                        ) : (
                          <>
                            <Plus size={12} /> Add
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '10px 18px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ffffff',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                <strong style={{ color: '#0f172a' }}>{routeEditForm.selectedCustomerIds.length}</strong> customer{routeEditForm.selectedCustomerIds.length === 1 ? '' : 's'} in route
              </span>
              <button
                type="button"
                onClick={() => setShowAssignCustomerModal(false)}
                style={{
                  padding: '6px 18px',
                  borderRadius: '6px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
              >
                Done
              </button>
            </div>
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
