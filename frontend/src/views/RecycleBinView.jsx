import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Trash2,
  RefreshCw,
  Search,
  X,
  Eye,
  Package,
  Truck,
  Tag,
  Warehouse,
  FolderTree,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { recycleBinApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import FilterSelect from '../components/FilterSelect';
import RecordDeleteDialog from '../components/RecordDeleteDialog';
import RecycleBinDetailsModal, { formatRecycleBinDate } from '../components/RecycleBinDetailsModal';
import { useDataSync } from '../hooks/useDataSync';
import '../components/PurchasingAppearance.css';

const labels = {
  PRODUCT: 'Product',
  SUPPLIER: 'Supplier',
  BRAND: 'Brand',
  WAREHOUSE: 'Warehouse',
  CATEGORY: 'Category',
  ALLOCATION: 'Inventory allocation',
  USER: 'Employee',
  CUSTOMER: 'Customer',
};

const entityIcons = {
  PRODUCT: Package,
  SUPPLIER: Truck,
  BRAND: Tag,
  WAREHOUSE: Warehouse,
  CATEGORY: FolderTree,
  ALLOCATION: ShieldCheck,
  USER: Users,
  CUSTOMER: Users,
};

export default function RecycleBinView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('ALL');
  const [deleting, setDeleting] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await recycleBinApi.getAll();
      setItems(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load recycle bin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useDataSync(load, ['erp:data_changed']);

  const change = async (record, permanent) => {
    if (busy) return;
    setBusy(true);
    try {
      if (permanent) {
        await recycleBinApi.permanentlyDelete(record.type, record.id);
      } else {
        await recycleBinApi.restore(record.type, record.id);
      }
      setDeleting(null);
      setViewingRecord(null);
      await load();
      addToast(permanent ? 'Record permanently deleted' : 'Record restored', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || err.message || 'Unable to update record', 'error');
    } finally {
      setBusy(false);
    }
  };

  const filtered = items.filter(
    (record) =>
      (type === 'ALL' || type === record.type) &&
      `${record.name} ${record.code} ${labels[record.type] || record.type}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  return (
    <div
      className="erp-page purchasing-no-shadows"
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
      {/* Page Header (Purchasing / GRN Page Header Style) */}
      <div
        className="erp-page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexShrink: 0,
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '2px',
        }}
      >
        <div>
          <h1
            className="erp-page-title"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#fee2e2',
                color: '#dc2626',
              }}
            >
              <Trash2 size={20} />
            </span>
            Recycle Bin
          </h1>
          <p className="erp-page-description" style={{ margin: '4px 0 0', color: '#475569' }}>
            Deleted records from across the ERP. Restore them to their previous status, or permanently remove them.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: 'var(--erp-text-small)',
              color: '#475569',
              fontWeight: 600,
              background: '#f1f5f9',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
            }}
          >
            Total Deleted: <strong style={{ color: '#0284c7' }}>{items.length}</strong>
          </span>
        </div>
      </div>

      {/* Top Filter & Actions Bar (Sticky Toolbar Card - GRN Page Look) */}
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
        {/* Left: Search Input with clear button */}
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
            className="erp-field"
            type="text"
            placeholder="Search deleted records by code, name, or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search recycle bin"
            style={{
              width: '100%',
              height: '38px',
              padding: '0 32px 0 38px',
              border: '1px solid #cbd5e1',
              outline: 'none',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              boxSizing: 'border-box',
              boxShadow: 'none',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#0284c7';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
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
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Right Controls: FilterSelect, Reset, Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
          <FilterSelect
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Recycle bin record type"
            style={{ width: '190px' }}
          >
            <option value="ALL">All record types</option>
            {Object.entries(labels).map(([t, label]) => (
              <option key={t} value={t}>
                {label}
              </option>
            ))}
          </FilterSelect>

          {(type !== 'ALL' || search) && (
            <button
              className="erp-button"
              type="button"
              onClick={() => {
                setType('ALL');
                setSearch('');
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
              aria-label="Reset filters"
            >
              <X size={13} /> Reset
            </button>
          )}

          <button
            type="button"
            onClick={load}
            style={{
              height: '38px',
              width: '38px',
              minWidth: '38px',
              padding: 0,
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#334155',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxSizing: 'border-box',
              flexShrink: 0,
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
              e.currentTarget.style.color = '#334155';
            }}
            title="Refresh records"
            aria-label="Refresh recycle bin"
            disabled={loading || busy}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && <p role="alert" style={{ color: '#dc2626', margin: 0 }}>{error}</p>}

      {/* Recycle Bin Table (Fixed Table Frame, Sticky Header, Internal Scroll - Exact GRN Look) */}
      <div
        className="erp-table-frame"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          overflow: 'hidden',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          boxShadow: 'none',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="erp-table-scroll"
          style={{
            width: '100%',
            maxWidth: '100%',
            overflowY: 'auto',
            overflowX: 'auto',
            flex: 1,
            minHeight: 0,
          }}
        >
          <table
            className="erp-table"
            style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left' }}
          >
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
                <th
                  className="erp-table-heading"
                  style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}
                >
                  RECORD TYPE
                </th>
                <th
                  className="erp-table-heading"
                  style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}
                >
                  CODE
                </th>
                <th
                  className="erp-table-heading"
                  style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}
                >
                  NAME / DESCRIPTION
                </th>
                <th
                  className="erp-table-heading"
                  style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}
                >
                  DELETED ON
                </th>
                <th
                  className="erp-table-heading erp-table-actions"
                  style={{
                    textAlign: 'right',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    className="erp-table-cell"
                    colSpan={5}
                    style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}
                  >
                    Loading deleted records…
                  </td>
                </tr>
              ) : filtered.length ? (
                filtered.map((record) => {
                  const TypeIcon = entityIcons[record.type] || Package;
                  return (
                    <tr
                      key={`${record.type}:${record.id}`}
                      onClick={() => setViewingRecord(record)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        transition: 'background-color 0.1s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      title="Click row to view complete details"
                    >
                      <td className="erp-table-cell">
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            fontSize: 'var(--erp-text-caption)',
                            fontWeight: 600,
                          }}
                        >
                          <TypeIcon size={14} style={{ color: '#64748b' }} />
                          {labels[record.type] || record.type}
                        </span>
                      </td>
                      <td className="erp-table-cell">
                        <span
                          className="erp-table-code"
                          style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}
                        >
                          {record.code}
                        </span>
                      </td>
                      <td className="erp-table-cell" style={{ fontWeight: 600, color: '#0f172a' }}>
                        {record.name || '—'}
                      </td>
                      <td className="erp-table-cell erp-table-date" style={{ color: '#475569' }}>
                        {formatRecycleBinDate(record.deletedAt)}
                      </td>
                      <td className="erp-table-cell erp-table-actions" style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <button
                            type="button"
                            className="erp-table-icon-action"
                            title="View details"
                            aria-label={`View ${record.type} ${record.code}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingRecord(record);
                            }}
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            className="erp-table-icon-action"
                            title="Restore record"
                            aria-label={`Restore ${record.type} ${record.code}`}
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              change(record, false);
                            }}
                            style={{
                              borderColor: '#bbf7d0',
                              color: '#16a34a',
                            }}
                          >
                            <RotateCcw size={13} />
                          </button>
                          <button
                            type="button"
                            className="erp-table-icon-action"
                            data-tone="danger"
                            title="Delete permanently"
                            aria-label={`Permanently delete ${record.type} ${record.code}`}
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleting(record);
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    className="erp-table-cell"
                    colSpan={5}
                    style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}
                  >
                    {items.length ? 'No deleted records match your filters.' : 'Recycle bin is empty.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspection Modal: Supplier & GRN Inspection theme */}
      {viewingRecord && (
        <RecycleBinDetailsModal
          record={viewingRecord}
          label={labels[viewingRecord.type] || viewingRecord.type}
          busy={busy}
          onClose={() => setViewingRecord(null)}
          onRestore={(rec) => change(rec, false)}
          onDelete={(rec) => setDeleting(rec)}
        />
      )}

      {/* Permanent Deletion Confirmation Dialog */}
      {deleting && (
        <RecordDeleteDialog
          record={deleting}
          label={labels[deleting.type] || deleting.type}
          permanent
          busy={busy}
          onClose={() => setDeleting(null)}
          onConfirm={() => change(deleting, true)}
        />
      )}
    </div>
  );
}
