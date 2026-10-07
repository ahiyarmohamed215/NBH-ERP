import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          left: 0,
          right: 0,
          margin: '0 auto',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          maxWidth: '540px',
          width: 'max-content',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="glass-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 18px',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              borderLeft: `5px solid ${
                toast.type === 'success'
                  ? '#10b981'
                  : toast.type === 'error'
                  ? '#ef4444'
                  : toast.type === 'warning'
                  ? '#f59e0b'
                  : '#3b82f6'
              }`,
              boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.14), 0 4px 10px -2px rgba(0, 0, 0, 0.06)',
              pointerEvents: 'auto',
              minWidth: '280px',
              maxWidth: '520px',
            }}
          >
            {toast.type === 'success' && <CheckCircle2 size={19} color="#10b981" style={{ flexShrink: 0 }} />}
            {toast.type === 'error' && <AlertCircle size={19} color="#ef4444" style={{ flexShrink: 0 }} />}
            {(toast.type === 'info' || !toast.type) && <Info size={19} color="#3b82f6" style={{ flexShrink: 0 }} />}
            {toast.type === 'warning' && <AlertCircle size={19} color="#f59e0b" style={{ flexShrink: 0 }} />}
            <span
              style={{
                fontSize: '0.88rem',
                fontWeight: 600,
                color: '#0f172a',
                flex: 1,
                lineHeight: 1.4,
              }}
            >
              {toast.message}
            </span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '2px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
              }}
              title="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
