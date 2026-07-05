var https = require('https');
https.get('https://gravio.onrender.com/sw.js', function(r) {
  var d = '';
  r.on('data', function(c) { d += c; });
  r.on('end', function() {
    console.log('Has BUILD_ID:', d.indexOf('BUILD_ID') >= 0);
    var m = d.match(/STATIC_CACHE\s*=\s*"([^"]+)"/);
    console.log('STATIC_CACHE:', m ? m[1] : 'not found');
  });
});
