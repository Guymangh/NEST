/**
 * config.js — Frontend API configuration
 * ─────────────────────────────────────────────────────────────────
 * This is the ONLY file you need to change when deploying to production.
 *
 * Load this script BEFORE nav.js on every page. It's already included
 * in all pages via the <script src="js/config.js"> tag in the <head>.
 *
 * ─── How to set up for production ────────────────────────────────
 * Change the URL below to your live backend domain, e.g.:
 *
 *   window.__API_BASE__ = 'https://api.yourdomain.com/api';
 *
 * Or if your frontend and backend share the same domain:
 *
 *   window.__API_BASE__ = 'https://yourdomain.com/api';
 *
 * For local development, leave it as an empty string or 'http://localhost:5000/api'
 * and nav.js will use the localhost fallback automatically.
 * ─────────────────────────────────────────────────────────────────
 */

// ── Change this ONE line when deploying ──────────────────────────
window.__API_BASE__ = 'http://localhost:5000/api';

// Production example (uncomment and fill in):
// window.__API_BASE__ = 'https://yourdomain.com/api';
