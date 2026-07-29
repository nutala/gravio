const { execSync } = require('child_process');

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

const dbUrl = process.env.SUPABASE_URL || '(not set)';
console.log('[start] SUPABASE_URL: ' + dbUrl);

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
