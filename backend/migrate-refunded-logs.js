require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`
  CREATE TABLE IF NOT EXISTS refunded_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE NOT NULL,
    user_id UUID,
    product_id UUID,
    product_name TEXT,
    recovered_data TEXT,
    refunded_amount NUMERIC(10,2),
    refunded_at TIMESTAMPTZ DEFAULT NOW()
  )
`).then(() => {
  console.log('✅ refunded_logs table created successfully');
  pool.end();
}).catch(e => {
  console.error('❌ Error:', e.message);
  pool.end();
});
