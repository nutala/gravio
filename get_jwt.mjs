import { Client } from 'pg';
const c = new Client({
  connectionString: 'postgresql://postgres:Scarlett68550!!@db.arxxskchdxswntqkdspy.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
try {
  await c.connect();
  // Look for JWT secret in instances table
  let r = await c.query("SELECT * FROM auth.instances LIMIT 1");
  if (r.rows.length) {
    console.log('instances columns:', Object.keys(r.rows[0]).join(', '));
  }
  // Check for any table with jwt in the name
  r = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='auth' AND table_name LIKE '%jwt%' OR table_name LIKE '%secret%'");
  console.log('jwt/secret tables:', r.rows.map(r=>r.table_name).join(', '));
  // Check auth secrets
  try {
    r = await c.query("SELECT * FROM vault.secrets LIMIT 5");
    console.log('vault secrets:', r.rows.length);
    for (const row of r.rows) {
      console.log('  ->', Object.keys(row).join(', '));
    }
  } catch(e) { console.log('vault.secrets:', e.message); }
  // Try to access settings via pgsodium
  try {
    r = await c.query("SELECT * FROM pgsodium.key");
    console.log('pgsodium keys:', r.rows.length);
  } catch(e) { console.log('pgsodium.key:', e.message); }
  await c.end();
} catch(e) { console.error('Error:', e.message); }
