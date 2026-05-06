const fs = require('fs');
let html = fs.readFileSync('frontend/store.html', 'utf8');

const oldStyle = html.slice(html.indexOf('<style>'), html.indexOf('</style>') + '</style>'.length);

const newStyle = `<style>
    /* ─── Store Layout ───────────────────────────────────── */
    .store-wrapper {
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 1.25rem;
      align-items: start;
    }
    .bank-sidebar {
      background: var(--bg-card);
      border: 1px solid var(--border-soft);
      border-radius: 12px;
      padding: 1rem;
      box-shadow: var(--shadow-soft);
      position: sticky;
      top: 70px;
      height: calc(100vh - 100px);
      display: flex;
      flex-direction: column;
    }
    .bank-sidebar h3 {
      font-size: 0.95rem;
      color: var(--primary-deep);
      margin-bottom: 0.6rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .bank-list-wrapper {
      overflow-y: auto;
      flex-grow: 1;
      margin-top: 0.75rem;
      padding-right: 0.35rem;
    }
    .bank-list-wrapper::-webkit-scrollbar { width: 4px; }
    .bank-list-wrapper::-webkit-scrollbar-thumb { background: rgba(13, 79, 79, 0.2); border-radius: 10px; }

    .bank-item {
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      cursor: pointer;
      color: var(--text-main);
      font-size: 0.82rem;
      font-weight: 600;
      transition: all 0.2s ease;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.2rem;
      border: 1px solid transparent;
    }
    .bank-item:hover { background: var(--bg-accent); color: var(--primary); }
    .bank-item.active {
      background: var(--primary-deep);
      color: #fff;
      box-shadow: 0 3px 8px rgba(13, 79, 79, 0.2);
    }
    .bank-item .count {
      font-size: 0.7rem;
      background: var(--bg-main);
      color: var(--text-muted);
      padding: 0.15rem 0.5rem;
      border-radius: 20px;
      border: 1px solid var(--border-soft);
      flex-shrink: 0;
    }
    .bank-item.active .count {
      background: rgba(255,255,255,0.2);
      color: #fff;
      border-color: transparent;
    }

    .store-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-card);
      border: 1px solid var(--border-soft);
      padding: 0.6rem 1rem;
      border-radius: 10px;
      margin-bottom: 1rem;
      box-shadow: var(--shadow-soft);
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .product-card {
      display: flex;
      flex-direction: column;
      height: 100%;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      overflow: hidden;
      border: 1px solid var(--border-soft);
      padding: 1rem !important;
      min-width: 0;
    }
    .product-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 18px rgba(13, 79, 79, 0.08);
      border-color: var(--primary);
    }
    .product-card-header {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      margin-bottom: 0.6rem;
      min-width: 0;
    }
    .bank-logo-placeholder {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--bg-accent), #fff);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      color: var(--primary-deep);
      font-weight: 800;
      border: 1px solid rgba(13, 79, 79, 0.1);
      flex-shrink: 0;
    }

    /* ─── Product Grid ───────────────────────────────────── */
    #product-grid {
      display: grid !important;
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      gap: 0.85rem !important;
    }

    /* ─── Responsive Breakpoints ─────────────────────────── */
    @media (max-width: 1200px) {
      #product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
    }

    @media (max-width: 992px) {
      .store-wrapper {
        grid-template-columns: 1fr !important;
        gap: 0.75rem;
      }
      .bank-sidebar {
        position: relative;
        top: 0;
        height: auto;
        max-height: 260px;
        margin-bottom: 0.5rem;
      }
      .bank-list-wrapper {
        max-height: 170px;
      }
      #product-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    }

    @media (max-width: 640px) {
      .store-toolbar {
        flex-direction: column;
        align-items: stretch;
        gap: 0.5rem;
        padding: 0.6rem 0.75rem;
      }
      .store-toolbar > div { width: 100% !important; max-width: 100% !important; }
      .store-toolbar select { width: 100% !important; }
      #product-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 0.6rem !important;
      }
      .product-card { padding: 0.75rem !important; }
      .bank-logo-placeholder { width: 30px; height: 30px; font-size: 0.9rem; }
    }

    @media (max-width: 400px) {
      #product-grid { grid-template-columns: minmax(0, 1fr) !important; }
    }
  </style>`;

html = html.slice(0, html.indexOf('<style>')) + newStyle + html.slice(html.indexOf('</style>') + '</style>'.length);
fs.writeFileSync('frontend/store.html', html);
console.log('Done - mobile styles applied');
