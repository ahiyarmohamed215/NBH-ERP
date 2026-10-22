import React,{useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Calendar,ChevronDown,ChevronLeft,ChevronRight,X} from 'lucide-react';
import {dateRangePosition} from './DateRangePicker';
import './DateRangePicker.css';
import './MonthFilter.css';
export function currentBusinessMonth(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit'}).formatToParts(new Date());return `${parts.find(part=>part.type==='year').value}-${parts.find(part=>part.type==='month').value}`;}
const monthLabel=value=>new Date(`${value}-01T12:00:00`).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
const months=Array.from({length:12},(_,index)=>new Date(2020,index,1).toLocaleDateString('en-GB',{month:'short'}));
export default function MonthFilter({value,onChange,label='Month',disabled=false}) {
 const current=currentBusinessMonth(),selected=value || current,currentYear=Number(current.slice(0,4));
 const [open,setOpen]=useState(false),[year,setYear]=useState(Number(selected.slice(0,4))),[mode,setMode]=useState('months'),[position,setPosition]=useState({});
 const anchor=useRef(null),popup=useRef(null),id=useId();
 const close=()=>{setOpen(false);anchor.current?.focus();};
 const toggle=()=>{if(open){close();return;}setYear(Number(selected.slice(0,4)));setMode('months');setOpen(true);};
 const choose=next=>{onChange(next);close();};
 useLayoutEffect(()=>{
  if(!open)return;
  const reposition=()=>{const rect=anchor.current.getBoundingClientRect(),viewport=window.visualViewport;const next=dateRangePosition(rect,{width:viewport?.width || window.innerWidth,height:viewport?.height || window.innerHeight,left:viewport?.offsetLeft || 0,top:viewport?.offsetTop || 0},popup.current?.getBoundingClientRect().height,320);setPosition(previous=>Object.keys(next).every(key=>previous[key]===next[key])?previous:next);};
  const outside=event=>{if(!anchor.current?.contains(event.target) && !popup.current?.contains(event.target))setOpen(false);};
  reposition();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(reposition);if(popup.current)observer?.observe(popup.current);
  document.addEventListener('pointerdown',outside);window.addEventListener('resize',reposition);window.addEventListener('scroll',reposition,true);window.visualViewport?.addEventListener('resize',reposition);window.visualViewport?.addEventListener('scroll',reposition);
  return()=>{observer?.disconnect();document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',reposition);window.removeEventListener('scroll',reposition,true);window.visualViewport?.removeEventListener('resize',reposition);window.visualViewport?.removeEventListener('scroll',reposition);};
 },[open]);
 useLayoutEffect(()=>{if(open)(popup.current?.querySelector('.month-filter-cell[data-selected="true"]:not(:disabled)') || popup.current?.querySelector('.month-filter-cell:not(:disabled)'))?.focus();},[open,mode,year]);
 const yearStart=Math.floor((year-1)/12)*12+1;
 const keyboard=event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
  const cells=[...popup.current.querySelectorAll('.month-filter-cell:not(:disabled)')],index=cells.indexOf(document.activeElement);
  if(index>=0 && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)){
   event.preventDefault();const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3};const next=event.key==='Home'?0:event.key==='End'?cells.length-1:Math.max(0,Math.min(cells.length-1,index+delta[event.key]));cells[next]?.focus();
  }
  if(event.key==='Tab'){const controls=[...popup.current.querySelectorAll('button:not(:disabled)')],first=controls[0],last=controls.at(-1);if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}}
 };
 return <>
  <button ref={anchor} type="button" className="date-range-trigger has-range erp-month-filter" aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined} disabled={disabled} title={label} onClick={toggle} onKeyDown={event=>{if(event.key==='ArrowDown' && !open){event.preventDefault();toggle();}else if(event.key==='Escape' && open){event.preventDefault();event.stopPropagation();close();}}}><Calendar size={15}/><span>{monthLabel(selected)}</span><ChevronDown size={14}/></button>
  {open && createPortal(<div ref={popup} id={id} role="dialog" aria-label={`Choose ${label.toLowerCase()}`} className="date-range-popover purchasing-no-shadows month-filter-popover" style={position} onClick={event=>event.stopPropagation()} onKeyDown={keyboard}>
   <header><h3>{mode==='months'?'Select month':'Select year'}</h3><button type="button" aria-label="Close month picker" onClick={close}><X size={16}/></button></header>
   <div className="date-range-month"><button type="button" aria-label={mode==='months'?'Previous year':'Previous years'} disabled={mode==='months'?year<=1:yearStart<=1} onClick={()=>setYear(year-(mode==='months'?1:12))}><ChevronLeft size={17}/></button><button type="button" className="month-filter-year" aria-label={mode==='months'?'Choose year':'Show months'} aria-expanded={mode==='years'} onClick={()=>setMode(mode==='months'?'years':'months')}>{mode==='months'?year:`${yearStart} – ${Math.min(currentYear,yearStart+11)}`}<ChevronDown size={13}/></button><button type="button" aria-label={mode==='months'?'Next year':'Next years'} disabled={mode==='months'?year>=currentYear:yearStart+12>currentYear} onClick={()=>setYear(year+(mode==='months'?1:12))}><ChevronRight size={17}/></button></div>
   <div className="month-filter-grid">{mode==='months'?months.map((name,index)=>{const key=`${String(year).padStart(4,'0')}-${String(index+1).padStart(2,'0')}`;return <button key={key} type="button" className={`date-range-day month-filter-cell${key===selected?' endpoint':''}`} aria-label={monthLabel(key)} aria-pressed={key===selected} data-selected={key===selected} disabled={key>current} onClick={()=>choose(key)}>{name}</button>;}):Array.from({length:12},(_,index)=>yearStart+index).map(option=><button key={option} type="button" className={`date-range-day month-filter-cell${option===Number(selected.slice(0,4))?' endpoint':''}`} aria-label={String(option)} aria-pressed={option===Number(selected.slice(0,4))} data-selected={option===Number(selected.slice(0,4))} disabled={option>currentYear || option<1} onClick={()=>{setYear(option);setMode('months');}}>{option}</button>)}</div>
   <footer><span>{monthLabel(selected)}</span><button type="button" onClick={()=>choose(current)}>This month</button></footer>
  </div>,anchor.current?.closest('dialog') || document.body)}
 </>;
}
