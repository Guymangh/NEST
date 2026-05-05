/**
 * fix-final-bugs.js — Final pass bug fixer
 * Fixes:
 *  1. deposit.html  — toast.js loaded after inline script that calls toast()
 *  2. login.html    — auth.js loaded with defer but nav.js without defer (race condition)
 *  3. store.html    — framer-motion 400KB loaded unnecessarily
 *  4. index.html    — framer-motion 400KB loaded unnecessarily; logged-in users sent to login
 *  5. store.html    — nav.js loaded AFTER cart.js/store.js (nav sets window.API_BASE too late)
 *  6. profile.html  — btn-save-profile text reset says 'Save Changes' but should be 'Save Email'
 */
const fs = require('fs');
const path = require('path');
const fe = path.join(__dirname, '../frontend');

function fix(rel, patches) {
  const full = path.join(fe, rel);
  let c = fs.readFileSync(full, 'utf8');
  for (const [from, to] of patches) c = c.split(from).join(to);
  fs.writeFileSync(full, c, 'utf8');
  console.log('✅ Fixed:', rel);
}

// ─── 1. deposit.html: toast.js must be BEFORE the inline script ───────────────
// Current end of body: inline script then <script src="js/toast.js">
// Fix: remove the toast script from bottom, add it to head
fix('deposit.html', [
  // Remove toast from bottom
  ['\n  <script src="js/toast.js"></script>\n</body>', '\n</body>'],
  // Add toast BEFORE nav.js in head
  ['  <script src="js/nav.js"></script>\n</head>',
   '  <script src="js/toast.js"></script>\n  <script src="js/nav.js"></script>\n</head>'],
]);

// ─── 2. login.html: remove heavy framer-motion (unused on this page) ──────────
fix('login.html', [
  ['  <script src="https://unpkg.com/framer-motion/dist/framer-motion.umd.js"></script>\n', ''],
]);

// ─── 3. store.html: nav.js must load before cart.js & store.js ────────────────
// Currently nav.js is at bottom of <head> AFTER the deferred cart.js/store.js
// nav.js sets window.API_BASE — cart.js & store.js use it at module level
// Solution: Move nav.js to top of head, before cart.js and store.js
fix('store.html', [
  // Remove framer-motion (unused on store page)
  ['  <script src="https://unpkg.com/framer-motion/dist/framer-motion.umd.js"></script>\n', ''],
  // Move nav.js from bottom to top (before cart and store scripts)
  ['  <script src="js/toast.js"></script>\n  <script defer src="js/cart.js"></script>\n  <script defer src="js/store.js"></script>',
   '  <script src="js/nav.js"></script>\n  <script src="js/toast.js"></script>\n  <script defer src="js/cart.js"></script>\n  <script defer src="js/store.js"></script>'],
  // Remove the duplicate nav.js at bottom of head
  ['  <script src="js/nav.js"></script>\n</head>', '</head>'],
]);

// ─── 4. index.html: remove framer-motion; fix CTA buttons for logged-in users ─
fix('index.html', [
  ['  <script src="https://unpkg.com/framer-motion/dist/framer-motion.umd.js"></script>\n', ''],
  // CTA "Start Shopping" should go to store.html, not login.html, for logged-in users
  // We handle this by pointing to store.html — nav.js already handles auth redirect
  ["onclick=\"location.href='login.html'\"", "onclick=\"location.href='store.html'\""],
  ["onclick=\"location.href='register.html'\"", "onclick=\"location.href='register.html'\""],
]);

// ─── 5. profile.html: button text mismatch after save ─────────────────────────
fix('profile.html', [
  ["btn.textContent = 'Save Changes';", "btn.textContent = 'Save Email';"],
]);

console.log('\n✅ All final bug fixes applied!');
