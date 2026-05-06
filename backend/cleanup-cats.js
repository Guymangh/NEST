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
    // IDs to completely remove (with all their products)
    const removeIds = [
      143, // M&T Bank duplicate (keep id=8)
      6,   // Other Tools
      2,   // RDP Access
    ];

    for (const id of removeIds) {
      // Delete products first
      const pDel = await client.query('DELETE FROM products WHERE category_id = $1', [id]);
      console.log(`  Deleted ${pDel.rowCount} products from category ${id}`);
      // Delete category
      const cDel = await client.query('DELETE FROM categories WHERE id = $1', [id]);
      console.log(`  Deleted category ${id}: ${cDel.rowCount} rows`);
    }

    console.log('\n✅ Cleanup complete!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup();
