// ─── Config ───────────────────────────────────────────────────────────────────
// API_BASE is set by nav.js. Fallback here in case nav.js isn't loaded.
const API_BASE = window.API_BASE || 'http://localhost:5000/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showError(msg) {
  let el = document.getElementById('auth-error');
  if (!el) {
    el = document.createElement('div');
    el.id = 'auth-error';
    el.style.cssText = `
      background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;
      border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem;
      font-size: 0.9rem; font-weight: 500;
    `;
    const form = document.querySelector('form');
    if (form) form.insertAdjacentElement('beforebegin', el);
  }
  el.textContent = msg;
  el.style.display = 'block';
}

function clearError() {
  const el = document.getElementById('auth-error');
  if (el) el.style.display = 'none';
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait…' : btn.dataset.label;
}

// ─── Login ────────────────────────────────────────────────────────────────────
const loginForm = document.getElementById('login-form');
if (loginForm) {
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.dataset.label = submitBtn.textContent;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    setLoading(submitBtn, true);

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const res  = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showError(data.message || 'Login failed. Please try again.');
        return;
      }

      // Save token & user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect based on role
      const isAdminArea = window.location.pathname.includes('/admin/');
      
      if (data.user.role === 'admin') {
        window.location.href = isAdminArea ? 'index.html' : 'admin/index.html';
      } else {
        window.location.href = isAdminArea ? '../dashboard.html' : 'dashboard.html';
      }
    } catch (err) {
      showError('Cannot connect to server. Make sure the backend is running.');
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

// ─── Register ─────────────────────────────────────────────────────────────────
const registerForm = document.getElementById('register-form');
if (registerForm) {
  const submitBtn = registerForm.querySelector('button[type="submit"]');
  submitBtn.dataset.label = submitBtn.textContent;

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const username        = document.getElementById('username').value.trim();
    const email           = document.getElementById('email').value.trim();
    const password        = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password !== confirmPassword) {
      showError('Passwords do not match.');
      return;
    }

    setLoading(submitBtn, true);

    try {
      const res  = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showError(data.message || 'Registration failed. Please try again.');
        return;
      }

      // Save token & user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      window.location.href = 'dashboard.html';
    } catch (err) {
      showError('Cannot connect to server. Make sure the backend is running.');
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

// --- Forgot Password ----------------------------------------------------------
const forgotPasswordForm = document.getElementById('forgot-password-form');
if (forgotPasswordForm) {
  const submitBtn = forgotPasswordForm.querySelector('button[type="submit"]');
  submitBtn.dataset.label = submitBtn.textContent;

  forgotPasswordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError();
    setLoading(submitBtn, true);

    const email = document.getElementById('email').value.trim();
    if (!email) {
      showError('Please enter your email address.');
      setLoading(submitBtn, false);
      return;
    }

    // Simulate network request since there is no actual email/SMTP backend yet
    setTimeout(() => {
      setLoading(submitBtn, false);
      if (typeof toast !== 'undefined') {
        toast('If an account with that email exists, a password reset link has been sent.', 'success');
      } else {
        alert('If an account with that email exists, a password reset link has been sent.');
      }
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 3000);
    }, 800);
  });
}

