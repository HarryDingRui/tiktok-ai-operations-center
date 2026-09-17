const assert = require('assert');
const videoRange = require('../data/video-range.js');

const summary = videoRange.summarizeVideoRows([
  { date: '2026-09-10', videoId: 'video-1', orders: 2, gmv: 100, gpm: 40 },
  { date: '2026-09-11', videoId: 'video-2', orders: 0, gmv: 0, gpm: 0 },
  { date: '2026-09-12', videoId: 'video-3', orders: 1, gmv: 50, gpm: 25 },
]);

assert.deepStrictEqual(
  {
    start: summary.start,
    end: summary.end,
    total: summary.total,
    sellingCount: summary.sellingCount,
    gmv: summary.gmv,
  },
  {
    start: '2026-09-10',
    end: '2026-09-12',
    total: 3,
    sellingCount: 2,
    gmv: 150,
  },
);
assert.deepStrictEqual(summary.byGmv.map((row) => row.videoId), ['video-1', 'video-3']);
assert.deepStrictEqual(summary.byGpm.map((row) => row.videoId), ['video-1', 'video-3']);

const deduplicatedSummary = videoRange.summarizeVideoRows([
  { date: '2026-09-10', videoId: 'video-1', productId: 'product-1', orders: 1, gmv: 40, exposure: 100 },
  { date: '2026-09-11', videoId: 'video-1', productId: 'product-1', orders: 2, gmv: 60, exposure: 200 },
]);
assert.strictEqual(deduplicatedSummary.total, 1);
assert.strictEqual(deduplicatedSummary.sellingCount, 1);
assert.strictEqual(deduplicatedSummary.gmv, 100);
assert.strictEqual(deduplicatedSummary.byGmv[0].orders, 3);

const mergedRecords = videoRange.mergeVideoRecords([
  {
    store: 'yaya thailand tth', date: '2026-09-01', videoId: 'video-4', productId: 'product-4',
    orders: 1, gmv: 591.2,
  },
], [
  {
    store: 'yaya thailand tth', date: '2026-09-01', videoId: 'video-4', productId: 'product-4',
    orders: 0, gmv: 0,
  },
]);
assert.strictEqual(mergedRecords.length, 1);
assert.strictEqual(mergedRecords[0].gmv, 591.2);
assert.strictEqual(mergedRecords[0].orders, 1);

const restoredRecords = videoRange.mergeVideoRecords([
  {
    store: 'yaya thailand tth', date: '2026-09-01', videoId: 'video-5', productId: 'product-5',
    orders: 0, gmv: 0,
  },
], [
  {
    store: 'yaya thailand tth', date: '2026-09-01', videoId: 'video-5', productId: 'product-5',
    orders: 1, gmv: 89,
  },
]);
assert.strictEqual(restoredRecords[0].gmv, 89);
assert.strictEqual(restoredRecords[0].orders, 1);

const crossStoreSummary = videoRange.summarizeVideoRows([
  { store: 'Store A', date: '2026-09-10', videoId: 'shared-video', orders: 1, gmv: 40 },
  { store: 'Store B', date: '2026-09-10', videoId: 'shared-video', orders: 1, gmv: 60 },
]);
assert.strictEqual(crossStoreSummary.total, 2);
assert.strictEqual(crossStoreSummary.gmv, 100);
console.log('video-range tests passed');
