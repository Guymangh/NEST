const API_BASE = window.__API_BASE__ || window.API_BASE || 'http://localhost:5000/api';

// ─── Admin Toast (no browser alerts!) ─────────────────────────────────────
function adminToast(message, type = 'success') {
  // Inject container if not present
  let container = document.getElementById('a-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'a-toast-container';
    container.style.cssText = `
      position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9999;
      display: flex; flex-direction: column; gap: 0.6rem;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const colors = {
    success: { bg: '#022c22', border: '#065f46', icon: '✓', text: '#6ee7b7' },
    error:   { bg: '#2c0a0a', border: '#7f1d1d', icon: '✕', text: '#fca5a5' },
    info:    { bg: '#0a1628', border: '#1e3a5f', icon: 'ℹ', text: '#93c5fd' },
  };
  const c = colors[type] || colors.success;

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${c.bg}; border: 1px solid ${c.border};
    color: ${c.text}; border-radius: 10px;
    padding: 0.75rem 1.1rem; font-size: 0.875rem; font-weight: 600;
    display: flex; align-items: center; gap: 0.6rem;
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    transform: translateX(120%); transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
    pointer-events: auto; min-width: 240px; max-width: 360px;
    font-family: 'Inter', sans-serif;
  `;
  toast.innerHTML = `<span style="font-size:1rem;">${c.icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  // Slide in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });
  });

  // Auto dismiss
  setTimeout(() => {
    toast.style.transform = 'translateX(120%)';
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 3500);
}

// ─── Custom Modal System (no browser dialogs) ──────────────────────────────
function _injectModalBase() {
  if (document.getElementById('a-modal-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'a-modal-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(10,26,26,0.65);backdrop-filter:blur(4px);
    z-index:10000;display:flex;align-items:center;justify-content:center;
    opacity:0;transition:opacity 0.2s ease;pointer-events:none;
  `;
  overlay.innerHTML = `<div id="a-modal-box" style="
    background:#fff;border-radius:16px;padding:2rem;width:100%;max-width:560px;
    max-height:90vh;overflow-y:auto;
    box-shadow:0 24px 60px rgba(10,26,26,0.25);transform:scale(0.95);
    transition:transform 0.2s ease;font-family:'Inter',sans-serif;
    border-top:4px solid #0D4F4F;
  "></div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) _closeModal(); });
}

function _openModal(html) {
  _injectModalBase();
  const overlay = document.getElementById('a-modal-overlay');
  document.getElementById('a-modal-box').innerHTML = html;
  overlay.style.pointerEvents = 'auto';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      document.getElementById('a-modal-box').style.transform = 'scale(1)';
    });
  });
  // Focus first input if exists
  setTimeout(() => {
    const first = document.querySelector('#a-modal-box input');
    if (first) first.focus();
  }, 220);
}

function _closeModal() {
  const overlay = document.getElementById('a-modal-overlay');
  if (!overlay) return;
  overlay.style.opacity = '0';
  document.getElementById('a-modal-box').style.transform = 'scale(0.95)';
  overlay.style.pointerEvents = 'none';
}

// Confirm modal — returns Promise<boolean>
function adminConfirm(title, message, confirmLabel = 'Confirm', danger = false) {
  return new Promise(resolve => {
    _openModal(`
      <div style="margin-bottom:1.25rem;">
        <div style="font-size:1.5rem;margin-bottom:0.75rem;">${danger ? '⚠️' : '❓'}</div>
        <h2 style="font-size:1.05rem;font-weight:700;color:#1B2A3D;margin-bottom:0.5rem;">${title}</h2>
        <p style="font-size:0.875rem;color:#6B7A8D;line-height:1.5;">${message}</p>
      </div>
      <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
        <button onclick="_closeModal();" style="
          padding:0.55rem 1.1rem;border-radius:8px;border:1px solid #D9E2E8;
          background:transparent;font-size:0.875rem;font-weight:600;cursor:pointer;color:#1B2A3D;
        ">Cancel</button>
        <button id="a-modal-confirm-btn" style="
          padding:0.55rem 1.1rem;border-radius:8px;border:none;
          background:${danger ? '#ef4444' : '#0D4F4F'};color:#fff;
          font-size:0.875rem;font-weight:600;cursor:pointer;
        ">${confirmLabel}</button>
      </div>
    `);
    document.getElementById('a-modal-confirm-btn').onclick = () => {
      _closeModal(); resolve(true);
    };
    // Cancel button already calls _closeModal, but we need to resolve false
    document.querySelector('#a-modal-box button:first-child').onclick = () => {
      _closeModal(); resolve(false);
    };
  });
}

// Input modal — returns Promise<{[key]: value} | null>
function adminForm(title, fields) {
  // fields = [{id, label, type, value, hint}]
  return new Promise(resolve => {
    const inputsHtml = fields.map(f => `
      <div style="margin-bottom:1rem;">
        <label style="display:block;font-size:0.78rem;font-weight:600;color:#1B2A3D;margin-bottom:0.35rem;">${f.label}${f.hint ? `<span style="font-weight:400;color:#6B7A8D;"> — ${f.hint}</span>` : ''}</label>
        ${f.type === 'toggle' ? `
          <div style="display:flex;gap:0.75rem;">
            <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;font-size:0.875rem;">
              <input type="radio" name="${f.id}" id="${f.id}_yes" value="true" ${f.value ? 'checked' : ''} style="accent-color:#0D4F4F;"> Active
            </label>
            <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;font-size:0.875rem;">
              <input type="radio" name="${f.id}" id="${f.id}_no" value="false" ${!f.value ? 'checked' : ''} style="accent-color:#0D4F4F;"> Inactive
            </label>
          </div>
        ` : f.type === 'textarea' ? `
          <textarea id="a-field-${f.id}" rows="${f.rows || 8}" style="
            width:100%;padding:0.65rem 0.9rem;border:1px solid #D9E2E8;border-radius:8px;
            font-size:0.82rem;font-family:'Courier New',monospace;color:#1B2A3D;
            outline:none;background:#F5F7FA;resize:vertical;line-height:1.6;
          ">${(f.value ?? '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
        ` : `
          <input id="a-field-${f.id}" type="${f.type || 'text'}" value="${f.value ?? ''}" style="
            width:100%;padding:0.65rem 0.9rem;border:1px solid #D9E2E8;border-radius:8px;
            font-size:0.875rem;font-family:'Inter',sans-serif;color:#1B2A3D;
            outline:none;background:#F5F7FA;
          " />
        `}
      </div>
    `).join('');

    _openModal(`
      <h2 style="font-size:1.05rem;font-weight:700;color:#1B2A3D;margin-bottom:1.25rem;">${title}</h2>
      <form id="a-modal-form" onsubmit="return false;">
        ${inputsHtml}
        <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1.25rem;">
          <button type="button" id="a-modal-cancel" style="
            padding:0.55rem 1.1rem;border-radius:8px;border:1px solid #D9E2E8;
            background:transparent;font-size:0.875rem;font-weight:600;cursor:pointer;color:#1B2A3D;
          ">Cancel</button>
          <button type="submit" id="a-modal-save" style="
            padding:0.55rem 1.1rem;border-radius:8px;border:none;
            background:#0D4F4F;color:#fff;font-size:0.875rem;font-weight:600;cursor:pointer;
          ">Save Changes</button>
        </div>
      </form>
    `);

    // Focus border on input/textarea focus
    document.querySelectorAll('#a-modal-box input[type=text], #a-modal-box input[type=number], #a-modal-box textarea').forEach(el => {
      el.addEventListener('focus', () => el.style.borderColor = '#1A7A7A');
      el.addEventListener('blur',  () => el.style.borderColor = '#D9E2E8');
    });

    // Cancel closes without saving
    document.getElementById('a-modal-cancel').onclick = () => { _closeModal(); resolve(null); };

    // Submit collects all field values
    document.getElementById('a-modal-form').onsubmit = () => {
      const result = {};
      fields.forEach(f => {
        if (f.type === 'toggle') {
          result[f.id] = document.getElementById(`${f.id}_yes`).checked;
        } else {
          result[f.id] = document.getElementById(`a-field-${f.id}`).value;
        }
      });
      _closeModal();
      resolve(result);
    };

    // Save button triggers submit
    document.getElementById('a-modal-save').onclick = () => {
      document.getElementById('a-modal-form').dispatchEvent(new Event('submit'));
    };

    // Enter key submits (but not inside textarea — allow newlines there)
    document.getElementById('a-modal-form').addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        document.getElementById('a-modal-form').dispatchEvent(new Event('submit'));
      }
    });
  });
}

// ─── Authentication Guard ──────────────────────────────────────────────────
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user || user.role !== 'admin') {
  window.location.href = '../login.html';
}

async function fetchAdminData(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '../login.html';
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`Error fetching ${endpoint}:`, err);
    return null;
  }
}

// ─── Pagination ─────────────────────────────────────────────────────────────
function renderPagination(containerId, currentPage, totalPages, loadFunction) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const valid = Math.max(1, totalPages);
  let html = `
    <button class="a-btn a-btn-outline a-btn-sm" onclick="${loadFunction}(${currentPage - 1})" ${currentPage <= 1 ? 'disabled style="opacity:.45;cursor:not-allowed;"' : ''}>← Prev</button>
    <span class="a-page-info">Page ${currentPage} of ${valid}</span>
    <button class="a-btn a-btn-outline a-btn-sm" onclick="${loadFunction}(${currentPage + 1})" ${currentPage >= valid ? 'disabled style="opacity:.45;cursor:not-allowed;"' : ''}>Next →</button>
  `;
  container.innerHTML = html;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
async function loadDashboard() {
  const data = await fetchAdminData('/admin/stats');
  if (!data || !data.success) return;

  const s = data.stats;
  if (document.getElementById('total-users'))     document.getElementById('total-users').textContent     = s.total_users;
  if (document.getElementById('total-revenue'))   document.getElementById('total-revenue').textContent   = `$${parseFloat(s.total_revenue).toFixed(2)}`;
  if (document.getElementById('total-orders'))    document.getElementById('total-orders').textContent    = s.total_orders;
  if (document.getElementById('pending-deposits')) document.getElementById('pending-deposits').textContent = s.pending_deposits;

  const ordersBody = document.getElementById('recent-orders');
  if (ordersBody) {
    ordersBody.innerHTML = data.recent_orders.length === 0
      ? '<tr><td colspan="3" class="a-empty">No recent orders</td></tr>'
      : data.recent_orders.map(o => `
          <tr>
            <td style="font-family:monospace;">#${o.id.substring(0,8)}</td>
            <td>${o.username || '—'}</td>
            <td style="color:#10b981;font-weight:600;">$${parseFloat(o.total).toFixed(2)}</td>
          </tr>`).join('');
  }

  const depositsBody = document.getElementById('recent-deposits');
  if (depositsBody) {
    depositsBody.innerHTML = data.recent_deposits.length === 0
      ? '<tr><td colspan="3" class="a-empty">No recent deposits</td></tr>'
      : data.recent_deposits.map(d => `
          <tr>
            <td style="font-family:monospace;">#${d.id.substring(0,8)}</td>
            <td>${d.username || '—'}</td>
            <td style="color:#10b981;font-weight:600;">$${parseFloat(d.amount).toFixed(2)}</td>
          </tr>`).join('');
  }
}

// ─── Users ───────────────────────────────────────────────────────────────────
window.loadUsers = async function(page = 1) {
  const table = document.getElementById('admin-users-table');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="a-empty">Loading users...</td></tr>';

  const limit = 10;
  const data = await fetchAdminData(`/admin/users?page=${page}&limit=${limit}`);
  if (!data || !data.success) {
    tbody.innerHTML = '<tr><td colspan="6" class="a-empty">Failed to load users.</td></tr>';
    return;
  }
  if (!data.users.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="a-empty">No users found.</td></tr>';
    return;
  }

  tbody.innerHTML = data.users.map(u => `
    <tr>
      <td><strong>${u.username}</strong></td>
      <td style="color:#6b7280;">${u.email}</td>
      <td style="color:#10b981;font-weight:600;">$${parseFloat(u.balance).toFixed(2)}</td>
      <td><span class="a-badge ${u.role === 'admin' ? 'a-badge-blue' : 'a-badge-gray'}">${u.role}</span></td>
      <td style="color:#6b7280;">${new Date(u.created_at).toLocaleDateString()}</td>
      <td>
        <button class="a-btn a-btn-outline a-btn-sm" onclick="editUser('${u.id}','${u.username}',${u.balance},'${u.role}')">Edit</button>
      </td>
    </tr>`).join('');

  renderPagination('users-pagination', page, Math.ceil(data.total / limit), 'loadUsers');
}

window.editUser = async function(id, username, currentBalance, currentRole) {
  const result = await adminForm(`Edit User — ${username}`, [
    { id: 'balance', label: 'Balance (USD)', type: 'number', value: currentBalance, hint: 'Set new account balance' }
  ]);
  if (!result) return;

  const data = await fetchAdminData(`/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ balance: parseFloat(result.balance), role: currentRole })
  });
  if (data && data.success) { adminToast('User balance updated!'); loadUsers(); }
  else adminToast(data?.message || 'Error updating user', 'error');
}

