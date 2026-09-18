const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'data', 'ops-v33.js'), 'utf8');
[
  'SKU Subtotal Before Discount',
  'SKU Seller Discount',
  'SKU Platform Discount',
  'deriveTransactionAmounts',
  'grossProfit',
  'netProfit',
  'profit-summary-panel',
  'suggestedRetailPrice',
  'targetMargin',
  'mergePricingImports',
  'cost-map',
].forEach((token) => assert.ok(source.includes(token), `missing integration token: ${token}`));
assert.ok(!source.includes('const revenue = (l.dealPrice || 0) * ratio;'), 'legacy after-discount revenue path is still active');
assert.ok(
  source.includes('sourceType === "cost-map" ? ["SKU", "成本价"] : ["SKU", "成本价", "活动价"]'),
  'cost-only mapping workbooks must not require an activity-price column',
);
console.log('profit ops integration tests passed');

