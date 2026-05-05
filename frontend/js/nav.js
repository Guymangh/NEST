/**
 * nav.js — Universal navigation & auth guard
 * Add to every non-admin HTML page.
 * Body attributes:
 *   data-require-auth="true"   → redirect to login if not logged in
 *   data-redirect-auth="page"  → redirect to page if already logged in
 */

// Set API_BASE as window property so other scripts share it without redeclaring.
// The actual URL is defined in js/config.js — change it there for production.
window.API_BASE = window.__API_BASE__ || 'http://localhost:5000/api';

// ── Auto-clear expired JWT tokens ─────────────────────────────────────────────
(function clearExpiredToken() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      // Token expired — clear everything
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('lognest_cart');
    }
  } catch {
    // Malformed token — clear it
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
})();

(function () {
  function getCartCount() {
    try { return JSON.parse(localStorage.getItem('lognest_cart') || '[]').length; }
    catch { return 0; }
  }

  // ── Inject styles for dropdown ───────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .nav-actions { display: flex; align-items: center; gap: 1rem; }
    .nav-links   { display: flex; align-items: center; gap: 1.75rem; list-style: none; }
    .nav-links a { font-weight: 500; font-size: 0.92rem; color: var(--text-main); text-decoration: none; transition: color 0.2s; }
    .nav-links a:hover { color: var(--primary); }

    .nav-balance {
      display: inline-flex; align-items: center; gap: 0.35rem;
      background: var(--bg-accent); border: 1px solid var(--border-soft);
      border-radius: 20px; padding: 0.35rem 0.9rem;
      font-size: 0.82rem; font-weight: 700; color: var(--primary-deep);
      text-decoration: none; transition: background 0.2s;
    }
    .nav-balance:hover { background: var(--champagne); }

    .nav-cart {
      position: relative; display: inline-flex; align-items: center;
      justify-content: center; width: 38px; height: 38px;
      background: var(--bg-accent); border: 1px solid var(--border-soft);
      border-radius: 10px; font-size: 1.1rem; text-decoration: none;
      transition: background 0.2s, border-color 0.2s;
    }
    .nav-cart:hover { background: var(--champagne); border-color: var(--primary); }
    .nav-cart-badge {
      position: absolute; top: -6px; right: -6px;
      background: #E07A5F; color: #fff; border-radius: 50%;
      width: 17px; height: 17px; font-size: 0.65rem; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid var(--bg-main);
    }

    .nav-user { position: relative; }
    .nav-user-btn {
      display: flex; align-items: center; gap: 0.5rem;
      background: var(--bg-accent); border: 1px solid var(--border-soft);
      border-radius: 10px; padding: 0.4rem 0.9rem 0.4rem 0.5rem;
      cursor: pointer; font-size: 0.88rem; font-weight: 600;
      color: var(--text-main); transition: background 0.2s;
    }
    .nav-user-btn:hover { background: var(--champagne); }
    .nav-user-avatar {
      width: 28px; height: 28px; border-radius: 50%;
      background: var(--primary-deep); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.8rem; font-weight: 800; flex-shrink: 0;
    }
    .nav-dropdown {
      position: absolute; top: calc(100% + 8px); right: 0;
      background: var(--bg-card); border: 1px solid var(--border-soft);
      border-radius: 14px; box-shadow: 0 10px 30px rgba(44,36,22,0.12);
      min-width: 200px; overflow: hidden;
      opacity: 0; pointer-events: none; transform: translateY(-6px);
      transition: opacity 0.2s, transform 0.2s; z-index: 999;
    }
    .nav-dropdown.open { opacity: 1; pointer-events: all; transform: translateY(0); }
    .nav-dropdown a {
      display: flex; align-items: center; gap: 0.65rem;
      padding: 0.75rem 1.1rem; font-size: 0.88rem; font-weight: 500;
      color: var(--text-main) !important; text-decoration: none;
      transition: background 0.15s;
    }
    .nav-dropdown a:hover { background: var(--bg-accent); }
    .nav-dropdown-sep { height: 1px; background: var(--border-soft); margin: 0.25rem 0; }
    .nav-dropdown .logout-link { color: #b91c1c !important; }
    .nav-dropdown .logout-link:hover { background: #fef2f2; }

    /* Dark Mode Toggle Button */
    .dark-toggle {
      display: flex; align-items: center; gap: 0.65rem;
      padding: 0.75rem 1.1rem; font-size: 0.88rem; font-weight: 500;
      color: var(--text-main); cursor: pointer; background: none;
      border: none; width: 100%; text-align: left; font-family: var(--font-main);
      transition: background 0.15s;
    }
    .dark-toggle:hover { background: var(--bg-accent); }
    .dark-toggle-track {
      width: 34px; height: 19px; border-radius: 99px;
      background: #D9E2E8; border: 1.5px solid #c0ccd6;
      position: relative; transition: background 0.25s, border-color 0.25s;
      flex-shrink: 0; margin-left: auto;
    }
    .dark-toggle-track.on { background: #1A7A7A; border-color: #0D4F4F; }
    .dark-toggle-track::after {
      content: ''; position: absolute; top: 2px; left: 2px;
      width: 13px; height: 13px; border-radius: 50%;
      background: #fff; transition: transform 0.25s; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .dark-toggle-track.on::after { transform: translateX(15px); }

    @media (max-width: 768px) {
      .nav-container { flex-wrap: nowrap; gap: 0.5rem; padding: 0.5rem 1rem; }
      .nav-actions { gap: 0.45rem; flex-shrink: 0; }
      .nav-balance { padding: 0.3rem 0.65rem; font-size: 0.75rem; }
      .nav-cart { width: 32px; height: 32px; font-size: 0.95rem; border-radius: 8px; }
      .nav-user-btn { padding: 0.3rem 0.55rem 0.3rem 0.35rem; font-size: 0.8rem; gap: 0.3rem; border-radius: 8px; }
      .nav-user-btn > span:nth-child(2) { display: none; }
      .nav-user-avatar { width: 24px; height: 24px; font-size: 0.7rem; }
      .nav-dropdown { right: -0.5rem; min-width: 180px; }
    }
  `;
  document.head.appendChild(style);

  // ── Everything runs after DOM is ready ───────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // ── Apply saved dark mode preference immediately ──────────────────────────
    if (localStorage.getItem('lognest_dark') === '1') {
      document.body.classList.add('dark-mode');
    }
    const token = localStorage.getItem('token');
    const user  = JSON.parse(localStorage.getItem('user') || 'null');
    const body  = document.body;

    // Auth guards — body is guaranteed to exist here
    if (body.dataset.requireAuth === 'true' && !token) {
      window.location.href = 'login.html';
      return;
    }
    if (body.dataset.redirectAuth && token) {
      window.location.href = body.dataset.redirectAuth;
      return;
    }

    const mainNav = document.getElementById('main-nav');
    if (!mainNav) return;

    const parent = mainNav.parentElement;

    if (token && user) {
      const cartCount = getCartCount();
      const initial   = (user.username || 'U').charAt(0).toUpperCase();
      const dashLink  = user.role === 'admin' ? 'admin/index.html' : 'dashboard.html';
      const balance   = `$${parseFloat(user.balance || 0).toFixed(2)}`;

      const onStorePage = window.location.pathname.split('/').pop() === 'store.html';

      parent.innerHTML = `
        <div class="nav-actions">
          ${!onStorePage ? `<a href="store.html" class="nav-balance" title="Store">Store</a>` : ''}
        <a href="deposit.html" class="nav-balance" title="Add funds">
          💰 ${balance}
        </a>
        <a href="cart.html" class="nav-cart" title="Cart">
          🛒
          <span class="nav-cart-badge" style="${cartCount > 0 ? '' : 'display:none;'}">${cartCount}</span>
        </a>
        <div class="nav-user" id="nav-user-wrap">
          <button class="nav-user-btn" id="nav-user-btn">
            <span class="nav-user-avatar">${initial}</span>
            <span>${user.username || 'Account'}</span>
            <span style="font-size:0.7rem;opacity:0.6;">▾</span>
          </button>
          <div class="nav-dropdown" id="nav-dropdown">
            <a href="${dashLink}">📊 Dashboard</a>
            <a href="profile.html">👤 Profile</a>
            <a href="orders.html">📦 My Orders</a>
            <a href="deposit.html">💰 Add Funds</a>
            <div class="nav-dropdown-sep"></div>
            <button class="dark-toggle" id="nav-dark-toggle">
              <span id="nav-dark-icon">🌙</span>
              <span id="nav-dark-label">Dark Mode</span>
              <span class="dark-toggle-track" id="nav-dark-track"></span>
            </button>
            <div class="nav-dropdown-sep"></div>
            ${user.role === 'admin' ? '<a href="admin/index.html">🛡 Admin Panel</a><div class="nav-dropdown-sep"></div>' : ''}
            <a href="#" id="nav-logout" class="logout-link">🚪 Logout</a>
          </div>
        </div>
      </div>
    `;

      // Attach dropdown handlers (always, not just non-index)
      const btn      = document.getElementById('nav-user-btn');
      const dropdown = document.getElementById('nav-dropdown');
      if(btn && dropdown) {
        btn.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.toggle('open'); });
        document.addEventListener('click', () => dropdown.classList.remove('open'));
      }

      const logoutBtn = document.getElementById('nav-logout');
      if(logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
          e.preventDefault();
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('lognest_cart');
          window.location.href = 'index.html';
        });
      }

      // ── Dark Mode Toggle ─────────────────────────────────────────────────
      const darkBtn   = document.getElementById('nav-dark-toggle');
      const darkTrack = document.getElementById('nav-dark-track');
      const darkIcon  = document.getElementById('nav-dark-icon');
      const darkLabel = document.getElementById('nav-dark-label');

      function applyDark(on) {
        document.body.classList.toggle('dark-mode', on);
        localStorage.setItem('lognest_dark', on ? '1' : '0');
        if (darkTrack)  darkTrack.classList.toggle('on', on);
        if (darkIcon)   darkIcon.textContent  = on ? '☀️' : '🌙';
        if (darkLabel)  darkLabel.textContent = on ? 'Light Mode' : 'Dark Mode';
      }

      const isDark = localStorage.getItem('lognest_dark') === '1';
      applyDark(isDark);

      if (darkBtn) {
        darkBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          applyDark(!document.body.classList.contains('dark-mode'));
        });
      }
    } else {
      parent.innerHTML = `
        <div class="nav-actions">
          <a href="login.html" class="btn btn-outline" style="padding:0.45rem 1.1rem; font-size:0.9rem;">Login</a>
          <a href="register.html" class="btn btn-primary" style="padding:0.45rem 1.1rem; font-size:0.9rem;">Register</a>
        </div>
      `;
    }

    // Highlight active link
    const current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(a => {
      if ((a.getAttribute('href') || '') === current) {
        a.style.color = 'var(--primary-deep)';
        a.style.fontWeight = '700';
      }
    });
  });
})();
