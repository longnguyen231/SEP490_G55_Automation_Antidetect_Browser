const http = require('http');

http.get('http://127.0.0.1:4000/api/profiles', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const profiles = JSON.parse(data);
    if (profiles.length === 0) {
      console.log("No profiles found");
      return;
    }
    const p = profiles[0];
    console.log("Found profile:", p.id, p.name);
    
    // Launch with UI
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/browsers/' + p.id + '/launch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res2) => {
      let d = '';
      res2.on('data', chunk => d += chunk);
      res2.on('end', () => {
        console.log("Launch response UI:", d);
        setTimeout(() => process.exit(0), 1000);
      });
    });
    
    req.write(JSON.stringify({ headless: false }));
    req.end();
  });
});
