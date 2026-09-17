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
console.log('video-range tests passed');
