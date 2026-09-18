const assert = require('assert');
const {
  isIncludedOrderStatus,
  deriveTransactionAmounts,
  calculateProfit,
  calculateBreakevenPrice,
  assessPriceRisk,
  normalizeSkuKey,
  findShippingFee,
  resolveOrderProfitPolicy,
  allocateOrderShipping,
  shouldExcludeRevenueLine,
} = require('../data/profit-analysis-core.js');

assert.strictEqual(isIncludedOrderStatus(''), true);
assert.strictEqual(isIncludedOrderStatus('Completed'), true);
assert.strictEqual(isIncludedOrderStatus('Cancelled'), false);
assert.strictEqual(isIncludedOrderStatus('已取消'), false);

const exactAmounts = deriveTransactionAmounts({
  subtotalBeforeDiscount: 300,
  sellerDiscount: 40,
  platformDiscount: 20,
  subtotalAfterDiscount: 240,
  quantity: 2,
});
assert.deepStrictEqual(exactAmounts, {
  listAmount: 300,
  sellerDiscount: 40,
  platformSubsidy: 20,
  sellerRevenue: 260,
  buyerPaidAmount: 240,
  subtotalAfterDiscount: 240,
  sellerUnitPrice: 130,
  buyerUnitPrice: 120,
  platformSubsidyPerUnit: 10,
  equationGap: 0,
  basis: 'before-minus-seller',
  exact: true,
});

const fallbackAmounts = deriveTransactionAmounts({
  subtotalAfterDiscount: 240,
  quantity: 2,
});
assert.strictEqual(fallbackAmounts.sellerRevenue, 240);
assert.strictEqual(fallbackAmounts.sellerUnitPrice, 120);
assert.strictEqual(fallbackAmounts.basis, 'after-discount-fallback');
assert.strictEqual(fallbackAmounts.exact, false);

const inferredBuyerAmounts = deriveTransactionAmounts({
  subtotalBeforeDiscount: 300,
  sellerDiscount: 40,
  platformDiscount: 20,
  quantity: 2,
});
assert.strictEqual(inferredBuyerAmounts.sellerRevenue, 260);
assert.strictEqual(inferredBuyerAmounts.buyerPaidAmount, 240);
assert.strictEqual(inferredBuyerAmounts.equationGap, null);

const profit = calculateProfit({
  sellerRevenue: 260,
  productCost: 120,
  fixedPlatformFee: 52,
  affiliateFee: 7.8,
  adCost: 26,
  shippingCost: 5,
  staffCost: 15.6,
});
assert.strictEqual(profit.grossProfit, 140);
assert.strictEqual(profit.grossMargin, 140 / 260);
assert.ok(Math.abs(profit.netProfit - 33.6) < 1e-9);
assert.ok(Math.abs(profit.netMargin - (33.6 / 260)) < 1e-9);

const missingProfit = calculateProfit({ sellerRevenue: 260, productCost: null });
assert.strictEqual(missingProfit.grossProfit, null);
assert.strictEqual(missingProfit.netProfit, null);

assert.strictEqual(calculateBreakevenPrice({ unitCost: 67.2, shippingUnit: 3, variableRate: 0.4109 }).toFixed(2), '119.16');

const lossRisk = assessPriceRisk({
  exactRevenue: true,
  hasCost: true,
  shippingKnown: true,
  sellerUnitPrice: 100,
  buyerUnitPrice: 90,
  platformSubsidyPerUnit: 10,
  activityPrice: 120,
  suggestedRetailPrice: 130,
  breakevenPrice: 110,
  netMargin: -0.05,
  equationGap: 0,
  targetMargin: 0.05,
});
assert.strictEqual(lossRisk.level, 'loss');
assert.ok(lossRisk.reasons.some((reason) => reason.includes('保本价')));

const anomalyRisk = assessPriceRisk({
  exactRevenue: true,
  hasCost: true,
  shippingKnown: true,
  sellerUnitPrice: 130,
  buyerUnitPrice: 120,
  platformSubsidyPerUnit: 10,
  activityPrice: 130,
  suggestedRetailPrice: 130,
  breakevenPrice: 100,
  netMargin: 0.12,
  equationGap: 5,
  targetMargin: 0.05,
});
assert.strictEqual(anomalyRisk.level, 'anomaly');
assert.ok(anomalyRisk.reasons.some((reason) => reason.includes('折扣等式')));
assert.strictEqual(anomalyRisk.activityGap, 0);
assert.strictEqual(anomalyRisk.buyerActivityGap, 0);

