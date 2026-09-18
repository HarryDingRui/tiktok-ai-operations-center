(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FEISHU_OPS_INTEGRATION = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function normalizeGatewayUrl(value) {
    const candidate = String(value || '').trim().replace(/\/+$/, '');
    if (!candidate) return '';
    try {
      const parsed = new URL(candidate);
      return /^https?:$/.test(parsed.protocol) ? parsed.toString().replace(/\/+$/, '') : '';
    } catch (error) {
      return '';
    }
  }

  function statusItem(label, detail, tone) {
    return { label, detail, tone };
  }

  function deriveIntegrationView(status, hasEndpoint) {
    const mode = statusItem('只读 + 人工审批', '不会自动操作 TikTok 店铺', 'safe');
    if (!hasEndpoint) {
      return {
        level: 'unconfigured', label: '待配置后端', detail: '请配置公司内部网关地址',
        feishu: statusItem('待配置', 'App ID 与密钥仅保存在后端', 'muted'),
        doubao: statusItem('待配置', 'ARK API Key 仅保存在后端', 'muted'),
        mode, audit: statusItem('待连接', '连接网关后读取审计状态', 'muted'),
      };
    }
    if (status && status.error) {
      return {
        level: 'error', label: '连接异常', detail: status.error,
        feishu: statusItem('未知', '未能读取网关状态', 'danger'),
        doubao: statusItem('未知', '未能读取网关状态', 'danger'),
        mode, audit: statusItem('未知', '未能读取网关状态', 'danger'),
      };
    }
    const feishuReady = Boolean(status && status.feishu && status.feishu.configured);
    const doubaoReady = Boolean(status && status.doubao && status.doubao.configured);
    const auditWritable = Boolean(status && status.audit && status.audit.writable);
    const count = Number(status && status.audit && status.audit.recordCount) || 0;
    const ready = feishuReady && doubaoReady && auditWritable;
    return {
      level: ready ? 'ready' : 'partial',
      label: ready ? '只读审批已就绪' : '部分就绪',
      detail: ready ? '可以生成建议并发送飞书人工审批' : '仍有服务需要配置',
      feishu: statusItem(feishuReady ? '已配置' : '待配置', feishuReady ? '可发送内部审批卡片' : '缺少飞书应用或接收目标', feishuReady ? 'success' : 'warning'),
      doubao: statusItem(doubaoReady ? '已配置' : '待配置', doubaoReady ? `模型：${status.doubao.model || '已配置'}` : '缺少 ARK_API_KEY 或模型标识', doubaoReady ? 'success' : 'warning'),
      mode,
      audit: statusItem(auditWritable ? '可写入' : '不可写入', auditWritable ? `已记录 ${count} 条` : '检查审计目录权限', auditWritable ? 'success' : 'danger'),
    };
  }

  function createGatewayClient(options) {
    const settings = options || {};
    const baseUrl = normalizeGatewayUrl(settings.baseUrl);
    const fetchImpl = settings.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (!baseUrl) throw new Error('请先填写有效的网关地址');
    if (!fetchImpl) throw new Error('当前环境不支持网络请求');

    async function request(path, init) {
      const headers = { Accept: 'application/json', ...(init && init.body ? { 'Content-Type': 'application/json' } : {}) };
      if (settings.token) headers.Authorization = `Bearer ${settings.token}`;
      const response = await fetchImpl(`${baseUrl}${path}`, { method: 'GET', ...init, headers: { ...headers, ...(init && init.headers) } });
      let payload;
      try { payload = await response.json(); } catch (error) { payload = {}; }
      if (!response.ok) throw new Error(payload.error || `网关请求失败（HTTP ${response.status}）`);
      return payload;
    }

    return {
      getStatus: () => request('/api/v1/integrations/status'),
      testFeishu: () => request('/api/v1/integrations/feishu/test', { method: 'POST', body: '{}' }),
      testDoubao: () => request('/api/v1/integrations/doubao/test', { method: 'POST', body: '{}' }),
      analyze: (snapshot) => request('/api/v1/recommendations/analyze', { method: 'POST', body: JSON.stringify(snapshot || {}) }),
    };
  }

  function initializeBrowser() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const root = document.getElementById('feishu-ops-integration');
    if (!root) return;
    const endpointKey = 'tiktok-feishu-gateway-url-v1';
    const tokenKey = 'tiktok-feishu-gateway-token-v1';
    const urlInput = document.getElementById('feishu-gateway-url');
    const tokenInput = document.getElementById('feishu-gateway-token');
    const result = document.getElementById('feishu-integration-result');
    const actions = ['feishu-save-config', 'feishu-check-status', 'feishu-test-message', 'doubao-test-connection']
      .map((id) => document.getElementById(id)).filter(Boolean);

    urlInput.value = window.localStorage.getItem(endpointKey) || '';
    tokenInput.value = window.sessionStorage.getItem(tokenKey) || '';

    function setFeedback(message, tone) {
      result.textContent = message;
      result.dataset.tone = tone || '';
    }

    function setBusy(busy) { actions.forEach((button) => { button.disabled = busy; }); }

    function render(view) {
      const overall = document.getElementById('feishu-overall-status');
      overall.textContent = view.label;
      overall.dataset.level = view.level;
      [['feishu-app', view.feishu], ['doubao-service', view.doubao], ['feishu-mode', view.mode], ['feishu-audit', view.audit]].forEach(([prefix, item]) => {
        document.getElementById(`${prefix}-value`).textContent = item.label;
        document.getElementById(`${prefix}-detail`).textContent = item.detail;
        document.getElementById(`${prefix}-dot`).dataset.tone = item.tone || '';
      });
    }

    function savedSettings() {
      const baseUrl = normalizeGatewayUrl(urlInput.value);
      const token = tokenInput.value.trim();
      if (baseUrl) window.localStorage.setItem(endpointKey, baseUrl);
      else window.localStorage.removeItem(endpointKey);
      if (token) window.sessionStorage.setItem(tokenKey, token);
      else window.sessionStorage.removeItem(tokenKey);
      urlInput.value = baseUrl;
      return { baseUrl, token };
    }

    function clientFromForm() {
      const settings = savedSettings();
      if (!settings.token) throw new Error('请输入本次会话访问令牌');
      return createGatewayClient(settings);
    }

    async function run(label, operation, successMessage) {
      setBusy(true);
      setFeedback(`${label}…`, 'working');
      try {
        const payload = await operation();
        setFeedback(typeof successMessage === 'function' ? successMessage(payload) : successMessage, 'success');
        return payload;
      } catch (error) {
        render(deriveIntegrationView({ error: error.message }, Boolean(normalizeGatewayUrl(urlInput.value))));
        setFeedback(error.message, 'error');
        return null;
      } finally {
        setBusy(false);
      }
    }

    document.getElementById('feishu-save-config').addEventListener('click', () => {
      const settings = savedSettings();
      render(deriveIntegrationView(null, Boolean(settings.baseUrl)));
      setFeedback(settings.baseUrl ? '本机配置已保存。访问令牌只保留到本次浏览器会话结束。' : '网关地址无效，请填写完整的 http:// 或 https:// 地址。', settings.baseUrl ? 'success' : 'error');
    });
    document.getElementById('feishu-check-status').addEventListener('click', async () => {
      const payload = await run('正在读取真实连接状态', () => clientFromForm().getStatus(), '已读取内部网关真实状态。');
      if (payload) render(deriveIntegrationView(payload, true));
    });
    document.getElementById('feishu-test-message').addEventListener('click', () => run(
      '正在发送飞书测试卡片', () => clientFromForm().testFeishu(),
      (payload) => `飞书测试卡片已发送${payload.messageId ? ` · Message ID ${payload.messageId}` : ''}。`,
    ));
    document.getElementById('doubao-test-connection').addEventListener('click', () => run(
      '正在调用豆包真实接口', () => clientFromForm().testDoubao(),
      (payload) => `豆包连接成功${payload.responseId ? ` · Response ID ${payload.responseId}` : ''}。`,
    ));

    const hasEndpoint = Boolean(normalizeGatewayUrl(urlInput.value));
    render(deriveIntegrationView(null, hasEndpoint));
    if (hasEndpoint && tokenInput.value) {
      run('正在读取真实连接状态', () => clientFromForm().getStatus(), '已读取内部网关真实状态。').then((payload) => {
        if (payload) render(deriveIntegrationView(payload, true));
      });
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeBrowser, { once: true });
    else initializeBrowser();
  }

  return { normalizeGatewayUrl, deriveIntegrationView, createGatewayClient, initializeBrowser };
});
