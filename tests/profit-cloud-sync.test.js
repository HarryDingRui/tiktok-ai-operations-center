const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cloudSource = fs.readFileSync(path.join(root, 'data', 'cloud-import.js'), 'utf8');
const opsSource = fs.readFileSync(path.join(root, 'data', 'ops-v33.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const match = cloudSource.match(/^window\.TIKTOK_CLOUD_SNAPSHOT=(.*);window\.REAL_STORE_DATA=/s);
assert.ok(match, 'cloud snapshot wrapper must remain parseable');
const snapshot = JSON.parse(match[1]);

assert.ok(snapshot.v33Urls?.orders, 'published snapshot must provide cloud order rows');
assert.ok(snapshot.pricingUrl, 'published snapshot must provide cloud pricing data');
assert.ok(opsSource.includes('loadCloudPricing'), 'v3.3 engine must load the published pricing fallback');
assert.ok(opsSource.includes('if (!pricing && cloudPricing)'), 'local pricing must win over the published fallback');
assert.ok(indexSource.includes('2026-09-profit-cloud-1'), 'page must bust the cloud manifest cache');
assert.ok(indexSource.includes('gmvmax-native-26'), 'page must bust the profit engine cache');

const orders = JSON.parse(fs.readFileSync(path.join(root, 'data', 'cloud-orders.json'), 'utf8'));
assert.ok(Array.isArray(orders) && orders.length >= 2000, 'cloud order snapshot must contain the imported order rows');
assert.ok(orders.every((row) => /^PUB-\d{6}$/.test(row.orderId)), 'public order IDs must be pseudonymized');
assert.ok(orders.every((row) => row.store === 'INSPIRE PURIFY'), 'cloud order rows must retain their store scope');
assert.ok(orders.every((row) => /^2026-09-(0[7-9]|1[0-3])$/.test(row.date)), 'cloud order rows must retain the 2026-09-07 to 2026-09-13 dates');
assert.ok(orders.every((row) => !('creator' in row)), 'public order rows must not expose creator handles');

const pricing = JSON.parse(fs.readFileSync(path.join(root, 'data', 'cloud-pricing.json'), 'utf8'));
assert.ok(Array.isArray(pricing.skus) && pricing.skus.length >= 367, 'cloud pricing snapshot must retain the complete merged SKU set');
assert.strictEqual(pricing.publishedSnapshot, true, 'cloud pricing data must identify itself as a published snapshot');
assert.ok(Array.isArray(pricing.tiers) && pricing.tiers.length > 0, 'cloud pricing snapshot must retain shipping tiers');

console.log('profit cloud sync tests passed');
