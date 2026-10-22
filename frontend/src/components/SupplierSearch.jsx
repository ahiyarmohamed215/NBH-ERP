import React, { useId, useState } from 'react';
import { Search, X, Phone } from 'lucide-react';
import './PurchaseProductSearch.css';
import './FilterSelect.css';

export default function SupplierSearch({
  suppliers = [],
  value,
  onChange,
  disabled = false,
  label = 'Supplier *',
  ariaLabel = 'Supplier',
  placeholder = 'Search supplier...',
  className = '',
  required = false,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const resultsId = useId();

  const selected = suppliers.find(s => String(s.id) === String(value));
  const results = suppliers.filter(s => {
    const searchStr = `${s.name || ''} ${s.code || s.supplierCode || ''} ${s.contactPerson || ''} ${s.phone || ''} ${s.email || ''}`.toLowerCase();
    const q = (selected && !query ? '' : query).trim().toLowerCase();
    return !q || searchStr.includes(q);
  });

  const select = supplier => {
    onChange(supplier.id);
    setQuery('');
    setOpen(false);
    setActive(0);
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
    setOpen(false);
    setActive(0);
  };

  const displayValue = selected ? (query ? query : selected.name) : query;

  return (
    <div
      className={`purchase-product-search supplier-search-container ${className}`.trim()}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      {label && <label>{label}</label>}
      <div className="purchase-search-input">
        <Search size={16} />
        <input
          className="erp-field"
          aria-label={ariaLabel}
          role="searchbox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={resultsId}
          aria-activedescendant={open && results[active] ? `${resultsId}-${active}` : undefined}
          placeholder={placeholder}
          disabled={disabled}
          value={displayValue}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onChange={event => {
            setQuery(event.target.value);
            if (value) onChange('');
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              setOpen(false);
              return;
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              setActive(index =>
                Math.max(0, Math.min(results.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
              );
            } else if (event.key === 'Enter' && open) {
              event.preventDefault();
              if (results[active]) select(results[active]);
            }
          }}
        />
        {(value || query) && !disabled && (
          <button
            type="button"
            aria-label="Clear supplier search"
            onClick={handleClear}
          >
            <X size={15} />
          </button>
        )}
      </div>
      <button
        type="button"
        className="modern-filter-trigger"
        aria-hidden="true"
        tabIndex={-1}
        style={{ display: 'none' }}
        onClick={() => {
          setOpen(true);
          setActive(0);
        }}
      />
      <select
        className="modern-select-native erp-field"
        aria-hidden="true"
        tabIndex={-1}
        value={value || ''}
        onChange={event => onChange(event.target.value)}
        required={required}
        disabled={disabled}
      >
        <option value="">Select supplier</option>
        {suppliers.map(s => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {open && (
        <div className="purchase-product-results" role="listbox" id={resultsId} aria-label="Supplier search results">
          {results.map((supplier, index) => (
            <button
              type="button"
              role="option"
              key={supplier.id}
              id={`${resultsId}-${index}`}
              data-value={supplier.id}
              aria-selected={index === active}
              onMouseDown={event => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => select(supplier)}
            >
              <span className="purchase-result-product">
                <span className="purchase-result-name" style={{ fontWeight: 600 }}>{supplier.name}</span>
                {(supplier.contactPerson || supplier.phone) && (
                  <small style={{ display: 'flex', gap: '8px', color: '#64748b', fontSize: 'var(--erp-text-caption)' }}>
                    {supplier.contactPerson && <span>{supplier.contactPerson}</span>}
                    {supplier.phone && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Phone size={11} /> {supplier.phone}
                      </span>
                    )}
                  </small>
                )}
              </span>
              {(supplier.code || supplier.supplierCode) && (
                <span className="purchase-result-stock" style={{ color: 'var(--erp-accent)', fontWeight: 600 }}>
                  {supplier.code || supplier.supplierCode}
                </span>
              )}
            </button>
          ))}
          {!results.length && <p>No matching suppliers found.</p>}
        </div>
      )}
    </div>
  );
}