// ─── Products ─────────────────────────────────────────────────────────────────
let allProducts = [];
window.loadProducts = async function(page = 1) {
  const list = document.getElementById('product-list');
  if (!list) return;

  // Always fetch fresh data from server
  list.innerHTML = '<tr><td colspan="7" class="a-empty">Loading products...</td></tr>';
  const data = await fetchAdminData('/products/admin/all');
  if (!data || !data.success) {
    list.innerHTML = '<tr><td colspan="7" class="a-empty">Failed to load products.</td></tr>';
    return;
  }
  allProducts = data.products;

  const limit = 10;
  const totalPages = Math.ceil(allProducts.length / limit);
  const paginated = allProducts.slice((page - 1) * limit, page * limit);

  if (!paginated.length) {
    list.innerHTML = '<tr><td colspan="7" class="a-empty">No products found.</td></tr>';
    return;
  }

  list.innerHTML = paginated.map(p => `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td style="color:#6b7280;">${p.category_name || 'Uncategorized'}</td>
      <td style="color:#10b981;font-weight:600;">$${p.price.toFixed(2)}</td>
      <td>${p.stock}</td>
      <td><span class="a-badge ${p.is_active ? 'a-badge-green' : 'a-badge-gray'}">${p.is_active ? 'Active' : 'Inactive'}</span></td>
      <td style="color:#6b7280;">${new Date(p.created_at).toLocaleDateString()}</td>
      <td style="display:flex;gap:0.5rem;">
        <button class="a-btn a-btn-outline a-btn-sm" onclick="editProduct('${p.id}')">Edit</button>
        <button class="a-btn a-btn-danger a-btn-sm" onclick="deleteProduct('${p.id}')">Delete</button>
      </td>
    </tr>`).join('');

  renderPagination('products-pagination', page, totalPages, 'loadProducts');
}

