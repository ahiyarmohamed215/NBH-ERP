import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUsername,
  validateFullName,
  validateEmail,
  validatePhone,
  evaluatePassword,
  validateConfirmPassword,
  validateSignupForm,
} from '../src/utils/authValidation.js';

test('validateUsername accepts valid usernames and rejects invalid formats', () => {
  assert.equal(validateUsername('john_doe'), '');
  assert.equal(validateUsername('john.doe-99'), '');
  assert.notEqual(validateUsername(''), '');
  assert.notEqual(validateUsername('ab'), ''); // too short
  assert.notEqual(validateUsername('john doe'), ''); // spaces
  assert.notEqual(validateUsername('john@doe'), ''); // special chars
});

test('validateFullName requires standard name characters', () => {
  assert.equal(validateFullName('John Perera'), '');
  assert.equal(validateFullName("Jane O'Connor"), '');
  assert.notEqual(validateFullName(''), '');
  assert.notEqual(validateFullName('A'), ''); // too short
  assert.notEqual(validateFullName('John123'), ''); // digits
});

test('validateEmail requires standard RFC email', () => {
  assert.equal(validateEmail('user@nbh.com'), '');
  assert.equal(validateEmail('test.user+tag@domain.co'), '');
  assert.notEqual(validateEmail(''), '');
  assert.notEqual(validateEmail('invalid-email'), '');
  assert.notEqual(validateEmail('user@domain'), '');
});

test('validatePhone checks international/national phone formats', () => {
  assert.equal(validatePhone('+94 77 123 4567'), '');
  assert.equal(validatePhone('0771234567'), '');
  assert.notEqual(validatePhone(''), '');
  assert.notEqual(validatePhone('123'), '');
  assert.notEqual(validatePhone('abcdef'), '');
});

test('evaluatePassword checks complexity and identifies breached/weak passwords', () => {
  // Strong password
  const strong = evaluatePassword('Secure#Pass2026', 'john', 'john@example.com');
  assert.equal(strong.isStrong, true);
  assert.equal(strong.error, '');
  assert.equal(strong.label, 'Strong');

  // Too short
  const shortPass = evaluatePassword('Sh0rt!', 'john', 'john@example.com');
  assert.equal(shortPass.isStrong, false);
  assert.match(shortPass.error, /8 characters/i);

  // Missing special symbol
  const noSpecial = evaluatePassword('SecurePass2026', 'john', 'john@example.com');
  assert.equal(noSpecial.isStrong, false);
  assert.match(noSpecial.error, /special character/i);

  // Containing username
  const withUser = evaluatePassword('John#Pass2026', 'john', 'other@example.com');
  assert.equal(withUser.isStrong, false);
  assert.match(withUser.error, /cannot contain your username/i);

  // Containing email handle
  const withEmail = evaluatePassword('SecretAdmin#2026', 'user', 'secretadmin@example.com');
  assert.equal(withEmail.isStrong, false);
  assert.match(withEmail.error, /parts of your email/i);

  // Common breached password
  const breached = evaluatePassword('Password123!', 'user', 'user@example.com');
  assert.equal(breached.isStrong, false);
  assert.match(breached.error, /breach/i);
});

test('validateSignupForm validates all fields collectively', () => {
  const validForm = {
    username: 'validuser',
    fullName: 'Valid User',
    email: 'valid@nbh.com',
    phone: '+94 77 123 4567',
    password: 'SafePassword#2026',
    confirmPassword: 'SafePassword#2026',
  };

  const validResult = validateSignupForm(validForm);
  assert.equal(validResult.isValid, true);
  assert.equal(Object.keys(validResult.errors).length, 0);

  const invalidForm = {
    username: 'u',
    fullName: '',
    email: 'not-an-email',
    phone: '123',
    password: '123',
    confirmPassword: '456',
  };

  const invalidResult = validateSignupForm(invalidForm);
  assert.equal(invalidResult.isValid, false);
  assert.ok(invalidResult.errors.username);
  assert.ok(invalidResult.errors.fullName);
  assert.ok(invalidResult.errors.email);
  assert.ok(invalidResult.errors.phone);
  assert.ok(invalidResult.errors.password);
  assert.ok(invalidResult.errors.confirmPassword);
});
