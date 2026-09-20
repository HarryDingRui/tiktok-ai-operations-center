const test = require('node:test');
const assert = require('node:assert/strict');

const { createPasswordRecord } = require('../src/auth');
const { createAuthApp } = require('../src/app');

async function createTestApp() {
  const passwordRecord = await createPasswordRecord('correct-password', 'fixed-salt');
  return createAuthApp({
    config: {
      cookieName: 'tiktok_ops_session',
      sessionTtlSeconds: 3600,
      cookieSecure: false,
    },
    authConfig: {
      sessionSecret: 'test-session-secret'.padEnd(32, '!'),
      users: { Harry: passwordRecord },
    },
    clock: () => 1000,
  });
}

async function request(app, method, path, body = null, headers = {}) {
  const requestHeaders = { ...headers };
  if (body !== null) requestHeaders['content-type'] = 'application/json';
  return app.handle(new Request(`http://localhost${path}`, {
    method,
    headers: requestHeaders,
    body: body === null ? undefined : JSON.stringify(body),
  }));
}

test('login issues a session and session endpoint recognizes it', async () => {
  const app = await createTestApp();
  const login = await request(app, 'POST', '/api/auth/login', { username: 'Harry', password: 'correct-password' });

  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);

  const session = await request(app, 'GET', '/api/auth/session', null, { cookie });
  assert.deepEqual(await session.json(), { authenticated: true, user: 'Harry' });
});

test('wrong credentials and missing verification cookie are rejected', async () => {
  const app = await createTestApp();
  const login = await request(app, 'POST', '/api/auth/login', { username: 'Harry', password: 'wrong-password' });
  const verify = await request(app, 'GET', '/api/auth/verify');

  assert.equal(login.status, 401);
  assert.deepEqual(await login.json(), { ok: false, error: '账号或密码错误' });
  assert.equal(verify.status, 401);
});

test('verification returns the authenticated username for Nginx', async () => {
  const app = await createTestApp();
  const login = await request(app, 'POST', '/api/auth/login', { username: 'Harry', password: 'correct-password' });
  const cookie = login.headers.get('set-cookie');
  const verify = await request(app, 'GET', '/api/auth/verify', null, { cookie });

  assert.equal(verify.status, 204);
  assert.equal(verify.headers.get('x-authenticated-user'), 'Harry');
});

test('logout clears the session cookie', async () => {
  const app = await createTestApp();
  const logout = await request(app, 'POST', '/api/auth/logout');

  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});
