import ErpTabs, {ErpTab} from '../components/ErpTabs';
import {newestFirst} from '../utils/recordOrder';
import SupplierEditorModal from '../components/SupplierEditorModal';
import MasterWorkspace from '../components/MasterWorkspace';
import MasterDirectoryTable from '../components/MasterDirectoryTable';
import MasterDetailsModal from '../components/MasterDetailsModal';
import './InventoryTheme.css';
import {supplierErrors,normalizePhone,phoneCountry,masterErrors} from '../utils/purchasingValidation';
import SupplierDetailsModal from '../components/SupplierDetailsModal';
import useRecordDeletion from '../hooks/useRecordDeletion';
import SupplierDeleteDialog from '../components/SupplierDeleteDialog';
import FilterSelect from '../components/FilterSelect';
import {printCurrentDirectory} from '../utils/printDirectory';
import '../components/PurchasingAppearance.css';
import StatusBadge from '../components/StatusBadge';
import {masterTypes,masterNames,recordStatus,hasMasterDraftInput} from '../utils/masterRecordLifecycle';
import { usePurchasingStatusChange } from '../hooks/usePurchasingStatusChange';
import React, { useState, useEffect } from 'react';
import {
  warehouseApi,
  categoryApi,
  customerApi,
  supplierApi,
  recycleBinApi,
  productApi,
  brandApi,
} from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useDataSync } from '../hooks/useDataSync';
import { canEditModule } from '../utils/permissionUtils';
import { printA4Report } from '../utils/printReport';
import { useProductsQuery, invalidateProductQueries, invalidateMasterQueries } from '../queryClient';

import {
  Database,
  Building2,
  FolderTree,
  Users,
  Truck,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  X,
  Eye,
  Package,
  Download,
  Printer,
  Award,
  Phone,
  Mail,
  Trash2,
} from 'lucide-react';

