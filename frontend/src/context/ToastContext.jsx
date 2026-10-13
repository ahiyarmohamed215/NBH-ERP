import './ToastContext.css';
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { sanitizeErrorMessage } from '../utils/errorHandler.js';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [isServerOutage, setIsServerOutage] = useState(false);
  const recentToastsRef = useRef(new Map()); // Map<string, number> for deduplication
  const outageIncidentRef = useRef({ active: false, lastNotifiedAt: 0, count: 0 });

  const addToast = useCallback((rawMessage, type = 'success') => {
    if (!rawMessage) return;

    // Sanitize message to strip any technical codes, HTTP statuses, or exception text
    const cleanMessage = sanitizeErrorMessage(rawMessage);
    const toastType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
    const now = Date.now();

    // Check if this error represents an outage / connectivity failure
    const isOutageMessage =
      cleanMessage.includes('temporarily unavailable') ||
      cleanMessage.includes('Unable to connect') ||
      cleanMessage.includes('taking too long') ||
      cleanMessage.includes('502') ||
      cleanMessage.includes('503') ||
      cleanMessage.includes('504');

    if (isOutageMessage && (toastType === 'error' || toastType === 'warning')) {
      setIsServerOutage(true);
      outageIncidentRef.current.active = true;
      outageIncidentRef.current.count += 1;

      // Group 30+ simultaneous outage failures into EXACTLY ONE user-facing notification with 8-second cooldown
      if (now - outageIncidentRef.current.lastNotifiedAt < 8000) {
        return; // Suppress duplicate notification during ongoing outage
      }
      outageIncidentRef.current.lastNotifiedAt = now;
    } else if (outageIncidentRef.current.active && (toastType === 'error' || toastType === 'warning')) {
      // While a server outage is active, suppress secondary downstream errors (e.g. cascaded fetch failures)
      // unless it is an explicit form validation error
      if (!cleanMessage.includes('highlighted fields') && !cleanMessage.includes('validation')) {
        return;
      }
    }

    // Deduplication check: prevent multiple identical notifications appearing simultaneously
    const dedupKey = `${toastType}:::${cleanMessage}`;
    const lastShown = recentToastsRef.current.get(dedupKey) || 0;

    if (now - lastShown < 3500) {
      return; // Skipped duplicate toast within cooldown window
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
      // Maximum 3 toasts visible at a time to prevent screen clutter
      const trimmed = prev.length >= 3 ? prev.slice(prev.length - 2) : prev;
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

    const handleApiHealthy = () => {
      // Confirmed recovery: clear outage indicator
      if (outageIncidentRef.current.active) {
        outageIncidentRef.current.active = false;
        outageIncidentRef.current.count = 0;
        setIsServerOutage(false);
      }
    };

    window.addEventListener('erp:api_error', handleApiError);
    window.addEventListener('erp:api_healthy', handleApiHealthy);
    return () => {
      window.removeEventListener('erp:api_error', handleApiError);
      window.removeEventListener('erp:api_healthy', handleApiHealthy);
    };
  }, [addToast]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {typeof document !== 'undefined' && createPortal(<>
      {isServerOutage && <div role="status" className="erp-connection-notice"><AlertCircle size={16}/><span>Connection unavailable. Reconnecting...</span></div>}
      <div aria-live="polite" className={`erp-toast-stack${isServerOutage?' has-outage':''}`}>
        {toasts.map(toast=>{
          const Icon=toast.type==='success'?CheckCircle2:toast.type==='error'?AlertCircle:toast.type==='warning'?AlertTriangle:Info;
          return <div key={toast.id} role={toast.type==='error' || toast.type==='warning'?'alert':'status'} className={`erp-toast erp-toast-${toast.type}`}>
            <Icon size={17} className="erp-toast-icon"/>
            <div className="erp-toast-content"><span className="erp-toast-title">{toast.type==='success'?'Success':toast.type==='info'?'Notice':'Attention'}</span><span className="erp-toast-message">{toast.message}</span></div>
            <button type="button" onClick={()=>removeToast(toast.id)} aria-label="Dismiss notification" title="Dismiss"><X size={14}/></button>
          </div>;
        })}
      </div>
      </>, document.body)}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
