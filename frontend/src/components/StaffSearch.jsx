import React, { useId, useState } from 'react';
import { Search, X, Phone, UserRound } from 'lucide-react';

export default function StaffSearch({ staff, value, onChange, disabled = false, label = 'Assign staff *', ariaLabel = 'Responsible staff' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const resultsId = useId();
  const selected = staff.find(member => String(member.id) === String(value));
  const roleLabel = member => (member.roles || []).map(role => String(role).replace(/^ROLE_/, '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, letter=>letter.toUpperCase())).join(', ') || 'No role assigned';
  const results = staff.filter(member => `${member.fullName || ''} ${member.username || ''} ${member.employeeCode || ''} ${member.phone || ''} ${roleLabel(member)}`.toLowerCase().includes((selected ? '' : query).trim().toLowerCase()));
  const select = member => { onChange(member.id); setQuery(''); setOpen(false); setActive(0); };
  return <div className="purchase-product-search gtn-staff-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label>{label}</label>
    <div className="purchase-search-input"><Search size={16}/>
      <input className="erp-field" aria-label={ariaLabel} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={resultsId}
        aria-activedescendant={open && results[active] ? `${resultsId}-${active}` : undefined}
        placeholder="Search staff by name, role, phone or code..." disabled={disabled} value={selected?.fullName || query}
        onFocus={()=>{setOpen(true);setActive(0);}}
        onChange={event=>{setQuery(event.target.value);onChange('');setOpen(true);setActive(0);}}
        onKeyDown={event=>{
          if(event.key==='Escape'){setOpen(false);return;}
          if(event.key==='ArrowDown'||event.key==='ArrowUp'){
            event.preventDefault();setOpen(true);setActive(index=>Math.max(0,Math.min(results.length-1,index+(event.key==='ArrowDown'?1:-1))));
          } else if(event.key==='Enter'&&open){event.preventDefault();if(results[active])select(results[active]);}
        }}/>
      {(value || query) && <button type="button" aria-label="Clear staff search" disabled={disabled} onClick={()=>{onChange('');setQuery('');setOpen(false);}}><X size={15}/></button>}
    </div>
    {open && <div className="purchase-product-results" role="listbox" id={resultsId} aria-label="Staff search results">
      {results.map((member,index)=><button type="button" role="option" key={member.id} id={`${resultsId}-${index}`} aria-selected={index===active}
        onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>select(member)}>
        <span className="purchase-result-product gtn-staff-result"><span>{member.fullName}</span>
          <small><span><UserRound size={12}/>{roleLabel(member)}</span><span><Phone size={12}/>{member.phone || 'No phone number'}</span></small>
        </span>
        <span className="purchase-result-stock">{member.employeeCode || member.username}</span>
      </button>)}
      {!results.length && <p>No matching staff found.</p>}
    </div>}
  </div>;
}
