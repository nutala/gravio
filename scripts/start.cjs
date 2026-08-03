const { execSync } = require('child_process');

require('./patch-openid-client.cjs')();

const port = process.env.PORT || 3000;

const dbUrl = process.env.SUPABASE_URL || '(not set)';
console.log('[start] SUPABASE_URL: ' + dbUrl);

try {
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit', env: { ...process.env } });
} catch (e) {
  console.error('[start] prisma db push failed (non-fatal): ' + (e.stderr || e.message).substring(0, 500));
}

try {
  execSync('next start -p ' + port, { stdio: 'inherit', env: { ...process.env } });
} catch (e) {
  console.error('[start] next start failed:', e.message);
  process.exit(1);
}