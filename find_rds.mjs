import tls from 'tls';
const socket = tls.connect({
  host: 'db.arxxskchdxswntqkdspy.supabase.co',
  port: 5432,
  rejectUnauthorized: false,
}, () => {
  const cert = socket.getPeerCertificate();
  console.log('Subject:', cert.subject);
  console.log('Issuer:', cert.issuer);
  console.log('SAN:', cert.subjectaltname);
  console.log('Valid from:', cert.valid_from);
  console.log('Valid to:', cert.valid_to);
  console.log('Fingerprint:', cert.fingerprint);
  // Also check DNS entries in cert
  if (cert.subjectaltname) {
    const dnsEntries = cert.subjectaltname
      .split(', ')
      .filter(e => e.startsWith('DNS:'))
      .map(e => e.slice(4));
    console.log('DNS names in cert:', dnsEntries);
  }
  socket.end();
});
socket.on('error', (e) => console.error('Error:', e.message));
