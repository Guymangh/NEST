// API_BASE set globally by nav.js — use window.API_BASE
let currentCategory = '';
let currentSearch = '';
let currentSort = 'name_asc';
let currentPage = 1;
let allCategories = [];

// ─── Fetch Categories (Banks) ──────────────────────────────────────────────────
async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/products/categories`);
    const data = await res.json();
    if (data.success) {
      allCategories = data.categories.sort((a, b) => a.name.localeCompare(b.name));
      renderCategories(allCategories);
      const total = allCategories.reduce((acc, c) => acc + parseInt(c.product_count || 0), 0);
      const tEl = document.getElementById('total-count');
      if (tEl) tEl.textContent = total;
    }
  } catch (err) {
    console.error('Failed to load categories:', err);
    document.getElementById('bank-list').innerHTML = '<div style="padding:1rem;color:red;">Error loading banks.</div>';
  }
}

function renderCategories(categories) {
  const container = document.getElementById('bank-list');
  container.innerHTML = `
    <div class="bank-item ${currentCategory === '' ? 'active' : ''}" data-slug="">
      <span>All Institutions</span>
      <span class="count" id="total-count">--</span>
    </div>
  `;

  const total = allCategories.reduce((acc, c) => acc + parseInt(c.product_count || 0), 0);
  const tEl = document.getElementById('total-count');
  if (tEl) tEl.textContent = total;

  categories.forEach(cat => {
    const item = document.createElement('div');
    item.className = `bank-item ${currentCategory === cat.slug ? 'active' : ''}`;
    item.dataset.slug = cat.slug;
    item.innerHTML = `
      <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 0.5rem;" title="${cat.name}">${cat.name}</span>
      <span class="count">${cat.product_count || 0}</span>
    `;
    item.addEventListener('click', () => {
      document.querySelectorAll('.bank-item').forEach(b => b.classList.remove('active'));
      item.classList.add('active');
      currentCategory = cat.slug;
      currentPage = 1;
      loadProducts();
    });
    container.appendChild(item);
  });

  container.firstElementChild.addEventListener('click', (e) => {
    document.querySelectorAll('.bank-item').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    currentCategory = '';
    currentPage = 1;
    loadProducts();
  });
}

// ─── Fetch Products ────────────────────────────────────────────────────────────
async function loadProducts() {
  const grid = document.getElementById('product-grid');
  grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem; color: var(--text-muted);">Loading secure inventory...</div>';
  try {
    let url = `${API_BASE}/products?page=${currentPage}&limit=20&sort=${currentSort}`;
    if (currentCategory) url += `&category=${currentCategory}`;
    if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.success) {
      grid.innerHTML = '';
      if (data.products.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem; border: 1px dashed var(--border-soft); border-radius: 16px; background: var(--bg-card);">
            <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem; color: var(--text-main);">No logs found</h3>
            <p style="color: var(--text-muted);">Try selecting a different institution or adjust your search.</p>
          </div>
        `;
      } else {
        data.products.forEach(p => {
          const initial = p.category_name ? p.category_name.charAt(0) : 'B';

          // Parse balance from product name e.g. "Chase Bank Log — $43,988 Balance"
          const balanceMatch = p.name.match(/\$[\d,]+/);
          const balance = balanceMatch ? balanceMatch[0].replace('$', '') : 'N/A';

          // Type = first part of short_description before " | "
          const type = p.short_description
            ? p.short_description.split('|')[0].trim()
            : p.category_name || 'Bank Log';

          const shortName = (p.category_name || p.name).split(' Log')[0].trim();

          const card = document.createElement('div');
          card.className = 'card product-card';
          card.innerHTML = `
            <div class="product-card-header">
              <div class="bank-logo-placeholder">${initial}</div>
              <div style="overflow: hidden; min-width: 0;">
                <span style="font-size: 0.68rem; text-transform: uppercase; font-weight: 700; color: var(--accent-terra); display: block;">${p.category_name || 'Uncategorized'}</span>
                <h3 style="font-size: 0.92rem; color: var(--text-main); margin: 0; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${shortName}</h3>
              </div>
            </div>
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary); margin-bottom: 0.5rem;">$${p.price.toFixed(2)}</div>
            <div style="background: var(--bg-main); border-radius: 6px; padding: 0.6rem 0.75rem; margin-bottom: 0.6rem; flex-grow: 1; border: 1px solid var(--border-soft); font-size: 0.78rem; overflow: hidden; min-width: 0;">
              <div style="display: flex; margin-bottom: 0.3rem;">
                <strong style="color: var(--text-main); width: 65px; flex-shrink: 0;">Balance:</strong>
                <span style="color: var(--primary-deep); font-family: monospace; font-weight: 700;">$${balance}</span>
              </div>
              <div style="display: flex; margin-bottom: 0.3rem; min-width: 0;">
                <strong style="color: var(--text-main); width: 65px; flex-shrink: 0;">Type:</strong>
                <span style="color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${type}</span>
              </div>
            </div>
            <div style="margin-top: auto;">
              <button class="btn btn-outline" style="width: 100%; padding: 0.45rem; font-size: 0.82rem;" data-product-id="${p.id}">👁 View Details</button>
            </div>
          `;

          // Attach click using stored product object — no inline JSON risk
          card.querySelector('button').addEventListener('click', () => openDetails(p));
          grid.appendChild(card);
        });
      }
      renderPagination(data.pagination);
    }
  } catch (err) {
    console.error('Failed to load products:', err);
    grid.innerHTML = '<div style="grid-column: 1/-1; color: #b91c1c; text-align: center;">Error loading secure inventory.</div>';
  }
}

