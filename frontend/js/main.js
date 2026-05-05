// ─── Main JS ──────────────────────────────────────────────────────────────────
// Handles site-wide nav state, balance display, and cart badge

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || 'null');
  const nav   = document.querySelector('.nav-list');

  if (nav && token && user) {
    // Remove login/register links
    nav.querySelectorAll('a[href="login.html"], a[href="register.html"]').forEach(a => a.parentElement.remove());

    // Show user balance badge in nav
    const balanceLi = document.createElement('li');
    balanceLi.innerHTML = `
      <a href="deposit.html" style="display:flex; align-items:center; gap:0.4rem; font-weight:700; color:var(--primary-deep);">
        <span style="font-size:0.75rem; background:var(--bg-accent); border:1px solid var(--border-soft); border-radius:20px; padding:0.25rem 0.75rem;">
          💰 $${parseFloat(user.balance || 0).toFixed(2)}
        </span>
      </a>
    `;
    nav.appendChild(balanceLi);

    // Cart link with badge
    const cartLi = document.createElement('li');
    cartLi.style.position = 'relative';
    cartLi.innerHTML = `
      <a href="cart.html" style="position:relative; display:inline-flex; align-items:center; gap:0.35rem;">
        🛒 Cart
        <span class="cart-badge" style="display:none; background:var(--accent-warm,#E07A5F); color:#fff; border-radius:50%; width:18px; height:18px; font-size:0.7rem; font-weight:800; align-items:center; justify-content:center;"></span>
      </a>
    `;
    nav.appendChild(cartLi);

    // Dashboard link
    const dashLi = document.createElement('li');
    const dashLink = user.role === 'admin' ? 'admin/index.html' : 'dashboard.html';
    dashLi.innerHTML = `<a href="${dashLink}" class="btn btn-outline" style="padding:0.5rem 1rem;">Dashboard</a>`;
    nav.appendChild(dashLi);

    // Logout link
    const logoutLi = document.createElement('li');
    logoutLi.innerHTML = `<a href="#" id="logout-btn" class="btn btn-primary" style="padding:0.5rem 1rem;">Logout</a>`;
    nav.appendChild(logoutLi);

    document.getElementById('logout-btn').addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('lognest_cart');
      window.location.href = 'index.html';
    });

    // Update cart badge count
    try {
      const cart = JSON.parse(localStorage.getItem('lognest_cart') || '[]');
      document.querySelectorAll('.cart-badge').forEach(el => {
        el.textContent = cart.length;
        el.style.display = cart.length > 0 ? 'flex' : 'none';
      });
    } catch {}
  }
});
