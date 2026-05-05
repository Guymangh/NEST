/**
 * seed-products.js
 * Run: node backend/seed-products.js
 * Seeds one product per bank institution with realistic login data.
 */

require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Institution definitions ───────────────────────────────────────────────
const institutions = [
  { name: 'Chase Bank',         slug: 'chase-bank' },
  { name: 'Bank of America',    slug: 'bank-of-america' },
  { name: 'Wells Fargo',        slug: 'wells-fargo' },
  { name: 'Citibank',           slug: 'citibank' },
  { name: 'Capital One',        slug: 'capital-one' },
  { name: 'US Bank',            slug: 'us-bank' },
  { name: 'TD Bank',            slug: 'td-bank' },
  { name: 'PNC Bank',           slug: 'pnc-bank' },
  { name: 'Truist Bank',        slug: 'truist-bank' },
  { name: 'Stifel',             slug: 'stifel' },
  { name: 'Regions Bank',       slug: 'regions-bank' },
  { name: 'Fifth Third Bank',   slug: 'fifth-third-bank' },
  { name: 'KeyBank',            slug: 'keybank' },
  { name: 'Huntington Bank',    slug: 'huntington-bank' },
  { name: 'Ally Bank',          slug: 'ally-bank' },
  { name: 'Marcus (Goldman)',   slug: 'marcus-goldman' },
  { name: 'Discover Bank',      slug: 'discover-bank' },
  { name: 'USAA',               slug: 'usaa' },
  { name: 'Navy Federal CU',    slug: 'navy-federal-cu' },
  { name: 'PayPal',             slug: 'paypal' },
];

// ─── Generate realistic product_data per institution ──────────────────────
function makeProductData(bank, balance) {
  const firstNames = ['James','Michael','Sarah','Robert','Emily','David','Jessica','Daniel','Ashley','Christopher'];
  const lastNames  = ['Williams','Johnson','Smith','Brown','Jones','Garcia','Miller','Davis','Wilson','Taylor'];
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last  = lastNames[Math.floor(Math.random() * lastNames.length)];
  const username = `${first.toLowerCase()}${last.toLowerCase()}${Math.floor(Math.random()*99)}`;
  const email    = `${username}@gmail.com`;
  const phone    = `+1 (${rnd(200,999)}) ${rnd(200,999)}-${rnd(1000,9999)}`;
  const ssn      = `${rnd(100,999)}-${rnd(10,99)}-${rnd(1000,9999)}`;
  const dob      = `${rnd(1,12).toString().padStart(2,'0')}/${rnd(1,28).toString().padStart(2,'0')}/${rnd(1960,1995)}`;
  const routing  = rnd(021000000, 121999999);
  const acct     = rnd(10000000000, 99999999999);
  const pin      = rnd(1000,9999);
  const mmn      = lastNames[Math.floor(Math.random() * lastNames.length)];
  const city     = ['New York','Los Angeles','Chicago','Houston','Phoenix','Dallas','San Antonio','San Diego'][Math.floor(Math.random()*8)];
  const state    = ['NY','CA','IL','TX','AZ','FL','WA','GA'][Math.floor(Math.random()*8)];
  const zip      = rnd(10000,99999);

  return `============================
  ${bank.toUpperCase()} ACCOUNT LOG
============================

>> ACCOUNT HOLDER
   Full Name  : ${first} ${last}
   DOB        : ${dob}
   SSN        : ${ssn}
   Phone      : ${phone}
   Address    : ${rnd(100,9999)} ${last} St, ${city}, ${state} ${zip}

>> LOGIN CREDENTIALS
   Online URL : https://www.${bank.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g,'')}.com/login
   Username   : ${username}
   Email      : ${email}
   Password   : ${capitalize(first)}@${rnd(100,9999)}!

>> ACCOUNT DETAILS
   Account #  : ${acct}
   Routing #  : ${routing}
   Account Type: Checking + Savings
   Balance    : $${balance.toLocaleString()}
   ATM PIN    : ${pin}

>> SECURITY
   Mother's Maiden Name : ${mmn}
   Security Q1  : What was your first pet's name?
   Security A1  : fluffy${rnd(1,9)}
   Security Q2  : What city were you born in?
   Security A2  : ${city}

>> ACCESS NOTES
   ✓ Online banking: ACTIVE
   ✓ Mobile app: ENABLED
   ✓ Phone banking: ACTIVE
   ✓ Driver License on file

============================
   HANDLE WITH CARE
============================`;
}

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ─── Main ──────────────────────────────────────────────────────────────────
async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Starting seed...\n');

    for (const inst of institutions) {
      // 1. Upsert category
      const catRes = await client.query(
        `INSERT INTO categories (name, slug)
         VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [inst.name, inst.slug]
      );
      const categoryId = catRes.rows[0].id;

      // 2. Build product details
      const balance = rnd(2000, 95000);
      const price   = balance < 10000 ? rnd(25, 80)
                    : balance < 40000 ? rnd(80, 180)
                    : rnd(180, 350);

      const name = `${inst.name} Log — $${balance.toLocaleString()} Balance`;
      const description = `Full access ${inst.name} account with verified balance of $${balance.toLocaleString()}. Includes online login, mobile app access, phone banking, and complete identity documents (SSN, DOB, Driver License).`;
      const short_desc  = `${inst.name} | $${balance.toLocaleString()} balance | Email + Online + Phone + DL/SSN`;
      const product_data = makeProductData(inst.name, balance);
      const tags = `${inst.name.toLowerCase()}, bank log, ${inst.slug}, online access, ssn, drivers license`;

      // 3. Insert product (skip if one already exists for this category)
      const existing = await client.query(
        `SELECT id FROM products WHERE category_id = $1 AND is_active = TRUE LIMIT 1`,
        [categoryId]
      );

      if (existing.rows.length > 0) {
        console.log(`  ⏭  ${inst.name}: active product already exists, skipping.`);
        continue;
      }

      await client.query(
        `INSERT INTO products
           (name, category_id, description, short_description, price, stock,
            product_data, is_active, featured, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [name, categoryId, description, short_desc, price, 1,
         product_data, true, rnd(0,1) === 1, tags]
      );

      console.log(`  ✅  ${inst.name} — $${balance.toLocaleString()} balance @ $${price}`);
    }

    console.log('\n✅ Seed complete! All institutions inserted.\n');
  } catch (err) {
    console.error('❌ Seed error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
