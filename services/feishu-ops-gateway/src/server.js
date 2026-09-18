const http = require('node:http');
const { loadConfig } = require('./config');
const { createAuditStore } = require('./audit-store');
const { createApp } = require('./app');

const config = loadConfig();
const app = createApp({ config, auditStore: createAuditStore(config.auditLogPath) });

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
    if (!['GET', 'HEAD'].includes(method)) init.body = Buffer.concat(chunks).toString('utf8');
    const webResponse = await app.handle(new Request(`http://${request.headers.host || 'localhost'}${request.url || '/'}`, init));
    response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()));
    response.end(Buffer.from(await webResponse.arrayBuffer()));
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: error.message || '内部服务错误' }));
  }
});

server.listen(config.port, () => {
  console.log(`feishu-ops-gateway listening on http://127.0.0.1:${config.port}`);
  console.log('mode=read_only_approval');
});
