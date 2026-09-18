const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const dataPageStart = html.indexOf('<div id="page-data" class="page">');
const integrationStart = html.indexOf('id="feishu-ops-integration"');
const nextPageBoundary = html.indexOf('<div class="manual-entry-modal"', dataPageStart);

assert.ok(dataPageStart >= 0, '数据接入页应存在');
assert.ok(integrationStart > dataPageStart, '飞书模块应位于数据接入页内');
assert.ok(integrationStart < nextPageBoundary, '飞书模块应位于数据接入页末尾，而不是弹窗之后');
assert.ok(integrationStart > html.indexOf('🔄 日报闭环', dataPageStart), '飞书模块应放在日报闭环之后');

[
  '飞书智能运营接入', '只读分析', '人工审批', '不会自动操作 TikTok 店铺',
  'feishu-gateway-url', 'feishu-gateway-token', 'feishu-check-status', 'feishu-test-message', 'doubao-test-connection',
].forEach((label) => assert.ok(html.includes(label), `缺少 ${label}`));

assert.ok(html.includes('./data/feishu-integration.css?v=feishu-integration-1'));
assert.ok(html.includes('./data/feishu-integration.js?v=feishu-integration-1'));
assert.ok(!/FEISHU_APP_SECRET\s*=/.test(html), '前端不得包含飞书密钥');
assert.ok(!/ARK_API_KEY\s*=/.test(html), '前端不得包含豆包密钥');

const css = fs.readFileSync(path.join(__dirname, '..', 'data', 'feishu-integration.css'), 'utf8');
assert.ok(css.includes('.feishu-integration-grid'));
assert.ok(css.includes('@media'));
console.log('feishu integration shell tests passed');
