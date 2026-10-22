import React,{useState,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import CustomerRangeBadge from './CustomerRangeBadge';
import MonthFilter,{currentBusinessMonth} from './MonthFilter';
import {salesApi} from '../api/apiClient';
import StatusBadge from './StatusBadge';
import './PurchaseInspectionModal.css';
import './PosRangeProgress.css';
import {X,Trophy,ChevronLeft,ChevronRight,RotateCcw} from 'lucide-react';
export const posMoney=value=>`Rs. ${Number(value || 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const bounded=value=>Math.max(0,Math.min(100,Number(value)||0));
export function RangeMeter({milestone,label}) {
 if(!milestone)return null;
 const confirmed=bounded(milestone.completedPercent),bill=Math.min(100-confirmed,bounded(milestone.billPercent));
 return <div className="pos-meter" role="progressbar" aria-label={label || milestone.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={confirmed+bill} aria-valuetext={`${posMoney(milestone.projectedAmount)} of ${posMoney(milestone.goal)}`}>
  <span style={{width:`${confirmed}%`}}/><span className="pos-meter-bill" style={{width:`${bill}%`}}/>
 </div>;
}
function Milestone({value,range,campaign,endDate}) {
 const completed=Number(value.completedAmount || 0),goal=Number(value.goal || 0),remaining=Math.max(0,goal-completed);
 const percent=goal<=0?100:Math.round(bounded(completed*100/goal));
 const achieved=remaining===0;
 return <div className="pos-milestone" role="listitem">
  <div className="pos-milestone-heading"><div className="pos-goal-name">{range?<CustomerRangeBadge name={value.name}/>:<strong>{value.name}</strong>}{campaign && <small>{campaign}</small>}</div><StatusBadge status={achieved?'COMPLETED':'PENDING'} label={achieved?'Achieved':'In progress'}/></div>
  <div className="pos-goal-row-values"><span>Goal <strong>{posMoney(goal)}</strong></span><span>Remaining <strong>{posMoney(remaining)}</strong></span><span className="pos-goal-row-percent">{percent}%</span></div>
  <RangeMeter milestone={{...value,projectedAmount:completed,completedPercent:percent,billPercent:0}}/>
  {(value.reward || endDate) && <div className="pos-goal-extra">{value.reward && <span>Reward: <strong>{value.reward}</strong></span>}{endDate && <span>Ends {new Date(`${endDate}T00:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</span>}</div>}
 </div>;
}
export default function PosRangeProgress({customer,progress:baseProgress,loading:baseLoading,onClose}) {
 const [page,setPage]=useState(null);
 const baseMonth=baseProgress?.periodStart?.slice(0,7) || currentBusinessMonth();
 const [month,setMonth]=useState(baseMonth),[historical,setHistorical]=useState(null),[monthLoading,setMonthLoading]=useState(false),[monthError,setMonthError]=useState('');
 const progress=month===baseMonth?baseProgress:historical;
 const loading=month===baseMonth?baseLoading:monthLoading;
 useEffect(()=>{
  if(month===baseMonth)return;
  let alive=true;setMonthLoading(true);setHistorical(null);setMonthError('');
  salesApi.getPosProgress({customerId:customer?.id,month}).then(response=>{if(alive)setHistorical(response.data?.data || response.data);}).catch(()=>{if(alive)setMonthError('Could not load this month. Choose another month or try again.');}).finally(()=>{if(alive)setMonthLoading(false);});
  return()=>{alive=false;};
 },[month,baseMonth,customer?.id]);
 const dialog=useRef(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement;
  dialog.current?.querySelector('[aria-label="Close ranges"]')?.focus();
  const keydown=event=>{
   if(document.querySelector('.modern-filter-popup,.month-filter-popover'))return;
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();}
   if(event.key==='Tab'){
    const controls=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')],first=controls[0],last=controls.at(-1);
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  document.addEventListener('keydown',keydown,true);
  return()=>{document.removeEventListener('keydown',keydown,true);previous?.focus?.();};
 },[]);
 const goals=[...(progress?.ranges || []).map(value=>({value,range:true})),...(progress?.targets || []).flatMap(target=>(target.milestones || []).map(value=>({value,range:false,campaign:target.name,endDate:target.endDate})))];
 const firstPending=goals.findIndex(({value})=>Number(value.completedAmount || 0)<Number(value.goal || 0));
 const pageCount=Math.max(1,Math.ceil(goals.length/3));
 const currentPage=Math.max(0,Math.min(page ?? Math.floor(Math.max(0,firstPending)/3),pageCount-1));
 const visible=goals.slice(currentPage*3,currentPage*3+3);
 return createPortal(<div className="modal-backdrop pos-range-backdrop" onClick={onClose}>
  <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="pos-ranges-title" className="purchase-inspection pos-range-dialog" onClick={event=>event.stopPropagation()}>
   <header className="purchase-inspection-header purchase-inspection-header-details">
    <div className="purchase-inspection-header-main"><div className="purchase-inspection-title"><div className="grn-inspection-symbol"><Trophy size={22} strokeWidth={1.7}/></div><div><h2 id="pos-ranges-title" className="erp-dialog-title">Ranges & Targets</h2><div className="pos-range-customer"><span>{customer?.name}</span><CustomerRangeBadge name={progress?.currentRangeName || 'Standard'}/></div></div></div><div className="purchase-inspection-header-controls"><button type="button" className="purchase-inspection-close" aria-label="Close ranges" onClick={onClose}><X size={18}/></button></div></div>
   </header>
   <div className="pos-goal-body">
     <section className="pos-range-card" aria-label="Range and target progress">
      <div className="pos-range-card-summary"><div><span>Monthly total</span><strong>{loading || !progress?'—':posMoney(progress.monthlyPurchases)}</strong></div><MonthFilter label="Range month" value={month} onChange={value=>{setMonth(value);setPage(null);}}/></div>
      {loading?<div className="pos-range-message" role="status"><RotateCcw size={20} className="animate-spin"/>Loading progress...</div>:!progress?<p className="pos-range-message" role="status">{monthError || 'Progress is unavailable. Close and reopen to try again.'}</p>:<>
      {visible.length ? <div className="pos-goal-list" role="list">{visible.map((item,index)=><Milestone key={`${currentPage}-${index}`} {...item}/>)}</div> : <div className="pos-goal-empty"><Trophy size={24}/><strong>No ranges or targets configured</strong></div>}
      {pageCount>1 && <nav className="pos-goal-navigation" aria-label="Goal navigation"><button type="button" className="btn btn-glass erp-button" aria-label="Previous goal" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}><ChevronLeft size={14}/>Previous</button><span>{currentPage+1} of {pageCount}</span><button type="button" className="btn btn-glass erp-button" aria-label="Next goal" disabled={currentPage===pageCount-1} onClick={()=>setPage(currentPage+1)}>Next<ChevronRight size={14}/></button></nav>}
      </>}
     </section>
   </div>
  </section>
 </div>,document.body);
}
