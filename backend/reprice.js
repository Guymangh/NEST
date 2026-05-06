require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace(':5432', ':6543'),
  ssl: { rejectUnauthorized: false },
  max: 2
});

async function reprice() {
  const client = await pool.connect();
  try {
    // Extract numeric balance from product name e.g. "Chase Bank Log — $43,988 Balance"
    // Then apply: price = CLAMP(300 + (balance - 10000) * 0.005 + jitter, 300, 1500)
    const sql = `
      UPDATE products
      SET price = GREATEST(300, LEAST(1500,
        ROUND(
          300 + (
            CASE
              WHEN name ~ '\\$[0-9,]+'
              THEN LEAST(
                CAST(REPLACE(SUBSTRING(name FROM '\\$([0-9,]+)'), ',', '') AS NUMERIC),
                250000
              ) - 10000
              ELSE 120000
            END
          ) * 0.005 + (RANDOM() * 20 - 10)
        )
      ))
    `;
    const result = await client.query(sql);
    console.log(`✅ Repriced ${result.rowCount} products to $300–$1500 range.`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

reprice();
