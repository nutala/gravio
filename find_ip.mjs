import { Client } from 'pg';
const c = new Client({
  connectionString: 'postgresql://postgres:Scarlett68550!!@db.arxxskchdxswntqkdspy.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
try {
  await c.connect();
  // Try to get the server's hostname/IP
  let queries = [
    "SELECT inet_server_addr() as server_addr",
    "SELECT current_setting('listen_addresses') as listen_addrs",
    "SELECT current_database() as db_name",
    "SELECT current_schema() as schema",
    "SHOW cluster_name",
    "SELECT pg_read_file('/etc/hostname') as hostname",
  ];
  for (const q of queries) {
    try {
      const r = await c.query(q);
      console.log(q.substring(0, 60) + ':', JSON.stringify(r.rows[0]));
    } catch(e) { console.log(q.substring(0, 60) + ':', 'ERROR:', e.message); }
  }
  await c.end();
} catch(e) { console.error('Error:', e.message); }