const healthyWorkbookLikeRisk = assessPriceRisk({
  exactRevenue: true,
  hasCost: true,
  shippingKnown: true,
  sellerUnitPrice: 155,
  buyerUnitPrice: 145,
  platformSubsidyPerUnit: 10,
  activityPrice: 155,
  suggestedRetailPrice: 124.65,
  breakevenPrice: 115,
  netMargin: 0.1555,
  equationGap: 0,
  targetMargin: 0.05,
});
assert.strictEqual(healthyWorkbookLikeRisk.level, 'healthy');
assert.strictEqual(healthyWorkbookLikeRisk.activityGap, 0);
assert.strictEqual(healthyWorkbookLikeRisk.buyerActivityGap, 0);
assert.ok(healthyWorkbookLikeRisk.targetPriceGap > 30);

const lowMarginRisk = assessPriceRisk({
  exactRevenue: true,
  hasCost: true,
  shippingKnown: true,
  sellerUnitPrice: 120,
  buyerUnitPrice: 110,
  platformSubsidyPerUnit: 10,
  activityPrice: 120,
  suggestedRetailPrice: 130,
  breakevenPrice: 115,
  netMargin: 0.03,
  equationGap: 0,
  targetMargin: 0.05,
});
assert.strictEqual(lowMarginRisk.level, 'low-margin');
assert.ok(lowMarginRisk.reasons.some((reason) => reason.includes('目标价')));

const pendingRisk = assessPriceRisk({ exactRevenue: false, hasCost: false, shippingKnown: false });
assert.strictEqual(pendingRisk.level, 'pending');
assert.ok(pendingRisk.reasons.some((reason) => reason.includes('重新导入')));

assert.strictEqual(normalizeSkuKey(' TH020141\n king*10 '), 'th020141king*10');
assert.strictEqual(normalizeSkuKey('ＴＨ ０２０１４１'), 'th020141');

const shippingTiers = [
  { lo: 0, hi: 1000, net: 2.5 },
  { lo: 1000.01, hi: 5000, net: 5 },
];
assert.strictEqual(findShippingFee(850, shippingTiers), 2.5);
assert.strictEqual(findShippingFee(3200, shippingTiers), 5);
assert.strictEqual(findShippingFee(6000, shippingTiers), null, 'out-of-range shipping must stay unknown');
assert.strictEqual(findShippingFee(null, shippingTiers), null);

const zeroRevenueOrder = resolveOrderProfitPolicy({ sellerRevenue: 0, quantity: 12, weightGrams: 8000 });
assert.deepStrictEqual(zeroRevenueOrder, {
  status: 'excluded-zero-revenue',
  excludedFromProfit: true,
  shippingCost: 0,
});

const validOrder = resolveOrderProfitPolicy({ sellerRevenue: 260, quantity: 12, weightGrams: 8000 });
assert.deepStrictEqual(validOrder, {
  status: 'included',
  excludedFromProfit: false,
  shippingCost: 5,
});

const missingRevenueOrder = resolveOrderProfitPolicy({ sellerRevenue: null });
assert.deepStrictEqual(missingRevenueOrder, {
  status: 'pending-revenue',
  excludedFromProfit: false,
  shippingCost: null,
});

const firstSkuShipping = allocateOrderShipping({ shippingCost: 5, itemRevenue: 180, orderRevenue: 300 });
const secondSkuShipping = allocateOrderShipping({ shippingCost: 5, itemRevenue: 120, orderRevenue: 300 });
assert.strictEqual(firstSkuShipping, 3);
assert.strictEqual(secondSkuShipping, 2);
assert.strictEqual(firstSkuShipping + secondSkuShipping, 5, 'multi-SKU allocation must not duplicate the order fee');

assert.strictEqual(shouldExcludeRevenueLine(0), true, 'zero-revenue SKU rows must not enter profit calculations');
assert.strictEqual(shouldExcludeRevenueLine(-1), true, 'negative-revenue SKU rows must not enter profit calculations');
assert.strictEqual(shouldExcludeRevenueLine(0.01), false);
assert.strictEqual(shouldExcludeRevenueLine(null), false, 'missing revenue must stay pending instead of being treated as zero');

console.log('profit-analysis-core tests passed');

