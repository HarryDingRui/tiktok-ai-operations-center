const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createAuditStore } = require('../src/audit-store');
const { createApp } = require('../src/app');

function config(overrides = {}) {
  return {
    gatewayToken: 'gateway-token', allowedOrigins: ['https://harrydingrui.github.io'],
    feishu: { configured: false, verificationToken: 'verify-token' },
    doubao: { configured: false, model: '' },
    publicStatus: { mode: 'read_only_approval', feishu: { configured: false }, doubao: { configured: false, model: '' } },
    ...overrides,
  };
}

async function json(response) { return response.json(); }

test('health is public but integration status requires bearer authorization', async () => {
  const records = [];
  const app = createApp({ config: config(), auditStore: { count: async () => records.length, isWritable: async () => true, append: async (record) => records.push(record) } });
  const health = await app.handle(new Request('http://localhost/health'));
  assert.equal(health.status, 200);
  assert.equal((await json(health)).mode, 'read_only_approval');

  const unauthorized = await app.handle(new Request('http://localhost/api/v1/integrations/status'));
  assert.equal(unauthorized.status, 401);

  const status = await app.handle(new Request('http://localhost/api/v1/integrations/status', { headers: { Authorization: 'Bearer gateway-token' } }));
  assert.equal(status.status, 200);
  const payload = await json(status);
  assert.equal(payload.mode, 'read_only_approval');
  assert.deepEqual(payload.audit, { writable: true, recordCount: 0 });
  assert.equal(JSON.stringify(payload).includes('gateway-token'), false);
});

test('provider tests fail truthfully when credentials are absent', async () => {
  const app = createApp({ config: config(), auditStore: { count: async () => 0, isWritable: async () => true, append: async () => {} } });
  const response = await app.handle(new Request('http://localhost/api/v1/integrations/feishu/test', {
    method: 'POST', headers: { Authorization: 'Bearer gateway-token', 'Content-Type': 'application/json' }, body: '{}',
  }));
  assert.equal(response.status, 409);
  assert.match((await json(response)).error, /飞书应用配置不完整/);
});

test('Feishu URL verification and approval callback write append-only audit records', async () => {
  const records = [];
  const app = createApp({
    config: config(),
    auditStore: { count: async () => records.length, isWritable: async () => true, append: async (record) => records.push(record) },
    now: () => '2026-09-18T10:00:00.000Z',
  });
  const challenge = await app.handle(new Request('http://localhost/api/v1/integrations/feishu/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'url_verification', token: 'verify-token', challenge: 'challenge-value' }),
  }));
  assert.equal(challenge.status, 200);
  assert.deepEqual(await json(challenge), { challenge: 'challenge-value' });

  const approval = await app.handle(new Request('http://localhost/api/v1/integrations/feishu/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'verify-token', open_id: 'ou_operator', action: { value: { action: 'approve', recommendation_id: 'rec_1' } } }),
  }));
  assert.equal(approval.status, 200);
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {
    type: 'recommendation_approval', recommendationId: 'rec_1', decision: 'approved', operatorId: 'ou_operator', createdAt: '2026-09-18T10:00:00.000Z',
  });
  assert.match(JSON.stringify(await json(approval)), /已记录采纳/);
});

test('gateway exposes no TikTok mutation route', async () => {
  const app = createApp({ config: config(), auditStore: { count: async () => 0, isWritable: async () => true, append: async () => {} } });
  const response = await app.handle(new Request('http://localhost/api/v1/tiktok/ads/budget', {
    method: 'POST', headers: { Authorization: 'Bearer gateway-token' },
  }));
  assert.equal(response.status, 404);
});

test('analysis creates a pending recommendation and sends it for human approval only', async () => {
  const records = [];
  const cards = [];
  const app = createApp({
    config: config({
      feishu: { configured: true, verificationToken: 'verify-token' },
      doubao: { configured: true, model: 'doubao-model' },
      publicStatus: { mode: 'read_only_approval', feishu: { configured: true }, doubao: { configured: true, model: 'doubao-model' } },
    }),
    auditStore: { count: async () => records.length, isWritable: async () => true, append: async (record) => records.push(record) },
    doubaoClient: { respond: async () => ({ id: 'resp_1', text: JSON.stringify({ title: '商品转化异常', summary: '成交下降', evidence: ['商品 ID 173'], action: '人工复核详情页', risk: 'medium', confidence: 0.8, missingData: [] }) }) },
    feishuClient: { sendCard: async (card) => { cards.push(card); return { messageId: 'om_1' }; } },
    now: () => '2026-09-18T10:00:00.000Z',
  });
  const response = await app.handle(new Request('http://localhost/api/v1/recommendations/analyze', {
    method: 'POST',
    headers: { Authorization: 'Bearer gateway-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ store: 'INSPIRE PURIFY', dateRange: { start: '2026-09-01', end: '2026-09-14' }, summary: { productId: '173', orders: { first: 15, last: 0 } } }),
  }));
  assert.equal(response.status, 200);
  const payload = await json(response);
  assert.equal(payload.recommendation.status, 'pending_approval');
  assert.equal(payload.feishu.sent, true);
  assert.equal(cards.length, 1);
  assert.equal(records.filter((record) => record.type === 'recommendation_created').length, 1);
  assert.equal(records.filter((record) => record.type === 'recommendation_sent').length, 1);
  assert.equal(records.some((record) => /tiktok_mutation/i.test(record.type)), false);
});

test('file audit store appends JSON lines and reports count', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'feishu-ops-audit-'));
  const filePath = path.join(directory, 'audit.jsonl');
  const store = createAuditStore(filePath);
  assert.equal(await store.isWritable(), true);
  await store.append({ type: 'test', value: 1 });
  await store.append({ type: 'test', value: 2 });
  assert.equal(await store.count(), 2);
  const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  assert.deepEqual(lines.map((item) => item.value), [1, 2]);
});
