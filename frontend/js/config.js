/**
 * config.js — Frontend API configuration
 * ─────────────────────────────────────────────────────────────────
 * This is the ONLY file you need to change when deploying to production.
 */

// Since frontend and backend are on the same Vercel domain, use relative path
window.__API_BASE__ = '/api';

// For local development, override this manually:
// window.__API_BASE__ = 'http://localhost:5000/api';
