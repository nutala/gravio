var https = require('https');
https.get('https://gravio.onrender.com/sw.js', function(r) {
  var d = '';
  r.on('data', function(c) { d += c; });
  r.on('end', function() {
    // Print lines 1-5
    var lines = d.split('\n');
    for (var i = 0; i < 5 && i < lines.length; i++) {
      console.log((i+1) + ': ' + lines[i]);
    }
  });
});
