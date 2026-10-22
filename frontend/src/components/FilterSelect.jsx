import React,{useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown,Search} from 'lucide-react';
import {dateRangePosition} from './DateRangePicker';
import './FilterSelect.css';
import './PurchasingAppearance.css';

const optionText=node=>Array.isArray(node) ? node.map(optionText).join('') : React.isValidElement(node) ? optionText(node.props.children) : String(node ?? '');
const readOptions=children=>React.Children.toArray(children).flatMap(child=>!React.isValidElement(child) ? [] : child.type===React.Fragment ? readOptions(child.props.children) : [{value:String(child.props.value ?? optionText(child.props.children)),label:optionText(child.props.children),disabled:child.props.disabled}]);

export default function FilterSelect({value,onChange,children,selectedLabel,style={},title,onFocus,onBlur,variant='filter',className='',disabled=false,required=false,name:fieldName,id:fieldId,'aria-label':ariaLabel,searchable=true}) {
  const options=readOptions(children), selected=options.find(option=>option.value===String(value));
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0),[position,setPosition]=useState({});
  const trigger=useRef(null),popup=useRef(null),list=useRef(null),search=useRef(null),id=useId();
  const name=ariaLabel || title || (/status/i.test(options[0]?.label || '') ? 'Status filter' : `${options[0]?.label.replace(/^All\s+/i,'') || 'Options'} filter`);
  const matches=options.filter(option=>option.label.toLowerCase().includes(query.trim().toLowerCase()));
  const close=()=>{setOpen(false);trigger.current?.focus();};
  const choose=option=>{if(!option || option.disabled) return;onChange?.({target:{value:option.value},currentTarget:{value:option.value}});close();};
  useLayoutEffect(()=>{
    if(!open) return;
    const reposition=()=>{
      const rect=trigger.current.getBoundingClientRect(),viewport=window.visualViewport;
      const next=dateRangePosition(rect,{width:viewport?.width || window.innerWidth,height:viewport?.height || window.innerHeight,left:viewport?.offsetLeft || 0,top:viewport?.offsetTop || 0},popup.current?.getBoundingClientRect().height,Math.max(220,rect.width));
      setPosition(previous=>Object.keys(next).every(key=>previous[key]===next[key]) ? previous : next);
    };
    const outside=event=>{if(!trigger.current?.contains(event.target) && !popup.current?.contains(event.target)) setOpen(false);};
    reposition();(search.current || list.current)?.focus();
    const observer=typeof ResizeObserver==='undefined' ? null : new ResizeObserver(reposition);if(popup.current)observer?.observe(popup.current);
    document.addEventListener('pointerdown',outside);window.addEventListener('resize',reposition);window.addEventListener('scroll',reposition,true);
    window.visualViewport?.addEventListener('resize',reposition);window.visualViewport?.addEventListener('scroll',reposition);
    return ()=>{observer?.disconnect();document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',reposition);window.removeEventListener('scroll',reposition,true);window.visualViewport?.removeEventListener('resize',reposition);window.visualViewport?.removeEventListener('scroll',reposition);};
  },[open]);
  const toggle=()=>{if(disabled)return;if(open){close();return;}setQuery('');setActive(Math.max(0,options.findIndex(option=>option.value===String(value))));setOpen(true);};
  const keydown=event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
    else if(event.key==='Tab')close();
    else if(event.key==='ArrowDown' || event.key==='ArrowUp'){event.preventDefault();setActive(index=>Math.max(0,Math.min(matches.length-1,index+(event.key==='ArrowDown'?1:-1))));}
    else if(event.key==='Enter'){event.preventDefault();choose(matches[active]);}
    else if(event.target!==search.current && ['Home','End'].includes(event.key)){event.preventDefault();setActive(event.key==='Home'?0:matches.length-1);}
  };
  useLayoutEffect(()=>{if(open)list.current?.querySelector(`[data-active="true"]`)?.scrollIntoView?.({block:'nearest'});},[active,open]);
  return <>
    <button ref={trigger} id={fieldId} disabled={disabled} aria-required={required || undefined} type="button" role="combobox" aria-label={name} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} title={title || name}
      data-filter-active={String(value)!==options[0]?.value} className={`modern-filter-trigger${variant==='field'?' modern-select-field':''}${open?' is-open':''} ${className}`} style={variant==='field' ? {width:'100%',minWidth:0,...style} : {width:style.width || 140,maxWidth:'100%',minWidth:Math.min(Number.parseInt(style.minWidth)||120,140)}}
      onClick={toggle} onFocus={onFocus} onBlur={onBlur} onKeyDown={event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(!open)toggle();}}}>
      <span className="modern-filter-value">{selectedLabel ?? (selected?.label || (variant==='field' ? 'Select an option' : 'Select filter'))}</span><ChevronDown size={14}/>
    </button>
    {variant==='field' && <select className="modern-select-native erp-field" aria-hidden="true" tabIndex={-1} value={value} onChange={onChange} required={required} disabled={disabled} name={fieldName} onInvalid={event=>{event.preventDefault();trigger.current?.focus();if(!open)toggle();}}>{children}</select>}
    {open && createPortal(<div ref={popup} className="modern-filter-popup purchasing-no-shadows" style={position} onKeyDown={keydown}>
      {searchable && options.length>=8 && <div className="modern-filter-search"><Search size={14}/><input className="erp-field" ref={search} type="text" aria-label={`Search ${name} options`} placeholder="Search options..." value={query} onChange={event=>{setQuery(event.target.value);setActive(0);}}/></div>}
      <div ref={list} id={id} role="listbox" tabIndex={-1} aria-label={`${name} options`} aria-activedescendant={matches[active] ? `${id}-${active}` : undefined} className="modern-filter-options">
        {matches.map((option,index)=><button key={option.value} type="button" role="option" tabIndex={-1} id={`${id}-${index}`} aria-selected={option.value===String(value)} data-value={option.value} disabled={option.disabled} data-active={index===active}
          onMouseEnter={()=>setActive(index)} onClick={()=>choose(option)}><span>{option.label}</span>{option.value===String(value) && <Check size={14}/>}</button>)}
        {!matches.length && <p>No matching options</p>}
      </div>
    </div>,trigger.current?.closest('dialog') || document.body)}
  </>;
}
