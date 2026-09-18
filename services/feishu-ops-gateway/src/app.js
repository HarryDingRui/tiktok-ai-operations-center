const { createFeishuClient } = require('./feishu');
const { createDoubaoClient } = require('./doubao');
const { buildRecommendationCard, normalizeRecommendation, parseRecommendationText } = require('./recommendations');

const MAX_BODY_BYTES = 512 * 1024;

function createApp(dependencies) {
  const config = dependencies.config;
  const auditStore = dependencies.auditStore;
  const now = dependencies.now || (() => new Date().toISOString());
  const feishuClient = dependencies.feishuClient || createFeishuClient({ config: config.feishu });
  const doubaoClient = dependencies.doubaoClient || createDoubaoClient({ config: config.doubao });

  function corsHeaders(request) {
    const origin = request.headers.get('origin') || '';
    if (!origin || !config.allowedOrigins.includes(origin)) return {};
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      Vary: 'Origin',
    };
  }

  function response(request, body, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...corsHeaders(request) },
    });
  }

  async function readJson(request) {
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > MAX_BODY_BYTES) throw Object.assign(new Error('请求体超过 512 KB 限制'), { status: 413 });
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) throw Object.assign(new Error('请求体超过 512 KB 限制'), { status: 413 });
    if (!raw) return {};
    try { return JSON.parse(raw); } catch (error) { throw Object.assign(new Error('请求体不是有效 JSON'), { status: 400 }); }
  }

  function authorize(request) {
    if (!config.gatewayToken) return { status: 503, error: '网关未配置 OPS_GATEWAY_TOKEN' };
    if (request.headers.get('authorization') !== `Bearer ${config.gatewayToken}`) return { status: 401, error: '未授权访问内部运营网关' };
    return null;
  }

  function testCard() {
    return {
      config: { wide_screen_mode: true },
      header: { template: 'blue', title: { tag: 'plain_text', content: 'TikTok AI 运营中心 · 连接测试' } },
      elements: [
        { tag: 'div', text: { tag: 'lark_md', content: '**飞书内部应用连接成功。**\n当前运行模式：只读分析 + 人工审批。' } },
        { tag: 'note', elements: [{ tag: 'plain_text', content: '此测试不会修改 TikTok 店铺、广告或商品。' }] },
      ],
    };
  }

  function operatorId(body) {
    return String(body.open_id || body.operator?.open_id || body.event?.operator?.operator_id?.open_id || body.event?.operator?.operator_id?.user_id || '').trim();
  }

  function actionValue(body) {
    return body.action?.value || body.event?.action?.value || {};
  }

  async function handleFeishuEvent(request) {
    const body = await readJson(request);
    if (!config.feishu.verificationToken) return response(request, { error: '飞书回调验证令牌未配置' }, 503);
    const token = body.token || (body.header && body.header.token) || '';
    if (token !== config.feishu.verificationToken) return response(request, { error: '飞书回调验证失败' }, 401);
    if (body.type === 'url_verification') return response(request, { challenge: body.challenge || '' });

    const value = actionValue(body);
    if (!['approve', 'reject'].includes(value.action) || !value.recommendation_id) {
      return response(request, { error: '不支持的飞书审批动作' }, 400);
    }
    const decision = value.action === 'approve' ? 'approved' : 'rejected';
    await auditStore.append({
      type: 'recommendation_approval', recommendationId: String(value.recommendation_id), decision,
      operatorId: operatorId(body), createdAt: now(),
    });
    return response(request, { toast: { type: 'success', content: decision === 'approved' ? '已记录采纳，等待人工执行' : '已记录驳回' } });
  }

  async function handleAnalyze(request) {
    if (!config.doubao.configured) return response(request, { error: '豆包配置不完整：需要 ARK_API_KEY 和 ARK_MODEL' }, 409);
    const body = await readJson(request);
    if (!body.store || !body.dateRange || !body.summary) return response(request, { error: '分析请求需要 store、dateRange 和 summary' }, 400);
    const prompt = [
      '你是公司内部 TikTok Shop 运营分析助手。只分析给定真实汇总，不补造数据，不执行任何店铺动作。',
      '只返回一个 JSON 对象，字段为 title、summary、evidence(string[])、action、risk(low|medium|high)、confidence(0-1)、missingData(string[])。',
      `经营汇总：${JSON.stringify({ store: body.store, dateRange: body.dateRange, summary: body.summary })}`,
    ].join('\n');
    const modelResult = await doubaoClient.respond(prompt);
    const recommendation = normalizeRecommendation(parseRecommendationText(modelResult.text), {
      store: body.store, dateRange: body.dateRange, createdAt: now(),
    });
    await auditStore.append({ type: 'recommendation_created', recommendation, modelResponseId: modelResult.id, createdAt: now() });
    let feishu = { sent: false };
    if (body.sendToFeishu !== false) {
      if (!config.feishu.configured) return response(request, { error: '建议已生成，但飞书应用未配置，未发送审批卡片', recommendation }, 409);
      const sent = await feishuClient.sendCard(buildRecommendationCard(recommendation));
      feishu = { sent: true, messageId: sent.messageId };
      await auditStore.append({ type: 'recommendation_sent', recommendationId: recommendation.id, messageId: sent.messageId, createdAt: now() });
    }
    return response(request, { recommendation, feishu });
  }

  async function handle(request) {
    try {
      const url = new URL(request.url);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
      if (request.method === 'GET' && url.pathname === '/health') {
        return response(request, { ok: true, service: 'feishu-ops-gateway', mode: 'read_only_approval' });
      }
      if (request.method === 'POST' && url.pathname === '/api/v1/integrations/feishu/events') return handleFeishuEvent(request);

      const authError = authorize(request);
      if (authError) return response(request, { error: authError.error }, authError.status);

      if (request.method === 'GET' && url.pathname === '/api/v1/integrations/status') {
        return response(request, { ...config.publicStatus, audit: { writable: await auditStore.isWritable(), recordCount: await auditStore.count() } });
      }
      if (request.method === 'POST' && url.pathname === '/api/v1/integrations/feishu/test') {
        if (!config.feishu.configured) return response(request, { error: '飞书应用配置不完整：需要 App ID、App Secret 和接收目标' }, 409);
        const result = await feishuClient.sendCard(testCard());
        await auditStore.append({ type: 'feishu_connection_test', messageId: result.messageId, createdAt: now() });
        return response(request, { ok: true, messageId: result.messageId });
      }
      if (request.method === 'POST' && url.pathname === '/api/v1/integrations/doubao/test') {
        if (!config.doubao.configured) return response(request, { error: '豆包配置不完整：需要 ARK_API_KEY 和 ARK_MODEL' }, 409);
        const result = await doubaoClient.respond('只回复：豆包内部运营分析服务连接成功。');
        await auditStore.append({ type: 'doubao_connection_test', responseId: result.id, createdAt: now() });
        return response(request, { ok: true, responseId: result.id, text: result.text });
      }
      if (request.method === 'POST' && url.pathname === '/api/v1/recommendations/analyze') return handleAnalyze(request);
      return response(request, { error: '接口不存在' }, 404);
    } catch (error) {
      return response(request, { error: error.message || '内部服务错误' }, error.status || 500);
    }
  }

  return { handle };
}

module.exports = { createApp };
