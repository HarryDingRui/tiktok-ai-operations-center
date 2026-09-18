const path = require('node:path');

function text(value) { return String(value || '').trim(); }

function loadConfig(env = process.env) {
  const feishu = {
    appId: text(env.FEISHU_APP_ID),
    appSecret: text(env.FEISHU_APP_SECRET),
    receiveId: text(env.FEISHU_RECEIVE_ID),
    receiveIdType: text(env.FEISHU_RECEIVE_ID_TYPE) || 'chat_id',
    verificationToken: text(env.FEISHU_VERIFICATION_TOKEN),
  };
  feishu.configured = Boolean(feishu.appId && feishu.appSecret && feishu.receiveId);

  const doubao = {
    apiKey: text(env.ARK_API_KEY),
    model: text(env.ARK_MODEL),
    baseUrl: (text(env.ARK_BASE_URL) || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/+$/, ''),
  };
  doubao.configured = Boolean(doubao.apiKey && doubao.model);

  const config = {
    port: Number(env.PORT) || 8788,
    gatewayToken: text(env.OPS_GATEWAY_TOKEN),
    allowedOrigins: text(env.ALLOWED_ORIGINS).split(',').map((value) => value.trim()).filter(Boolean),
    auditLogPath: path.resolve(text(env.AUDIT_LOG_PATH) || path.join(process.cwd(), 'data', 'audit-log.jsonl')),
    feishu,
    doubao,
  };
  config.publicStatus = {
    mode: 'read_only_approval',
    feishu: { configured: feishu.configured },
    doubao: { configured: doubao.configured, model: doubao.model || '' },
  };
  return config;
}

module.exports = { loadConfig };
