const fs = require('fs');
const path = require('path');

const targetFile = path.join(process.cwd(), 'node_modules', 'openid-client', 'lib', 'helpers', 'process_response.js');

if (!fs.existsSync(targetFile)) {
  console.log('[patch] openid-client process_response.js not found, skipping');
  process.exit(0);
}

let content = fs.readFileSync(targetFile, 'utf8');

if (content.includes('[openid-client] Non-200 response from token endpoint')) {
  console.log('[patch] openid-client process_response.js already patched');
  process.exit(0);
}

const patchInsertion = `
    let debugBody = '(unable to read)';
    try {
      if (response.body) {
        if (typeof response.body === 'object') {
          debugBody = JSON.stringify(response.body);
        } else {
          const str = response.body.toString();
          debugBody = str.substring(0, 2000) + (str.length > 2000 ? '... (truncated)' : '');
        }
      }
    } catch(e) {
      debugBody = 'Error reading body: ' + (e.message || e);
    }
    console.error('[openid-client] Non-200 response from token endpoint:', response.statusCode, response.statusMessage);
    console.error('[openid-client] Response body:', debugBody);
    console.error('[openid-client] Response headers:', JSON.stringify(response.headers));
`;

const searchStr = `throw new OPError(
      {
        error: format(
          'expected %i %s, got: %i %s',`;

const replacement = patchInsertion + `
    throw new OPError(
      {
        error: format(
          'expected %i %s, got: %i %s',`;

if (!content.includes(searchStr)) {
  console.log('[patch] Could not find insertion point in process_response.js');
  console.log('[patch] File content preview:', content.substring(0, 500));
  process.exit(0);
}

content = content.replace(searchStr, replacement);
fs.writeFileSync(targetFile, content, 'utf8');
console.log('[patch] Successfully patched openid-client process_response.js with debug logging');