// ─── Product Details Modal ─────────────────────────────────────────────────────
function openDetails(p) {
  // Parse balance from product name e.g. "Chase Bank Log — $43,988 Balance"
  const balanceMatch = p.name.match(/\$[\d,]+/);
  const balance = balanceMatch ? balanceMatch[0] : 'N/A';

  // Type = first segment of short_description before " | "
  const type = p.short_description
    ? p.short_description.split('|')[0].trim()
    : 'Checking / Savings';

  const modal = document.getElementById('product-modal');
  document.getElementById('modal-bank').textContent = p.category_name || 'Bank';
  document.getElementById('modal-name').textContent = p.name.split(/ with Description| \/ Balance/i)[0].trim();
  document.getElementById('modal-price').textContent = `$${p.price.toFixed(2)}`;
  document.getElementById('modal-balance').textContent = `$${balance}`;
  document.getElementById('modal-type').textContent = type;
  document.getElementById('modal-description').textContent = p.description || 'Premium access details included.';
  document.getElementById('modal-buy-btn').onclick = () => {
    const added = addToCart(p);
    if (added) {
      document.getElementById('modal-buy-btn').textContent = '✅ Added!';
      document.getElementById('modal-buy-btn').disabled = true;
      setTimeout(() => closeModal(), 900);
    }
  };
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('product-modal').style.display = 'none';
  document.body.style.overflow = '';
}

async function confirmBuy(id, price, name) {
  const token = localStorage.getItem('token');
  if (!token) {
    closeModal();
    window.location.href = 'login.html';
    return;
  }

  const btn = document.getElementById('modal-buy-btn');
  btn.textContent = 'Processing...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ product_id: id, quantity: 1 })
    });
    const data = await res.json();

    if (data.success) {
      closeModal();
      const user = JSON.parse(localStorage.getItem('user'));
      if (user && data.order) {
        user.balance -= parseFloat(data.order.total);
        localStorage.setItem('user', JSON.stringify(user));
      }
      toast('Purchase successful! Redirecting to your orders...', 'success');
      setTimeout(() => window.location.href = 'orders.html', 1500);
    } else {
      toast(data.message || 'Error processing purchase.', 'error');
      btn.textContent = 'Confirm Purchase';
      btn.disabled = false;
    }
  } catch (err) {
    console.error(err);
    toast('Server connection error.', 'error');
    btn.textContent = 'Confirm Purchase';
    btn.disabled = false;
  }
}

// ─── Pagination ────────────────────────────────────────────────────────────────
function renderPagination(pg) {
  const container = document.getElementById('pagination');
  container.innerHTML = '';
  if (pg.pages <= 1) return;

  // Previous Button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn btn-outline';
  prevBtn.style.padding = '0.4rem 0.8rem';
  prevBtn.innerHTML = '&laquo; Prev';
  prevBtn.disabled = pg.page === 1;
  prevBtn.addEventListener('click', () => { 
    if (currentPage > 1) { currentPage--; loadProducts(); }
  });
  container.appendChild(prevBtn);

  // Page Numbers
  for (let i = 1; i <= pg.pages; i++) {
    const btn = document.createElement('button');
    btn.className = i === pg.page ? 'btn btn-primary' : 'btn btn-outline';
    btn.style.padding = '0.4rem 0.8rem';
    btn.textContent = i;
    btn.addEventListener('click', () => { currentPage = i; loadProducts(); });
    container.appendChild(btn);
  }

  // Next Button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-outline';
  nextBtn.style.padding = '0.4rem 0.8rem';
  nextBtn.innerHTML = 'Next &raquo;';
  nextBtn.disabled = pg.page === pg.pages;
  nextBtn.addEventListener('click', () => { 
    if (currentPage < pg.pages) { currentPage++; loadProducts(); }
  });
  container.appendChild(nextBtn);
}

// ─── Initialization ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadProducts();

  document.getElementById('product-search').addEventListener('input', (e) => {
    clearTimeout(window._searchTimeout);
    window._searchTimeout = setTimeout(() => {
      currentSearch = e.target.value.trim();
      currentPage = 1;
      loadProducts();
    }, 500);
  });

  document.getElementById('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    currentPage = 1;
    loadProducts();
  });

  document.getElementById('bank-search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    renderCategories(term ? allCategories.filter(c => c.name.toLowerCase().includes(term)) : allCategories);
  });

  // Close modal on backdrop click
  document.getElementById('product-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
});