const supplierActionStyle = {
  width: '30px', height: '30px', background: '#ffffff', border: '1px solid #bae6fd',
  borderRadius: '6px', cursor: 'pointer', color: '#0284c7', display: 'flex',
  alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease',
};
const MastersView = React.forwardRef(function MastersView({
  activeSubTab,
  onSubTabChange,
  isStandalone = false,
  allowedTabs = null,
  title = '',
  subtitle = '',
  hideHeader = false,
  printDirectory = false,
  onFormModeChange,
}, ref) {
  const directoryRef=React.useRef(null);
  const [activeTab, setActiveTab] = useState(() => activeSubTab || 'products');
  const ToolbarFilter=FilterSelect;
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [productPage, setProductPage] = useState(0);
  const productPageSize = 20;

  // Data lists
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [deletingSupplier, setDeletingSupplier] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const {requestStatusChange,statusChangeDialog}=usePurchasingStatusChange();

  // Central TanStack Query for Products
  const {
    data: pagedProductsData,
    isLoading: productsQueryLoading,
    refetch: refetchProducts,
  } = useProductsQuery({
    page: productPage,
    size: productPageSize,
    query: searchTerm,
    enabled: activeTab === 'products',
  });

  useEffect(() => {
    if (activeTab === 'products' && pagedProductsData) {
      const content = pagedProductsData.content || (Array.isArray(pagedProductsData) ? pagedProductsData : []);
      if (Array.isArray(content)) {
        setProducts(content);
      }
    }
  }, [activeTab, pagedProductsData]);

  const getBrandForProduct = (p) => {
    if (!p) return 'General';
    if (p.brandName) return p.brandName;
    if (p.brandId) {
      const found = brands.find((b) => String(b.id) === String(p.brandId));
      if (found) return found.name;
    }
    return 'General';
  };

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalForm, setModalForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(()=>{onFormModeChange?.(showModal && ['suppliers','products','brands','warehouses','categories'].includes(activeTab));return ()=>onFormModeChange?.(false);},[activeTab,showModal,onFormModeChange]);

  // View Details Modal State
  const [viewingItem, setViewingItem] = useState(null);

  const { user } = useAuth();
  const { addToast } = useToast();

  const getTabModule = (tab) => {
    switch (tab) {
      case 'products':
        return 'PRODUCT';
      case 'brands':
        return 'BRAND';
      case 'categories':
        return 'CATEGORY';
      case 'warehouses':
        return 'WAREHOUSE';
      case 'suppliers':
        return 'SUPPLIER';
      case 'customers':
        return 'CUSTOMER';
      default:
        return 'INVENTORY';
    }
  };
  const canEditCurrentTab = canEditModule(user, getTabModule(activeTab));
  const masterDeletion=useRecordDeletion(getTabModule(activeTab),activeTab==='categories'?'Category':activeTab==='warehouses'?'Warehouse':activeTab==='brands'?'Brand':activeTab==='products'?'Product':'Record',async ()=>{
    if (activeTab === 'products') invalidateProductQueries();
    else invalidateMasterQueries(activeTab);
    setViewingItem(null);
    return loadTabData();
  });

  React.useImperativeHandle(ref, () => ({
    openAdd: handleOpenAdd,
    refresh: loadTabData,
  }));

  useEffect(() => {
    if (activeSubTab) {
      setActiveTab(activeSubTab);
    }
  }, [activeSubTab]);

  // Load counts for all tabs so pill badges show real numbers immediately
  const loadAllCounts = async () => {
    try {
      const promises = [
        warehouseApi.getAll(),
        categoryApi.getAll(),
        customerApi.getAll(),
        supplierApi.getAll(),
        // When products tab is active, loadTabData handles product loading; avoid duplicate download on mount/sync
        activeTab === 'products' ? Promise.resolve({ status: 'skipped' }) : productApi.getProducts({ size: 300 }),
        brandApi.getAll(),
      ];
      const [wRes, cRes, cuRes, sRes, pRes, bRes] = await Promise.allSettled(promises);
      if (wRes.status === 'fulfilled' && wRes.value?.data) setWarehouses(wRes.value.data || []);
      if (cRes.status === 'fulfilled' && cRes.value?.data) setCategories(cRes.value.data || []);
      if (cuRes.status === 'fulfilled' && cuRes.value?.data) setCustomers(cuRes.value.data || []);
      if (sRes.status === 'fulfilled' && sRes.value?.data) setSuppliers(sRes.value.data || []);
      if (pRes.status === 'fulfilled' && pRes.value?.status !== 'skipped' && pRes.value?.data) {
        setProducts(pRes.value.data?.content || pRes.value.data || []);
      }
      if (bRes.status === 'fulfilled' && bRes.value?.data) setBrands(bRes.value.data || []);
    } catch (e) {
      // silent fallback
    }
  };

  useEffect(() => {
    loadAllCounts();
  }, []);

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  useDataSync(() => {
    return Promise.allSettled([loadAllCounts(),loadTabData()]);
  }, ['erp:data_changed', 'erp:inventory_updated', 'erp:customers_updated', 'erp:purchasing_updated']);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setStatusFilter('ALL');
    setSearchTerm('');
    setProductPage(0);
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  const loadTabData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'products') {
        const [pRes, cRes, bRes] = await Promise.all([
          refetchProducts().then(r => r?.data).catch(() => null),
          categories.length === 0 ? categoryApi.getAll() : Promise.resolve({ data: categories }),
          brands.length === 0 ? brandApi.getAll() : Promise.resolve({ data: brands }),
        ]);
        const fetchedContent = pRes?.content || pRes?.data?.content || (Array.isArray(pRes) ? pRes : pRes?.data);
        if (Array.isArray(fetchedContent)) {
          setProducts(fetchedContent);
        } else if (pagedProductsData?.content) {
          setProducts(pagedProductsData.content);
        }
        if (categories.length === 0 && cRes.data) {
          setCategories(cRes.data || []);
        }
        if (brands.length === 0 && bRes.data) {
          setBrands(bRes.data || []);
        }
      } else if (activeTab === 'brands') {
        const res = await brandApi.getAll();
        setBrands(res.data || []);
      } else if (activeTab === 'warehouses') {
        const res = await warehouseApi.getAll();
        setWarehouses(res.data || []);
      } else if (activeTab === 'categories') {
        const res = await categoryApi.getAll();
        setCategories(res.data || []);
      } else if (activeTab === 'customers') {
        const res = await customerApi.getAll();
        setCustomers(res.data || []);
      } else if (activeTab === 'suppliers') {
        const res = await supplierApi.getAll();
        setSuppliers(res.data || []);
      }
    } catch (err) {
      addToast('Failed to load ' + activeTab + ': ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const supplierStatus=item=>item?.status || (isItemActive(item)?'ACTIVE':'INACTIVE');
  const handleDeleteSupplier = async () => {
    if (!deletingSupplier || deletingBusy || !canEditCurrentTab) return;
    setDeletingBusy(true);
    try {
      await recycleBinApi.delete('SUPPLIER',deletingSupplier.id);
      setDeletingSupplier(null); setViewingItem(null);
      await loadTabData(); addToast('Supplier moved to recycle bin', 'success');
    } catch (error) { addToast(error.response?.data?.message || error.message || 'Unable to delete supplier', 'error'); }
    finally { setDeletingBusy(false); }
  };
  const handleSupplierStatus=(supplier,target)=>requestStatusChange({type:'Supplier',number:supplier.name || supplier.supplierCode,current:supplierStatus(supplier),target,onConfirm:async reason=>{const response=await supplierApi.changeStatus(supplier.id,target,reason);setViewingItem(previous=>previous?.id===supplier.id?{...previous,...(response.data?.data || response.data),status:target,isActive:target==='ACTIVE'}:previous);await loadTabData();addToast('Supplier status updated','success');}});
  const handleMasterStatus=(record,target)=>{
    if(!canEditCurrentTab)return;
    const type=record.type;
    requestStatusChange({type:masterNames[type],number:record.name || record.sku || record.code,current:recordStatus(record),target,onConfirm:async reason=>{
      const api={products:productApi,warehouses:warehouseApi,brands:brandApi,categories:categoryApi}[type];
      const response=await api.changeStatus(record.id,target,reason);
      setViewingItem(previous=>previous?.id===record.id && previous.type===type ? {...previous,...response.data,status:target,isActive:target==='ACTIVE'}:previous);
      await loadTabData();addToast('Status updated','success');
    }});
  };
  const isItemActive = (item) => Boolean(item?.isActive ?? item?.active ?? false);

  const handleOpenAdd = () => {
    setEditingItem(null);
    if (activeTab === 'products') {
      const defaultWh = warehouses.find(isItemActive);
      setModalForm({
        sku: '',
        name: '',
        brandId: brands.find(isItemActive)?.id || '',
        categoryId: categories.find(isItemActive)?.id || '',
        warehouseId: defaultWh ? defaultWh.id : '',
        unitOfMeasure: 'PCS',
        minStockLevel: '5',
        description: '',
      });
    } else if (activeTab === 'brands') {
      setModalForm({ code: '', name: '', description: '', markupPercent: 0 });
    } else if (activeTab === 'warehouses') {
      setModalForm({ code: '', name: '', address: '', contactNumber: '', phone: '', remarks: '' });
    } else if (activeTab === 'categories') {
      setModalForm({ code: '', name: '', description: '' });
    } else if (activeTab === 'customers') {
      setModalForm({ code: '', name: '', contactPerson: '', phone: '', email: '', address: '', creditLimit: '0' });
    } else if (activeTab === 'suppliers') {
      setModalForm({ code: '', name: '', contactPerson: '', phone: '', phoneCountry:'LK', email: '', address: '', remarks: '' });
    }
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    if (activeTab === 'products') {
      const draft = recordStatus(item)==='DRAFT';
      const matchedWh = warehouses.find((w) => String(w.id) === String(item.warehouseId || item.defaultWarehouseId) || w.name === item.warehouseName) || (draft?null:warehouses.find(isItemActive));
      setModalForm({
        sku: item.sku || '',
        name: item.name || '',
        brandId: item.brandId || (brands.find((b) => b.name === item.brandName)?.id || (draft?'':brands.find(isItemActive)?.id || '')),
        categoryId: item.categoryId || (categories.find((c) => c.name === item.categoryName)?.id || ''),
        warehouseId: item.warehouseId || item.defaultWarehouseId || (matchedWh ? matchedWh.id : ''),
        unitOfMeasure: item.unitOfMeasure || 'PCS',
        minStockLevel: item.minStockLevel?.toString() || '0',
        description: item.description || '',
      });
    } else if (activeTab === 'brands') {
      setModalForm({
        code: item.code || '',
        name: item.name || '',
        description: item.description || '',
        markupPercent: item.markupPercent ?? 0,
      });
    } else {
      setModalForm({
        ...item,
        contactNumber: item.contactNumber || item.phone || '',
        phone: item.phone || item.contactNumber || '',
        phoneCountry:phoneCountry(item.phone || item.contactNumber),
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e, requestedStatus) => {
    const supplierDraft=requestedStatus==='DRAFT' || editingItem?.status==='DRAFT';
    const masterDraft=masterTypes.includes(activeTab) && (requestedStatus==='DRAFT' || editingItem?.status==='DRAFT');
    const savedStatus=editingItem ? recordStatus(editingItem) : masterDraft?'DRAFT':'ACTIVE';
    if(masterDraft && !hasMasterDraftInput(activeTab,modalForm)){e.preventDefault();addToast('Fill at least one input before saving a draft.','error');return;}
    e.preventDefault();
    if(masterTypes.includes(activeTab)){const errors=masterErrors(activeTab,modalForm,{draft:masterDraft});if(Object.keys(errors).length){addToast(Object.values(errors)[0],'error');return;}}
    if (editingItem && !canEditCurrentTab) {
      addToast('Permission denied: Only authorized staff can edit existing records.', 'error');
      return;
    }
    if(activeTab==='suppliers') {const errors=supplierErrors(modalForm,{draft:supplierDraft});if(Object.keys(errors).length){addToast(Object.values(errors)[0],'error');return;}}
    try {
      setSaving(true);
      if (activeTab === 'products') {
        if (!masterDraft && (!modalForm.sku || !modalForm.name)) {
          addToast('SKU and Product Name are required', 'error');
          setSaving(false);
          return;
        }
        const payload = {
          status:savedStatus,
          sku: (modalForm.sku || '').trim().toUpperCase(),
          barcode: null,
          name: (modalForm.name || '').trim(),
          brandId: modalForm.brandId ? Number(modalForm.brandId) : null,
          categoryId: modalForm.categoryId ? Number(modalForm.categoryId) : null,
          warehouseId: modalForm.warehouseId ? Number(modalForm.warehouseId) : null,
          defaultWarehouseId: modalForm.warehouseId ? Number(modalForm.warehouseId) : null,
          unitOfMeasure: modalForm.unitOfMeasure || 'PCS',
          costPrice: editingItem ? (parseFloat(editingItem.costPrice) || 0) : 0,
          sellingPrice: editingItem ? (parseFloat(editingItem.sellingPrice) || 0) : 0,
          useBrandMarkup: editingItem ? (editingItem.useBrandMarkup ?? Number(editingItem.sellingPrice || 0) === 0) : true,
          minStockLevel: parseInt(modalForm.minStockLevel, 10) || 0,
          description: modalForm.description?.trim() || null,
        };
        if (editingItem) {
          await productApi.update(editingItem.id, payload);
        } else {
          await productApi.create(payload);
        }
      } else if (activeTab === 'brands') {
        if (!masterDraft && !modalForm.name?.trim()) {
          addToast('Brand name is required', 'error');
          setSaving(false);
          return;
        }
        const bCode = modalForm.code?.trim().toUpperCase() || (modalForm.name || '').trim().toUpperCase().replace(/\s+/g, '_').slice(0, 10);
        const markupPercent = Number(modalForm.markupPercent);
        if (!Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 99999) {
          addToast('Enter a valid MP% between 0 and 99999', 'error');
          setSaving(false);
          return;
        }
        const payload = {
          status:savedStatus,
          code: bCode,
          name: modalForm.name?.trim() || null,
          description: modalForm.description?.trim() || '',
          markupPercent,
        };
        if (editingItem) {
          await brandApi.update(editingItem.id, payload);
        } else {
          await brandApi.create(payload);
        }
      } else if (activeTab === 'warehouses') {
        const payload = {
          ...modalForm,
          status:savedStatus,
          contactNumber: normalizePhone(modalForm.contactNumber || modalForm.phone,phoneCountry(modalForm.contactNumber || modalForm.phone)),
          phone: normalizePhone(modalForm.contactNumber || modalForm.phone,phoneCountry(modalForm.contactNumber || modalForm.phone)),
        };
        if (editingItem) {
          await warehouseApi.update(editingItem.id, payload);
        } else {
          await warehouseApi.create(payload);
        }
      } else if (activeTab === 'categories') {
        const payload = {
          status:savedStatus,
          code: (modalForm.code || '').trim().toUpperCase(),
          name: (modalForm.name || '').trim(),
          description: modalForm.description || '',
        };
        if (editingItem) {
          await categoryApi.update(editingItem.id, payload);
        } else {
          await categoryApi.create(payload);
        }
      } else if (activeTab === 'customers') {
        const payload = {
          ...modalForm,
          customerCode: modalForm.code || modalForm.customerCode || '',
          creditLimit: parseFloat(modalForm.creditLimit) || 0,
        };
        if (editingItem) {
          await customerApi.update(editingItem.id, payload);
        } else {
          await customerApi.create(payload);
        }
      } else if (activeTab === 'suppliers') {
        const payload = {
          status:editingItem ? supplierStatus(editingItem) : supplierDraft?'DRAFT':'ACTIVE',
          name:modalForm.name?.trim() || null,contactPerson:modalForm.contactPerson?.trim() || '',
          phone:normalizePhone(modalForm.phone,modalForm.phoneCountry || phoneCountry(modalForm.phone)),email:modalForm.email?.trim() || '',address:modalForm.address?.trim() || '',remarks:modalForm.remarks?.trim() || '',
        };
        if (editingItem) {
          await supplierApi.update(editingItem.id, payload);
        } else {
          await supplierApi.create(payload);
        }
      }

      if (activeTab === 'products') {
        invalidateProductQueries();
      } else {
        invalidateMasterQueries(activeTab);
      }

      addToast(`Record saved successfully!`, 'success');
      setShowModal(false);
      loadTabData();
    } catch (err) {
      addToast(err.message || 'Operation failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id, currentStatus, reason) => {
    if (!canEditCurrentTab) {
      addToast('Permission denied: Only authorized staff can change record status.', 'error');
      return;
    }
    if(activeTab==='suppliers' && !reason) {
      const supplier=suppliers.find(item=>item.id===id) || viewingItem;
      requestStatusChange({type:'Supplier',number:supplier?.name || supplier?.supplierCode,current:currentStatus?'ACTIVE':'INACTIVE',target:currentStatus?'INACTIVE':'ACTIVE',onConfirm:reason=>handleToggleActive(id,currentStatus,reason)});return false;
    }
    try {
      if (activeTab === 'products') {
        await productApi.toggleActive(id);
        invalidateProductQueries();
      } else if (activeTab === 'brands') {
        await brandApi.toggleActive(id);
        invalidateMasterQueries('brands');
      } else if (activeTab === 'warehouses') {
        await warehouseApi.toggleActive(id);
        invalidateMasterQueries('warehouses');
      } else if (activeTab === 'categories') {
        await categoryApi.toggleActive(id);
        invalidateMasterQueries('categories');
      } else if (activeTab === 'customers') {
        await customerApi.toggleActive(id);
        invalidateMasterQueries('customers');
      } else if (activeTab === 'suppliers') {
        await supplierApi.toggleActive(id,reason);
        invalidateMasterQueries('suppliers');
        setViewingItem(previous=>previous?.id===id && previous.type==='suppliers' ? {...previous,active:!currentStatus,isActive:!currentStatus,status:currentStatus?'INACTIVE':'ACTIVE'} : previous);
      }

      addToast(`Status changed to ${currentStatus ? 'Inactive' : 'Active'}`, 'success');
      loadTabData();
    } catch (err) {
      addToast('Status update failed: ' + err.message, 'error');
      return false;
    }
  };

  // Get current active tab list
  const getCurrentItems = () => {
    switch (activeTab) {
      case 'products': return products;
      case 'brands': return brands;
      case 'warehouses': return warehouses;
      case 'categories': return categories;
      case 'customers': return customers;
      case 'suppliers': return suppliers;
      default: return [];
    }
  };

  const currentItems = getCurrentItems();

  // Status-filtered and search-filtered lists
  const filterList = (list, searchFields) => {
    return list.filter((item) => {
      const active = isItemActive(item);
      if(activeTab==='suppliers' || masterTypes.includes(activeTab)){if(statusFilter!=='ALL' && recordStatus(item)!==statusFilter)return false;}else {
      if (statusFilter === 'ACTIVE' && !active) return false;
      if (statusFilter === 'INACTIVE' && active) return false;}
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return searchFields.some((field) => {
          const val = item[field];
          return val && String(val).toLowerCase().includes(q);
        });
      }
      return true;
    });
  };

  const filteredProducts = filterList(newestFirst(products), ['name', 'sku', 'categoryName', 'description']);
  const filteredBrands = filterList(newestFirst(brands), ['code', 'name', 'description']);
  const filteredWarehouses = filterList(newestFirst(warehouses), ['name', 'code', 'contactNumber', 'phone', 'address', 'remarks']);
  const filteredCategories = filterList(newestFirst(categories), ['code', 'name', 'description']);
  const filteredCustomers = filterList(customers, ['name', 'code', 'customerCode', 'phone', 'contactPerson', 'email']);
  const filteredSuppliers = filterList(newestFirst(suppliers), ['name', 'code', 'supplierCode', 'contactPerson', 'phone', 'email', 'remarks']);

  const handlePrintSuppliers = (supplier = null) => {
    const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character]));
    const supplierDetails = (item) => ({
      code: escapeText(item.code || item.supplierCode),
      name: escapeText(item.name),
      contactPerson: escapeText(item.contactPerson),
      phone: escapeText(item.phone),
      email: escapeText(item.email),
      address: escapeText(item.address),
      status: supplierStatus(item),
      remarks:escapeText(item.remarks),
    });
    if (supplier) {
      const details = supplierDetails(supplier);
      printA4Report({
        title: 'Supplier Details',
        columns: [
          { header: 'Field', accessor: 'field', width: '30%' },
          { header: 'Details', accessor: 'value' },
        ],
        data: [
          { field: 'Supplier Code', value: details.code },
          { field: 'Supplier Name', value: details.name },
          { field: 'Contact Person', value: details.contactPerson },
          { field: 'Phone', value: details.phone },
          { field: 'Email', value: details.email },
          { field: 'Address', value: details.address },
          { field: 'Status', value: details.status },
          { field: 'Remarks', value: details.remarks },
        ],
      });
      return;
    }
    printA4Report({
      title: 'Supplier Directory',
      metaItems: [
        { label: 'Search', value: escapeText(searchTerm) || 'All suppliers' },
        { label: 'Status', value: statusFilter === 'ALL' ? 'All' : statusFilter },
      ],
      columns: [
        { header: 'Code', accessor: 'code' },
        { header: 'Supplier Name', accessor: 'name' },
        { header: 'Contact Person', accessor: 'contactPerson' },
        { header: 'Phone', accessor: 'phone' },
        { header: 'Email', accessor: 'email' },
        { header: 'Address', accessor: 'address' },
        { header: 'Status', accessor: 'status' },
        { header: 'Remarks', accessor: 'remarks' },
      ],
      data: filteredSuppliers.map(supplierDetails),
      summaryItems: [{ label: 'Total Suppliers', value: String(filteredSuppliers.length) }],
    });
  };

  const activeCount = currentItems.filter(isItemActive).length;
  const inactiveCount = currentItems.length - activeCount;

  const downloadCSV = (headers, rows, filename) => {
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Records exported to CSV', 'success');
  };

  const handleExportCSV = async () => {
    let itemsToExport = [];
    let headers = [];
    let filename = `${activeTab}_export_${new Date().toISOString().slice(0, 10)}.csv`;

    if (activeTab === 'products') {
      itemsToExport = filteredProducts;
      try {
        const fullRes = await productApi.getProducts({ size: 1000 });
        const allFetched = fullRes.data?.content || fullRes.data || [];
        if (allFetched.length > 0) {
          itemsToExport = filterList(newestFirst(allFetched), ['name', 'sku', 'categoryName', 'description']);
        }
      } catch (_) {}
      headers = ['SKU', 'Name', 'Description / Note', 'Brand', 'Category', 'Unit', 'Min Stock', 'Status'];
      if (itemsToExport.length === 0) {
        addToast('No products to export', 'error');
        return;
      }
      const rows = itemsToExport.map((p) => [
        `"${p.sku || ''}"`,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${(p.description || p.notes || p.note || '').replace(/"/g, '""')}"`,
        `"${getBrandForProduct(p)}"`,
        `"${p.categoryName || 'General'}"`,
        `"${p.unitOfMeasure || 'PCS'}"`,
        p.minStockLevel || 0,
        recordStatus(p),
      ]);
      downloadCSV(headers, rows, filename);
    } else if (activeTab === 'brands') {
      itemsToExport = filteredBrands;
      headers = ['Brand Code', 'Brand Name', 'Description', 'Status'];
      if (itemsToExport.length === 0) {
        addToast('No brands to export', 'error');
        return;
      }
      const rows = itemsToExport.map((b) => [
        `"${b.code || ''}"`,
        `"${(b.name || '').replace(/"/g, '""')}"`,
        `"${(b.description || '').replace(/"/g, '""')}"`,
        recordStatus(b),
      ]);
      downloadCSV(headers, rows, filename);
    } else if (activeTab === 'warehouses') {
      itemsToExport = filteredWarehouses;
      headers = ['Code', 'Name', 'Address', 'Contact Number', 'Status'];
      if (itemsToExport.length === 0) {
        addToast('No warehouses to export', 'error');
        return;
      }
      const rows = itemsToExport.map((w) => [
        `"${w.code || ''}"`,
        `"${(w.name || '').replace(/"/g, '""')}"`,
        `"${(w.address || '').replace(/"/g, '""')}"`,
        `"${w.contactNumber || w.phone || ''}"`,
        recordStatus(w),
      ]);
      downloadCSV(headers, rows, filename);
    } else if (activeTab === 'categories') {
      itemsToExport = filteredCategories;
      headers = ['Code', 'Name', 'Description', 'Status'];
      if (itemsToExport.length === 0) {
        addToast('No categories to export', 'error');
        return;
      }
      const rows = itemsToExport.map((c) => [
        `"${c.code || ''}"`,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.description || '').replace(/"/g, '""')}"`,
        recordStatus(c),
      ]);
      downloadCSV(headers, rows, filename);
    } else if (activeTab === 'suppliers') {
      itemsToExport = filteredSuppliers;
      headers = ['Code', 'Name', 'Contact Person', 'Phone', 'Email', 'Status', 'Remarks'];
      if (itemsToExport.length === 0) {
        addToast('No suppliers to export', 'error');
        return;
      }
      const rows = itemsToExport.map((s) => [
        `"${s.code || s.supplierCode || ''}"`,
        `"${(s.name || '').replace(/"/g, '""')}"`,
        `"${(s.contactPerson || '').replace(/"/g, '""')}"`,
        `"${s.phone || ''}"`,
        `"${s.email || ''}"`,
        supplierStatus(s),
        `"${(s.remarks || '').replace(/"/g, '""')}"`,
      ]);
      downloadCSV(headers, rows, filename);
    }
  };

  const allTabs = [
    { id: 'products', label: 'Products', count: products.length, icon: Package },
    { id: 'brands', label: 'Brands', count: brands.length, icon: Award },
    { id: 'categories', label: 'Categories', count: categories.length, icon: FolderTree },
    { id: 'warehouses', label: 'Warehouses', count: warehouses.length, icon: Building2 },
    { id: 'customers', label: 'Customers', count: customers.length, icon: Users },
    { id: 'suppliers', label: 'Suppliers', count: suppliers.length, icon: Truck },
  ];

  const visibleTabs = allowedTabs ? allTabs.filter((t) => allowedTabs.includes(t.id)) : allTabs;

  const displayTitle =
    title ||
    (isStandalone
      ? activeTab === 'customers'
        ? 'Customer Management'
        : activeTab === 'suppliers'
        ? 'Supplier Directory'
        : activeTab === 'warehouses'
        ? 'Warehouse Locations'
        : activeTab === 'products'
        ? 'Products & Categories'
        : activeTab === 'categories'
        ? 'Product Categories'
        : 'Master Data Management'
      : 'Master Data Management');

  const displaySubtitle =
    subtitle ||
    (isStandalone
      ? activeTab === 'customers'
        ? 'Manage customer records, credit balances, terms, and contact profiles'
        : activeTab === 'suppliers'
        ? 'Manage procurement vendors, contact personnel, and addresses'
        : activeTab === 'warehouses'
        ? 'Manage storage centers, fulfillment hubs, and stock locations'
        : activeTab === 'products'
        ? 'Manage master product catalog, categories, pricing, and stock limits'
        : 'Enterprise catalog and records management'
      : 'Enterprise management for products, warehouses, categories, customers, and suppliers');

  const getHeaderIcon = () => {
    if (activeTab === 'customers') return <Users size={28} color="#2563eb" />;
    if (activeTab === 'suppliers') return <Truck size={28} color="#2563eb" />;
    if (activeTab === 'warehouses') return <Building2 size={28} color="#2563eb" />;
    if (activeTab === 'products' || activeTab === 'categories') return <Package size={28} color="#2563eb" />;
    return <Database size={28} color="#2563eb" />;
  };

  if(showModal && ['products','brands','warehouses','categories'].includes(activeTab))return <MasterWorkspace type={activeTab} form={modalForm} setForm={setModalForm} editing={editingItem} saving={saving} brands={brands} categories={categories} warehouses={warehouses} onClose={()=>setShowModal(false)} onSave={handleSave}/>;
  if(showModal && activeTab==='suppliers')return <SupplierEditorModal key={editingItem?.id || 'new-supplier'} form={modalForm} setForm={setModalForm} editing={editingItem} saving={saving} onClose={()=>setShowModal(false)} onSubmit={handleSave}/>;


  return (
    <div ref={directoryRef} className={(activeTab === 'suppliers' ? 'purchasing-no-shadows' : ['products','brands','warehouses','categories'].includes(activeTab) ? 'inventory-theme purchasing-no-shadows' : '') + (isStandalone || hideHeader ? '' : ' erp-page')}
      style={{
        flex: 1,
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: isStandalone ? '0' : '24px 32px',
        overflow: 'hidden',
      }}
    >
      {/* Header (Fixed / Sticky at Top) */}
      {!hideHeader && (
        <div className="erp-page-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <h1 className="erp-page-title"

            >
              {displayTitle}
            </h1>
            <p className="erp-page-description">
              {displaySubtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: 'var(--erp-text-button)',
              padding: '9px 18px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={17} /> {['products','brands','warehouses','categories'].includes(activeTab)?'New':'Add'} {masterNames[activeTab] || (activeTab === 'customers' ? 'Customer' : activeTab === 'suppliers' ? 'Supplier' : activeTab.slice(0, -1))}
          </button>
        </div>
      )}

      {/* Directory Tabs (only if more than 1 tab visible) */}
      {visibleTabs.length > 1 && (
        <div style={{ flexShrink: 0 }}>
          <ErpTabs>
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <ErpTab
                  key={tab.id}
                  type="button"
                  active={isActive}
                  onClick={() => handleTabChange(tab.id)}
                >
                  <Icon size={16} /> {tab.label} ({tab.count})
                </ErpTab>
              );
            })}
          </ErpTabs>
        </div>
      )}

      {/* Search Bar & Action Buttons (Fixed / Sticky - Customer/Employee Look) */}
      <div className="master-toolbar"
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
        {/* Left Control: Search Input */}
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
          <input className="erp-field"
            type="text"
            placeholder={
              activeTab === 'products'
                ? 'Search products by SKU, name, category...'
                : activeTab === 'warehouses'
                ? 'Search warehouses by code, name, address, contact...'
                : activeTab === 'categories'
                ? 'Search categories by code, name, remarks...'
                : `Search ${activeTab} by name, code, contact...`
            }
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setProductPage(0);
            }}
            style={{
              width: '100%',
              height: '38px',
              padding: '0 32px 0 38px',
              border: '1px solid #cbd5e1',
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
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setProductPage(0);
              }}
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

        {/* Right Controls: Status Filter, Reset, Export CSV (icon only), & Refresh (icon only) */}
        <div className={activeTab === 'suppliers' ? 'purchase-date-controls' : undefined} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
          {/* Status Filter Dropdown */}
          <ToolbarFilter
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setProductPage(0);
            }}
            style={{width:'140px'}}
            title="Filter records by status"
          >
            <option value="ALL">All Statuses</option>
            {(activeTab==='suppliers' || masterTypes.includes(activeTab)) && <option value="DRAFT">Draft</option>}
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </ToolbarFilter>

          {/* Reset Filters button */}
          {(statusFilter !== 'ALL' || searchTerm) && (
            <button className="erp-button"
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setSearchTerm('');
                setProductPage(0);
              }}
              style={{
                height: '38px',
                padding: '0 12px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f1f5f9',
                color: '#64748b',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                boxSizing: 'border-box',
              }}
              title="Reset all filters to default"
            >
              <X size={13} /> Reset
            </button>
          )}

          {/* Supplier print / other master-data CSV export */}
          <button
            type="button"
            onClick={activeTab === 'suppliers' ? () => handlePrintSuppliers() : printDirectory ? ()=>printCurrentDirectory(directoryRef.current,displayTitle) : handleExportCSV}
            style={{
              height: '38px',
              width: '38px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: 0,
              color: activeTab === 'suppliers' ? '#334155' : '#64748b',
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
              e.currentTarget.style.color = activeTab === 'suppliers' ? '#334155' : '#64748b';
            }}
            title={activeTab === 'suppliers' ? 'Print Supplier Directory (A4)' : printDirectory ? `Print ${displayTitle} (A4)` : `Export ${activeTab} to CSV`}
            aria-label={activeTab === 'suppliers' ? 'Print Supplier Directory (A4)' : printDirectory ? `Print ${displayTitle} (A4)` : `Export ${activeTab} to CSV`}
          >
            {activeTab === 'suppliers' || printDirectory ? <Printer size={15} /> : <Download size={15} />}
          </button>

          {/* Refresh Records - Icon only */}
          <button
            type="button"
            onClick={loadTabData}
            style={{
              height: '38px',
              width: '38px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: 0,
              color: activeTab === 'suppliers' ? '#334155' : '#64748b',
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
              e.currentTarget.style.color = activeTab === 'suppliers' ? '#334155' : '#64748b';
            }}
            title="Refresh records"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Master Data Tables (Fixed Frame, Sticky Header, Internal Scroll for Data Rows Only) */}
      <div className="erp-table-frame"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          overflow: 'hidden',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="erp-table-scroll" style={{ width: '100%', maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: 0 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
              Loading {activeTab} data...
            </div>
          )}

          {!loading && ['products','brands','warehouses','categories'].includes(activeTab) && <MasterDirectoryTable type={activeTab} rows={activeTab==='products'?filteredProducts:activeTab==='brands'?filteredBrands:activeTab==='warehouses'?filteredWarehouses:filteredCategories} warehouses={warehouses} getBrand={getBrandForProduct} canEdit={canEditCurrentTab} isActive={isItemActive} onView={item=>setViewingItem({...item,type:activeTab})} onEdit={handleOpenEdit} onDelete={masterDeletion.requestDeletion}/>}

          {!loading && activeTab === 'customers' && (
            <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                  <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CODE</th>
                  <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CUSTOMER NAME</th>
                  <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CONTACT PERSON</th>
                  <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PHONE / EMAIL</th>
                  <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CREDIT LIMIT</th>
                  <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CURRENT BALANCE</th>
                  <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                  <th className="erp-table-heading erp-table-actions" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td className="erp-table-cell" colSpan="8" style={{ textAlign: 'center', color: '#64748b' }}>
                      No customers found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => {
                    const active = isItemActive(c);
                    const code = c.code || c.customerCode;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setViewingItem({ ...c, code, type: 'customers' })}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        title="Click row to view customer details"
                      >
                        <td className="erp-table-cell" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{code}</td>
                        <td className="erp-table-cell" style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</td>
                        <td className="erp-table-cell" style={{ color: '#475569' }}>{c.contactPerson || '—'}</td>
                        <td className="erp-table-cell" style={{ color: '#475569' }}>{c.phone || c.email || '—'}</td>
                        <td className="erp-table-cell" style={{ fontWeight: 600, color: '#334155' }}>Rs. {Number(c.creditLimit || 0).toFixed(2)}</td>
                        <td className="erp-table-cell" style={{ color: (c.currentBalance || c.currentCredit) > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                          Rs. {Number(c.currentBalance || c.currentCredit || 0).toFixed(2)}
                        </td>
                        <td className="erp-table-cell">
                          <StatusBadge status={active ? 'Active' : 'Inactive'} onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(c.id, active);
                            }} title={`Status: ${active ? 'Active' : 'Inactive'} (Click to toggle)`}/>
                        </td>
                        <td className="erp-table-cell erp-table-actions" style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <button aria-label="Edit Customer" className="erp-table-icon-action"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit({ ...c, code });
                              }}
                              style={{
                                width: '30px',
                                height: '30px',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
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
                                e.currentTarget.style.color = '#475569';
                              }}
                              title="Edit Customer"
                            >
                              <Edit2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {!loading && activeTab === 'suppliers' && (
            <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                  <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>SUPPLIER CODE</th>
                  <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>SUPPLIER NAME</th>
                  <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>CONTACT PERSON</th>
                  <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>PHONE / EMAIL</th>
                  <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ADDRESS</th>
                  <th className="erp-table-heading" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                  <th className="erp-table-heading">REMARKS</th>
                  <th className="erp-table-heading erp-table-actions" style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td className="erp-table-cell" colSpan="8" style={{ textAlign: 'center', color: '#64748b' }}>
                      No suppliers found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((s) => {
                    const active = isItemActive(s);
                    const code = s.code || s.supplierCode;
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setViewingItem({ ...s, code, type: 'suppliers' })}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        title="Click row to view supplier details"
                      >
                        <td className="erp-table-cell" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{code}</td>
                        <td className="erp-table-cell" style={{ fontWeight: 600, color: '#0f172a' }}>{s.name || '—'}</td>
                        <td className="erp-table-cell" style={{ color: '#475569' }}>{s.contactPerson || '—'}</td>
                        <td className="erp-table-cell" style={{ color: '#475569' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxWidth: '250px' }}>
                            {s.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: 'var(--erp-text-body)', fontWeight: 500 }}><Phone size={12} aria-hidden="true" style={{ color: '#94a3b8', flexShrink: 0 }} />{s.phone}</span>}
                            {s.email && <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: 'var(--erp-text-small)', color: '#64748b' }}><Mail size={12} aria-hidden="true" style={{ color: '#94a3b8', flexShrink: 0 }} /><span style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{s.email}</span></span>}
                            {!s.phone && !s.email && '—'}
                          </div>
                        </td>
                        <td className="erp-table-cell" style={{ color: '#64748b' }}>{s.address || '—'}</td>
                        <td className="erp-table-cell">
                          <StatusBadge status={supplierStatus(s)} title={`Status: ${supplierStatus(s)}`} />
                        </td>
                        <td className="erp-table-cell" style={{color:'#64748b',maxWidth:280,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{s.remarks || '—'}</td>
                        <td className="erp-table-cell erp-table-actions" style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <button className="erp-table-icon-action" type="button" title="Edit Supplier" aria-label="Edit Supplier"
                              disabled={!canEditCurrentTab}
                              onClick={event=>{event.stopPropagation();handleOpenEdit({...s,code});}}
                              style={supplierActionStyle}
                              onMouseEnter={event=>{event.currentTarget.style.backgroundColor='#f0f9ff';}}
                              onMouseLeave={event=>{event.currentTarget.style.backgroundColor='#ffffff';}}>
                              <Edit2 size={13} />
                            </button>
                            <button className="erp-table-icon-action" type="button" title="Print Supplier Details (A4)" aria-label="Print Supplier Details (A4)"
                              onClick={event=>{event.stopPropagation();handlePrintSuppliers(s);}}
                              style={supplierActionStyle}
                              onMouseEnter={event=>{event.currentTarget.style.backgroundColor='#f0f9ff';}}
                              onMouseLeave={event=>{event.currentTarget.style.backgroundColor='#ffffff';}}>
                              <Printer size={13} />
                            </button>
                            {canEditCurrentTab && <button className="erp-table-icon-action" data-tone="danger" type="button" title="Delete Supplier" aria-label="Delete Supplier" onClick={event => { event.stopPropagation(); setDeletingSupplier(s); }}><Trash2 size={13}/></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Product Server Pagination Controls */}
        {activeTab === 'products' && (pagedProductsData?.totalPages > 1 || ((pagedProductsData?.totalElements || products.length) > productPageSize)) && (
          <div
            style={{
              padding: '8px 16px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#fafbfc',
              fontSize: 'var(--erp-text-small)',
              flexShrink: 0,
            }}
          >
            <div style={{ color: '#64748b' }}>
              Showing {productPage * productPageSize + 1} to{' '}
              {Math.min((productPage + 1) * productPageSize, pagedProductsData?.totalElements || products.length)} of{' '}
              {pagedProductsData?.totalElements || products.length} products
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className="erp-button"
                type="button"
                disabled={productPage === 0}
                onClick={() => setProductPage((p) => Math.max(0, p - 1))}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: productPage === 0 ? '#94a3b8' : '#334155',
                  cursor: productPage === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                Previous
              </button>
              <span style={{ padding: '0 6px', fontWeight: 600, color: '#334155', fontSize: 'var(--erp-text-small)' }}>
                {productPage + 1} / {pagedProductsData?.totalPages || 1}
              </span>
              <button
                className="erp-button"
                type="button"
                disabled={productPage >= (pagedProductsData?.totalPages || 1) - 1}
                onClick={() => setProductPage((p) => p + 1)}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: productPage >= (pagedProductsData?.totalPages || 1) - 1 ? '#94a3b8' : '#334155',
                  cursor: productPage >= (pagedProductsData?.totalPages || 1) - 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Details Modal */}
      {masterDeletion.deletionDialog}
      {deletingSupplier && <SupplierDeleteDialog supplier={deletingSupplier} busy={deletingBusy} onClose={() => setDeletingSupplier(null)} onConfirm={handleDeleteSupplier}/>}
      {viewingItem?.type === 'suppliers' && <SupplierDetailsModal supplier={viewingItem} active={isItemActive(viewingItem)} canManage={canEditCurrentTab}
        onClose={()=>setViewingItem(null)} onPrint={()=>handlePrintSuppliers(viewingItem)} onStatusChange={target=>handleSupplierStatus(viewingItem,target)}
        onDelete={()=>setDeletingSupplier(viewingItem)}
        onEdit={()=>{const item=viewingItem;setViewingItem(null);handleOpenEdit(item);}}/>}
      {viewingItem && masterTypes.includes(viewingItem.type) && <MasterDetailsModal record={viewingItem} type={viewingItem.type} canManage={canEditCurrentTab}
        brandName={viewingItem.brandName || brands.find(brand=>String(brand.id)===String(viewingItem.brandId))?.name}
        warehouseName={viewingItem.warehouseName || viewingItem.defaultWarehouseName || warehouses.find(warehouse=>String(warehouse.id)===String(viewingItem.warehouseId || viewingItem.defaultWarehouseId))?.name}
        onClose={()=>setViewingItem(null)} onEdit={()=>{const item=viewingItem;setViewingItem(null);handleOpenEdit(item);}}
        onStatusChange={target=>handleMasterStatus(viewingItem,target)} onDelete={()=>masterDeletion.requestDeletion(viewingItem)}/>}
      {viewingItem && viewingItem.type === 'customers' && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{ width: 'min(820px, 96vw)', maxWidth: '820px', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <span style={{ textTransform: 'uppercase', fontSize: 'var(--erp-text-caption)', fontWeight: 800, color: '#2563eb', letterSpacing: '0.05em' }}>
                  {viewingItem.type?.slice(0, -1)} Master Details
                </span>
                <h2 className="erp-dialog-title" style={{ color: '#0f172a', margin: '4px 0 0 0' }}>
                  {viewingItem.name || viewingItem.sku || viewingItem.code}
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {viewingItem.type === 'suppliers' && (
                  <button
                    type="button"
                    className="btn btn-primary erp-button erp-button-primary"

                    title="Print Supplier Details (A4)"
                    onClick={() => handlePrintSuppliers(viewingItem)}
                  >
                    <Printer size={15} /> Print
                  </button>
                )}
                <button
                  type="button"
                  title="Close"
                  aria-label="Close"
                  onClick={() => setViewingItem(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--erp-text-body)', color: '#64748b', fontWeight: 600 }}>Status</span>
                <div>
                  <StatusBadge status={recordStatus(viewingItem)} />
                </div>
              </div>

              {(viewingItem.code || viewingItem.sku || viewingItem.customerCode || viewingItem.supplierCode) && (
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--erp-text-body)', color: '#64748b', fontWeight: 600 }}>Code / Identifier</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8', fontSize: 'var(--erp-text-nav)' }}>
                    {viewingItem.code || viewingItem.sku || viewingItem.customerCode || viewingItem.supplierCode}
                  </span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--erp-text-body)', color: '#64748b', fontWeight: 600 }}>Name</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{viewingItem.name || '—'}</span>
              </div>

              {viewingItem.type === 'products' && (
                <>
                  <div style={{ display:'grid',gridTemplateColumns:'140px 1fr',gap:8,padding:'10px 14px',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color:'#64748b', fontWeight:600 }}>Selling price</span>
                    <span style={{fontWeight:600}}>LKR {Number(viewingItem.sellingPrice || 0).toFixed(2)}<small style={{ display:'block', marginTop:4, fontSize: 'var(--erp-text-caption)', fontWeight:400, color:'#64748b' }}>{viewingItem.useBrandMarkup ? `Cost + brand MP% (${Number(viewingItem.brandMarkupPercent || 0).toFixed(2)}%)` : 'Manual price'}</small></span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Category</span>
                    <span style={{ fontWeight: 600 }}>{viewingItem.categoryName || 'General / Uncategorized'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Unit of Measure</span>
                    <span style={{ fontWeight: 600 }}>{viewingItem.unitOfMeasure || 'PCS'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Default Warehouse</span>
                    <span style={{ fontWeight: 600, color: '#15803d' }}>
                      {viewingItem.warehouseName || viewingItem.defaultWarehouseName || (warehouses.find(w => String(w.id) === String(viewingItem.warehouseId || viewingItem.defaultWarehouseId))?.name) || 'Main Warehouse'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Min Stock Alert</span>
                    <span style={{ fontWeight: 700, color: viewingItem.minStockLevel > 10 ? '#059669' : '#d97706' }}>
                      {viewingItem.minStockLevel || 0} {viewingItem.unitOfMeasure || 'PCS'}
                    </span>
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Description</span>
                    <span>{viewingItem.description || 'No description provided.'}</span>
                  </div>
                </>
              )}

              {viewingItem.type === 'warehouses' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Contact Number</span>
                    <span style={{ fontWeight: 500 }}>{viewingItem.contactNumber || viewingItem.phone || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Address</span>
                    <span>{viewingItem.address || '—'}</span>
                  </div>
                </>
              )}

              {viewingItem.type === 'brands' && (
                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 'var(--erp-text-body)', color: '#64748b', fontWeight: 600 }}>MP% (Markup on cost)</span>
                  <div style={{ marginTop: '6px', fontWeight: 700 }}>{Number(viewingItem.markupPercent || 0).toFixed(2)}%</div>
                </div>
              )}

              {viewingItem.type === 'categories' && (
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Description</span>
                  <span>{viewingItem.description || 'No description provided.'}</span>
                </div>
              )}

              {viewingItem.type === 'customers' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Contact Person</span>
                    <span>{viewingItem.contactPerson || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Phone</span>
                    <span>{viewingItem.phone || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Email</span>
                    <span>{viewingItem.email || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Address</span>
                    <span>{viewingItem.address || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Credit Limit</span>
                    <span style={{ fontWeight: 600 }}>${Number(viewingItem.creditLimit || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Current Balance</span>
                    <span style={{ fontWeight: 600, color: (viewingItem.currentBalance || viewingItem.currentCredit) > 0 ? '#dc2626' : '#059669' }}>
                      ${Number(viewingItem.currentBalance || viewingItem.currentCredit || 0).toFixed(2)}
                    </span>
                  </div>
                </>
              )}

              {viewingItem.type === 'suppliers' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Contact Person</span>
                    <span>{viewingItem.contactPerson || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Phone</span>
                    <span>{viewingItem.phone || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Email</span>
                    <span>{viewingItem.email || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 'var(--erp-text-field)', color: '#64748b', fontWeight: 600 }}>Address</span>
                    <span>{viewingItem.address || '—'}</span>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap:'wrap' }}>
              <button type="button" className="btn btn-glass erp-button" onClick={() => setViewingItem(null)}>
                Close
              </button>
              {masterTypes.includes(viewingItem.type) && canEditCurrentTab && <>
                <button type="button" className="btn btn-glass erp-button" onClick={()=>handleMasterStatus(viewingItem,recordStatus(viewingItem)==='ACTIVE'?'INACTIVE':'ACTIVE')}>
                  {recordStatus(viewingItem)==='ACTIVE'?'Deactivate':recordStatus(viewingItem)==='INACTIVE'?'Reactivate':'Activate'} {masterNames[viewingItem.type]}
                </button>
                {recordStatus(viewingItem)!=='DRAFT' && <button type="button" className="btn btn-glass erp-button" onClick={()=>handleMasterStatus(viewingItem,'DRAFT')}>Return to draft</button>}
              </>}
              {canEditCurrentTab && <button type="button" className="btn btn-primary erp-button" onClick={()=>{const item=viewingItem;setViewingItem(null);handleOpenEdit(item);}}><Edit2 size={16}/> Edit Record</button>}

            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {showModal && activeTab==='customers' && (
        <div
          className="modal-backdrop"
          style={{ padding: '12px', zIndex: 1100, overflowY: 'auto' }}
        >
          <div
            className="glass-modal"
            style={{ width: 'min(820px, 96vw)', maxWidth: '820px', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <h2 className="erp-dialog-title" style={{ color: '#0f172a', margin: 0 }}>
                {editingItem ? 'Edit' : 'Create New'} {activeTab === 'categories' ? 'Category' : activeTab === 'products' ? 'Product' : activeTab.slice(0, -1)}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              {activeTab === 'customers' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CODE</label>
                      <input
                        type="text"
                        className="input-glass erp-field"
                        placeholder="e.g. CUST-0001"
                        value={modalForm.code || modalForm.customerCode || ''}
                        onChange={(e) => setModalForm({ ...modalForm, code: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CUSTOMER NAME *</label>
                      <input
                        type="text"
                        className="input-glass erp-field"
                        placeholder="e.g. Apex Engineering Ltd"
                        value={modalForm.name || ''}
                        onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CONTACT PERSON</label>
                      <input
                        type="text"
                        className="input-glass erp-field"
                        placeholder="e.g. John Doe"
                        value={modalForm.contactPerson || ''}
                        onChange={(e) => setModalForm({ ...modalForm, contactPerson: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>PHONE</label>
                      <input
                        type="text"
                        className="input-glass erp-field"
                        placeholder="e.g. +94 77 123 4567"
                        value={modalForm.phone || ''}
                        onChange={(e) => setModalForm({ ...modalForm, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>EMAIL</label>
                      <input
                        type="email"
                        className="input-glass erp-field"
                        placeholder="e.g. billing@apex.com"
                        value={modalForm.email || ''}
                        onChange={(e) => setModalForm({ ...modalForm, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CREDIT LIMIT ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-glass erp-field"
                        placeholder="0.00"
                        value={modalForm.creditLimit ?? ''}
                        onChange={(e) => setModalForm({ ...modalForm, creditLimit: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>BILLING ADDRESS</label>
                    <input
                      type="text"
                      className="input-glass erp-field"
                      placeholder="e.g. 45 Galle Road, Colombo"
                      value={modalForm.address || ''}
                      onChange={(e) => setModalForm({ ...modalForm, address: e.target.value })}
                    />
                  </div>
                </>
              )}

              {activeTab === 'suppliers' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>SUPPLIER CODE</label>
                      <input
                        type="text"
                        className="input-glass erp-field"
                        placeholder="e.g. SUPP-0001"
                        value={modalForm.code || modalForm.supplierCode || ''}
                        onChange={(e) => setModalForm({ ...modalForm, code: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>SUPPLIER NAME *</label>
                      <input
                        type="text"
                        className="input-glass erp-field"
                        placeholder="e.g. Global Steels Corp"
                        value={modalForm.name || ''}
                        onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>CONTACT PERSON</label>
                      <input
                        type="text"
                        className="input-glass erp-field"
                        placeholder="e.g. Robert Smith"
                        value={modalForm.contactPerson || ''}
                        onChange={(e) => setModalForm({ ...modalForm, contactPerson: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>PHONE</label>
                      <input
                        type="text"
                        className="input-glass erp-field"
                        placeholder="e.g. +94 11 234 5678"
                        value={modalForm.phone || ''}
                        onChange={(e) => setModalForm({ ...modalForm, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>EMAIL</label>
                    <input
                      type="email"
                      className="input-glass erp-field"
                      placeholder="e.g. orders@globalsteels.com"
                      value={modalForm.email || ''}
                      onChange={(e) => setModalForm({ ...modalForm, email: e.target.value })}
                    />
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: 'var(--erp-text-small)', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>SUPPLIER ADDRESS</label>
                    <input
                      type="text"
                      className="input-glass erp-field"
                      placeholder="e.g. 12 Industrial Zone, Kandy"
                      value={modalForm.address || ''}
                      onChange={(e) => setModalForm({ ...modalForm, address: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap:'wrap' }}>
                <button type="button" className="btn btn-glass erp-button" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary erp-button" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {statusChangeDialog}
    </div>
  );
});

export default MastersView;
