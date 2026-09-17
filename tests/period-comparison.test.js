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
console.log('period-comparison tests passed');
