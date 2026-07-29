const { execSync, spawn } = require('child_process');
const path = require('path');

// Intercept https.request to log non-200 responses from Google's OAuth endpoints
const https = require('https');
const originalHttpsRequest = https.request;
https.request = function patchedHttpsRequest(...args) {
  const req = originalHttpsRequest.apply(this, args);
  req.on('response', (res) => {
    if (res.statusCode && res.statusCode !== 200) {
      const origAsyncIterator = res[Symbol.asyncIterator].bind(res);
      let body = '';
      res[Symbol.asyncIterator] = async function* () {
        for await (const chunk of origAsyncIterator()) {
          body += chunk.toString();
          yield chunk;
        }
        console.error('[https] Non-200:', res.statusCode, res.statusMessage);
        console.error('[https] Body:', body.substring(0, 3000));
        console.error('[https] Headers:', JSON.stringify(res.headers));
      };
    }
  });
  return req;
};

const patchProcessResponse = require('./patch-openid-client.cjs');
patchProcessResponse();

const port = process.env.PORT || 3000;
const SUPABASE_HOST = 'db.arxxskchdxswntqkdspy.supabase.co';
const PROXY_PORT = 5555;

// Helper: rewrite DATABASE_URL to use local IPv4 proxy
function rewriteDbUrl(host, port) {
  const orig = process.env.DATABASE_URL;
  if (orig && orig.includes(host)) {
    process.env.DATABASE_URL = orig
      .replace(new RegExp(host.replace(/\./g, '\\.') + ':\\d+'), '127.0.0.1:' + port)
      .replace(/[?&]pgbouncer=true/g, '');
    console.log('[start] DATABASE_URL rewritten to local proxy');
  }
}

(async () => {
  // ── 1. Start IPv4→IPv6 TCP proxy in a child process ──
  const proxyScript = path.join(__dirname, 'db-proxy.cjs');
  const proxy = spawn('node', [proxyScript], { stdio: ['ignore', 'pipe', 'inherit'] });
  proxy.on('error', (e) => console.error('[proxy] spawn error:', e.message));

  // Wait for proxy to signal readiness
  await new Promise((resolve) => {
    proxy.stdout.once('data', () => { console.log('[proxy] OK → 127.0.0.1:' + PROXY_PORT + ' → ' + SUPABASE_HOST + ':5432'); resolve(); });
    proxy.on('exit', (code) => { if (code !== 0) console.error('[proxy] exited with code', code); resolve(); });
  });

  // Rewrite DATABASE_URL
  rewriteDbUrl(SUPABASE_HOST, PROXY_PORT);

  const dbUrl = process.env.DATABASE_URL || '(not set)';
  const masked = dbUrl.startsWith('postgresql://')
    ? 'postgresql://***:***@' + dbUrl.split('@')[1]
    : dbUrl;
  console.log('[start] DATABASE_URL: ' + masked);

  // ── 2. Prisma db push ──
  try {
    execSync('prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit', env: { ...process.env } });
  } catch (e) {
    console.error('[start] prisma db push failed (non-fatal): ' + (e.stderr || e.message).substring(0, 500));
  }

  // ── 3. Start Next.js (foreground; proxy runs as child) ──
  const next = spawn('next', ['start', '-p', port], { stdio: 'inherit', env: { ...process.env } });
  next.on('error', (e) => { console.error('[start] next start failed:', e.message); process.exit(1); });
  next.on('exit', (code) => { proxy.kill(); process.exit(code || 0); });
})().catch((e) => {
  console.error('[start] Fatal error:', e.message);
  process.exit(1);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
