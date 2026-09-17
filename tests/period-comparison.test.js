const assert = require('assert');
const period = require('../data/period-comparison.js');

assert.strictEqual(period.daysBetweenInclusive('2026-09-08', '2026-09-14'), 7);
assert.deepStrictEqual(
  period.previousPeriodBounds({ start: '2026-09-08', end: '2026-09-14' }),
  { start: '2026-09-01', end: '2026-09-07' },
);
assert.deepStrictEqual(
  period.previousPeriodBounds({ start: '2026-09-01', end: '2026-09-01' }),
  { start: '2026-08-31', end: '2026-08-31' },
);
assert.deepStrictEqual(period.previousPeriodBounds({ start: '', end: '' }), { start: '', end: '' });
assert.strictEqual(period.absoluteDeltaText(1000, 700, (value) => `${value}次`), '增加 300次');
assert.strictEqual(period.absoluteDeltaText(700, 1000, (value) => `${value}次`), '减少 300次');
assert.strictEqual(period.absoluteDeltaText(700, 700, (value) => `${value}次`), '持平');
console.log('period-comparison tests passed');
