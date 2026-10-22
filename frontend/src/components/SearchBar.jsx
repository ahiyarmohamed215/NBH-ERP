import React from 'react';
import { Search, X } from 'lucide-react';

/**
 * Global standardized search bar component matching GRN & Supplier themes.
 * Blue focus border, fixed height (38px), search icon, and clear action.
 */
export default function SearchBar({
  value = '',
  onChange,
  onClear,
  placeholder = 'Search...',
  ariaLabel,
  className = '',
  style = {},
  inputStyle = {},
  disabled = false,
  inputRef,
  onKeyDown,
}) {
  return (
    <div
      className={`erp-search-group ${className}`}
      style={{
        position: 'relative',
        flex: 1,
        minWidth: '220px',
        ...style,
      }}
    >
      <Search
        size={17}
        style={{
          position: 'absolute',
          left: '12px',
          top: '11px',
          color: '#94a3b8',
          pointerEvents: 'none',
        }}
      />
      <input
        ref={inputRef}
        onKeyDown={onKeyDown}
        type="text"
        className="erp-field erp-search-input"
        aria-label={ariaLabel || placeholder}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={onChange}
        style={{
          width: '100%',
          height: '38px',
          padding: '0 32px 0 38px',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          outline: 'none',
          backgroundColor: '#ffffff',
          color: '#0f172a',
          fontSize: 'var(--erp-text-button)',
          boxSizing: 'border-box',
          boxShadow: 'none',
          transition: 'border-color 0.15s ease',
          ...inputStyle,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#0284c7';
          e.currentTarget.style.boxShadow = 'none';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '#cbd5e1';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          style={{
            position: 'absolute',
            right: '10px',
            top: '10px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#94a3b8',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Clear search text"
          aria-label="Clear search text"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
