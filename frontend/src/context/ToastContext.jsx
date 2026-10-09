import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { sanitizeErrorMessage } from '../utils/errorHandler.js';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const recentToastsRef = useRef(new Map()); // Map<string, number> for deduplication

  const addToast = useCallback((rawMessage, type = 'success') => {
    if (!rawMessage) return;

    // Sanitize message to strip any technical codes, HTTP statuses, or exception text
    const cleanMessage = sanitizeErrorMessage(rawMessage);
    const toastType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';

    // Deduplication check: prevent multiple identical notifications appearing simultaneously
    const now = Date.now();
    const dedupKey = `${toastType}:::${cleanMessage}`;
    const lastShown = recentToastsRef.current.get(dedupKey) || 0;

    if (now - lastShown < 3000) {
      // Skipped duplicate toast within 3 second window
      return;
    }

    recentToastsRef.current.set(dedupKey, now);

    // Clean up old entries from deduplication map periodically
    if (recentToastsRef.current.size > 50) {
      for (const [key, timestamp] of recentToastsRef.current.entries()) {
        if (now - timestamp > 10000) {
          recentToastsRef.current.delete(key);
        }
      }
    }

    const id = now + Math.random();

    setToasts((prev) => {
      // Do not add if already present in currently displayed toasts
      if (prev.some((t) => t.message === cleanMessage && t.type === toastType)) {
        return prev;
      }
      // Maximum 4 toasts visible at a time to prevent screen clutter
      const trimmed = prev.length >= 4 ? prev.slice(prev.length - 3) : prev;
      return [...trimmed, { id, message: cleanMessage, type: toastType }];
    });

    const duration = toastType === 'error' ? 5000 : 4000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  useEffect(() => {
    const handleApiError = (event) => {
      const detail = event.detail;
      if (!detail) return;

      if (typeof detail === 'string') {
        addToast(detail, 'error');
      } else if (typeof detail === 'object') {
        const msg = detail.message || 'Something went wrong. Please try again.';
        const type = detail.type || 'error';
        addToast(msg, type);
      }
    };

    window.addEventListener('erp:api_error', handleApiError);
    return () => window.removeEventListener('erp:api_error', handleApiError);
  }, [addToast]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div
        aria-live="polite"
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
        {toasts.map((toast) => {
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';
          const isSuccess = toast.type === 'success';

          const accentColor = isSuccess
            ? '#10b981'
            : isError
            ? '#ef4444'
            : isWarning
            ? '#f59e0b'
            : '#3b82f6';

          const bgColor = isError
            ? '#fef2f2'
            : isWarning
            ? '#fffbeb'
            : isSuccess
            ? '#f0fdf4'
            : '#f8fafc';

          return (
            <div
              role={isError || isWarning ? 'alert' : 'status'}
              key={toast.id}
              className="glass-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '11px 18px',
                backgroundColor: bgColor,
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                borderLeft: `5px solid ${accentColor}`,
                boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.14), 0 4px 10px -2px rgba(0, 0, 0, 0.06)',
                pointerEvents: 'auto',
                minWidth: '280px',
                maxWidth: '520px',
                animation: 'fadeIn 0.2s ease-out',
              }}
            >
              {isSuccess && <CheckCircle2 size={19} color="#10b981" style={{ flexShrink: 0 }} />}
              {isError && <AlertCircle size={19} color="#ef4444" style={{ flexShrink: 0 }} />}
              {isWarning && <AlertTriangle size={19} color="#f59e0b" style={{ flexShrink: 0 }} />}
              {!isSuccess && !isError && !isWarning && <Info size={19} color="#3b82f6" style={{ flexShrink: 0 }} />}
              
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
                type="button"
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#475569')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                title="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
