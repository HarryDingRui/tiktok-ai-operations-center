const assert = require('assert');
const period = require('../data/period-comparison.js');

assert.deepStrictEqual(
  period.selectedPeriodEndpoints({ start: '2026-09-01', end: '2026-09-14' }, ['2026-09-01', '2026-09-07', '2026-09-14']),
  { start: '2026-09-01', end: '2026-09-14' },
);
assert.deepStrictEqual(
  period.selectedPeriodEndpoints({ start: '2026-09-01', end: '2026-09-14' }, ['2026-09-03', '2026-09-10']),
  { start: '2026-09-03', end: '2026-09-10' },
);
assert.deepStrictEqual(period.selectedPeriodEndpoints({ start: '', end: '' }, []), { start: '', end: '' });
assert.strictEqual(period.absoluteDeltaText(1000, 700, (value) => `${value}次`), '增加 300次');
assert.strictEqual(period.absoluteDeltaText(700, 1000, (value) => `${value}次`), '减少 300次');
assert.strictEqual(period.absoluteDeltaText(700, 700, (value) => `${value}次`), '持平');
assert.deepStrictEqual(period.metricTrend(120, 100, (value) => `${value}次`), {
  state: 'up',
  symbol: '↑',
  action: '增加',
  value: '20次',
});
assert.deepStrictEqual(period.metricTrend(80, 100, (value) => `${value}次`), {
  state: 'down',
  symbol: '↓',
  action: '减少',
  value: '20次',
});
assert.deepStrictEqual(period.metricTrend(100, 100, (value) => `${value}次`), {
  state: 'flat',
  symbol: '→',
  action: '持平',
  value: '',
});
assert.deepStrictEqual(period.metricTrend(null, 100, (value) => `${value}次`), {
  state: 'unavailable',
  symbol: '',
  action: '区间首日暂无数据',
  value: '',
});
console.log('period-comparison tests passed');
