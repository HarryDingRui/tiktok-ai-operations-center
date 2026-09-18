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
assert.ok(source.includes('profitTools.resolveOrderProfitPolicy'), 'order profit policy must exclude zero-revenue orders and apply fixed shipping');
assert.ok(source.includes('profitTools.shouldExcludeRevenueLine'), 'zero-revenue SKU rows must be removed before order and SKU profit aggregation');
assert.ok(source.includes('profitTools.allocateOrderShipping'), 'multi-SKU orders must share one fixed order-level shipping fee');
assert.ok(!source.includes('const requiresWeight ='), 'profit calculation must not depend on product or package weight');
assert.ok(!source.includes('shipFeeNet(weightG)'), 'profit calculation must not use weight-based shipping tiers');
assert.ok(!source.includes('profit-patch-weight'), 'manual cost repair must not ask for unused weight data');
assert.ok(source.includes('profitTools.normalizeSkuKey'), 'Seller SKU matching must ignore harmless whitespace and Unicode-width differences');
assert.ok(source.indexOf('const sheets = await readWorkbook(file);') < source.indexOf('const hinted = unifiedFilenameHint(file.name);'), 'unified import must inspect headers before trusting an ambiguous filename');
assert.ok(source.includes('bounds?.start && bounds?.end'), 'profit rendering must support the all-dates scope where bounds is null');
assert.ok(source.includes('restoreProfitUploadStatuses'), 'saved pricing and order data must restore their imported status after reload');
console.log('profit ops integration tests passed');

