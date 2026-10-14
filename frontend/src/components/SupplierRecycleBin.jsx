import React, { useEffect, useState } from 'react';
import { ArrowLeft, RotateCcw, Trash2, RefreshCw } from 'lucide-react';
import { supplierApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import SupplierDeleteDialog from './SupplierDeleteDialog';

export default function SupplierRecycleBin({ onBack, onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');
  const { addToast } = useToast();
  const load = async () => {
    setLoading(true); setError('');
    try { const response = await supplierApi.getRecycleBin(); setItems(response.data || []); }
    catch (failure) { setError(failure.response?.data?.message || failure.message || 'Unable to load recycle bin'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const change = async (supplier, permanent) => {
    if (busy) return;
    setBusy(true);
    try {
      if (permanent) await supplierApi.permanentlyDelete(supplier.id);
      else await supplierApi.restore(supplier.id);
      setDeleting(null); await load(); await onChanged();
      addToast(permanent ? 'Supplier permanently deleted' : 'Supplier restored', 'success');
    } catch (failure) { addToast(failure.response?.data?.message || failure.message || 'Unable to update supplier', 'error'); }
    finally { setBusy(false); }
  };
  return <div className="erp-page purchasing-no-shadows" style={{display:'flex',flexDirection:'column',gap:16,minHeight:0,flex:1}}>
    <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
      <button className="btn btn-secondary" onClick={onBack} disabled={busy}><ArrowLeft size={16}/> Supplier list</button>
      <h2 style={{margin:0,fontSize:'var(--erp-text-title, 20px)'}}>Supplier recycle bin</h2>
      <button className="btn btn-glass erp-button" style={{width:30,height:30,padding:0,flexShrink:0}} aria-label="Refresh recycle bin" disabled={busy || loading} onClick={load}><RefreshCw size={14}/></button>
    </div>
    <p style={{margin:0,color:'#475569'}}>Restore suppliers to their previous status, or permanently remove them. Linked records remain available.</p>
    {error && <p role="alert">{error}</p>}
    <div className="erp-table-frame"><div className="erp-table-scroll"><table className="erp-table" style={{minWidth:720}}>
      <thead><tr><th>Supplier code</th><th>Supplier name</th><th>Deleted on</th><th className="erp-table-actions">Actions</th></tr></thead>
      <tbody>{loading ? <tr><td colSpan={4}>Loading deleted suppliers…</td></tr> : items.length ? items.map(supplier => <tr key={supplier.id}>
        <td>{supplier.supplierCode || supplier.code}</td><td>{supplier.name}</td><td>{supplier.deletedAt ? new Date(supplier.deletedAt).toLocaleString() : '—'}</td>
        <td className="erp-table-actions"><div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
          <button className="erp-table-icon-action" aria-label={`Restore ${supplier.supplierCode}`} title="Restore supplier" disabled={busy} onClick={() => change(supplier,false)}><RotateCcw size={13}/></button>
          <button className="erp-table-icon-action" data-tone="danger" aria-label={`Permanently delete ${supplier.supplierCode}`} title="Delete permanently" disabled={busy} onClick={() => setDeleting(supplier)}><Trash2 size={13}/></button>
        </div></td>
      </tr>) : <tr><td colSpan={4}>Recycle bin is empty.</td></tr>}</tbody>
    </table></div></div>
    {deleting && <SupplierDeleteDialog supplier={deleting} permanent busy={busy} onClose={() => setDeleting(null)} onConfirm={() => change(deleting,true)}/>}
  </div>;
}
