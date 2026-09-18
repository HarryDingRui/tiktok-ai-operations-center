function extractOutputText(payload) {
  for (const item of payload && Array.isArray(payload.output) ? payload.output : []) {
    if (item.type !== 'message') continue;
    for (const part of Array.isArray(item.content) ? item.content : []) {
      if (part.type === 'output_text' && typeof part.text === 'string') return part.text;
    }
  }
  if (typeof payload.output_text === 'string') return payload.output_text;
  return '';
}

function createDoubaoClient({ config, fetchImpl = fetch }) {
  function assertConfigured() {
    if (!config || !config.apiKey || !config.model) throw new Error('豆包配置不完整：需要 ARK_API_KEY 和 ARK_MODEL');
  }

  async function respond(input) {
    assertConfigured();
    const response = await fetchImpl(`${String(config.baseUrl || '').replace(/\/+$/, '')}/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, input, store: false }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(`豆包调用失败：${payload.error && payload.error.message ? payload.error.message : `HTTP ${response.status}`}`);
    const text = extractOutputText(payload);
    if (!text) throw new Error('豆包响应中没有可读取的文本');
    return { id: payload.id || '', text, raw: payload };
  }

  return { respond };
}

module.exports = { createDoubaoClient, extractOutputText };
