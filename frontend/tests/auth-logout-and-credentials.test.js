import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Manual logout sets signed out notice and does not trigger session expired', () => {
  const apiClientSrc = fs.readFileSync(path.resolve('src/api/apiClient.js'), 'utf8');
  const authContextSrc = fs.readFileSync(path.resolve('src/context/AuthContext.jsx'), 'utf8');
  const loginViewSrc = fs.readFileSync(path.resolve('src/views/LoginView.jsx'), 'utf8');

  // Verify manualLogout exists and stores nbh_signed_out
  assert.ok(apiClientSrc.includes('export const manualLogout'), 'manualLogout should be exported from apiClient');
  assert.ok(apiClientSrc.includes("sessionStorage.setItem('nbh_signed_out', message)"), 'manualLogout should store nbh_signed_out');
  assert.ok(apiClientSrc.includes("sessionStorage.removeItem('nbh_session_expired')"), 'manualLogout should clear nbh_session_expired');

  // Verify AuthContext invokes manualLogout on normal logout
  assert.ok(authContextSrc.includes("manualLogout('You have successfully signed out.')"), 'AuthContext should call manualLogout on manual signout');
  assert.ok(authContextSrc.includes('expireSession(IDLE_EXPIRED_MESSAGE)'), 'AuthContext should call expireSession on idle timeout');

  // Verify LoginView handles signedOutNotice cleanly
  assert.ok(loginViewSrc.includes("sessionStorage.getItem('nbh_signed_out')"), 'LoginView checks for signed out notice');
  assert.ok(loginViewSrc.includes('signedOutNotice'), 'LoginView renders signedOutNotice component');
});

test('Login keeps failed credentials uniform and handles throttling without identifying an account', () => {
  const loginViewSrc = fs.readFileSync(path.resolve('src/views/LoginView.jsx'), 'utf8');
  const authServiceSrc = fs.readFileSync(path.resolve('../src/main/java/com/nbh/erp/auth/service/AuthService.java'), 'utf8');
  for (const source of [loginViewSrc, authServiceSrc]) {
    assert.ok(source.includes('Invalid username or password'));
    assert.doesNotMatch(source, /Username is incorrect\.|Password is incorrect\./);
  }
  assert.ok(loginViewSrc.includes('err.response?.status === 429'));
  assert.ok(loginViewSrc.includes('Please wait a minute and try again'));
});

test('Forgot Password request feature is available on Login and handled in Admin', () => {
  const loginViewSrc = fs.readFileSync(path.resolve('src/views/LoginView.jsx'), 'utf8');
  const apiClientSrc = fs.readFileSync(path.resolve('src/api/apiClient.js'), 'utf8');
  const employeesHubSrc = fs.readFileSync(path.resolve('src/views/EmployeesHub.jsx'), 'utf8');
  const modalSrc = fs.readFileSync(path.resolve('src/components/EmployeeEditorModal.jsx'), 'utf8');

  // Verify Forgot Password button & modal in LoginView
  assert.ok(loginViewSrc.includes('Forgot Password?'), 'LoginView has Forgot Password? trigger');
  assert.ok(loginViewSrc.includes('Request Password Reset'), 'LoginView has Request Password Reset modal');
  assert.ok(loginViewSrc.includes('authApi.forgotPassword'), 'LoginView invokes authApi.forgotPassword');

  // Verify apiClient has forgotPassword and whitelists it
  assert.ok(apiClientSrc.includes("forgotPassword: (data) => api.post('/auth/forgot-password', data)"), 'apiClient defines forgotPassword');
  assert.ok(apiClientSrc.includes("'/auth/forgot-password'"), 'apiClient whitelists /auth/forgot-password');

  // Verify Admin UI indicates reset requested
  assert.ok(employeesHubSrc.includes('emp.passwordResetRequested'), 'EmployeesHub renders badge when passwordResetRequested is true');
  assert.ok(employeesHubSrc.includes('Reset Requested'), 'EmployeesHub displays Reset Requested badge');
  assert.ok(modalSrc.includes('Password Reset Requested by Employee'), 'EmployeeEditorModal displays reset alert');
});

test('Signup page removes breach protection banner, compacts errors to prevent vertical scrolling', () => {
  const signupViewSrc = fs.readFileSync(path.resolve('src/views/SignupView.jsx'), 'utf8');

  // Verify breach advisory text is completely removed
  assert.ok(!signupViewSrc.includes('Google & Browser Breach Protection'), 'Breach protection text should be removed');
  assert.ok(!signupViewSrc.includes('Google &amp; Browser Breach Protection'), 'Breach protection text should be removed');

  // Verify compact error layout
  assert.ok(signupViewSrc.includes('errors.username'), 'Username error tracked');
  assert.ok(signupViewSrc.includes('justifyContent: \'space-between\''), 'Errors displayed inline/aligned in label header');
});

test('Input focus style matches GRN page (#93c5fd border, #f8fbff background, no wide box-shadow/outline)', () => {
  const styleCss = fs.readFileSync(path.resolve('src/style.css'), 'utf8');
  const erpCss = fs.readFileSync(path.resolve('src/components/ErpDesignSystem.css'), 'utf8');

  // style.css
  assert.ok(styleCss.includes('border-color: #93c5fd !important;'), 'style.css sets #93c5fd border on focus');
  assert.ok(styleCss.includes('background-color: #f8fbff;'), 'style.css sets #f8fbff background on focus');
  assert.ok(styleCss.includes('box-shadow: none !important;'), 'style.css removes wide box-shadow');

  // ErpDesignSystem.css
  assert.ok(erpCss.includes('border-color: #93c5fd !important;'), 'ErpDesignSystem sets #93c5fd border on focus');
  assert.ok(erpCss.includes('background: #f8fbff !important;'), 'ErpDesignSystem sets #f8fbff background on focus');
  assert.ok(erpCss.includes('outline: none !important;'), 'ErpDesignSystem removes 2px offset outline from inputs');
});
