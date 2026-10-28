import React, { useId, useState } from 'react';
import { Search, X, Phone, UserRound } from 'lucide-react';

export default function StaffSearch({ staff = [], value, onChange, disabled = false, label = 'Assign staff *', ariaLabel = 'Responsible staff', showDetails = true, showRoles = showDetails, loading = false, error = '', onRetry }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const resultsId = useId();
  const selected = staff.find(member => String(member.id) === String(value));
  const name = member => member.fullName || member.name || member.displayName || member.username || `Staff ${member.id}`;
  const code = member => member.employeeCode || member.staffCode || member.code || member.username || '';
  const roleLabel = member => (member.roles || []).map(role => String(typeof role==='string'?role:role.name || '').replace(/^ROLE_/, '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, letter=>letter.toUpperCase())).filter(Boolean).join(', ') || 'No role assigned';
  const results = loading || error ? [] : staff.filter(member => `${name(member)} ${member.username || ''} ${code(member)} ${member.phone || ''} ${roleLabel(member)}`.toLowerCase().includes((selected ? '' : query).trim().toLowerCase()));
  const select = member => { onChange(member.id); setQuery(''); setOpen(false); setActive(0); };
  return <div className="purchase-product-search gtn-staff-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label>{label}</label>
    <div className="purchase-search-input"><Search size={16}/>
      <input className="erp-field" aria-label={ariaLabel} role="combobox" aria-haspopup="listbox" aria-autocomplete="list" aria-expanded={open} aria-controls={resultsId}
        aria-activedescendant={open && results[active] ? `${resultsId}-${active}` : undefined}
        placeholder={showDetails ? 'Search staff by name, role, phone or code...' : showRoles ? 'Search staff by name, role or employee code...' : 'Search staff by name or employee code...'} disabled={disabled} value={selected ? name(selected) : query}
        style={selected && showRoles ? { paddingRight: (value || query) ? '120px' : '90px' } : undefined}
        onFocus={()=>{setOpen(true);setActive(0);}}
        onClick={()=>{setOpen(true);setActive(0);}}
        onChange={event=>{setQuery(event.target.value);onChange('');setOpen(true);setActive(0);}}
        onKeyDown={event=>{
          if(event.key==='Escape'){setOpen(false);return;}
          if(event.key==='ArrowDown'||event.key==='ArrowUp'){
            event.preventDefault();setOpen(true);setActive(index=>Math.max(0,Math.min(results.length-1,index+(event.key==='ArrowDown'?1:-1))));
          } else if(event.key==='Enter'&&open){event.preventDefault();if(results[active])select(results[active]);}
        }}/>
      {selected && showRoles && (
        <span
          className="staff-selected-role-badge"
          style={{
            position: 'absolute',
            right: (value || query) ? '34px' : '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 500,
            background: '#f1f5f9',
            color: '#475569',
            border: '1px solid #e2e8f0',
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <UserRound size={11} style={{ color: '#94a3b8' }} />
          {roleLabel(selected)}
        </span>
      )}
      {(value || query) && <button type="button" aria-label="Clear staff search" disabled={disabled} onClick={()=>{onChange('');setQuery('');setOpen(false);}}><X size={15}/></button>}
    </div>
    {open && <div className="purchase-product-results" role="listbox" id={resultsId} aria-label="Staff search results">
      {results.map((member,index)=><button type="button" role="option" key={member.id} id={`${resultsId}-${index}`} aria-selected={index===active}
        onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>select(member)}>
        <span className="purchase-result-product gtn-staff-result">
          <span className="purchase-result-title">
            {code(member) && <span className="purchase-result-code">{code(member)}</span>}
            <span className="purchase-result-name">{name(member)}</span>
          </span>
          {showDetails && member.phone && (
            <small><span><Phone size={12}/>{member.phone}</span></small>
          )}
        </span>
        {showRoles && (
          <span className="purchase-result-stock gtn-staff-role" style={{ color: '#64748b', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 'auto' }}>
            <UserRound size={12} style={{ color: '#94a3b8' }}/>
            {roleLabel(member)}
          </span>
        )}
      </button>)}
      {loading && <p role="status">Loading staff...</p>}
      {error && <p role="alert">{error}</p>}
      {error && onRetry && <button type="button" onMouseDown={event=>event.preventDefault()} onClick={onRetry}>Retry loading staff</button>}
      {!loading && !error && !results.length && <p>{query ? 'No matching staff found.' : 'No active, approved staff available.'}</p>}
    </div>}
  </div>;
}
