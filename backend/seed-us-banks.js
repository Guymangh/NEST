require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const banks = [
  { name: 'Chase Bank', slug: 'chase-bank', rn: ['021000021', '122000244', '071000013', '111000614'] },
  { name: 'Bank of America', slug: 'bank-of-america', rn: ['026009593', '121000358', '021000322'] },
  { name: 'Wells Fargo', slug: 'wells-fargo', rn: ['121000248', '122000244', '026012881'] },
  { name: 'Citibank', slug: 'citibank', rn: ['021000089', '121000219', '122000163'] },
  { name: 'Capital One', slug: 'capital-one', rn: ['051405515', '031100144', '056001067'] },
  { name: 'US Bank', slug: 'us-bank', rn: ['042000013', '122000040', '091000022'] },
  { name: 'TD Bank', slug: 'td-bank', rn: ['031101266', '021203024', '011201534'] },
  { name: 'PNC Bank', slug: 'pnc-bank', rn: ['043000096', '031201360', '081000045'] },
  { name: 'Truist Bank', slug: 'truist-bank', rn: ['061000104', '051000017', '061101115'] },
  { name: 'Navy Federal CU', slug: 'navy-federal-cu', rn: ['256074974'] },
  { name: 'Chime', slug: 'chime', rn: ['031101279', '124085260'] },
  { name: 'Discover Bank', slug: 'discover-bank', rn: ['031100649', '021214042'] },
  { name: 'Ally Bank', slug: 'ally-bank', rn: ['041215663'] },
  { name: 'Citizens Bank', slug: 'citizens-bank', rn: ['011001438', '031201467', '021200331'] },
  { name: 'Santander Bank', slug: 'santander-bank', rn: ['011000138', '031201441', '021201356'] },
  { name: 'M&T Bank', slug: 'mt-bank', rn: ['022000046', '031301053'] },
  { name: 'BMO Harris Bank', slug: 'bmo-harris-bank', rn: ['071002880', '075000022'] },
  { name: 'KeyBank', slug: 'keybank', rn: ['041001039', '021300077', '041200056'] },
  { name: 'Fifth Third Bank', slug: 'fifth-third-bank', rn: ['042000314', '071000152', '064200145'] },
  { name: 'Regions Bank', slug: 'regions-bank', rn: ['062000019', '061000227'] },
  { name: 'Huntington Bank', slug: 'huntington-bank', rn: ['041200331', '041000632'] },
  { name: 'Woodforest National Bank', slug: 'woodforest-bank', rn: ['113110292', '113110289'] },
  { name: 'USAA', slug: 'usaa', rn: ['114925396', '314972266'] },
  { name: 'Varo Bank', slug: 'varo-bank', rn: ['124085066', '124085118'] },
  { name: 'Marcus by Goldman Sachs', slug: 'marcus-goldman', rn: ['026014494', '026014669'] },
  { name: 'Charles Schwab Bank', slug: 'charles-schwab', rn: ['121202211'] }
];

