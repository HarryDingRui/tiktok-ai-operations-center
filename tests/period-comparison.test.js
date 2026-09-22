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

function snapshot(reportDate) {
  return { reportDate, products: [] };
}

const singleDay = period.selectComparisonSnapshots(
  [snapshot('2026-09-18'), snapshot('2026-09-19'), snapshot('2026-09-20')],
  { start: '2026-09-20', end: '2026-09-20' },
);
assert.strictEqual(singleDay.previous.reportDate, '2026-09-19');
assert.strictEqual(singleDay.current.reportDate, '2026-09-20');
assert.strictEqual(singleDay.intervalDays, 1);
assert.strictEqual(singleDay.intervalText, '环比昨日');

const skippedYesterday = period.selectComparisonSnapshots(
  [snapshot('2026-09-18'), snapshot('2026-09-20')],
  { start: '2026-09-20', end: '2026-09-20' },
);
assert.strictEqual(skippedYesterday.previous.reportDate, '2026-09-18');
assert.strictEqual(skippedYesterday.intervalDays, 2);
assert.strictEqual(skippedYesterday.intervalText, '对比 2026-09-18（相隔 2 天）');

const selectedRange = period.selectComparisonSnapshots(
  [snapshot('2026-09-18'), snapshot('2026-09-19'), snapshot('2026-09-20')],
  { start: '2026-09-19', end: '2026-09-20' },
);
assert.strictEqual(selectedRange.previous.reportDate, '2026-09-19');
assert.strictEqual(selectedRange.current.reportDate, '2026-09-20');
assert.strictEqual(
  period.selectComparisonSnapshots([snapshot('2026-09-20')], { start: '2026-09-20', end: '2026-09-20' }),
  null,
);
console.log('period-comparison tests passed');
