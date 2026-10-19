import React from 'react';

/**
 * Non-intrusive, zero-layout-jump fallback rendered when an individual workspace chunk
 * is being loaded for the first time.
 */
export default function WorkspaceFallback({ id = 'workspace' }) {
  const label = typeof id === 'string'
    ? id.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
    : 'Workspace';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '280px',
        padding: '48px 24px',
        color: '#64748b',
        backgroundColor: 'transparent',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          border: '3px solid #e2e8f0',
          borderTopColor: '#0284c7',
          borderRadius: '50%',
          animation: 'erp-spin 0.75s linear infinite',
          marginBottom: '14px',
        }}
      />
      <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#64748b' }}>
        Loading {label}...
      </div>
      <style>{`
        @keyframes erp-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
