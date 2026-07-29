const net = require('net');
const HOST = 'db.arxxskchdxswntqkdspy.supabase.co';
const PORT = 5432;

const proxy = net.createServer((client) => {
  const target = net.createConnection({ host: HOST, port: PORT }, () => {
    console.error('[proxy] connection established');
    client.pipe(target);
    target.pipe(client);
  });
  target.on('error', (err) => { console.error('[proxy] target error:', err.code, err.message); client.destroy(); });
  client.on('error', (err) => { console.error('[proxy] client error:', err.code, err.message); });
  client.on('close', () => { if (!target.destroyed) target.destroy(); });
  target.on('close', () => { if (!client.destroyed) client.destroy(); });
});

proxy.listen(5555, '127.0.0.1', () => {
  console.log('ready');
});
