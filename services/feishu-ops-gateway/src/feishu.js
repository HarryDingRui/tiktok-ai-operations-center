const FEISHU_BASE_URL = 'https://open.feishu.cn/open-apis';

function providerError(prefix, payload, status) {
  const detail = payload && (payload.msg || payload.message || payload.error);
  return new Error(`${prefix}${detail ? `：${detail}` : status ? `（HTTP ${status}）` : ''}`);
}

function createFeishuClient({ config, fetchImpl = fetch, now = () => Date.now() }) {
  let cachedToken = '';
  let tokenExpiresAt = 0;

  function assertConfigured() {
    if (!config || !config.appId || !config.appSecret || !config.receiveId) {
      throw new Error('飞书应用配置不完整：需要 App ID、App Secret 和接收目标');
    }
  }

  async function getTenantAccessToken() {
    assertConfigured();
    if (cachedToken && tokenExpiresAt > now() + 60_000) return cachedToken;
    const response = await fetchImpl(`${FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ app_id: config.appId, app_secret: config.appSecret }),
    });
    const payload = await response.json();
    if (!response.ok || payload.code !== 0 || !payload.tenant_access_token) throw providerError('飞书鉴权失败', payload, response.status);
    cachedToken = payload.tenant_access_token;
    tokenExpiresAt = now() + Math.max(0, Number(payload.expire || 7200) - 120) * 1000;
    return cachedToken;
  }

  async function sendCard(card) {
    const token = await getTenantAccessToken();
    const type = encodeURIComponent(config.receiveIdType || 'chat_id');
    const response = await fetchImpl(`${FEISHU_BASE_URL}/im/v1/messages?receive_id_type=${type}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ receive_id: config.receiveId, msg_type: 'interactive', content: JSON.stringify(card) }),
    });
    const payload = await response.json();
    if (!response.ok || payload.code !== 0) throw providerError('飞书消息发送失败', payload, response.status);
    return { messageId: payload.data && payload.data.message_id ? payload.data.message_id : '', raw: payload };
  }

  return { getTenantAccessToken, sendCard };
}

module.exports = { createFeishuClient };
