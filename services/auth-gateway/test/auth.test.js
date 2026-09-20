const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPasswordRecord,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  serializeSessionCookie,
} = require('../src/auth');

test('accepts the configured password and rejects a wrong password', async () => {
  const record = await createPasswordRecord('correct-password', 'fixed-salt');

  assert.equal(await verifyPassword('correct-password', record), true);
  assert.equal(await verifyPassword('wrong-password', record), false);
});

test('rejects an expired or tampered session token', () => {
  const token = createSessionToken('Harry', 'test-secret', 1000, 3600);

  assert.equal(verifySessionToken(token, 'test-secret', 2000).username, 'Harry');
  assert.equal(verifySessionToken(token, 'test-secret', 5000), null);
  assert.equal(verifySessionToken(`${token}x`, 'test-secret', 2000), null);
});

test('serializes an HttpOnly SameSite session cookie without the password', () => {
  const cookie = serializeSessionCookie('token-value', { secure: false, maxAge: 3600 });

  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.doesNotMatch(cookie, /password|correct-password/);
});
