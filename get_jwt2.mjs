import { Client } from 'pg';
const c = new Client({
  connectionString: 'postgresql://postgres:Scarlett68550!!@db.arxxskchdxswntqkdspy.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
try {
  await c.connect();
  // instances table
  let r = await c.query("SELECT * FROM auth.instances LIMIT 1");
  if (r.rows.length) {
    const cols = Object.keys(r.rows[0]);
    console.log('instances columns:', cols.join(', '));
    for (const col of cols) {
      const val = r.rows[0][col];
      if (typeof val === 'string') {
        // Print first 100 chars of each string value
        console.log(`  ${col}: ${val.substring(0, 200)}`);
      } else {
        console.log(`  ${col}: ${val}`);
      }
    }
  }
  // Check auth settings table
  try {
    r = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='auth'");
    console.log('All auth tables:', r.rows.map(t=>t.table_name).join(', '));
  } catch(e) {}
  await c.end();
} catch(e) { console.error('Error:', e.message); }
