const http = require('http');
const https = require('https');

const PORT = 8085;

const server = http.createServer((req, res) => {
  // 1. Set CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 2. Parse Query Parameters
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const targetUrl = reqUrl.searchParams.get('url');
  const targetUa = reqUrl.searchParams.get('ua');

  if (!targetUrl) {
    res.writeHead(400);
    res.end('Missing required query parameter: url');
    return;
  }

  console.log(`\n[${new Date().toLocaleTimeString()}] 🛰️ Proxying request for: ${targetUrl.substring(0, 60)}...`);
  if (targetUa) {
    console.log(`[Spoofing UA] ${targetUa.substring(0, 60)}...`);
  }

  try {
    const target = new URL(targetUrl);
    const options = {
      hostname: target.hostname,
      path: target.pathname + target.search,
      method: 'GET',
      headers: {
        'User-Agent': targetUa || 'CTV-Simulator-Proxy/1.0',
        'Accept': 'application/xml'
      }
    };

    const proxyReq = https.request(options, (proxyRes) => {
      console.log(`[Response] Status: ${proxyRes.statusCode}`);
      
      // Forward status and content-type
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/xml',
        'Access-Control-Allow-Origin': '*' // Re-ensure CORS for response
      });
      
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      console.error(`[Error] ${e.message}`);
      res.writeHead(500);
      res.end('Proxy Error: ' + e.message);
    });

    proxyReq.end();
  } catch (e) {
    console.error(`[Invalid URL] ${targetUrl}`);
    res.writeHead(400);
    res.end('Invalid target URL: ' + e.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n=========================================`);
  console.log(`🛰️  Zero-Dependency VAST Proxy Running`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Url : http://localhost:${PORT}/?url=...&ua=...`);
  console.log(`=========================================\n`);
});
