import React, {useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Calendar, ChevronLeft, ChevronRight, X} from 'lucide-react';
import './DateRangePicker.css';
import './PurchasingAppearance.css';

const key = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const parse = value => new Date(`${value}T12:00:00`);
const label = value => value ? parse(value).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '';

export function matchesDateRange(value, from, to) {
  if(!from && !to) return true;
  const date=value?.slice(0,10);
  return Boolean(date && (!from || date>=from) && (!to || date<=to));
}

export function dateRangePosition(rect, viewport, contentHeight, preferredWidth=340) {
  const margin=12, leftEdge=(viewport.left || 0)+margin, topEdge=(viewport.top || 0)+margin;
  const width=Math.min(preferredWidth,Math.max(0,viewport.width-margin*2));
  const maxHeight=Math.max(0,viewport.height-margin*2), height=Math.min(contentHeight || 400,maxHeight);
  const rightEdge=(viewport.left || 0)+viewport.width-margin;
  const bottomEdge=(viewport.top || 0)+viewport.height-margin;
  const below=rect.bottom+8, above=rect.top-height-8;
  const preferred=below+height<=bottomEdge ? below : above>=topEdge ? above : below;
  return {width,maxHeight,left:Math.max(leftEdge,Math.min(rect.right-width,rightEdge-width)),top:Math.max(topEdge,Math.min(preferred,bottomEdge-height))};
}

export default function DateRangePicker({from, to, onChange, documentType='PO'}) {
  const [open,setOpen]=useState(false);
  const [month,setMonth]=useState(()=>new Date());
  const [start,setStart]=useState('');
  const [end,setEnd]=useState('');
  const [selectingEnd,setSelectingEnd]=useState(false);
  const [hover,setHover]=useState('');
  const [position,setPosition]=useState({});
  const anchor=useRef(null), popup=useRef(null);
  useLayoutEffect(()=>{
    if(!open) return;
    const reposition=()=>{
      const rect=anchor.current.getBoundingClientRect();
      const viewport=window.visualViewport;
      const next=dateRangePosition(rect,{width:viewport?.width || window.innerWidth,height:viewport?.height || window.innerHeight,left:viewport?.offsetLeft || 0,top:viewport?.offsetTop || 0},popup.current?.getBoundingClientRect().height);
      setPosition(previous=>Object.keys(next).every(key=>previous[key]===next[key]) ? previous : next);
    };
    const outside=event=>{if(!anchor.current?.contains(event.target) && !popup.current?.contains(event.target)) setOpen(false);};
    const escape=event=>{if(event.key==='Escape') {setOpen(false);anchor.current?.focus();}};
    reposition();
    popup.current?.querySelector('[data-selected="true"], [data-today="true"], .date-range-day')?.focus();
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    window.addEventListener('resize',reposition);window.addEventListener('scroll',reposition,true);
    window.visualViewport?.addEventListener('resize',reposition);window.visualViewport?.addEventListener('scroll',reposition);
    const observer=typeof ResizeObserver==='undefined' ? null : new ResizeObserver(reposition);
    if(popup.current) observer?.observe(popup.current);
    return ()=>{observer?.disconnect();document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);window.removeEventListener('resize',reposition);window.removeEventListener('scroll',reposition,true);window.visualViewport?.removeEventListener('resize',reposition);window.visualViewport?.removeEventListener('scroll',reposition);};
  },[open]);
  const toggle=()=>{
    if(open) {setOpen(false);return;}
    setStart(from || '');setEnd(to || '');setSelectingEnd(false);setHover('');
    const date=from ? parse(from) : new Date();setMonth(new Date(date.getFullYear(),date.getMonth(),1));setOpen(true);
  };
  const choose=date=>{
    if(!selectingEnd) {setStart(date);setEnd('');setHover('');setSelectingEnd(true);return;}
    const range=[start,date].sort();onChange(range[0],range[1]);setOpen(false);anchor.current?.focus();
  };
  const first=new Date(month.getFullYear(),month.getMonth(),1);
  const offset=(first.getDay()+6)%7;
  const dayCount=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const days=Array.from({length:Math.ceil((offset+dayCount)/7)*7},(_,index)=>new Date(month.getFullYear(),month.getMonth(),index-offset+1));
  const preview=selectingEnd ? hover || start : end;
  const low=start && preview ? [start,preview].sort()[0] : start;
  const high=start && preview ? [start,preview].sort()[1] : end;
  return <>
    <button ref={anchor} type="button" className={`date-range-trigger${from || to ? ' has-range' : ''}`} aria-label={`${documentType} date range`} aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
      <Calendar size={15}/><span>{from && to ? `${label(from)} – ${label(to)}` : 'Date range'}</span>
    </button>
    {open && createPortal(<div ref={popup} role="dialog" aria-label={`Choose ${documentType} date range`} className="date-range-popover purchasing-no-shadows" style={position}>
      <header><div><h3>Date range</h3><p aria-live="polite">{selectingEnd ? 'Select the end date' : 'Select the start date'}</p></div><button type="button" aria-label="Close date range" onClick={()=>{setOpen(false);anchor.current?.focus();}}><X size={16}/></button></header>
      <div className="date-range-summary"><div className={!selectingEnd ? 'selecting' : ''}><small>From</small><strong>{label(start) || 'Start date'}</strong></div><span>→</span><div className={selectingEnd ? 'selecting' : ''}><small>To</small><strong>{label(end) || 'End date'}</strong></div></div>
      <div className="date-range-month"><button type="button" aria-label="Previous month" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={17}/></button><strong>{month.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</strong><button type="button" aria-label="Next month" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={17}/></button></div>
      <div className="date-range-weekdays">{['Mo','Tu','We','Th','Fr','Sa','Su'].map(day=><span key={day}>{day}</span>)}</div>
      <div className="date-range-days" onMouseLeave={()=>setHover('')}>{days.map(date=>{
        const value=key(date), endpoint=value===start || value===end;
        return <button key={value} type="button" className={`date-range-day${date.getMonth()!==month.getMonth() ? ' outside-month' : ''}${endpoint ? ' endpoint' : ''}${low && high && value>=low && value<=high ? ' in-range' : ''}`}
          aria-label={date.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})} aria-pressed={endpoint} data-selected={endpoint} data-today={value===key(new Date())}
          onMouseEnter={()=>{if(selectingEnd)setHover(value);}} onClick={()=>choose(value)}>{date.getDate()}</button>;
      })}</div>
      <footer><span>Click From, then To</span><button type="button" onClick={()=>{onChange('','');setOpen(false);anchor.current?.focus();}}>Clear dates</button></footer>
    </div>,document.body)}
  </>;
}
