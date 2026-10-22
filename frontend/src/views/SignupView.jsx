import React, { useState, useMemo } from 'react';
import { authApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import NbhLogo from '../components/NbhLogo';
import {
  User,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
} from 'lucide-react';
import {
  validateUsername,
  validateFullName,
  validateEmail,
  validatePhone,
  evaluatePassword,
  validateConfirmPassword,
  validateSignupForm,
} from '../utils/authValidation';

export default function SignupView({ onSwitchToLogin }) {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const passwordEvaluation = useMemo(() => {
    return evaluatePassword(formData.password, formData.username, formData.email);
  }, [formData.password, formData.username, formData.email]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Real-time clearance of error if valid
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    let errorMsg = '';
    switch (field) {
      case 'username':
        errorMsg = validateUsername(formData.username);
        break;
      case 'fullName':
        errorMsg = validateFullName(formData.fullName);
        break;
      case 'email':
        errorMsg = validateEmail(formData.email);
        break;
      case 'phone':
        errorMsg = validatePhone(formData.phone);
        break;
      case 'password':
        errorMsg = passwordEvaluation.error;
        break;
      case 'confirmPassword':
        errorMsg = validateConfirmPassword(formData.password, formData.confirmPassword);
        break;
      default:
        break;
    }
    setErrors((prev) => {
      if (errorMsg) {
        return { ...prev, [field]: errorMsg };
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setTouched({
      username: true,
      fullName: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
    });

    const validation = validateSignupForm(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      addToast('Please correct the highlighted fields before submitting.', 'error');
      const firstField = Object.keys(validation.errors)[0];
      const element = document.getElementsByName(firstField)?.[0];
      if (element) element.focus();
      return;
    }

    try {
      setLoading(true);
      await authApi.signup({
        username: formData.username.trim(),
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });
      setSubmitted(true);
      addToast('Registration submitted for admin approval!', 'success');
    } catch (err) {
      const msg = err.message || 'Signup failed';
      addToast(msg, 'error');

      const lower = msg.toLowerCase();
      const newErrors = {};

      if (lower.includes('email')) {
        newErrors.email = msg;
      }
      if (lower.includes('phone')) {
        newErrors.phone = msg;
      }
      if (lower.includes('username')) {
        newErrors.username = msg;
      }
      if (lower.includes('password')) {
        newErrors.password = msg;
      }

      if (Array.isArray(err.fieldErrors)) {
        err.fieldErrors.forEach((item) => {
          const parts = String(item).split(':');
          if (parts.length >= 2) {
            const f = parts[0].trim();
            const m = parts.slice(1).join(':').trim();
            newErrors[f] = m;
          }
        });
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...newErrors }));
        const firstField = Object.keys(newErrors)[0];
        const element = document.getElementsByName(firstField)?.[0];
        if (element) element.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          padding: '20px',
        }}
      >
        <div
          className="glass-card"
          style={{
            width: '100%',
            maxWidth: '460px',
            padding: '32px 28px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: '#ecfdf5',
              color: '#10b981',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <CheckCircle2 size={30} />
          </div>

          <h2 className="erp-dialog-title" style={{ color: '#0f172a', marginBottom: '8px', fontSize: '18px' }}>
            Registration Submitted!
          </h2>

          <p
            style={{
              color: '#64748b',
              fontSize: '13px',
              lineHeight: '1.5',
              marginBottom: '20px',
            }}
          >
            Thank you for registering. Your account for <strong>{formData.username}</strong> is currently{' '}
            <span style={{ color: '#d97706', fontWeight: 600 }}>pending administrator approval</span>.
            An administrator will review your account and assign your ERP role before you can log in.
          </p>

          <button
            type="button"
            className="btn btn-primary erp-button"
            style={{ width: '100%', padding: '9px 16px' }}
            onClick={onSwitchToLogin}
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        padding: '16px',
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '24px 28px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'inline-flex', marginBottom: '8px' }}>
            <NbhLogo size={24} />
          </div>
          <h2 className="erp-dialog-title" style={{ color: '#0f172a', margin: '0 0 2px 0', fontSize: '18px' }}>
            Create an Account
          </h2>
          <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
            Register to request enterprise access
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Row 1: Username & Full Name */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '12px',
              marginBottom: '10px',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <label
                  htmlFor="signup-username"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: errors.username ? '#dc2626' : '#475569',
                  }}
                >
                  USERNAME *
                </label>
                {errors.username && (
                  <span
                    style={{ color: '#dc2626', fontSize: '10.5px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px' }}
                    title={errors.username}
                  >
                    <AlertCircle size={11} /> {errors.username}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <User
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '10px',
                    color: errors.username ? '#ef4444' : '#94a3b8',
                  }}
                />
                <input
                  id="signup-username"
                  type="text"
                  name="username"
                  className="input-glass erp-field"
                  style={{
                    paddingLeft: '32px',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                    fontSize: '13px',
                    borderColor: errors.username ? '#ef4444' : undefined,
                    backgroundColor: errors.username ? '#fef2f2' : undefined,
                  }}
                  placeholder="e.g. john_perera"
                  value={formData.username}
                  onChange={handleChange}
                  onBlur={() => handleBlur('username')}
                  autoComplete="username"
                  aria-invalid={Boolean(errors.username)}
                  required
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <label
                  htmlFor="signup-fullName"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: errors.fullName ? '#dc2626' : '#475569',
                  }}
                >
                  FULL NAME *
                </label>
                {errors.fullName && (
                  <span
                    style={{ color: '#dc2626', fontSize: '10.5px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px' }}
                    title={errors.fullName}
                  >
                    <AlertCircle size={11} /> {errors.fullName}
                  </span>
                )}
              </div>
              <input
                id="signup-fullName"
                type="text"
                name="fullName"
                className="input-glass erp-field"
                style={{
                  paddingTop: '8px',
                  paddingBottom: '8px',
                  fontSize: '13px',
                  borderColor: errors.fullName ? '#ef4444' : undefined,
                  backgroundColor: errors.fullName ? '#fef2f2' : undefined,
                }}
                placeholder="e.g. John Perera"
                value={formData.fullName}
                onChange={handleChange}
                onBlur={() => handleBlur('fullName')}
                autoComplete="name"
                aria-invalid={Boolean(errors.fullName)}
                required
              />
            </div>
          </div>

          {/* Row 2: Email & Phone Number */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '12px',
              marginBottom: '10px',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <label
                  htmlFor="signup-email"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: errors.email ? '#dc2626' : '#475569',
                  }}
                >
                  EMAIL ADDRESS *
                </label>
                {errors.email && (
                  <span
                    style={{ color: '#dc2626', fontSize: '10.5px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px' }}
                    title={errors.email}
                  >
                    <AlertCircle size={11} /> {errors.email}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '10px',
                    color: errors.email ? '#ef4444' : '#94a3b8',
                  }}
                />
                <input
                  id="signup-email"
                  type="email"
                  name="email"
                  className="input-glass erp-field"
                  style={{
                    paddingLeft: '32px',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                    fontSize: '13px',
                    borderColor: errors.email ? '#ef4444' : undefined,
                    backgroundColor: errors.email ? '#fef2f2' : undefined,
                  }}
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={() => handleBlur('email')}
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  required
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <label
                  htmlFor="signup-phone"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: errors.phone ? '#dc2626' : '#475569',
                  }}
                >
                  PHONE NUMBER *
                </label>
                {errors.phone && (
                  <span
                    style={{ color: '#dc2626', fontSize: '10.5px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px' }}
                    title={errors.phone}
                  >
                    <AlertCircle size={11} /> {errors.phone}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Phone
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '10px',
                    color: errors.phone ? '#ef4444' : '#94a3b8',
                  }}
                />
                <input
                  id="signup-phone"
                  type="tel"
                  name="phone"
                  className="input-glass erp-field"
                  style={{
                    paddingLeft: '32px',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                    fontSize: '13px',
                    borderColor: errors.phone ? '#ef4444' : undefined,
                    backgroundColor: errors.phone ? '#fef2f2' : undefined,
                  }}
                  placeholder="+94 77 123 4567"
                  value={formData.phone}
                  onChange={handleChange}
                  onBlur={() => handleBlur('phone')}
                  autoComplete="tel"
                  aria-invalid={Boolean(errors.phone)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Row 3: Password & Confirm Password */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '12px',
              marginBottom: '10px',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <label
                  htmlFor="signup-password"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: errors.password ? '#dc2626' : '#475569',
                  }}
                >
                  PASSWORD *
                </label>
                {errors.password && (
                  <span
                    style={{ color: '#dc2626', fontSize: '10.5px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px' }}
                    title={errors.password}
                  >
                    <AlertCircle size={11} /> {errors.password}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '10px',
                    color: errors.password ? '#ef4444' : '#94a3b8',
                  }}
                />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  className="input-glass erp-field"
                  style={{
                    paddingLeft: '32px',
                    paddingRight: '34px',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                    fontSize: '13px',
                    borderColor: errors.password ? '#ef4444' : undefined,
                    backgroundColor: errors.password ? '#fef2f2' : undefined,
                  }}
                  placeholder="Min 8 chars, mixed case & symbol"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={() => handleBlur('password')}
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.password)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '8px',
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
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <label
                  htmlFor="signup-confirmPassword"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: errors.confirmPassword ? '#dc2626' : '#475569',
                  }}
                >
                  CONFIRM PASSWORD *
                </label>
                {errors.confirmPassword && (
                  <span
                    style={{ color: '#dc2626', fontSize: '10.5px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px' }}
                    title={errors.confirmPassword}
                  >
                    <AlertCircle size={11} /> {errors.confirmPassword}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '10px',
                    color: errors.confirmPassword ? '#ef4444' : '#94a3b8',
                  }}
                />
                <input
                  id="signup-confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  className="input-glass erp-field"
                  style={{
                    paddingLeft: '32px',
                    paddingRight: '34px',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                    fontSize: '13px',
                    borderColor: errors.confirmPassword ? '#ef4444' : undefined,
                    backgroundColor: errors.confirmPassword ? '#fef2f2' : undefined,
                  }}
                  placeholder="Re-type password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={() => handleBlur('confirmPassword')}
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '8px',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {/* Compact Password Evaluation Strip (Only when password entered) */}
          {formData.password && (
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '8px 10px',
                marginBottom: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '5px',
                }}
              >
                <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#475569' }}>
                  Password Strength:
                </span>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    color: passwordEvaluation.color,
                  }}
                >
                  {passwordEvaluation.label}
                </span>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '3px',
                  marginBottom: '6px',
                }}
              >
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    style={{
                      height: '3px',
                      borderRadius: '2px',
                      backgroundColor:
                        step <= passwordEvaluation.score
                          ? passwordEvaluation.color
                          : '#e2e8f0',
                      transition: 'background-color 0.2s ease',
                    }}
                  />
                ))}
              </div>

              {/* Compact criteria chips */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '3px 8px',
                  fontSize: '10.5px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: passwordEvaluation.criteria.minLength ? '#16a34a' : '#64748b',
                  }}
                >
                  {passwordEvaluation.criteria.minLength ? <Check size={11} /> : <span>•</span>}
                  8+ characters
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color:
                      passwordEvaluation.criteria.hasUpper && passwordEvaluation.criteria.hasLower
                        ? '#16a34a'
                        : '#64748b',
                  }}
                >
                  {passwordEvaluation.criteria.hasUpper && passwordEvaluation.criteria.hasLower ? (
                    <Check size={11} />
                  ) : (
                    <span>•</span>
                  )}
                  Upper & lower
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: passwordEvaluation.criteria.hasDigit ? '#16a34a' : '#64748b',
                  }}
                >
                  {passwordEvaluation.criteria.hasDigit ? <Check size={11} /> : <span>•</span>}
                  Number (0–9)
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: passwordEvaluation.criteria.hasSpecial ? '#16a34a' : '#64748b',
                  }}
                >
                  {passwordEvaluation.criteria.hasSpecial ? <Check size={11} /> : <span>•</span>}
                  Special symbol
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color:
                      passwordEvaluation.criteria.noUsername &&
                      passwordEvaluation.criteria.noEmail &&
                      passwordEvaluation.criteria.noBreach
                        ? '#16a34a'
                        : '#64748b',
                  }}
                >
                  {passwordEvaluation.criteria.noUsername &&
                  passwordEvaluation.criteria.noEmail &&
                  passwordEvaluation.criteria.noBreach ? (
                    <Check size={11} />
                  ) : (
                    <span>•</span>
                  )}
                  Unique & safe
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color:
                      formData.confirmPassword &&
                      formData.password === formData.confirmPassword
                        ? '#16a34a'
                        : '#64748b',
                  }}
                >
                  {formData.confirmPassword && formData.password === formData.confirmPassword ? (
                    <Check size={11} />
                  ) : (
                    <span>•</span>
                  )}
                  Passwords match
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: '12px' }}>
            <button
              type="submit"
              className="btn btn-primary erp-button"
              style={{ width: '100%', padding: '10px' }}
              disabled={loading}
            >
              {loading ? (
                'Submitting Registration...'
              ) : (
                <>
                  Register Account <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>

        <div
          style={{
            marginTop: '16px',
            textAlign: 'center',
            fontSize: 'var(--erp-text-button)',
            color: '#64748b',
          }}
        >
          Already have an approved account?{' '}
          <button
            className="erp-button"
            type="button"
            onClick={onSwitchToLogin}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
