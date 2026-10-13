import DeliveryVehicleWorkspace from '../components/DeliveryVehicleWorkspace';
import DeliveryWorkspace from '../components/DeliveryWorkspace';
import DeliveryDirectory from '../components/DeliveryDirectory';
import DeliveryActionDialog from '../components/DeliveryActionDialog';
import PurchaseInspectionModal from '../components/PurchaseInspectionModal';
import FilterSelect from '../components/FilterSelect';
import DateRangePicker,{matchesDateRange} from '../components/DateRangePicker';
import {printA4Report} from '../utils/printReport';
import {useToast} from '../context/ToastContext';
import './InventoryTheme.css';
import './DeliveryTheme.css';
import '../components/PurchasingAppearance.css';
import { formatBusinessDate } from '../utils/invoiceMapping';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Truck, Users, CheckCircle2, AlertCircle, Plus, Search, Navigation, Printer, RefreshCw, X, Edit2, UserCheck, Gauge, Check, Download } from 'lucide-react';
import { deliveryApi, deliveryRouteApi, vehicleApi } from '../api/apiClient';
import api from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { useDataSync } from '../hooks/useDataSync';
import { canEditModule } from '../utils/permissionUtils';

export default function DeliveryHub({ activeSubTab = 'deliveries' }) {
  const { user } = useAuth();
  const canEditDelivery = canEditModule(user, 'DELIVERY');
  // Primary Tabs: 'deliveries' | 'routes' | 'vehicles'
  const [currentTab, setCurrentTab] = useState(['deliveries', 'routes', 'vehicles'].includes(activeSubTab) ? activeSubTab : 'deliveries');

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

  const {addToast:showToast}=useToast();
  const [tripBusy,setTripBusy]=useState(false);
  const [vehicleBusy,setVehicleBusy]=useState(false);
  const [vehicleSearch,setVehicleSearch]=useState('');
  const [viewingVehicle,setViewingVehicle]=useState(null);
  const [viewingRoute,setViewingRoute]=useState(null);
  const [deliveryFrom,setDeliveryFrom]=useState(''),[deliveryTo,setDeliveryTo]=useState('');

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
    scheduledDate: formatBusinessDate(),
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

      setDeliveries(delivRes.data?.data?.content || delivRes.data?.data || delivRes.data?.content || delivRes.data || []);

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
        isActive:r.isActive ?? true,
      }));
      setRoutes(normalizedRoutes);

      setVehicles(vehRes.data?.data || vehRes.data || []);
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

  useDataSync(fetchData, ['erp:data_changed', 'erp:delivery_updated']);

  // Fetch pending invoices when opening Create Trip Modal
  const loadPendingInvoices = async () => {
    try {
      const res = await deliveryApi.getPendingInvoices();
      setPendingInvoices(res.data?.data || res.data || []);
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
      scheduledDate: formatBusinessDate(),
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

    if(tripBusy)return;
    setTripBusy(true);
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
    } finally {setTripBusy(false);}
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
    if(tripBusy)return;
    setTripBusy(true);
    try {
      await deliveryApi.dispatch(selectedTrip.id, {
        departureTime: dispatchForm.departureTime ? `${dispatchForm.departureTime}:00` : null,
        startOdometer: dispatchForm.startOdometer ? Number(dispatchForm.startOdometer) : null,
        notes: dispatchForm.notes,
      });
      showToast(`Trip ${selectedTrip.deliveryNumber} dispatched on route!`, 'success');
      setSelectedTrip(previous=>({...previous,status:'IN_TRANSIT',departureTime:dispatchForm.departureTime,startOdometer:dispatchForm.startOdometer!==''?Number(dispatchForm.startOdometer):previous.startOdometer,invoices:(previous.invoices || []).map(invoice=>({...invoice,deliveryStatus:'OUT_FOR_DELIVERY'}))}));
      setShowDispatchModal(false);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Dispatch failed', 'error');
    } finally {setTripBusy(false);}
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
    if(tripBusy)return;
    setTripBusy(true);
    try {
      await deliveryApi.complete(selectedTrip.id, {
        returnTime: completeForm.returnTime ? `${completeForm.returnTime}:00` : null,
        endOdometer: completeForm.endOdometer ? Number(completeForm.endOdometer) : null,
        notes: completeForm.notes,
      });
      showToast(`Trip ${selectedTrip.deliveryNumber} completed! All invoices marked delivered.`, 'success');
      setSelectedTrip(previous=>({...previous,status:'DELIVERED',returnTime:completeForm.returnTime,endOdometer:completeForm.endOdometer!==''?Number(completeForm.endOdometer):previous.endOdometer,invoices:(previous.invoices || []).map(invoice=>({...invoice,deliveryStatus:'DELIVERED'}))}));
      setShowCompleteModal(false);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Completion failed', 'error');
    } finally {setTripBusy(false);}
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
    if(tripBusy)return;
    setTripBusy(true);
    try {
      await deliveryApi.cancel(selectedTrip.id, {
        cancellationReason: cancelForm.cancellationReason,
      });
      showToast(`Trip ${selectedTrip.deliveryNumber} cancelled. Invoices restored to pending.`, 'info');
      setSelectedTrip(previous=>({...previous,status:'CANCELLED',invoices:(previous.invoices || []).map(invoice=>({...invoice,deliveryStatus:'PENDING'}))}));
      setShowCancelModal(false);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Cancellation failed', 'error');
    } finally {setTripBusy(false);}
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
    if(vehicleBusy)return;
    setVehicleBusy(true);
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
    } finally {setVehicleBusy(false);}
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

      return matchSearch && matchStatus && matchRoute && matchesDateRange(d.scheduledDate || d.createdAt,deliveryFrom,deliveryTo);
    });
  }, [deliveries, searchTerm, statusFilter, routeFilter,deliveryFrom,deliveryTo]);

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

  const invoiceColumns=[{label:'Invoice number',value:row=>row.invoiceNumber},{label:'Customer',value:row=>row.customerName},{label:'Address',value:row=>row.address || row.customerAddress || '—'},{label:'Amount (LKR)',value:row=>Number(row.netTotal || 0).toLocaleString(undefined,{minimumFractionDigits:2})},{label:'Status',value:row=>row.deliveryStatus || selectedTrip?.status || '—'}];
  const printTrip=trip=>{const escape=value=>String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));printA4Report({title:'Delivery Manifest',metaItems:[['Delivery number',trip.deliveryNumber],['Route',trip.routeName],['Vehicle',trip.vehicleNumber],['Driver',trip.driverName],['Assistant',trip.assistantStaffName],['Scheduled date',trip.scheduledDate],['Remarks',trip.notes]].map(([label,value])=>({label,value:escape(value)})),columns:invoiceColumns.map(column=>({header:column.label,accessor:row=>escape(column.value(row))})),data:trip.invoices || [],summaryItems:[{label:'Total (LKR)',value:Number(trip.totalAmount || 0).toLocaleString(undefined,{minimumFractionDigits:2})}]});};
  const loadTrip=async(row,print=false)=>{try{const response=await deliveryApi.getById(row.id);const trip=response.data?.data || response.data || row;if(print)printTrip(trip);else {setSelectedTrip(trip);setShowManifestModal(true);}}catch(error){showToast(error.message || 'Could not load delivery','error');}};
  if(showVehicleModal)return <div className="delivery-theme purchasing-no-shadows" style={{display:'flex',flex:1,minHeight:0}}><DeliveryVehicleWorkspace form={vehicleForm} setForm={setVehicleForm} busy={vehicleBusy} onClose={()=>setShowVehicleModal(false)} onSave={handleSaveVehicle}/></div>;
  if(showCreateTripModal)return <div className="delivery-theme purchasing-no-shadows" style={{display:'flex',flex:1,minHeight:0}}><DeliveryWorkspace form={newTripForm} setForm={setNewTripForm} warehouses={warehouses} routes={routes} vehicles={vehicles} employees={employees} invoices={pendingInvoices} busy={tripBusy} onClose={()=>setShowCreateTripModal(false)} onSave={handleCreateDeliveryTrip}/></div>;

  return (
    <div className="delivery-theme inventory-theme purchasing-no-shadows"
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
              <Plus size={17} /> New Delivery
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
              <Plus size={17} /> New Delivery Route
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

      </div>

      {currentTab==='deliveries' && <DeliveryDirectory title="Delivery Trips" rows={filteredDeliveries} query={searchTerm} onQuery={setSearchTerm} loading={loading} onRefresh={fetchData} onView={row=>loadTrip(row)} onPrint={row=>loadTrip(row,true)} columns={[{label:'Delivery number',code:true,value:row=>row.deliveryNumber},{label:'Route',value:row=>row.routeName},{label:'Vehicle',value:row=>row.vehicleNumber},{label:'Driver / assistant',value:row=>[row.driverName,row.assistantStaffName].filter(Boolean).join(' / ')},{label:'Invoices',value:row=>row.totalInvoicesCount ?? 0},{label:'Date',value:row=>row.scheduledDate},{label:'Status',status:true,value:row=>row.status},{label:'Remarks',value:row=>row.notes}]} filters={<><FilterSelect aria-label="Delivery status" title="Filter deliveries by status" value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="ALL">All Statuses</option>{['SCHEDULED','IN_TRANSIT','DELIVERED','CANCELLED'].map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</FilterSelect><FilterSelect className="inventory-full-label-filter" aria-label="Delivery route filter" title="Filter deliveries by route" value={routeFilter} style={{width:'auto'}} onChange={event=>setRouteFilter(event.target.value)}><option value="ALL">All Routes</option>{routes.map(route=><option key={route.id} value={route.id}>{route.routeName}</option>)}</FilterSelect><DateRangePicker documentType="Delivery" from={deliveryFrom} to={deliveryTo} onChange={(from,to)=>{setDeliveryFrom(from);setDeliveryTo(to);}}/></>}/> }

      {currentTab==='routes' && <DeliveryDirectory title="Delivery Routes" rows={filteredRoutes} query={routeSearchTerm} onQuery={setRouteSearchTerm} loading={loading} onRefresh={fetchData} columns={[{label:'Route code',code:true,value:row=>row.routeCode},{label:'Route',value:row=>row.routeName},{label:'Area',value:row=>row.area},{label:'Delivery days',value:row=>row.deliveryDays},{label:'Assigned staff',value:row=>row.assignedStaffName},{label:'Customers',value:row=>row.customerCount},{label:'Remarks',value:row=>row.description}]} canEdit={canEditDelivery} onView={setViewingRoute} onEdit={handleOpenRouteView}/>}
      {currentTab==='vehicles' && <DeliveryDirectory title="Fleet Vehicles" rows={vehicles.filter(row=>[row.vehicleNumber,row.model,row.vehicleType,row.notes].some(value=>String(value || '').toLowerCase().includes(vehicleSearch.toLowerCase())))} query={vehicleSearch} onQuery={setVehicleSearch} loading={loading} onRefresh={fetchData} columns={[{label:'Plate number',code:true,value:row=>row.vehicleNumber},{label:'Model & make',value:row=>row.model},{label:'Type',value:row=>row.vehicleType},{label:'Capacity (kg)',value:row=>row.capacityKg},{label:'Status',status:true,value:row=>row.status},{label:'Remarks',value:row=>row.notes}]} canEdit={canEditDelivery} onView={setViewingVehicle} onEdit={row=>{setVehicleForm({...row,capacityKg:row.capacityKg ?? '',notes:row.notes || ''});setShowVehicleModal(true);}}/>}

      {showDispatchModal && selectedTrip && <DeliveryActionDialog mode="dispatch" trip={selectedTrip} form={dispatchForm} setForm={setDispatchForm} busy={tripBusy} onClose={()=>setShowDispatchModal(false)} onConfirm={handleConfirmDispatch}/>}
      {showCompleteModal && selectedTrip && <DeliveryActionDialog mode="complete" trip={selectedTrip} form={completeForm} setForm={setCompleteForm} busy={tripBusy} onClose={()=>setShowCompleteModal(false)} onConfirm={handleConfirmComplete}/>}
      {showCancelModal && selectedTrip && <DeliveryActionDialog mode="cancel" trip={selectedTrip} form={cancelForm} setForm={setCancelForm} busy={tripBusy} onClose={()=>setShowCancelModal(false)} onConfirm={handleConfirmCancel}/>}

      {showManifestModal && selectedTrip && <PurchaseInspectionModal type="Delivery" number={selectedTrip.deliveryNumber} status={selectedTrip.status} rows={selectedTrip.invoices || []} columns={invoiceColumns} tableToolbar tableSearchPlaceholder="Search invoice or customer..." tableSearchLabel="Search delivery invoices" emptyMessage="No matching invoices found." onPrint={()=>printTrip(selectedTrip)} onClose={()=>setShowManifestModal(false)} details={[{label:'Route',value:selectedTrip.routeName},{label:'Warehouse',value:selectedTrip.warehouseName},{label:'Vehicle',value:selectedTrip.vehicleNumber},{label:'Driver',value:selectedTrip.driverName},{label:'Assistant',value:selectedTrip.assistantStaffName},{label:'Scheduled date',value:selectedTrip.scheduledDate},{label:'Total (LKR)',value:Number(selectedTrip.totalAmount || 0).toLocaleString(undefined,{minimumFractionDigits:2})},{label:'Departure',value:formatTimeStr(selectedTrip.departureTime)},{label:'Return',value:formatTimeStr(selectedTrip.returnTime)},{label:'Remarks',value:selectedTrip.notes}]} detailActions={canEditDelivery ? [...(selectedTrip.status==='SCHEDULED'?[{label:'Dispatch Delivery',icon:Navigation,tone:'success',onClick:()=>handleOpenDispatch(selectedTrip)}]:[]),...(selectedTrip.status==='IN_TRANSIT'?[{label:'Complete Delivery',icon:CheckCircle2,tone:'success',onClick:()=>handleOpenComplete(selectedTrip)}]:[]),...(['SCHEDULED','IN_TRANSIT'].includes(selectedTrip.status)?[{label:'Cancel Delivery',icon:X,tone:'danger',onClick:()=>handleOpenCancel(selectedTrip)}]:[])] : []}/>}
      {viewingVehicle && <PurchaseInspectionModal type="Fleet" number={viewingVehicle.vehicleNumber} status={viewingVehicle.status} rows={[viewingVehicle]} columns={[{label:'Model',value:row=>row.model},{label:'Type',value:row=>row.vehicleType},{label:'Capacity (kg)',value:row=>row.capacityKg ?? '—'},{label:'Notes',value:row=>row.notes || '—'}]} headerPrint onClose={()=>setViewingVehicle(null)} details={[{label:'Model',value:viewingVehicle.model},{label:'Type',value:viewingVehicle.vehicleType},{label:'Capacity',value:viewingVehicle.capacityKg?`${viewingVehicle.capacityKg} kg`:'—'},{label:'Remarks',value:viewingVehicle.notes}]} detailActions={canEditDelivery?[{label:'Edit Vehicle',icon:Edit2,onClick:()=>{setVehicleForm({...viewingVehicle,capacityKg:viewingVehicle.capacityKg ?? '',notes:viewingVehicle.notes || ''});setViewingVehicle(null);setShowVehicleModal(true);}}]:[]}/>}

      {viewingRoute && <PurchaseInspectionModal type="Route" number={viewingRoute.routeCode || viewingRoute.routeName} status={viewingRoute.isActive?'ACTIVE':'INACTIVE'} tableToolbar tableSearchPlaceholder="Search customer code or name..." tableSearchLabel="Search route customers" emptyMessage="No matching customers found." rows={customers.filter(customer=>(viewingRoute.customerIds || []).map(String).includes(String(customer.id)) || String(customer.routeId)===String(viewingRoute.id))} columns={[{label:'Customer code',value:row=>row.customerCode || row.code},{label:'Customer',value:row=>row.name || row.customerName},{label:'Phone',value:row=>row.phone},{label:'Address',value:row=>row.address}]} onClose={()=>setViewingRoute(null)} details={[{label:'Route',value:viewingRoute.routeName},{label:'Area',value:viewingRoute.area},{label:'Delivery days',value:viewingRoute.deliveryDays},{label:'Assigned staff',value:viewingRoute.assignedStaffName},{label:'Remarks',value:viewingRoute.description}]} detailActions={canEditDelivery?[{label:'Edit Route',icon:Edit2,onClick:()=>{handleOpenRouteView(viewingRoute);setViewingRoute(null);}}]:[]}/>}
      {/* MODAL 6: DELIVERY ROUTE VIEW POPUP (SPLIT 2 COLUMNS)          */}
      {/* ------------------------------------------------------------- */}
      {(selectedRoute || isCreatingRoute) && (
        <div
          className="modal-backdrop delivery-dialog"
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
                  {isCreatingRoute ? 'New Delivery Route' : `Manage Delivery Route: ${routeEditForm.name}`}
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
                    <FilterSelect variant="field"
                      aria-label="Assigned route staff" value={routeEditForm.assignedStaffId}
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
                    </FilterSelect>
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
          className="modal-backdrop delivery-dialog"
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

    </div>
  );
}
