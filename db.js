const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const isSupabase = (process.env.DATABASE_URL || '').includes('supabase');

const dbUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(':5432', ':6543') : '';

const pool = new Pool({
  connectionString: dbUrl,
  ssl: isSupabase ? { rejectUnauthorized: false } : false,
  max: 2, // Limit pool size for Vercel Serverless
  idleTimeoutMillis: 3000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
  process.exit(-1);
});

module.exports = pool;
