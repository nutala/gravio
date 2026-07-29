import { Client } from 'pg';
const c = new Client({
  connectionString: 'postgresql://postgres:Scarlett68550!!@db.arxxskchdxswntqkdspy.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
try {
  await c.connect();
  // Check auth schema
  let r = await c.query("SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name='auth')");
  console.log('auth schema exists:', r.rows[0].exists);
  if (r.rows[0].exists) {
    r = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='auth'");
    console.log('auth tables:', r.rows.map(t=>t.table_name).join(', '));
    try {
      r = await c.query("SELECT * FROM auth.config LIMIT 1");
      console.log('auth.config keys:', Object.keys(r.rows[0] || {}).join(', '));
      if (r.rows[0]?.jwt_secret) console.log('JWT_SECRET present:', !!r.rows[0].jwt_secret);
    } catch(e) { console.log('auth.config error:', e.message); }
    // Try to find the project ref / url
    try {
      r = await c.query("SELECT * FROM auth.config WHERE id=1");
      if (r.rows[0]) console.log('Site URL:', r.rows[0].site_url);
    } catch(e) {}
  }
  await c.end();
} catch(e) { console.error('Error:', e.message); }
