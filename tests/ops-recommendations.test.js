const assert = require('assert');
const { buildWeeklyRecommendations } = require('../data/ops-recommendations.js');

const report = {
  sourceFile: 'weekly.xlsx',
  periods: { primary: { label: '9.7-9.13' }, comparison: { label: '8.31-9.6' } },
  unmappedStores: [],
  growthTop: [{ store: 'PETTOS', raw: [1, 'yaya113', '1001', 'Cat litter', 100, 140, 40, 0.4, 1000, 1400, 0.04, 0.05, 0.08, 0.09, 2, 3, '曝光增长'] }],
  declineTop: [{ store: 'Miniyaya', raw: [1, 'Miniyaya', '2001', 'Tissue', 200, 100, -100, -0.5, 10000, 6000, 0.04, 0.03, 0.08, 0.04, 4, 1, '曝光下滑、转化率下滑'] }],
  alerts: [{ store: 'INSPIRE PURIFY', raw: [1, 'inspire Mall', '3001', 'Tissue', 'CVR转化下滑', 100, 50, 50, 5000, 3000, 0.4, 0.04, 0.03, 0.1, 0.04, 0.6, '先查详情页与价格力'] }],
  profitTop: [{ store: 'PETTOS', raw: [1, 'SKU-1', 'yaya113', 10, 100, 80, 30, 10, 5, -25, -0.25] }],
  channelProfit: [{ raw: ['视频', 1000, 100, 0.6, 700, 250, 100, 60, 20, -130] }],
};

const result = buildWeeklyRecommendations(report);
assert.strictEqual(result.source, 'weekly.xlsx');
assert.ok(result.items.some((item) => item.kind === 'decline' && item.title.includes('Miniyaya')));
assert.ok(result.items.some((item) => item.kind === 'growth' && item.action.includes('20%')));
assert.ok(result.items.some((item) => item.kind === 'alert' && item.action.includes('详情页')));
assert.ok(result.items.some((item) => item.kind === 'profit' && item.action.includes('成本')));
assert.ok(result.items.some((item) => item.kind === 'channel' && item.action.includes('视频')));
console.log('ops-recommendations tests passed');
