import { Client } from 'pg';

const password = 'Scarlett68550!!';
const ref = 'arxxskchdxswntqkdspy';

const regions = [
  'us-east-1','us-east-2','us-west-1','us-west-2',
  'eu-west-1','eu-west-2','eu-central-1','eu-north-1',
  'ap-southeast-1','ap-southeast-2','ap-northeast-1','ap-northeast-2',
  'ca-central-1','sa-east-1','af-south-1','ap-south-1'
];

for (const r of regions) {
  const url = `postgresql://postgres.${ref}:${password}@aws-0-${r}.pooler.supabase.com:6543/postgres?pgbouncer=true`;
  try {
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
    await c.connect();
    const res = await c.query('SELECT 1 AS ok');
    console.log(`SUCCESS: ${r} -> ${res.rows[0].ok}`);
    await c.end();
    process.exit(0);
  } catch (e) {
    console.log(`FAIL: ${r} -> ${e.message.substring(0, 80)}`);
  }
}

console.log('No region worked');
