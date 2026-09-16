const assert = require('assert');
const core = require('../data/weekly-report-core.js');

assert.strictEqual(core.canonicalStoreName('yaya113'), 'PETTOS');
assert.strictEqual(core.canonicalStoreName('yaya thailand'), 'yaya thailand tth');
assert.strictEqual(core.canonicalStoreName('inspire Mall'), 'INSPIRE PURIFY');
assert.strictEqual(core.classifySheet('②店铺数据(总分总)'), 'storeSummary');
assert.strictEqual(core.classifySheet('③全店涨跌TOP30'), 'top30');
assert.strictEqual(core.classifySheet('调价验证'), 'priceValidation');

const summaryRows = [
  ['TikTok Shop店铺数据周报', null, null, null],
  ['8.31-9.6', '9.7-9.13', '变化额', '变化幅度'],
  ['GMV', 100, 120, 20],
  ['曝光', 1000, 800, -200],
  [],
  ['【分】yaya113·店铺数据', null, null, null],
  ['指标', '上期', '本期', '变化'],
  ['GMV', 10, 15, 5],
  ['成交件数', 1, 2, 1],
  [],
];
const summary = core.parseSummarySections(summaryRows);
assert.strictEqual(summary.storeSummary.length, 1);
assert.strictEqual(summary.storeSummary[0].store, 'PETTOS');
assert.strictEqual(summary.storeSummary[0].metrics.GMV.current, 15);

const topRows = [
  ['全店涨幅TOP30', null, null],
  ['排名', '店铺', '商品ID'],
  [1, 'yaya113', '1001'],
  [2, 'inspire Mall', '1002'],
  [],
  ['全店跌幅TOP30', null, null],
  ['排名', '店铺', '商品ID'],
  [1, 'yaya thailand', '1003'],
];
const top = core.parseTop30Rows(topRows);
assert.strictEqual(top.growthTop.length, 2);
assert.strictEqual(top.declineTop.length, 1);
assert.strictEqual(top.growthTop[0].store, 'PETTOS');
assert.strictEqual(top.growthTop[1].store, 'INSPIRE PURIFY');
assert.strictEqual(top.declineTop[0].store, 'yaya thailand tth');

const report = core.parseWeeklyReportWorkbook({
  '②店铺数据(总分总)': summaryRows,
  '③全店涨跌TOP30': topRows,
  '④GMV&净利润榜': [
    ['GMV TOP10'],
    ['排名', '商品ID', '在售店铺', '9.7-9.13 GMV'],
    [1, '1001', 'yaya113', 99],
    [],
    ['净利润TOP10'],
    ['排名', 'Seller SKU', '在售店铺', '销量'],
    [1, 'SKU-1', 'yaya113', 5],
  ],
  '⑤商品预警TOP20': [
    ['排名', '店铺', '商品ID'],
    [1, 'yaya113', '1001'],
  ],
  '⑥店铺利润汇总': [
    ['店铺', '商家成交额', '毛利总额'],
    ['yaya113', 100, 20],
  ],
  '⑦SKU利润明细': [
    ['Seller SKU', '商品ID', '在售店铺'],
    ['SKU-1', '1001', 'yaya113'],
  ],
  '⑧渠道利润分析': [
    ['订单渠道', '商家成交额'],
    ['视频', 100],
  ],
  '⑨款式分析': [
    ['货号', 'Seller SKU', '在售店铺'],
    ['A', 'SKU-1', 'yaya113'],
  ],
  '⑩样品订单': [
    ['样品订单'],
    ['店铺', '订单号', 'Seller SKU'],
    ['yaya113', 'O-1', 'SKU-1'],
  ],
  调价验证: [
    ['商品ID: 1001'],
    ['指标', '调价前', '调价后', '变化幅度'],
    ['GMV', 10, 20, 1],
  ],
}, 'weekly.xlsx');
assert.strictEqual(report.sourceFile, 'weekly.xlsx');
assert.strictEqual(report.storeSummary[0].store, 'PETTOS');
assert.strictEqual(report.gmvTop[0].store, 'PETTOS');
assert.strictEqual(report.profitTop[0].store, 'PETTOS');
assert.strictEqual(report.alerts[0].store, 'PETTOS');
assert.strictEqual(report.storeProfit[0].store, 'PETTOS');
assert.strictEqual(report.skuProfit[0].store, 'PETTOS');
assert.strictEqual(report.styleAnalysis[0].store, 'PETTOS');
assert.strictEqual(report.samples[0].store, 'PETTOS');
assert.strictEqual(report.priceValidation.length, 1);
assert.deepStrictEqual(report.unmappedStores, []);

console.log('weekly-report-core tests passed');
