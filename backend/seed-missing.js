require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const firstNames = ['James','Michael','Sarah','Robert','Emily','David','Jessica','Daniel','Ashley','Christopher','Matthew','Amanda'];
const lastNames  = ['Williams','Johnson','Smith','Brown','Jones','Garcia','Miller','Davis','Wilson','Taylor','Anderson','Thomas'];
const cities     = ['New York','Los Angeles','Chicago','Houston','Phoenix','Dallas','San Antonio','San Diego','Miami','Atlanta'];
const states     = ['NY','CA','IL','TX','AZ','TX','TX','CA','FL','GA'];

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function makeProductData(bankName, balance) {
  const first = pick(firstNames);
  const last  = pick(lastNames);
  const username = `${first.toLowerCase()}${last.toLowerCase()}${rnd(10,99)}`;
  const email    = `${username}@gmail.com`;
  const phone    = `+1 (${rnd(200,999)}) ${rnd(200,999)}-${rnd(1000,9999)}`;
  const ssn      = `${rnd(100,999)}-${rnd(10,99)}-${rnd(1000,9999)}`;
  const dob      = `${rnd(1,12).toString().padStart(2,'0')}/${rnd(1,28).toString().padStart(2,'0')}/${rnd(1960,1995)}`;
  
  // Generic routing number for unknown banks/categories
  const routing  = `${rnd(0,1) === 1 ? '0' : '1'}${rnd(11111111, 99999999)}`;
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
  
  // Determine if it's a generic tool or bank
  const isTool = /(VPN|SMTP|RDP|SSH|Hosting|Other)/i.test(bankName);

  if (isTool) {
    return `============================
  ${bankName.toUpperCase()} DETAILS
============================

>> ACCESS CREDENTIALS
   Host/URL   : ${bankName.toLowerCase().replace(/\s+/g,'')}.server-${rnd(100,999)}.net
   Username   : ${username}
   Password   : ${capitalize(first)}@${rnd(100,9999)}!
   Port       : ${rnd(20, 8080)}

>> ADDITIONAL INFO
   Status     : ACTIVE / PREMIUM
   Valid Until: Lifetime or ${rnd(1,12)} Months
   Notes      : High performance, clean IP, full admin rights.

============================
   HANDLE WITH CARE
============================`;
  }

  return `============================
  ${bankName.toUpperCase()} ACCOUNT LOG
============================

>> ACCOUNT HOLDER
   Full Name  : ${first} ${last}
   DOB        : ${dob}
   SSN        : ${ssn}
   Phone      : ${phone}
   Address    : ${rnd(100,9999)} ${last} St, ${city}, ${state} ${zip}

>> LOGIN CREDENTIALS
   Online URL : https://www.${bankName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g,'')}.com/login
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

async function seedMissing() {
  const client = await pool.connect();
  try {
    console.log('🔍 Finding categories with 0 logs...');
    const result = await client.query(`
      SELECT c.id, c.name, c.slug, COUNT(p.id) as count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id, c.name, c.slug
      HAVING COUNT(p.id) = 0
    `);

    const missingCategories = result.rows;
    console.log(`⚠️ Found ${missingCategories.length} categories with 0 logs. Seeding them now...\n`);

    for (const cat of missingCategories) {
      // Create ~10 products per category
      const numProducts = rnd(10, 12);
      for(let i=0; i<numProducts; i++) {
        const balance = rnd(10000, 250000);
        const startingBase = rnd(0, 1) === 1 ? 350 : 300;
        let basePrice = startingBase + (balance - 10000) * 0.01;
        const price = Math.floor(basePrice + rnd(-5, 5));

        let name, description, short_desc, product_data;
        const isTool = /(VPN|SMTP|RDP|SSH|Hosting|Other)/i.test(cat.name);

        if (isTool) {
          name = `Premium ${cat.name} — Full Access`;
          description = `High quality, clean ${cat.name}. Comes with full credentials and lifetime or long-term validity.`;
          short_desc = `Clean ${cat.name} | Full Admin Access`;
        } else {
          name = `${cat.name} Log — $${balance.toLocaleString()} Balance`;
          const accTypes = ['Online + Mobile + Calling', 'Calling Access Only', 'Online Access Only', 'Full Access (Wire Unlocked)'];
          const accDesc = pick(accTypes);
          description = `Verified ${cat.name} account with balance of $${balance.toLocaleString()}. Access Type: ${accDesc}. Includes complete identity documents.`;
          short_desc = `${cat.name} | $${balance.toLocaleString()} bal | ${accDesc}`;
        }
        
        product_data = makeProductData(cat.name, balance);
        const tags = `${cat.name.toLowerCase()}, ${isTool ? 'tool' : 'bank log'}, ${cat.slug}`;

        await client.query(
          `INSERT INTO products (name, category_id, description, short_description, price, stock, product_data, is_active, featured, tags)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [name, cat.id, description, short_desc, price, 1, product_data, true, rnd(0,1) === 1, tags]
        );
      }
      console.log(`  ✅ ${cat.name} — Seeded ${numProducts} items.`);
    }

    console.log('\n✅ Successfully populated all 0-count categories with 10+ items!\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedMissing();
