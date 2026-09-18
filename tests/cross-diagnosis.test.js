const assert = require('assert');
const { buildCrossDiagnosis } = require('../data/cross-diagnosis.js');

const report = buildCrossDiagnosis({
  productId: 'product-1',
  bounds: { start: '2026-09-01', end: '2026-09-14' },
  productRows: [
    { date: '2026-09-01', productId: 'product-1', name: 'Product 1', exposure: 1000, clicks: 100, orders: 20, gmv: 200, price: 10, stock: 100, status: '在售', penalty: '无' },
    { date: '2026-09-14', productId: 'product-1', name: 'Product 1', exposure: 600, clicks: 60, orders: 12, gmv: 120, price: 10, stock: 100, status: '在售', penalty: '无' },
  ],
  adRows: [
    { date: '2026-09-01', productId: 'product-1', spend: 500, revenue: 1050, orders: 30, impressions: 10000, clicks: 500 },
    { date: '2026-09-14', productId: 'product-1', spend: 200, revenue: 260, orders: 10, impressions: 5000, clicks: 150 },
  ],
  creatorRows: [
    { date: '2026-09-01', productId: 'product-1', creator: 'creator-a', qty: 2, amount: 100 },
    { date: '2026-09-01', productId: 'product-1', creator: 'creator-b', qty: 1, amount: 80 },
    { date: '2026-09-01', productId: 'product-1', creator: 'creator-c', qty: 1, amount: 60 },
    { date: '2026-09-14', productId: 'product-1', creator: 'creator-a', qty: 1, amount: 40 },
  ],
  videoRows: [
    { date: '2026-09-01', productId: 'product-1', videoId: 'video-a', gmv: 80, orders: 4, exposure: 1000, views: 900, likes: 90, comments: 10, shares: 5 },
    { date: '2026-09-01', productId: 'product-1', videoId: 'video-b', gmv: 40, orders: 2, exposure: 800, views: 700, likes: 70, comments: 8, shares: 4 },
    { date: '2026-09-14', productId: 'product-1', videoId: 'video-a', gmv: 20, orders: 1, exposure: 400, views: 350, likes: 20, comments: 2, shares: 1 },
  ],
  orderRows: [
    { date: '2026-09-01', productId: 'product-1', orderId: 'order-a', qty: 1, orderAmount: 100, refund: 0 },
    { date: '2026-09-01', productId: 'product-1', orderId: 'order-b', qty: 1, orderAmount: 100, refund: 0 },
    { date: '2026-09-14', productId: 'product-1', orderId: 'order-c', qty: 1, orderAmount: 100, refund: 30 },
  ],
});

assert.deepStrictEqual(report.period, {
  selectedStart: '2026-09-01',
  selectedEnd: '2026-09-14',
  start: '2026-09-01',
  end: '2026-09-14',
});
assert.deepStrictEqual(
  report.modules.map((module) => [module.key, module.status]),
  [['ads', 'problem'], ['creators', 'problem'], ['videos', 'problem'], ['product', 'normal'], ['orders', 'problem']],
);
assert.strictEqual(report.conclusion.primary.module, 'ads');
assert.deepStrictEqual(report.conclusion.excluded.map((item) => item.module), ['product']);
assert.strictEqual(report.conclusion.pending.length, 0);
assert.ok(report.modules.find((module) => module.key === 'ads').issues.some((issue) => issue.key === 'spend'));
assert.ok(report.modules.find((module) => module.key === 'creators').facts.lostCreators.includes('creator-b'));
assert.ok(report.modules.find((module) => module.key === 'videos').issues.some((issue) => issue.key === 'videoCount'));
assert.ok(report.modules.find((module) => module.key === 'orders').issues.some((issue) => issue.key === 'refundRate'));

const incompleteReport = buildCrossDiagnosis({
  productId: 'product-2',
  bounds: { start: '2026-09-01', end: '2026-09-14' },
  productRows: [
    { date: '2026-09-14', productId: 'product-2', exposure: 100 },
  ],
});
assert.ok(incompleteReport.modules.every((module) => module.status === 'pending'));
assert.ok(incompleteReport.conclusion.pending.length >= 4);
assert.strictEqual(incompleteReport.conclusion.excluded.length, 0);

const incompleteProductReport = buildCrossDiagnosis({
  productId: 'product-3',
  bounds: { start: '2026-09-01', end: '2026-09-14' },
  productRows: [
    { date: '2026-09-01', productId: 'product-3', status: '在售' },
    { date: '2026-09-14', productId: 'product-3', status: '在售' },
  ],
});
assert.strictEqual(incompleteProductReport.modules.find((module) => module.key === 'product').status, 'pending');
assert.strictEqual(incompleteProductReport.conclusion.excluded.length, 0);

console.log('cross-diagnosis tests passed');
