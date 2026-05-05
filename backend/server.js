require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Dev:  allow localhost origins
// Prod: read from ALLOWED_ORIGINS env var (comma-separated domains)
const devOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];

const prodOrigins = [
  'https://lognest.store',
  'https://www.lognest.store',
  ...(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
];

const allowedOrigins = isProd ? prodOrigins : devOrigins;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Security Headers ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  // Prevent browsers from caching API responses that contain sensitive data
  if (req.path.startsWith('/api/')) {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'no-referrer');
  }
  next();
});

// ─── Body Parsers ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/deposits', require('./routes/deposits'));
app.use('/api/admin',    require('./routes/admin'));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success:     true,
    message:     'LogNest API is running 🚀',
    environment: isProd ? 'production' : 'development',
    timestamp:   new Date(),
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  // Never expose internal error details in production
  console.error('Unhandled error:', err);
  const message = isProd ? 'Internal server error.' : (err.message || 'Internal server error.');
  res.status(500).json({ success: false, message });
});

// ─── Start Server (local only — Vercel handles this in production) ────────────
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`\n🚀 LogNest API running on http://localhost:${PORT}`);
    console.log(`🌍 Environment : ${isProd ? 'PRODUCTION' : 'development'}`);
    console.log(`🔒 CORS origins: ${allowedOrigins.join(', ') || '(none set!)'}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health\n`);

    if (isProd && !process.env.ALLOWED_ORIGINS) {
      console.warn('⚠️  WARNING: NODE_ENV=production but ALLOWED_ORIGINS is not set in .env!');
    }
    if (process.env.JWT_SECRET === 'your_super_secret_jwt_key_change_this_in_production') {
      console.warn('⚠️  WARNING: JWT_SECRET is still the default placeholder — change it before going live!');
    }
  });
}

module.exports = app;
