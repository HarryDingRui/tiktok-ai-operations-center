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
assert.ok(!source.includes('if (!(amounts.sellerRevenue > 0)) return;'), 'zero-revenue gift lines must not be discarded');
assert.ok(source.includes('actualOrderWeightG'), 'order package weight must be tracked independently from per-SKU estimates');
assert.ok(source.includes('profitTools.findShippingFee'), 'shipping lookup must use the tested range-safe helper');
assert.ok(source.includes('profitTools.normalizeSkuKey'), 'Seller SKU matching must ignore harmless whitespace and Unicode-width differences');
assert.ok(source.indexOf('const sheets = await readWorkbook(file);') < source.indexOf('const hinted = unifiedFilenameHint(file.name);'), 'unified import must inspect headers before trusting an ambiguous filename');
assert.ok(source.includes('bounds?.start && bounds?.end'), 'profit rendering must support the all-dates scope where bounds is null');
assert.ok(source.includes('restoreProfitUploadStatuses'), 'saved pricing and order data must restore their imported status after reload');
console.log('profit ops integration tests passed');

