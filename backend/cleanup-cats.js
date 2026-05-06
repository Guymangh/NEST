require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace(':5432', ':6543'),
  ssl: { rejectUnauthorized: false },
  max: 2
});

async function cleanup() {
  const client = await pool.connect();
  try {
    const removeIds = [1, 5]; // SMTP Servers, VPN Accounts

    for (const id of removeIds) {
      const pDel = await client.query('DELETE FROM products WHERE category_id = $1', [id]);
      const cDel = await client.query('DELETE FROM categories WHERE id = $1', [id]);
      console.log(`  ✅ Removed category ${id} + ${pDel.rowCount} products`);
    }

    console.log('\n✅ Done!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup();
