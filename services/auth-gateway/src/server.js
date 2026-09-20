const http = require('node:http');

const { loadConfig, loadAuthConfig } = require('./config');
const { createAuthApp } = require('./app');

const config = loadConfig();
const authConfig = loadAuthConfig(config.authConfigFile);
const app = createAuthApp({
  config,
  authConfig,
  audit: (event) => console.info(JSON.stringify({ service: 'auth-gateway', at: new Date().toISOString(), ...event })),
});

const server = http.createServer(async (request, response) => {
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 512 * 1024) {
        response.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: '请求体超过 512 KB 限制' }));
        return;
      }
      chunks.push(chunk);
    }

    const method = request.method || 'GET';
    const init = { method, headers: request.headers };
    if (!['GET', 'HEAD'].includes(method)) init.body = Buffer.concat(chunks);
    const url = `http://${request.headers.host || 'localhost'}${request.url || '/'}`;
    const webResponse = await app.handle(new Request(url, init));
    response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()));
    response.end(Buffer.from(await webResponse.arrayBuffer()));
  } catch (error) {
    console.error(`auth request failed: ${error.message}`);
    response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ error: '认证服务内部错误' }));
  }
});

server.listen(config.port, '0.0.0.0', () => {
  console.log(`auth-gateway listening on http://127.0.0.1:${config.port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
