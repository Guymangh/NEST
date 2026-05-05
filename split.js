const fs = require('fs');
const path = require('path');
const adminDir = 'c:/Users/DELL/Desktop/WEBSITE/frontend/admin/';

// 1. Create add-product.html
let productsHtml = fs.readFileSync(path.join(adminDir, 'products.html'), 'utf8');
let addProductHtml = productsHtml.replace(/<h2 style="margin-bottom: 1rem; font-size: 1.25rem;">Existing Products<\/h2>[\s\S]*?(?=<\/main>)/, '');
fs.writeFileSync(path.join(adminDir, 'add-product.html'), addProductHtml);

// 2. Create existing-products.html
let existingHtml = productsHtml.replace(/<button class="btn btn-primary" onclick="document.getElementById\('add-product-form'\).scrollIntoView\(\)">\+ Add Product<\/button>/, '');
existingHtml = existingHtml.replace(/<div class="card" data-fm="slideUp" style="margin-bottom: 2rem;" id="add-product-form">[\s\S]*?<\/form>\s*<\/div>/, '');
fs.writeFileSync(path.join(adminDir, 'existing-products.html'), existingHtml);

// 3. Update sidebars across all files
const files = fs.readdirSync(adminDir).filter(f => f.endsWith('.html') && f !== 'login.html');
files.forEach(f => {
  let content = fs.readFileSync(path.join(adminDir, f), 'utf8');
  content = content.replace(/<a href="products.html"(.*?)>📦 Add Product<\/a>/g, '<a href="add-product.html"$1>📦 Add Product</a>');
  content = content.replace(/<a href="products.html#product-list"(.*?)>📋 Existing Products<\/a>/g, '<a href="existing-products.html"$1>📋 Existing Products</a>');
  
  // Update active states
  if (f === 'add-product.html') {
    content = content.replace(/class="active"/g, '');
    content = content.replace(/<a href="add-product.html">📦 Add Product<\/a>/, '<a href="add-product.html" class="active">📦 Add Product</a>');
  } else if (f === 'existing-products.html') {
    content = content.replace(/class="active"/g, '');
    content = content.replace(/<a href="existing-products.html">📋 Existing Products<\/a>/, '<a href="existing-products.html" class="active">📋 Existing Products</a>');
  }
  
  fs.writeFileSync(path.join(adminDir, f), content);
});

// 4. Delete products.html
fs.unlinkSync(path.join(adminDir, 'products.html'));
console.log('Successfully split products.html and updated navigation!');
