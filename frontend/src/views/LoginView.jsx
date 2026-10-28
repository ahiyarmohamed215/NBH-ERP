import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Lock, User, ArrowRight, Clock, X, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import NbhLogo from '../components/NbhLogo';
import { authApi } from '../api/apiClient';

export default function LoginView({ onSwitchToSignup }) {
  const { login } = useAuth();
  const { addToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Sign out confirmation & Session expired notices
  const [signedOutNotice, setSignedOutNotice] = useState(() => {
    return sessionStorage.getItem('nbh_signed_out') || null;
  });
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(() => {
    return sessionStorage.getItem('nbh_session_expired') || null;
  });

  useEffect(() => {
    if (signedOutNotice) {
      sessionStorage.removeItem('nbh_signed_out');
    }
  }, [signedOutNotice]);

  useEffect(() => {
    if (sessionExpiredNotice) {
      sessionStorage.removeItem('nbh_session_expired');
    }
  }, [sessionExpiredNotice]);

  // Forgot password popup modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotReason, setForgotReason] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState('');
  const [forgotErrorMessage, setForgotErrorMessage] = useState('');

  const handleOpenForgotModal = () => {
    setForgotInput(username.trim());
    setForgotReason('');
    setForgotSuccessMessage('');
    setForgotErrorMessage('');
    setShowForgotModal(true);
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotInput.trim()) {
      setForgotErrorMessage('Please enter your username or registered email address.');
      return;
    }
    setForgotLoading(true);
    setForgotErrorMessage('');
    try {
      const res = await authApi.forgotPassword({
        usernameOrEmail: forgotInput.trim(),
        reason: forgotReason.trim(),
      });
      setForgotSuccessMessage(
        res.data?.message ||
        'Password reset request submitted. An administrator has been notified to reset your password and send it to your registered email.'
      );
    } catch (err) {
      setForgotErrorMessage(err.friendlyMessage || err.message || 'Unable to submit reset request. Please check your username/email.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUsernameError('');
    setPasswordError('');

    let hasClientError = false;
    if (!username.trim()) {
      setUsernameError('Please enter your username or email.');
      hasClientError = true;
    }
    if (!password) {
      setPasswordError('Please enter your password.');
      hasClientError = true;
    }
    if (hasClientError) return;

    try {
      setLoading(true);
      await login(username.trim(), password);
      addToast('Welcome back! Successfully logged in.', 'success');
    } catch (err) {
      if (err.response?.status === 429) {
        addToast('Too many sign-in attempts. Please wait a minute and try again.', 'error');
      } else if (err.response?.status === 401) {
        setPasswordError('Invalid username or password. Please try again or contact your administrator.');
      } else {
        addToast('Unable to sign in right now. Please try again later.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
      padding: '24px',
    }}>
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '36px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'inline-flex', marginBottom: '12px' }}>
            <NbhLogo size={26} />
          </div>
          <p style={{ color: '#64748b', fontSize: 'var(--erp-text-button)', margin: 0 }}>
            Sign in to your enterprise account
          </p>
        </div>

        {/* Clean, standard sign out confirmation */}
        {signedOutNotice && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              color: '#166534',
              fontSize: 'var(--erp-text-body)',
              marginBottom: '20px',
              lineHeight: 1.4,
            }}
          >
            <CheckCircle size={18} style={{ flexShrink: 0, color: '#16a34a' }} />
            <div style={{ flex: 1 }}>{signedOutNotice}</div>
            <button
              type="button"
              onClick={() => setSignedOutNotice(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#15803d',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
              }}
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Inactivity / token expired notice (Only shown on genuine session expiry) */}
        {sessionExpiredNotice && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              color: '#92400e',
              fontSize: 'var(--erp-text-body)',
              marginBottom: '20px',
              lineHeight: 1.4,
            }}
          >
            <Clock size={18} style={{ flexShrink: 0, color: '#d97706', marginTop: '1px' }} />
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', color: '#78350f', marginBottom: '2px' }}>Session Expired</strong>
              {sessionExpiredNotice}
            </div>
            <button
              type="button"
              onClick={() => setSessionExpiredNotice(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#b45309',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
              }}
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* USERNAME */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <label
                htmlFor="login-username"
                style={{
                  display: 'block',
                  fontSize: 'var(--erp-text-small)',
                  fontWeight: 600,
                  color: usernameError ? '#dc2626' : '#475569',
                }}
              >
                USERNAME OR EMAIL
              </label>
              {usernameError && (
                <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <AlertCircle size={12} /> {usernameError}
                </span>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <User
                size={16}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '11px',
                  color: usernameError ? '#ef4444' : '#94a3b8',
                }}
              />
              <input
                id="login-username"
                type="text"
                className="input-glass erp-field"
                style={{
                  paddingLeft: '34px',
                  borderColor: usernameError ? '#ef4444' : undefined,
                  backgroundColor: usernameError ? '#fef2f2' : undefined,
                }}
                placeholder="Enter your username or email"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (usernameError) setUsernameError('');
                }}
                autoComplete="username"
                aria-invalid={Boolean(usernameError)}
                required
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div style={{ marginBottom: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <label
                htmlFor="login-password"
                style={{
                  display: 'block',
                  fontSize: 'var(--erp-text-small)',
                  fontWeight: 600,
                  color: passwordError ? '#dc2626' : '#475569',
                }}
              >
                PASSWORD
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {passwordError && (
                  <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <AlertCircle size={12} /> {passwordError}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleOpenForgotModal}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                >
                  Forgot Password?
                </button>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '11px',
                  color: passwordError ? '#ef4444' : '#94a3b8',
                }}
              />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="input-glass erp-field"
                style={{
                  paddingLeft: '34px',
                  paddingRight: '36px',
                  borderColor: passwordError ? '#ef4444' : undefined,
                  backgroundColor: passwordError ? '#fef2f2' : undefined,
                }}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError('');
                }}
                autoComplete="current-password"
                aria-invalid={Boolean(passwordError)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '9px',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary erp-button"
            style={{ width: '100%', padding: '11px' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : (
              <>
                Sign In <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          paddingTop: '20px',
          borderTop: '1px solid #e2e8f0',
          textAlign: 'center',
          fontSize: 'var(--erp-text-button)',
          color: '#64748b',
        }}>
          Need access?{' '}
          <button className="erp-button"
            type="button"
            onClick={onSwitchToSignup}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            Register for an account
          </button>
        </div>
      </div>

      {/* Forgot Password Request to Admin Popup */}
      {showForgotModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-password-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !forgotLoading) setShowForgotModal(false);
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '580px',
              minHeight: '526px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '36px 40px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            }}
          >
            {/* Header: Clean title with close button (No key mark icon, No enterprise security label) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 id="forgot-password-title" style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>
                Request Password Reset
              </h3>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                disabled={forgotLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {forgotSuccessMessage ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '16px 0' }}>
                <div style={{
                  padding: '16px 20px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  color: '#166534',
                  fontSize: '13.5px',
                  lineHeight: 1.55,
                  marginBottom: '28px',
                }}>
                  {forgotSuccessMessage}
                </div>
                <button
                  type="button"
                  className="btn btn-primary erp-button"
                  style={{ width: '100%', padding: '11px', fontSize: '13.5px' }}
                  onClick={() => setShowForgotModal(false)}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: '0 0 24px 0' }}>
                  Enter your username or registered email. A password reset request will be sent to your administrator, who will update your credentials and deliver them to your registered email.
                </p>

                {forgotErrorMessage && (
                  <div style={{
                    padding: '8px 12px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    color: '#dc2626',
                    fontSize: '12px',
                    marginBottom: '16px',
                  }}>
                    {forgotErrorMessage}
                  </div>
                )}

                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    USERNAME OR REGISTERED EMAIL *
                  </label>
                  <input
                    type="text"
                    className="input-glass erp-field"
                    style={{ padding: '10px 14px', fontSize: '13.5px' }}
                    placeholder="Enter username or email address"
                    value={forgotInput}
                    onChange={(e) => setForgotInput(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div style={{ marginBottom: '26px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                      ADDITIONAL NOTE (OPTIONAL)
                    </label>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {forgotReason.length}/200
                    </span>
                  </div>
                  <textarea
                    className="input-glass erp-field"
                    style={{
                      height: '116px',
                      minHeight: '116px',
                      maxHeight: '160px',
                      resize: 'vertical',
                      padding: '10px 14px',
                      fontSize: '13px',
                      lineHeight: 1.45,
                    }}
                    placeholder="Optional note for administrator (e.g. locked out of account, forgot password)"
                    value={forgotReason}
                    onChange={(e) => setForgotReason(e.target.value)}
                    maxLength={200}
                  />
                </div>

                {/* Form Buttons without icons */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-glass erp-button"
                    onClick={() => setShowForgotModal(false)}
                    disabled={forgotLoading}
                    style={{ padding: '9px 20px', fontSize: '13px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary erp-button"
                    disabled={forgotLoading}
                    style={{ padding: '9px 24px', fontSize: '13px' }}
                  >
                    {forgotLoading ? 'Submitting...' : 'Submit Request to Admin'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
