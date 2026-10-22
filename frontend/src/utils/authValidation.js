import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export const BREACHED_PASSWORDS = new Set([
  'password', 'password123', 'password1234', 'password123!', 'p@ssword', 'p@ssword123',
  '12345678', '123456789', '1234567890', '12345678!',
  'admin123', 'admin1234', 'admin123!', 'administrator',
  'qwerty123', 'qwertyuiop', 'welcome123', 'welcome123!',
  'letmein123', 'changeme123', 'iloveyou123', 'pass1234', 'pass1234!',
  'monkey123', 'dragon123', 'master123', 'sunshine123', 'princess123'
]);

export function validateUsername(username) {
  const trimmed = String(username || '').trim();
  if (!trimmed) return 'Username is required.';
  if (trimmed.length < 3 || trimmed.length > 50) return 'Username must be between 3 and 50 characters.';
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return 'Username can only contain letters, numbers, dots, hyphens, and underscores.';
  }
  return '';
}

export function validateFullName(fullName) {
  const trimmed = String(fullName || '').trim();
  if (!trimmed) return 'Full name is required.';
  if (trimmed.length < 2 || trimmed.length > 100) return 'Full name must be between 2 and 100 characters.';
  if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
    return 'Full name can only contain letters, spaces, hyphens, apostrophes, and dots.';
  }
  return '';
}

export function validateEmail(email) {
  const trimmed = String(email || '').trim().toLowerCase();
  if (!trimmed) return 'Email address is required.';
  if (trimmed.length > 100) return 'Email cannot exceed 100 characters.';
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(trimmed)) {
    return 'Enter a valid email address (e.g. user@example.com).';
  }
  return '';
}

export function validatePhone(phone) {
  const trimmed = String(phone || '').trim();
  if (!trimmed) return 'Phone number is required.';
  if (trimmed.length > 30 || !/^[+\d\s().-]+$/.test(trimmed)) {
    return 'Enter a valid contact number (e.g. +94 77 123 4567).';
  }
  const parsed = parsePhoneNumberFromString(trimmed, 'LK');
  if (!parsed || !parsed.isValid()) {
    return 'Enter a valid contact number with country calling code (e.g. +94 77 123 4567).';
  }
  return '';
}

export function evaluatePassword(password = '', username = '', email = '') {
  const str = String(password || '');
  const lower = str.toLowerCase();
  const trimmedUser = String(username || '').trim().toLowerCase();
  const emailPrefix = String(email || '').includes('@') ? email.split('@')[0].trim().toLowerCase() : '';

  const criteria = {
    minLength: str.length >= 8 && str.length <= 100,
    hasUpper: /[A-Z]/.test(str),
    hasLower: /[a-z]/.test(str),
    hasDigit: /[0-9]/.test(str),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(str),
    noUsername: !(trimmedUser && trimmedUser.length >= 3 && lower.includes(trimmedUser)),
    noEmail: !(emailPrefix && emailPrefix.length >= 3 && lower.includes(emailPrefix)),
    noBreach: !BREACHED_PASSWORDS.has(lower),
  };

  let score = 0;
  if (criteria.minLength) score++;
  if (criteria.hasUpper && criteria.hasLower) score++;
  if (criteria.hasDigit) score++;
  if (criteria.hasSpecial) score++;
  if (!criteria.noUsername || !criteria.noEmail || !criteria.noBreach) {
    score = Math.min(score, 1);
  }

  const isStrong = criteria.minLength &&
    criteria.hasUpper &&
    criteria.hasLower &&
    criteria.hasDigit &&
    criteria.hasSpecial &&
    criteria.noUsername &&
    criteria.noEmail &&
    criteria.noBreach;

  let label = 'Weak';
  let color = '#ef4444'; // Red
  if (score === 2) {
    label = 'Fair';
    color = '#f97316'; // Orange
  } else if (score === 3) {
    label = 'Good';
    color = '#eab308'; // Amber/Yellow
  } else if (score >= 4 && isStrong) {
    label = 'Strong';
    color = '#10b981'; // Green
  }

  let error = '';
  if (!str) {
    error = 'Password is required.';
  } else if (str.length < 8) {
    error = 'Password must be at least 8 characters long.';
  } else if (!criteria.hasLower || !criteria.hasUpper) {
    error = 'Password must contain uppercase and lowercase letters.';
  } else if (!criteria.hasDigit) {
    error = 'Password must contain at least one number (0-9).';
  } else if (!criteria.hasSpecial) {
    error = 'Password must contain at least one special character (!@#$%...).';
  } else if (!criteria.noUsername) {
    error = 'Password cannot contain your username.';
  } else if (!criteria.noEmail) {
    error = 'Password cannot contain parts of your email address.';
  } else if (!criteria.noBreach) {
    error = 'This password was flagged in data breaches or is too common. Choose a unique password.';
  }

  return {
    score,
    isStrong,
    label,
    color,
    criteria,
    error,
  };
}

export function validateConfirmPassword(password, confirmPassword) {
  if (!confirmPassword) return 'Please confirm your password.';
  if (password !== confirmPassword) return 'Passwords do not match.';
  return '';
}

export function validateSignupForm(formData) {
  const errors = {};

  const usernameErr = validateUsername(formData.username);
  if (usernameErr) errors.username = usernameErr;

  const fullNameErr = validateFullName(formData.fullName);
  if (fullNameErr) errors.fullName = fullNameErr;

  const emailErr = validateEmail(formData.email);
  if (emailErr) errors.email = emailErr;

  const phoneErr = validatePhone(formData.phone);
  if (phoneErr) errors.phone = phoneErr;

  const passwordEval = evaluatePassword(formData.password, formData.username, formData.email);
  if (passwordEval.error) errors.password = passwordEval.error;

  const confirmErr = validateConfirmPassword(formData.password, formData.confirmPassword);
  if (confirmErr) errors.confirmPassword = confirmErr;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    passwordEval,
  };
}
