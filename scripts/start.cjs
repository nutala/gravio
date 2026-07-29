const { execSync } = require('child_process');

// Intercept https.request to log non-200 responses from Google's OAuth endpoints
// This works because https is a native Node.js module (not bundled by Next.js)
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

// Patch is applied at build time (scripts/build.js), runtime patch is a safety net
const patchProcessResponse = require('./patch-openid-client.cjs');
patchProcessResponse();

const port = process.env.PORT || 3000;

// ── IPv4→IPv6 TCP proxy (Render cannot reach Supabase's IPv6-only hostname) ──
const net = require('net');
const PROXY_PORT = 5555;
const SUPABASE_HOST = 'db.arxxskchdxswntqkdspy.supabase.co';
const SUPABASE_PORT = 5432; // direct connection (no pooler)

let proxyActive = false;
const proxy = net.createServer((client) => {
  const target = net.createConnection({ host: SUPABASE_HOST, port: SUPABASE_PORT }, () => {
    client.pipe(target);
    target.pipe(client);
  });
  target.on('error', (err) => { console.error('[proxy] target error:', err.message); client.destroy(); });
  client.on('error', () => {});
  client.on('close', () => { if (!target.destroyed) target.destroy(); });
  target.on('close', () => { if (!client.destroyed) client.destroy(); });
});

try {
  proxy.listen(PROXY_PORT, '127.0.0.1', () => {
    proxyActive = true;
    console.log('[proxy] OK – forwarding 127.0.0.1:' + PROXY_PORT + ' → ' + SUPABASE_HOST + ':' + SUPABASE_PORT);
    // Rewrite DATABASE_URL to point at the local proxy
    const orig = process.env.DATABASE_URL;
    if (orig && orig.includes(SUPABASE_HOST)) {
      process.env.DATABASE_URL = orig
        .replace(new RegExp(SUPABASE_HOST.replace(/\./g,'\\.') + ':\\d+'), '127.0.0.1:' + PROXY_PORT)
        .replace(/[?&]pgbouncer=true/, '');
      console.log('[proxy] DATABASE_URL rewritten to local proxy');
    }
  });
} catch (e) {
  console.error('[proxy] FAILED to start:', e.message);
}

const dbUrl = process.env.DATABASE_URL || '(not set)';
const masked = dbUrl.startsWith('postgresql://')
  ? 'postgresql://***:***@' + dbUrl.split('@')[1]
  : dbUrl;
console.log('[start] DATABASE_URL: ' + masked);

try {
  execSync('prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit', env: { ...process.env } });
} catch (e) {
  console.error('[start] prisma db push failed (non-fatal): ' + (e.stderr || e.message).substring(0, 500));
}

try {
  execSync('next start -p ' + port, { stdio: 'inherit', env: { ...process.env } });
} catch (e) {
  console.error('[start] next start failed:', e.message);
  process.exit(1);
}

// Cleanup proxy on exit
process.on('exit', () => { if (proxyActive) proxy.close(); });
process.on('SIGINT', () => { if (proxyActive) proxy.close(); process.exit(0); });
process.on('SIGTERM', () => { if (proxyActive) proxy.close(); process.exit(0); });
