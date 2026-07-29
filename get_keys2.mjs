import { Client } from 'pg';
const c = new Client({
  connectionString: 'postgresql://postgres:Scarlett68550!!@db.arxxskchdxswntqkdspy.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
try {
  await c.connect();
  let r = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='auth' AND table_name='secrets'");
  console.log('secrets columns:', r.rows.map(c=>c.column_name+'('+c.data_type+')').join(', '));
  r = await c.query("SELECT * FROM auth.secrets LIMIT 5");
  console.log('secrets:', JSON.stringify(r.rows, null, 2));
  // Check decrypted_secrets
  try {
    r = await c.query("SELECT * FROM auth.decrypted_secrets LIMIT 5");
    console.log('decrypted_secrets:', JSON.stringify(r.rows, null, 2));
  } catch(e) { console.log('decrypted_secrets error:', e.message); }
  await c.end();
} catch(e) { console.error('Error:', e.message); }
