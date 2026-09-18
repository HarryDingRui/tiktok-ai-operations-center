const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.ok(html.includes('id="profit-summary-panel"'), 'missing profit summary panel');
assert.ok(html.includes('利润核算路径'), 'missing calculation steps');
assert.ok(html.includes('商家成交额 → 毛利 → 净利 → 风险判定'), 'missing profit flow copy');
assert.ok(html.includes('SKU Subtotal Before Discount − SKU Seller Discount'), 'missing seller transaction formula');
assert.ok(html.includes('SKU价格链路与风险'), 'missing price chain panel title');
const coreIndex = html.indexOf('data/profit-analysis-core.js');
const opsIndex = html.indexOf('data/ops-v33.js');
assert.ok(coreIndex >= 0 && coreIndex < opsIndex, 'profit core must load before ops-v33');
console.log('profit page shell tests passed');
