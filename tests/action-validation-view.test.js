const assert = require('assert');
const view = require('../data/action-validation-view.js');

const escapeHtml = (value) => String(value == null ? '' : value)
  .replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

const emptyTable = view.renderValidationTable([], escapeHtml);
assert.ok(emptyTable.includes('<table class="desktop-table">'));
assert.ok(emptyTable.includes('暂无真实动作记录'));

const populatedTable = view.renderValidationTable([
  {
    action: {
      date: '2026-09-10', store: 'Miniyaya', productId: 'product-1',
      actionType: '调整价格', detail: '测试组合装价格', owner: '运营A',
    },
    checks: [{ node: 1, verdict: '待验证' }, { node: 3, verdict: '有效' }],
    verdict: '有效',
  },
], escapeHtml);
assert.ok(populatedTable.includes('2026-09-10'));
assert.ok(populatedTable.includes('Miniyaya'));
assert.ok(populatedTable.includes('product-1'));
assert.ok(populatedTable.includes('调整价格'));
assert.ok(populatedTable.includes('T+1 / T+3'));
assert.ok(!populatedTable.includes('US-旗舰店'));
console.log('action-validation-view tests passed');