const firstNames = ['James','Michael','Sarah','Robert','Emily','David','Jessica','Daniel','Ashley','Christopher','Matthew','Amanda'];
const lastNames  = ['Williams','Johnson','Smith','Brown','Jones','Garcia','Miller','Davis','Wilson','Taylor','Anderson','Thomas'];
const cities     = ['New York','Los Angeles','Chicago','Houston','Phoenix','Dallas','San Antonio','San Diego','Miami','Atlanta'];
const states     = ['NY','CA','IL','TX','AZ','TX','TX','CA','FL','GA'];

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function makeProductData(bank, balance) {
  const first = pick(firstNames);
  const last  = pick(lastNames);
  const username = `${first.toLowerCase()}${last.toLowerCase()}${rnd(10,99)}`;
  const email    = `${username}@gmail.com`;
  const phone    = `+1 (${rnd(200,999)}) ${rnd(200,999)}-${rnd(1000,9999)}`;
  const ssn      = `${rnd(100,999)}-${rnd(10,99)}-${rnd(1000,9999)}`;
  const dob      = `${rnd(1,12).toString().padStart(2,'0')}/${rnd(1,28).toString().padStart(2,'0')}/${rnd(1960,1995)}`;
  const routing  = pick(bank.rn);
  const acct     = rnd(10000000000, 99999999999);
  const pin      = rnd(1000,9999);
  const mmn      = pick(lastNames);
  const cityIdx  = rnd(0, cities.length-1);
  const city     = cities[cityIdx];
  const state    = states[cityIdx];
  const zip      = rnd(10000,99999);

  const accessTypes = [
    ['Online banking: ACTIVE', 'Mobile app: ENABLED', 'Phone banking: ACTIVE'],
    ['Online banking: ACTIVE', 'Mobile app: DISABLED', 'Phone banking: ACTIVE'],
    ['Online banking: DISABLED', 'Mobile app: DISABLED', 'Phone banking: ACTIVE (Calling Only)'],
    ['Online banking: ACTIVE', 'Mobile app: ENABLED', 'Phone banking: DISABLED'],
    ['Online banking: ACTIVE (Full Access)', 'Mobile app: ENABLED', 'Wire Transfer: UNLOCKED']
  ];
  
  const selectedAccess = pick(accessTypes);

  return `============================
  ${bank.name.toUpperCase()} ACCOUNT LOG
============================

>> ACCOUNT HOLDER
   Full Name  : ${first} ${last}
   DOB        : ${dob}
   SSN        : ${ssn}
   Phone      : ${phone}
   Address    : ${rnd(100,9999)} ${last} St, ${city}, ${state} ${zip}

>> LOGIN CREDENTIALS
   Online URL : https://www.${bank.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g,'')}.com/login
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
   ✓ ${selectedAccess[0]}
   ✓ ${selectedAccess[1]}
   ✓ ${selectedAccess[2]}
   ✓ Driver License on file

============================
   HANDLE WITH CARE
============================`;
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Deleting old logs below $300...');
    // Delete all products priced below 300
    const delRes = await client.query("DELETE FROM products WHERE price < 300");
    console.log(`🗑️ Deleted ${delRes.rowCount} old products.`);

    console.log('🌱 Seeding new massive US Bank DB...\n');

    for (const inst of banks) {
      // Upsert category
      const catRes = await client.query(
        `INSERT INTO categories (name, slug) VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [inst.name, inst.slug]
      );
      const categoryId = catRes.rows[0].id;

      // Create ~10 products per bank to make the DB rich
      const numProducts = rnd(8, 12);
      for(let i=0; i<numProducts; i++) {
        const balance = rnd(10000, 250000);
        // If 10k = 350, 20k = 450 -> Price = 350 + (Balance - 10000) * 0.01
        let basePrice = 350 + (balance - 10000) * 0.01;
        // Add a small random jitter (-$5 to +$5) so prices aren't too perfectly round
        const price = Math.floor(basePrice + rnd(-5, 5));

        const name = `${inst.name} Log — $${balance.toLocaleString()} Balance`;
        
        const accTypes = ['Online + Mobile + Calling', 'Calling Access Only', 'Online Access Only', 'Full Access (Wire Unlocked)'];
        const accDesc = pick(accTypes);

        const description = `Verified ${inst.name} account with balance of $${balance.toLocaleString()}. Access Type: ${accDesc}. Includes complete identity documents (SSN, DOB, Driver License).`;
        const short_desc  = `${inst.name} | $${balance.toLocaleString()} bal | ${accDesc}`;
        const product_data = makeProductData(inst, balance);
        const tags = `${inst.name.toLowerCase()}, bank log, ${inst.slug}, ${accDesc.toLowerCase()}`;

        await client.query(
          `INSERT INTO products (name, category_id, description, short_description, price, stock, product_data, is_active, featured, tags)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [name, categoryId, description, short_desc, price, 1, product_data, true, rnd(0,1) === 1, tags]
        );
      }
      console.log(`  ✅ ${inst.name} — Seeded ${numProducts} logs with correct Routing Numbers.`);
    }

    console.log('\n✅ Database successfully updated with new US banks and logs above $300!\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
