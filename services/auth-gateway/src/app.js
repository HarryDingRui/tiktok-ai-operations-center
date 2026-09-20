const {
  SESSION_COOKIE_NAME,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  parseCookies,
  serializeSessionCookie,
  serializeClearedCookie,
} = require('./auth');

const MAX_LOGIN_BODY_BYTES = 16 * 1024;

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function noContent(status, headers = {}) {
  return new Response(null, { status, headers });
}

async function parseLoginBody(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) return null;

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_LOGIN_BODY_BYTES) return null;

  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_LOGIN_BODY_BYTES) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function readSession(request, config, authConfig, nowSeconds) {
  const cookies = parseCookies(request.headers.get('cookie') || '');
  const token = cookies[config.cookieName || SESSION_COOKIE_NAME];
  const session = verifySessionToken(token, authConfig.sessionSecret, nowSeconds);
  if (!session || !authConfig.users[session.username]) return null;
  return session;
}

function createAuthApp({ config, authConfig, clock = () => Math.floor(Date.now() / 1000) }) {
  async function handleLogin(request) {
    const body = await parseLoginBody(request);
    if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
      return jsonResponse(400, { ok: false, error: '请输入账号和密码' });
    }

    const userRecord = authConfig.users[body.username];
    const valid = userRecord ? await verifyPassword(body.password, userRecord) : false;
    if (!valid) return jsonResponse(401, { ok: false, error: '账号或密码错误' });

    const token = createSessionToken(
      body.username,
      authConfig.sessionSecret,
      clock(),
      config.sessionTtlSeconds,
    );
    return jsonResponse(200, { ok: true, user: body.username }, {
      'Set-Cookie': serializeSessionCookie(token, {
        secure: config.cookieSecure,
        maxAge: config.sessionTtlSeconds,
      }),
    });
  }

  return {
    async handle(request) {
      const url = new URL(request.url);
      const nowSeconds = clock();

      if (request.method === 'GET' && url.pathname === '/health') {
        return jsonResponse(200, { ok: true, service: 'auth-gateway' });
      }
      if (request.method === 'POST' && url.pathname === '/api/auth/login') return handleLogin(request);
      if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
        return jsonResponse(200, { ok: true }, {
          'Set-Cookie': serializeClearedCookie({ secure: config.cookieSecure }),
        });
      }
      if (request.method === 'GET' && url.pathname === '/api/auth/session') {
        const session = readSession(request, config, authConfig, nowSeconds);
        if (!session) return jsonResponse(401, { authenticated: false });
        return jsonResponse(200, { authenticated: true, user: session.username });
      }
      if (request.method === 'GET' && url.pathname === '/api/auth/verify') {
        const session = readSession(request, config, authConfig, nowSeconds);
        if (!session) return noContent(401);
        return noContent(204, { 'X-Authenticated-User': session.username });
      }

      return jsonResponse(404, { ok: false, error: 'Not Found' });
    },
  };
}

module.exports = { createAuthApp };
