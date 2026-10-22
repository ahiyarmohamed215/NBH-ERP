import React from 'react';
import CustomerRangeBadge from './CustomerRangeBadge';
import {ChevronRight, CheckCircle} from 'lucide-react';
import {RangeMeter, posMoney} from './PosRangeProgress';
import './PosRangePreview.css';

export default function PosRangePreview({progress,loading,customer,onClick}) {
  if(!customer)return <button type="button" className="pos-range-preview pos-range-preview-empty" disabled aria-label="Select a customer to view ranges and targets">
    <span className="pos-range-route"><span className="pos-range-current">Ranges &amp; targets</span></span>
    <span className="pos-range-preview-message">Select a customer to see their next goal</span>
  </button>;
  const goal=progress?.nextRange;
  const percent=Math.max(0,Math.min(100,Math.round(Number(goal?.completedPercent || 0)+Number(goal?.billPercent || 0))));
  const achieved=Boolean(progress?.highestRange),ready=goal?.state==='WITH_BILL';
  const current=progress?.currentRangeName || 'Customer range';
  return <button type="button" className="pos-range-preview" data-achieved={achieved || ready} onClick={onClick} title="View all ranges and campaign targets" aria-label="View customer ranges and targets" aria-busy={loading}>
    <span className="pos-range-route"><span className="pos-range-current"><CustomerRangeBadge name={current}/></span><span className="pos-range-destination">{achieved?'Top range achieved':goal?<>Next: <CustomerRangeBadge name={progress.nextRangeName || goal.name}/></>:'Ranges & targets'}<ChevronRight size={14}/></span></span>
    {loading?<span className="pos-range-preview-message">Updating customer progress…</span>:goal && !achieved?<>
      <span className="pos-range-finish"><strong>{ready?<><CheckCircle size={16}/>Ready to unlock</>:<>{posMoney(goal.remaining)} <span>to unlock</span></>}</strong><span className="pos-range-percent">{percent}%</span></span>
      <RangeMeter milestone={goal} label="Next monthly range"/>
      <span className="pos-range-foot"><span>{posMoney(goal.projectedAmount)} / {posMoney(goal.goal)}</span><span>{ready?'Send this bill to achieve it':Number(goal.billPercent)>0?'Includes current bill':percent>=75?'You’re getting close':'Every sent bill counts'}</span></span>
    </>:<span className="pos-range-preview-message">{achieved?<><CheckCircle size={16}/>All monthly ranges achieved. View your targets.</>:customer?'View monthly goals and campaign rewards':'Select a customer to see their next goal'}</span>}
  </button>;
}
