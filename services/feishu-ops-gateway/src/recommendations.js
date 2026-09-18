const crypto = require('node:crypto');

function text(value, maxLength = 500) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function stringList(value, maxItems = 8) {
  return (Array.isArray(value) ? value : []).map((item) => text(item, 300)).filter(Boolean).slice(0, maxItems);
}

function normalizeRecommendation(value, context = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const confidence = Number(source.confidence);
  return {
    id: text(context.id, 100) || `rec_${crypto.randomUUID()}`,
    store: text(context.store || source.store, 120) || '全部店铺',
    dateRange: {
      start: text(context.dateRange && context.dateRange.start, 20),
      end: text(context.dateRange && context.dateRange.end, 20),
    },
    title: text(source.title, 120) || '运营建议',
    summary: text(source.summary, 600),
    evidence: stringList(source.evidence),
    action: text(source.action, 600),
    risk: ['low', 'medium', 'high'].includes(source.risk) ? source.risk : 'medium',
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : null,
    missingData: stringList(source.missingData),
    status: 'pending_approval',
    createdAt: context.createdAt || new Date().toISOString(),
  };
}

function markdown(value) {
  return text(value, 1200).replace(/[\r\n]+/g, ' ');
}

function buildRecommendationCard(recommendation) {
  const rec = normalizeRecommendation(recommendation, recommendation);
  const range = rec.dateRange.start || rec.dateRange.end ? `${rec.dateRange.start || '?'} 至 ${rec.dateRange.end || '?'}` : '未提供';
  const evidence = rec.evidence.length ? rec.evidence.map((item) => `• ${markdown(item)}`).join('\n') : '• 暂无充分证据，需补充数据';
  const missing = rec.missingData.length ? rec.missingData.join('、') : '无';
  return {
    config: { wide_screen_mode: true },
    header: { template: rec.risk === 'high' ? 'red' : rec.risk === 'low' ? 'green' : 'orange', title: { tag: 'plain_text', content: `豆包运营建议 · ${rec.title}` } },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content: `**店铺：**${markdown(rec.store)}\n**日期：**${range}\n**建议状态：**待人工审批` } },
      { tag: 'hr' },
      { tag: 'div', text: { tag: 'lark_md', content: `**判断：**${markdown(rec.summary) || '待补充'}\n**数据证据：**\n${evidence}\n**建议动作：**${markdown(rec.action) || '待人工判断'}\n**缺失数据：**${markdown(missing)}` } },
      { tag: 'note', elements: [{ tag: 'plain_text', content: '安全模式：此卡片只记录审批，不会自动操作 TikTok 店铺。' }] },
      { tag: 'action', actions: [
        { tag: 'button', type: 'primary', text: { tag: 'plain_text', content: '采纳建议' }, value: { action: 'approve', recommendation_id: rec.id } },
        { tag: 'button', type: 'danger', text: { tag: 'plain_text', content: '驳回' }, value: { action: 'reject', recommendation_id: rec.id } },
      ] },
    ],
  };
}

function parseRecommendationText(value) {
  const body = text(value, 20_000).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(body); } catch (error) { throw new Error('豆包未返回有效 JSON 建议'); }
}

module.exports = { normalizeRecommendation, buildRecommendationCard, parseRecommendationText };