window.editProduct = async function(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;

  const result = await adminForm(`Edit Product`, [
    { id: 'price',        label: 'Price (USD)',                type: 'number',   value: p.price },
    { id: 'stock',        label: 'Stock (copies available)',   type: 'number',   value: p.stock, hint: 'Minimum 1' },
    { id: 'product_data', label: 'Delivered Content',          type: 'textarea', value: p.product_data || '', rows: 12, hint: 'Hidden until purchased' },
    { id: 'is_active',    label: 'Status',                    type: 'toggle',   value: p.is_active }
  ]);
  if (!result) return;

  const stockVal = parseInt(result.stock);
  if (isNaN(stockVal) || stockVal < 1) {
    adminToast('Stock must be 1 or greater.', 'error');
    return;
  }

  const data = await fetchAdminData(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      price: parseFloat(result.price),
      stock: stockVal,
      product_data: result.product_data,
      is_active: result.is_active
    })
  });
  if (data && data.success) { adminToast('Product updated!'); allProducts = []; loadProducts(1); }
  else adminToast(data?.message || 'Error updating product', 'error');
}

window.deleteProduct = async function(id) {
  const p = allProducts.find(x => x.id === id);
  const name = p ? p.name : 'this product';
  const ok = await adminConfirm('Delete Product', `Are you sure you want to delete "${name}"? This cannot be undone.`, 'Delete', true);
  if (!ok) return;
  const data = await fetchAdminData(`/products/${id}`, { method: 'DELETE' });
  if (data && data.success) { adminToast('Product deleted.', 'info'); allProducts = allProducts.filter(p => p.id !== id); loadProducts(1); }
  else adminToast('Failed to delete product.', 'error');
}

