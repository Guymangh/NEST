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
    // 1. Find all categories to diagnose duplicates and unwanted entries
    const all = await client.query(`SELECT id, name, slug FROM categories ORDER BY name`);
    console.log('\n=== All Categories ===');
    all.rows.forEach(r => console.log(`  ${r.id} | ${r.name} | ${r.slug}`));

    // 2. Find M&T Bank duplicates
    const mt = await client.query(`SELECT id, name, slug FROM categories WHERE name ILIKE '%m%t%bank%' OR slug ILIKE '%m-t%' OR slug ILIKE '%mt%bank%'`);
    console.log('\n=== M&T Bank Matches ===');
    mt.rows.forEach(r => console.log(`  ${r.id} | ${r.name} | ${r.slug}`));

    // 3. Find Other Tools / RDP
    const others = await client.query(`SELECT id, name, slug FROM categories WHERE name ILIKE '%other%' OR name ILIKE '%rdp%' OR name ILIKE '%remote%'`);
    console.log('\n=== Other/RDP Matches ===');
    others.rows.forEach(r => console.log(`  ${r.id} | ${r.name} | ${r.slug}`));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup();
