import React from 'react';
import {
  FileQuestion,
  WifiOff,
  ServerCrash,
  ShieldAlert,
  Lock,
  RotateCcw,
  Home,
  LogIn,
  AlertCircle,
} from 'lucide-react';

export default function ErrorState({
  type = 'error',
  title,
  message,
  onRetry,
  onAction,
  actionText,
  onNavigateHome,
  isCompact = false,
}) {
  const configs = {
    'not-found': {
      icon: FileQuestion,
      color: '#64748b',
      bgColor: '#f1f5f9',
      defaultTitle: 'Page Not Found',
      defaultMessage: 'The requested page or information could not be found.',
      defaultActionText: 'Back to Dashboard',
      safeRetry: false,
    },
    'offline': {
      icon: WifiOff,
      color: '#d97706',
      bgColor: '#fef3c7',
      defaultTitle: 'No Internet Connection',
      defaultMessage: 'Unable to connect. Please check your internet connection and try again.',
      defaultActionText: 'Check Connection',
      safeRetry: true,
    },
    'server-unavailable': {
      icon: ServerCrash,
      color: '#ea580c',
      bgColor: '#ffedd5',
      defaultTitle: 'System Temporarily Unavailable',
      defaultMessage: 'The system is temporarily unavailable. Please try again shortly.',
      defaultActionText: 'Try Again',
      safeRetry: true,
    },
    'access-denied': {
      icon: ShieldAlert,
      color: '#dc2626',
      bgColor: '#fee2e2',
      defaultTitle: 'Access Restricted',
      defaultMessage: "You don't have permission to perform this action.",
      defaultActionText: 'Back to Dashboard',
      safeRetry: false,
    },
    'session-expired': {
      icon: Lock,
      color: '#2563eb',
      bgColor: '#eff6ff',
      defaultTitle: 'Session Expired',
      defaultMessage: 'Your session has expired. Please log in again.',
      defaultActionText: 'Log In Again',
      safeRetry: false,
    },
    'error': {
      icon: AlertCircle,
      color: '#ef4444',
      bgColor: '#fee2e2',
      defaultTitle: 'Something Went Wrong',
      defaultMessage: 'Something went wrong. Please try again.',
      defaultActionText: 'Try Again',
      safeRetry: true,
    },
  };

  const currentConfig = configs[type] || configs.error;
  const Icon = currentConfig.icon;
  const displayTitle = title || currentConfig.defaultTitle;
  const displayMessage = message || currentConfig.defaultMessage;
  const displayActionText = actionText || currentConfig.defaultActionText;

  return (
    <div
      role="region"
      aria-label={displayTitle}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: isCompact ? '24px 16px' : '48px 24px',
        maxWidth: isCompact ? '100%' : '520px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: isCompact ? '48px' : '64px',
          height: isCompact ? '48px' : '64px',
          borderRadius: '50%',
          backgroundColor: currentConfig.bgColor,
          color: currentConfig.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: isCompact ? '12px' : '20px',
        }}
      >
        <Icon size={isCompact ? 24 : 32} />
      </div>

      <h2
        style={{
          fontSize: isCompact ? '1.1rem' : '1.35rem',
          fontWeight: 700,
          color: '#0f172a',
          margin: '0 0 8px 0',
        }}
      >
        {displayTitle}
      </h2>

      <p
        style={{
          fontSize: isCompact ? '0.85rem' : '0.92rem',
          color: '#64748b',
          lineHeight: 1.55,
          margin: '0 0 24px 0',
          maxWidth: '420px',
        }}
      >
        {displayMessage}
      </p>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* Render safe retry only when operation is safe to re-attempt */}
        {currentConfig.safeRetry && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '9px 18px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '7px',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
          >
            <RotateCcw size={15} />
            {displayActionText}
          </button>
        )}

        {/* Action handler (e.g. Session Expired -> Login, or Access Denied -> Dashboard) */}
        {!currentConfig.safeRetry && onAction && (
          <button
            type="button"
            onClick={onAction}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '9px 18px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '7px',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
          >
            {type === 'session-expired' ? <LogIn size={15} /> : <Home size={15} />}
            {displayActionText}
          </button>
        )}

        {/* Return to Dashboard fallback button */}
        {onNavigateHome && type !== 'session-expired' && (
          <button
            type="button"
            onClick={onNavigateHome}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '9px 16px',
              backgroundColor: '#ffffff',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '7px',
              fontSize: '0.88rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f8fafc';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            <Home size={15} />
            Return to Dashboard
          </button>
        )}
      </div>
    </div>
  );
}