// ─── Orders ──────────────────────────────────────────────────────────────────
window.loadOrders = async function(page = 1) {
  const table = document.getElementById('admin-orders-table');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="a-empty">Loading orders...</td></tr>';

  const limit = 10;
  const data = await fetchAdminData(`/orders/admin/all?page=${page}&limit=${limit}`);
  if (!data || !data.success) {
    tbody.innerHTML = '<tr><td colspan="7" class="a-empty">Failed to load orders.</td></tr>';
    return;
  }
  if (!data.orders.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="a-empty">No orders found.</td></tr>';
    return;
  }

  // Cache for viewOrder
  window._adminOrders = data.orders;

  tbody.innerHTML = data.orders.map(o => {
    const shortProduct = o.product_name
      ? (o.product_name.length > 30 ? o.product_name.slice(0, 28) + '…' : o.product_name)
      : 'N/A';
    const badgeCls = o.status === 'completed' ? 'a-badge-green' : o.status === 'refunded' ? 'a-badge-yellow' : 'a-badge-gray';
    const date = new Date(o.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    return `
    <tr>
      <td><code style="font-size:.75rem;background:var(--a-accent);padding:0.1rem 0.4rem;border-radius:4px;color:var(--a-primary);">#${o.id.substring(0,8).toUpperCase()}</code></td>
      <td><strong>${o.username}</strong><br><span style="font-size:.75rem;color:#6b7280;">${o.email}</span></td>
      <td style="max-width:180px;font-size:.82rem;" title="${o.product_name || ''}">${shortProduct}</td>
      <td style="color:#10b981;font-weight:700;">$${parseFloat(o.total).toFixed(2)}</td>
      <td><span class="a-badge ${badgeCls}">${o.status}</span></td>
      <td style="color:#6b7280;font-size:.82rem;white-space:nowrap;">${date}</td>
      <td style="display:flex;gap:0.4rem;">
        <button class="a-btn a-btn-outline a-btn-sm" onclick="viewOrder('${o.id}')">View</button>
        ${o.status !== 'refunded'
          ? `<button class="a-btn a-btn-danger a-btn-sm" onclick="refundOrder('${o.id}')">Refund</button>`
          : ''}
      </td>
    </tr>`;
  }).join('');

  const totalPages = Math.ceil((data.total || data.orders.length) / limit) || 1;
  renderPagination('orders-pagination', page, totalPages, 'loadOrders');
}


window.viewOrder = async function(id) {
  const orders = window._adminOrders || [];
  const o = orders.find(x => x.id === id);
  if (!o) return;

  const badgeCls = o.status === 'completed' ? 'a-badge-green' : o.status === 'refunded' ? 'a-badge-yellow' : 'a-badge-gray';
  const date = new Date(o.created_at).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });

  const row = (label, value) => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:0.55rem 0;border-bottom:1px solid #e5e7eb;font-size:0.85rem;gap:1rem;">
      <span style="color:#6b7280;font-weight:600;flex-shrink:0;min-width:90px;">${label}</span>
      <span style="color:#1B2A3D;text-align:right;word-break:break-word;">${value}</span>
    </div>`;

  _openModal(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;">
      <h2 style="font-size:1rem;font-weight:700;color:#1B2A3D;">
        Order <code style="font-size:.85rem;background:#E8F0F0;padding:0.1rem 0.5rem;border-radius:4px;color:#0D4F4F;">#${o.id.substring(0,8).toUpperCase()}</code>
      </h2>
      <span class="a-badge ${badgeCls}">${o.status}</span>
    </div>
    <div style="margin-bottom:1rem;">
      ${row('User', `<strong>${o.username}</strong>`)}
      ${row('Email', o.email)}
      ${row('Product', o.product_name || 'N/A')}
      ${row('Qty', o.quantity)}
      ${row('Unit Price', '$' + parseFloat(o.unit_price).toFixed(2))}
      ${row('Total', '<strong style="color:#10b981;">$' + parseFloat(o.total).toFixed(2) + '</strong>')}
      ${row('Date', date)}
    </div>
    <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:0.5rem;">
      <button onclick="_closeModal()" style="padding:0.5rem 1rem;border-radius:8px;border:1px solid #D9E2E8;background:transparent;font-size:0.875rem;font-weight:600;cursor:pointer;color:#1B2A3D;">Close</button>
      ${o.status !== 'refunded' ? `<button onclick="_closeModal();refundOrder('${o.id}')" style="padding:0.5rem 1rem;border-radius:8px;border:none;background:#ef4444;color:#fff;font-size:0.875rem;font-weight:600;cursor:pointer;">Refund Order</button>` : ''}
    </div>
  `);
}

