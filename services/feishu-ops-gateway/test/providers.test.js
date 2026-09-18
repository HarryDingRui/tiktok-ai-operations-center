const test = require('node:test');
const assert = require('node:assert/strict');

const { loadConfig } = require('../src/config');
const { createFeishuClient } = require('../src/feishu');
const { createDoubaoClient } = require('../src/doubao');
const { normalizeRecommendation, buildRecommendationCard } = require('../src/recommendations');

test('loadConfig reports provider readiness without exposing secrets', () => {
  const config = loadConfig({
    OPS_GATEWAY_TOKEN: 'gateway-secret', FEISHU_APP_ID: 'cli_a', FEISHU_APP_SECRET: 'secret',
    FEISHU_RECEIVE_ID: 'oc_chat', ARK_API_KEY: 'ark-secret', ARK_MODEL: 'doubao-model',
  });
  assert.equal(config.feishu.configured, true);
  assert.equal(config.doubao.configured, true);
  assert.equal(JSON.stringify(config.publicStatus).includes('gateway-secret'), false);
  assert.equal(JSON.stringify(config.publicStatus).includes('ark-secret'), false);
});

test('Feishu client rejects incomplete configuration', async () => {
  const client = createFeishuClient({ config: { appId: '', appSecret: '', receiveId: '' }, fetchImpl: async () => ({}) });
  await assert.rejects(() => client.sendCard({}), /飞书应用配置不完整/);
});

test('Feishu client exchanges tenant token and sends an interactive card', async () => {
  const calls = [];
  const client = createFeishuClient({
    config: { appId: 'cli_a', appSecret: 'secret', receiveId: 'oc_chat', receiveIdType: 'chat_id' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.includes('tenant_access_token')) return { ok: true, json: async () => ({ code: 0, tenant_access_token: 'tenant-token', expire: 7200 }) };
      return { ok: true, json: async () => ({ code: 0, data: { message_id: 'om_123' } }) };
    },
  });
  const result = await client.sendCard({ header: { title: { tag: 'plain_text', content: '测试' } }, elements: [] });
  assert.equal(result.messageId, 'om_123');
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /receive_id_type=chat_id/);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer tenant-token');
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.receive_id, 'oc_chat');
  assert.equal(body.msg_type, 'interactive');
  assert.equal(JSON.parse(body.content).header.title.content, '测试');
});

test('Doubao client calls Responses API and extracts output text', async () => {
  const calls = [];
  const client = createDoubaoClient({
    config: { apiKey: 'ark-key', model: 'doubao-model', baseUrl: 'https://ark.example/api/v3' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => ({ id: 'resp_1', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"title":"测试建议"}' }] }] }),
      };
    },
  });
  const result = await client.respond('只输出 JSON');
  assert.equal(result.text, '{"title":"测试建议"}');
  assert.equal(calls[0].url, 'https://ark.example/api/v3/responses');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer ark-key');
  assert.equal(JSON.parse(calls[0].options.body).model, 'doubao-model');
});

test('recommendation normalization preserves evidence and enforces read-only status', () => {
  const recommendation = normalizeRecommendation({
    title: '商品转化异常', summary: '曝光稳定但成交下降', evidence: ['商品 ID 173', '成交 15 → 0'],
    action: '人工复核价格与评价', risk: 'high', confidence: 0.82, missingData: ['库存'], status: 'executed',
  }, { store: 'INSPIRE PURIFY', dateRange: { start: '2026-09-01', end: '2026-09-14' }, id: 'rec_test' });
  assert.equal(recommendation.id, 'rec_test');
  assert.equal(recommendation.status, 'pending_approval');
  assert.deepEqual(recommendation.evidence, ['商品 ID 173', '成交 15 → 0']);
  assert.equal(recommendation.confidence, 0.82);

  const card = buildRecommendationCard(recommendation);
  const serialized = JSON.stringify(card);
  assert.match(serialized, /商品转化异常/);
  assert.match(serialized, /商品 ID 173/);
  assert.match(serialized, /采纳建议/);
  assert.match(serialized, /驳回/);
  assert.doesNotMatch(serialized, /自动执行/);
});
