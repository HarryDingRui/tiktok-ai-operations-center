const assert = require('assert');
const integration = require('../data/feishu-integration.js');

assert.strictEqual(integration.normalizeGatewayUrl(' https://gateway.example.com/// '), 'https://gateway.example.com');
assert.strictEqual(integration.normalizeGatewayUrl('javascript:alert(1)'), '');
assert.strictEqual(integration.normalizeGatewayUrl('ftp://example.com'), '');

const unconfigured = integration.deriveIntegrationView(null, false);
assert.strictEqual(unconfigured.level, 'unconfigured');
assert.strictEqual(unconfigured.label, '待配置后端');
assert.strictEqual(unconfigured.feishu.label, '待配置');
assert.strictEqual(unconfigured.doubao.label, '待配置');

const partial = integration.deriveIntegrationView({
  mode: 'read_only_approval',
  feishu: { configured: true },
  doubao: { configured: false, model: '' },
  audit: { writable: true, recordCount: 3 },
}, true);
assert.strictEqual(partial.level, 'partial');
assert.strictEqual(partial.label, '部分就绪');
assert.strictEqual(partial.feishu.label, '已配置');
assert.strictEqual(partial.doubao.label, '待配置');
assert.strictEqual(partial.audit.detail, '已记录 3 条');

const ready = integration.deriveIntegrationView({
  mode: 'read_only_approval',
  feishu: { configured: true },
  doubao: { configured: true, model: 'doubao-test' },
  audit: { writable: true, recordCount: 0 },
}, true);
assert.strictEqual(ready.level, 'ready');
assert.strictEqual(ready.label, '只读审批已就绪');
assert.strictEqual(ready.mode.label, '只读 + 人工审批');

const failure = integration.deriveIntegrationView({ error: '连接超时' }, true);
assert.strictEqual(failure.level, 'error');
assert.strictEqual(failure.label, '连接异常');
assert.strictEqual(failure.detail, '连接超时');

const calls = [];
const client = integration.createGatewayClient({
  baseUrl: 'https://gateway.example.com/',
  token: 'session-token',
  fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ ok: true }) };
  },
});

(async () => {
  await client.getStatus();
  await client.testFeishu();
  assert.strictEqual(calls[0].url, 'https://gateway.example.com/api/v1/integrations/status');
  assert.strictEqual(calls[0].options.headers.Authorization, 'Bearer session-token');
  assert.strictEqual(calls[1].options.method, 'POST');

  const failingClient = integration.createGatewayClient({
    baseUrl: 'https://gateway.example.com',
    token: 'session-token',
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ error: '飞书未配置' }) }),
  });
  await assert.rejects(() => failingClient.testFeishu(), /飞书未配置/);

  assert.throws(() => integration.createGatewayClient({ baseUrl: '', fetchImpl: async () => ({}) }), /网关地址/);
  console.log('feishu integration tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
