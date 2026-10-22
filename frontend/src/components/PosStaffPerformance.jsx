import React,{useEffect,useState,useRef} from 'react';
import {createPortal} from 'react-dom';
import {Trophy,Medal,ChevronLeft,ChevronRight,X} from 'lucide-react';
import {salesApi} from '../api/apiClient';
import {posMoney} from './PosRangeProgress';
import CustomerRangeBadge from './CustomerRangeBadge';
import MonthFilter,{currentBusinessMonth} from './MonthFilter';
import './PurchaseInspectionModal.css';
import './PosStaffPerformance.css';

export default function PosStaffPerformance({user,month:selectedMonth,showMonthFilter=true}) {
 const [localMonth,setMonth]=useState(currentBusinessMonth),[page,setPage]=useState(0),[data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[selected,setSelected]=useState(null);
 const month=selectedMonth || localMonth;
 useEffect(()=>{let alive=true,sequence=0;
  const load=async()=>{const request=++sequence;try{const response=await salesApi.getPosStaffPerformance({month});if(alive && request===sequence){setData(response.data?.data || response.data);setError('');}}catch(e){if(alive && request===sequence)setError(e.response?.data?.message || 'Unable to load staff rankings.');}finally{if(alive && request===sequence)setLoading(false);}};
  setLoading(true);setData(null);setPage(0);setSelected(null);load();const timer=setInterval(load,30000);return()=>{alive=false;clearInterval(timer);};
 },[month]);
 const staff=data?.staff || [];
 const pages=Math.max(1,Math.ceil(staff.length/8)),current=Math.min(page,pages-1),visible=staff.slice(current*8,current*8+8);
 const person=staff.find(row=>row.username===selected);
 return <section className="pos-staff-performance" aria-busy={loading} aria-label="POS staff performance">
  {showMonthFilter && <div className="pos-performance-toolbar"><MonthFilter label="Performance month" value={month} onChange={setMonth}/></div>}
  {error?<p role="alert" className="pos-performance-error">{error}</p>:loading && !data?<p className="pos-performance-loading" role="status">Loading rankings...</p>:<>
   <div className="erp-table-frame erp-table-scroll pos-performance-table"><table className="erp-table"><thead><tr>{['Rank','Staff','Sales value','Bills','Ranges achieved','Targets achieved'].map(label=><th key={label} className="erp-table-heading">{label}</th>)}</tr></thead><tbody>
    {visible.map(row=><tr key={row.username} data-current={row.username===user?.username} onClick={()=>setSelected(row.username)}>
     <td className="erp-table-cell"><span className={`pos-rank pos-rank-${row.rank<=3?row.rank:'other'}`}>{row.rank<=3 && <Medal size={14} aria-hidden="true"/>}#{row.rank}</span></td>
     <td className="erp-table-cell"><div className="pos-leader-name-line"><button type="button" className="pos-staff-name" aria-label={`View performance for ${row.fullName || row.username}`} onClick={()=>setSelected(row.username)}>{row.fullName || row.username}</button>{row.username===user?.username && <span className="pos-leader-you">You</span>}</div></td>
     <td className="erp-table-cell pos-performance-money">{posMoney(row.originalAmount)}</td><td className="erp-table-cell">{row.billCount || 0}</td><td className="erp-table-cell">{row.rangeMilestones || 0}</td><td className="erp-table-cell"><span className="pos-performance-achieved"><Trophy size={13}/>{row.targetAchievements?.length || 0}</span></td>
    </tr>)}
    {!visible.length && <tr><td colSpan={6} className="erp-table-cell">No staff rankings for this month.</td></tr>}
   </tbody></table></div>
   {pages>1 && <nav className="pos-performance-pagination" aria-label="Ranking pages"><span>{current+1} of {pages}</span><div><button type="button" className="erp-table-icon-action" aria-label="Previous staff page" disabled={current===0} onClick={()=>setPage(current-1)}><ChevronLeft size={15}/></button><button type="button" className="erp-table-icon-action" aria-label="Next staff page" disabled={current===pages-1} onClick={()=>setPage(current+1)}><ChevronRight size={15}/></button></div></nav>}
  </>}
  {person && <StaffDetails person={person} staff={staff} month={month} onClose={()=>setSelected(null)}/>}
 </section>;
}
function StaffDetails({person,staff,month,onClose}) {
 const dialog=useRef(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const previous=document.activeElement;dialog.current?.querySelector('button')?.focus();
  const key=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();}if(event.key==='Tab'){event.preventDefault();dialog.current?.querySelector('button')?.focus();}};
  document.addEventListener('keydown',key,true);return()=>{document.removeEventListener('keydown',key,true);previous?.focus?.();};
 },[]);
 const value=Number(person.originalAmount || 0),leader=Number(staff[0]?.originalAmount || 0),ahead=staff.filter(row=>Number(row.originalAmount)>value).at(-1);
 const gap=ahead?Number(ahead.originalAmount)-value:0;
 const percent=leader>0?Math.min(100,Math.round(value*100/leader)):0;
 const period=new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
 return createPortal(<div className="modal-backdrop pos-staff-detail-backdrop" onClick={onClose}><section ref={dialog} role="dialog" aria-modal="true" aria-label="Staff performance details" className="purchase-inspection pos-staff-details" onClick={event=>event.stopPropagation()}>
  <header className="purchase-inspection-header"><div className="purchase-inspection-title"><span className={`pos-rank pos-rank-${person.rank<=3?person.rank:'other'}`}><Medal size={16}/>#{person.rank}</span><div><h2 className="erp-dialog-title">{person.fullName || person.username}</h2><p>{period}</p></div></div><button type="button" className="purchase-inspection-close" aria-label="Close staff performance" onClick={onClose}><X size={18}/></button></header>
  <div className="pos-staff-detail-body">
   <dl className="purchase-inspection-details-card pos-staff-metrics">{[['Sales value',posMoney(value)],['Bills',person.billCount || 0],['Ranges achieved',person.rangeMilestones || 0],['Targets achieved',person.targetAchievements?.length || 0]].map(([label,total])=><div key={label}><dt>{label}</dt><dd>{total}</dd></div>)}</dl>
   <div className="pos-staff-challenge"><strong>{!leader?'Make the first sale this month':ahead?`${posMoney(gap)} to match rank #${ahead.rank}`:'Leading this month'}</strong><div className="pos-staff-leader-meter" role="progressbar" aria-label="Sales compared with first place" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${percent}%`}}/></div><span>{percent}% of the leading sales value</span></div>
   {Boolean(person.customerRanges?.length) && <div className="pos-staff-range-summary"><span>Customer ranges</span><div>{person.customerRanges.map(range=><span key={range.name}><CustomerRangeBadge name={range.name}/><strong>{range.customers}</strong></span>)}</div></div>}
  </div>
 </section></div>,document.body);
}
