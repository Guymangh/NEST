/**
 * run-migration.js
 * Connects to the Supabase PostgreSQL database using the project's
 * db.js config and executes migrate_bugs_fix.sql statement by statement.
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

// Mirror the same connection logic as db.js
const rawUrl = process.env.DATABASE_URL || '';
const dbUrl  = rawUrl.replace(':5432', ':6543'); // Supabase transaction pooler port

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function run() {
  const sqlFile = path.join(__dirname, 'migrate_bugs_fix.sql');
  const sql     = fs.readFileSync(sqlFile, 'utf8');

  const client = await pool.connect();
  console.log('\n✅ Connected to database\n');

  // Define each statement explicitly so multi-line blocks work correctly
  const statements = [
    {
      name: 'Drop old deposits method constraint',
      sql: `ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_method_check`,
    },
    {
      name: 'Add updated deposits method constraint (includes oxapay & nowpayments)',
      sql: `ALTER TABLE deposits ADD CONSTRAINT deposits_method_check
              CHECK (method IN ('manual', 'bitcoin', 'usdt', 'oxapay', 'nowpayments'))`,
    },
    {
      name: 'Create reveal_tokens table',
      sql: `CREATE TABLE IF NOT EXISTS reveal_tokens (
              token       VARCHAR(64)  PRIMARY KEY,
              order_id    UUID         NOT NULL REFERENCES orders(id)  ON DELETE CASCADE,
              user_id     UUID         NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
              expires_at  TIMESTAMPTZ  NOT NULL,
              used        BOOLEAN      DEFAULT FALSE,
              created_at  TIMESTAMPTZ  DEFAULT NOW()
            )`,
    },
    {
      name: 'Create index on reveal_tokens',
      sql: `CREATE INDEX IF NOT EXISTS idx_reveal_tokens_user_order
              ON reveal_tokens (user_id, order_id, created_at)`,
    },
    {
      name: 'Create password_reset_tokens table',
      sql: `CREATE TABLE IF NOT EXISTS password_reset_tokens (
              token       VARCHAR(64)  PRIMARY KEY,
              user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              expires_at  TIMESTAMPTZ  NOT NULL,
              used        BOOLEAN      DEFAULT FALSE,
              created_at  TIMESTAMPTZ  DEFAULT NOW()
            )`,
    },
    {
      name: 'Create index on password_reset_tokens',
      sql: `CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens (user_id)`,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const { name, sql: stmt } of statements) {
    try {
      await client.query(stmt);
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`  ⏭  SKIP (already exists): ${name}`);
        passed++;
      } else {
        console.error(`  ❌ FAILED: ${name}\n     Error: ${err.message}`);
        failed++;
      }
    }
  }

  client.release();
  await pool.end();

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Migration complete: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('⚠️  Some statements failed. Review errors above.');
    process.exit(1);
  } else {
    console.log('🎉 All statements applied successfully!');
  }
}

run().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
