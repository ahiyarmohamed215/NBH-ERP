import React,{useState,useEffect} from 'react';
import {RotateCcw,Trash2,RefreshCw,Search} from 'lucide-react';
import {recycleBinApi} from '../api/apiClient';
import {useToast} from '../context/ToastContext';
import FilterSelect from '../components/FilterSelect';
import RecordDeleteDialog from '../components/RecordDeleteDialog';
import {useDataSync} from '../hooks/useDataSync';
const labels={SUPPLIER:'Supplier',BRAND:'Brand',WAREHOUSE:'Warehouse',CATEGORY:'Category',ALLOCATION:'Inventory allocation',USER:'Employee',CUSTOMER:'Customer'};
export default function RecycleBinView() {
 const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[search,setSearch]=useState(''),[type,setType]=useState('ALL'),[deleting,setDeleting]=useState(null);const {addToast}=useToast();
 const load=async()=>{setLoading(true);setError('');try{const res=await recycleBinApi.getAll();setItems(res.data || []);}catch(error){setError(error.response?.data?.message || error.message || 'Unable to load recycle bin');}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 useDataSync(load,['erp:data_changed']);
 const change=async(record,permanent)=>{if(busy)return;setBusy(true);try{if(permanent)await recycleBinApi.permanentlyDelete(record.type,record.id);else await recycleBinApi.restore(record.type,record.id);setDeleting(null);await load();addToast(permanent?'Record permanently deleted':'Record restored','success');}catch(error){addToast(error.response?.data?.message || error.message || 'Unable to update record','error');}finally{setBusy(false);}};
 const filtered=items.filter(record=>(type==='ALL' || type===record.type) && `${record.name} ${record.code} ${labels[record.type]}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="erp-page purchasing-no-shadows" style={{display:'flex',flexDirection:'column',gap:16,flex:1,minHeight:0}}>
  <h1 style={{margin:0}}>Recycle bin</h1><p style={{margin:0,color:'#475569'}}>Deleted records from across the ERP. Restore them to their previous status, or permanently remove them.</p>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><label style={{display:'flex',gap:8,alignItems:'center',flex:1,minWidth:180}}><Search size={16}/><input className="erp-field" aria-label="Search recycle bin" placeholder="Search deleted records…" value={search} onChange={event=>setSearch(event.target.value)}/></label><FilterSelect style={{width:190}} value={type} onChange={event=>setType(event.target.value)} aria-label="Recycle bin record type"><option value="ALL">All record types</option>{Object.entries(labels).map(([type,label])=><option key={type} value={type}>{label}</option>)}</FilterSelect><button className="btn btn-glass erp-button" aria-label="Refresh recycle bin" disabled={loading || busy} onClick={load}><RefreshCw size={16}/></button></div>
  {error && <p role="alert">{error}</p>}<div className="erp-table-frame"><div className="erp-table-scroll"><table className="erp-table" style={{minWidth:720}}><thead><tr><th>Record type</th><th>Code</th><th>Name</th><th>Deleted on</th><th className="erp-table-actions">Actions</th></tr></thead><tbody>{loading?<tr><td colSpan={5}>Loading deleted records…</td></tr>:filtered.length?filtered.map(record=><tr key={`${record.type}:${record.id}`}><td>{labels[record.type] || record.type}</td><td>{record.code}</td><td>{record.name || '—'}</td><td>{new Date(record.deletedAt).toLocaleString()}</td><td className="erp-table-actions"><div style={{display:'flex',gap:6,justifyContent:'flex-end'}}><button className="erp-table-icon-action" title="Restore record" aria-label={`Restore ${record.type} ${record.code}`} disabled={busy} onClick={()=>change(record,false)}><RotateCcw size={13}/></button><button className="erp-table-icon-action" data-tone="danger" title="Delete permanently" aria-label={`Permanently delete ${record.type} ${record.code}`} disabled={busy} onClick={()=>setDeleting(record)}><Trash2 size={13}/></button></div></td></tr>):<tr><td colSpan={5}>{items.length?'No deleted records match your filters.':'Recycle bin is empty.'}</td></tr>}</tbody></table></div></div>
  {deleting && <RecordDeleteDialog record={deleting} label={labels[deleting.type]} permanent busy={busy} onClose={()=>setDeleting(null)} onConfirm={()=>change(deleting,true)}/>}
 </div>;
}
