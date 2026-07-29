import { Client } from 'pg';
const c = new Client({
  connectionString: 'postgresql://postgres:Scarlett68550!!@db.arxxskchdxswntqkdspy.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
try {
  await c.connect();
  let r = await c.query("SELECT version()");
  console.log('Version:', r.rows[0].version);
  r = await c.query("SELECT current_setting('server_version')");
  console.log('server_version:', r.rows[0].current_setting);
  r = await c.query("SHOW auth_type");
  console.log('auth_type:', r.rows[0].auth_type);
  await c.end();
} catch(e) { console.error('Error:', e.message); }