window.refundOrder = async function(id) {
  const ok = await adminConfirm('Refund Order', 'Are you sure? The user will have their balance fully restored.', 'Yes, Refund');
  if (!ok) return;
  const data = await fetchAdminData(`/orders/admin/refund/${id}`, { method: 'POST' });
  if (data && data.success) { adminToast(data.message || 'Order refunded successfully!'); loadOrders(1); }
  else adminToast(data?.message || 'Refund failed', 'error');
}

// ─── Deposits ─────────────────────────────────────────────────────────────────
window.loadDeposits = async function(page = 1) {
  const table = document.getElementById('admin-deposits-table');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="a-empty">Loading deposits...</td></tr>';

  const limit = 10;
  const data = await fetchAdminData(`/deposits/admin/all?page=${page}&limit=${limit}`);
  if (!data || !data.success) {
    tbody.innerHTML = '<tr><td colspan="7" class="a-empty">Failed to load deposits.</td></tr>';
    return;
  }
  if (!data.deposits.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="a-empty">No deposits found.</td></tr>';
    return;
  }

  tbody.innerHTML = data.deposits.map(d => `
    <tr>
      <td style="font-family:monospace;font-size:.8rem;">#${d.id.substring(0,8)}</td>
      <td><strong>${d.username}</strong></td>
      <td style="color:#10b981;font-weight:600;">$${parseFloat(d.amount).toFixed(2)}</td>
      <td style="text-transform:capitalize;">${d.method}</td>
      <td>
        <span class="a-badge ${d.status === 'approved' ? 'a-badge-green' : d.status === 'rejected' ? 'a-badge-red' : 'a-badge-yellow'}">
          ${d.status}
        </span>
      </td>
      <td style="color:#6b7280;">${new Date(d.created_at).toLocaleDateString()}</td>
      <td style="display:flex;gap:0.4rem;">
        ${d.status === 'pending' ? `
          <button class="a-btn a-btn-success a-btn-sm" onclick="processDeposit('${d.id}','approve')">✓ Approve</button>
          <button class="a-btn a-btn-danger a-btn-sm" onclick="processDeposit('${d.id}','reject')">✗ Reject</button>
        ` : `<span style="font-size:.8rem;color:#6b7280;">${d.status}</span>`}
      </td>
    </tr>`).join('');

  renderPagination('deposits-pagination', page, Math.ceil((data.total || data.deposits.length) / limit), 'loadDeposits');
}

