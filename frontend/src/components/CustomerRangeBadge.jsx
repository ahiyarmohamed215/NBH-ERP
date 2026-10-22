import React,{createContext,useContext,useEffect,useState} from 'react';
import {Award,Medal} from 'lucide-react';
import {customerMonthlyRangeApi} from '../api/apiClient';
import {hasPermission} from '../utils/moduleAccess';
import {defaultBadgeRanges,getRangeBadgeAppearance} from '../utils/customerRangeBadges';
import './CustomerRangeBadge.css';

const RangeBadgeContext=createContext(defaultBadgeRanges);
export function CustomerRangeBadgeProvider({user,children}) {
  const [ranges,setRanges]=useState(defaultBadgeRanges);
  const allowed=hasPermission(user,'CUSTOMER_TARGET_VIEW') || hasPermission(user,'CUSTOMER_TARGET_MANAGE') || hasPermission(user,'SALES_CREATE');
  useEffect(()=>{
    let alive=true,sequence=0;
    setRanges(defaultBadgeRanges);
    const load=async()=>{const request=++sequence;try{const response=await customerMonthlyRangeApi.getAllRanges();const data=response.data?.data || response.data;if(alive && request===sequence && Array.isArray(data) && data.length)setRanges(data);}catch{/* Keep badges available when range setup is unavailable. */}};
    const refresh=event=>{if(!event.detail?.topics || event.detail.topics.includes('targets'))load();};
    if(allowed){load();window.addEventListener('erp:targets_updated',refresh);window.addEventListener('erp:realtime_sync',refresh);}
    return()=>{alive=false;window.removeEventListener('erp:targets_updated',refresh);window.removeEventListener('erp:realtime_sync',refresh);};
  },[allowed,user?.username]);
  return <RangeBadgeContext.Provider value={ranges}>{children}</RangeBadgeContext.Provider>;
}
export function useCustomerBadgeRanges(){return useContext(RangeBadgeContext);}
export default function CustomerRangeBadge({name,code,id,ranges,className='',style}) {
  const configured=useCustomerBadgeRanges();
  const appearance=getRangeBadgeAppearance({name,code,id},ranges || configured);
  const Icon=['gold','silver','bronze'].includes(appearance.tone)?Medal:Award;
  return <span className={`customer-range-badge ${className}`} data-range-tone={appearance.tone}
    title={`${appearance.label} range · ${name || code || 'Standard'}`} style={{'--range-badge-bg':appearance.bg,'--range-badge-text':appearance.text,'--range-badge-border':appearance.border,...style}}>
    <Icon size={12} aria-hidden="true"/>{name || code || 'Standard'}
  </span>;
}
