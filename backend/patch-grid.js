const fs = require('fs');
let html = fs.readFileSync('frontend/store.html', 'utf8');

const before = html.indexOf('/* Responsive */');
const after = html.indexOf('</style>', before);

if (before === -1 || after === -1) {
  console.log('NOT FOUND'); process.exit(1);
}

const replacement = [
  '    /* Force 4-column grid on desktop */',
  '    #product-grid {',
  '      display: grid !important;',
  '      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;',
  '      gap: 0.85rem !important;',
  '    }',
  '    /* Responsive */',
  '    @media (max-width: 1200px) {',
  '      #product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }',
  '    }',
  '    @media (max-width: 992px) {',
  '      .store-wrapper { grid-template-columns: 1fr; }',
  '      .bank-sidebar { position: relative; top: 0; height: 280px; margin-bottom: 0.5rem; }',
  '      .store-toolbar { flex-direction: column; align-items: stretch; }',
  '      #product-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }',
  '    }',
  '    @media (max-width: 600px) {',
  '      #product-grid { grid-template-columns: minmax(0, 1fr) !important; }',
  '    }',
  '  </style>'
].join('\n');

html = html.slice(0, before) + replacement + html.slice(after + '</style>'.length);
fs.writeFileSync('frontend/store.html', html);
console.log('Done');