window.processDeposit = async function(id, action) {
  const isApprove = action === 'approve';
  const ok = await adminConfirm(
    isApprove ? 'Approve Deposit' : 'Reject Deposit',
    isApprove
      ? 'This will credit the full amount to the user\'s balance immediately.'
      : 'This will permanently reject the deposit request.',
    isApprove ? '✓ Approve' : '✗ Reject',
    !isApprove
  );
  if (!ok) return;
  const data = await fetchAdminData(`/deposits/admin/${action}/${id}`, { method: 'POST' });
  if (data && data.success) { adminToast(data.message || `Deposit ${action}d!`); loadDeposits(1); }
  else adminToast(data?.message || `Failed to ${action} deposit`, 'error');
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function loadSettings() {
  const pwForm = document.getElementById('change-password-form');
  if (pwForm) {
    pwForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn     = document.getElementById('change-pw-btn');
      const current = document.getElementById('current_password').value;
      const next    = document.getElementById('new_password').value;
      const confirm = document.getElementById('confirm_password').value;

      if (next !== confirm) {
        adminToast('New passwords do not match.', 'error'); return;
      }
      if (next.length < 8) {
        adminToast('New password must be at least 8 characters.', 'error'); return;
      }

      btn.textContent = 'Updating...'; btn.disabled = true;
      const res = await fetchAdminData('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: current, new_password: next })
      });
      btn.textContent = 'Update Password'; btn.disabled = false;
      
      if (res && res.success) {
        adminToast('Password updated successfully!', 'success');
        pwForm.reset();
      } else {
        adminToast(res?.message || 'Failed to update password.', 'error');
      }
    });
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.endsWith('index.html') || path.endsWith('/admin') || path.endsWith('/admin/')) loadDashboard();
  if (path.endsWith('users.html') || path.endsWith('/admin/users')) loadUsers();
  if (path.endsWith('orders.html') || path.endsWith('/admin/orders')) loadOrders();
  if (path.endsWith('deposits.html') || path.endsWith('/admin/deposits')) loadDeposits();
  if (path.endsWith('existing-products.html') || path.endsWith('/admin/existing-products')) loadProducts();
  if (path.endsWith('settings.html') || path.endsWith('/admin/settings')) loadSettings();

  // Mobile sidebar toggle
  const avatar = document.querySelector('.a-avatar');
  const sidebar = document.querySelector('.a-sidebar');
  if (avatar && sidebar) {
    avatar.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('mobile-open');
    });
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !avatar.contains(e.target)) {
        sidebar.classList.remove('mobile-open');
      }
    });
  }

  // Add Product form
  const productForm = document.getElementById('product-form');
  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = productForm.querySelector('button[type="submit"]');
      btn.textContent = 'Saving...'; btn.disabled = true;

      const res = await fetchAdminData('/products', {
        method: 'POST',
        body: JSON.stringify({
          name:              document.getElementById('name').value,
          category_id:       null,
          price:             parseFloat(document.getElementById('price').value),
          stock:             parseInt(document.getElementById('stock').value),
          description:       document.getElementById('description').value,
          short_description: (() => {
            const sd = document.getElementById('short_description');
            return sd ? sd.value : document.getElementById('description').value.substring(0, 120);
          })(),
          product_data:      document.getElementById('product_data').value,
          is_active:         true
        })
      });

      btn.textContent = 'Save Product'; btn.disabled = false;
      if (res && res.success) {
        productForm.reset();
        adminToast('Product created successfully!');
        allProducts = [];
      } else {
        adminToast(res?.message || 'Failed to create product', 'error');
      }
    });
  }

  // Logout
  const logoutBtn = document.getElementById('admin-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('lognest_cart');
      window.location.href = 'login.html';
    });
  }
});
