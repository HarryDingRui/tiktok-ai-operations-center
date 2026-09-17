const assert = require('assert');
const overviewMetrics = require('../data/overview-metrics.js');

const models = overviewMetrics.buildOverviewMetricModels(
  { gmv: 1000, orders: 30, exposure: 2000, clicks: 400, cvr: 7.5 },
  { gmv: 100, orders: 10, exposure: 100, cvr: 8 },
  { gmv: 120, orders: 8, exposure: 150, cvr: 7.25 },
  {
    money: (value) => `฿${value}`,
    number: (value) => String(value),
    compact: (value) => String(value),
    percent: (value) => `${Number(value).toFixed(2)}%`,
    percentagePoint: (value) => `${Number(value).toFixed(2)}pp`,
  },
);

assert.strictEqual(models.length, 4);
assert.strictEqual(models[0].value, '฿1000');
assert.deepStrictEqual(models[0].trend, { state: 'up', symbol: '↑', action: '增加', value: '฿20' });
assert.deepStrictEqual(models[1].trend, { state: 'down', symbol: '↓', action: '减少', value: '2 单' });
assert.deepStrictEqual(models[2].trend, { state: 'up', symbol: '↑', action: '增加', value: '50 次' });
assert.strictEqual(models[3].value, '7.50%');
assert.deepStrictEqual(models[3].trend, { state: 'down', symbol: '↓', action: '减少', value: '0.75pp' });
console.log('overview metric model tests passed');
