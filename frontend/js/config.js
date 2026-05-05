/**
 * config.js — Frontend API configuration
 * ─────────────────────────────────────────────────────────────────
 * Uses relative /api so it works on any domain (www or naked).
 * If on the naked domain (lognest.store), redirect to www to avoid
 * POST requests being broken by the domain-level redirect.
 */

(function () {
  const host = window.location.hostname;
  // Redirect naked domain → www to prevent POST-breaking 301 redirects
  if (host === 'lognest.store') {
    window.location.replace(window.location.href.replace('://lognest.store', '://www.lognest.store'));
    return;
  }
  // Use relative path — works on localhost, www.lognest.store, and Vercel preview URLs
  window.__API_BASE__ = '/api';
})();
