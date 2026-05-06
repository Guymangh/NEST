const fs = require('fs');
let html = fs.readFileSync('frontend/store.html', 'utf8');

// Fix 1: Update sort dropdown to add A-Z as default
html = html.replace(
  `<select id="sort-select" class="form-control" style="width: auto; padding: 0.5rem 2rem 0.5rem 1rem;">\r\n              <option value="newest">Newest Added</option>\r\n              <option value="price_asc">Price: Low to High</option>\r\n              <option value="price_desc">Price: High to Low</option>\r\n            </select>`,
  `<select id="sort-select" class="form-control" style="width: auto; padding: 0.5rem 2rem 0.5rem 1rem;">\r\n              <option value="name_asc" selected>A \u2192 Z</option>\r\n              <option value="newest">Newest Added</option>\r\n              <option value="price_asc">Price: Low to High</option>\r\n              <option value="price_desc">Price: High to Low</option>\r\n            </select>`
);

// Fix 2: Remove class="card-grid" from product-grid div so only #product-grid CSS applies
html = html.replace(
  `<div class="card-grid" id="product-grid" data-fm="stagger">`,
  `<div id="product-grid" data-fm="stagger">`
);

fs.writeFileSync('frontend/store.html', html);
console.log('Done');
