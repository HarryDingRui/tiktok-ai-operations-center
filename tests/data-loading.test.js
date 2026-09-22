const assert = require('assert');
const loading = require('../data/data-loading.js');

assert.deepStrictEqual(loading.datasetsForPage('overview'), []);
assert.deepStrictEqual(loading.datasetsForPage('bd'), ['creatorDaily', 'affOrders', 'samples']);
assert.deepStrictEqual(loading.datasetsForPage('ads'), ['adCreatives']);
assert.deepStrictEqual(loading.datasetsForPage('videos'), ['affVideos', 'adCreatives', 'orders']);
assert.deepStrictEqual(loading.datasetsForPage('profit'), ['orders', 'affOrders']);
assert.deepStrictEqual(loading.datasetsForPage('unknown'), []);
assert.deepStrictEqual(
  loading.mergeDatasetKeys(['creatorDaily', 'adCreatives'], ['adCreatives', 'affVideos']),
  ['creatorDaily', 'adCreatives', 'affVideos'],
);

console.log('data-loading tests passed');
