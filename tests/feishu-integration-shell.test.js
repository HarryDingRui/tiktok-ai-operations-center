const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const dataPageStart = html.indexOf('<div id="page-data" class="page">');
const feishuPageStart = html.indexOf('<div id="page-feishu" class="page">');
const integrationStart = html.indexOf('id="feishu-ops-integration"');
const modalStart = html.indexOf('<div class="manual-entry-modal"', dataPageStart);

assert.ok(dataPageStart >= 0, '数据接入页应存在');
assert.ok(feishuPageStart > dataPageStart, '飞书智能运营应是数据接入后的独立页面');
assert.ok(integrationStart > feishuPageStart, '飞书模块应位于独立飞书页面内');
assert.ok(integrationStart < modalStart, '飞书独立页面应位于全局弹窗之前');
assert.ok(html.includes("showPage('feishu', this)"), '左侧导航应提供独立飞书入口');
assert.ok(html.includes('<span>飞书智能运营</span>'), '左侧导航名称应清晰可见');

[
  '飞书智能运营接入', '只读分析', '人工审批', '不会自动操作 TikTok 店铺',
  'feishu-gateway-url', 'feishu-gateway-token', 'feishu-check-status', 'feishu-test-message', 'doubao-test-connection',
].forEach((label) => assert.ok(html.includes(label), `缺少 ${label}`));

assert.ok(html.includes('./data/feishu-integration.css?v=feishu-integration-2'));
assert.ok(html.includes('./data/feishu-integration.js?v=feishu-integration-2'));
assert.ok(!/FEISHU_APP_SECRET\s*=/.test(html), '前端不得包含飞书密钥');
assert.ok(!/ARK_API_KEY\s*=/.test(html), '前端不得包含豆包密钥');

const css = fs.readFileSync(path.join(__dirname, '..', 'data', 'feishu-integration.css'), 'utf8');
assert.ok(css.includes('.feishu-integration-grid'));
assert.ok(css.includes('@media'));
console.log('feishu integration shell tests passed');
