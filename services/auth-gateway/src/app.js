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
const DEFAULT_RATE_LIMIT_MAX_ATTEMPTS = 5;
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;

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

function createAuthApp({ config, authConfig, clock = () => Math.floor(Date.now() / 1000), audit = () => {} }) {
  const failedLoginAttempts = new Map();

  function getClientKey(request) {
    return (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').split(',')[0].trim() || 'unknown';
  }

  function getRateLimitSettings() {
    return {
      maxAttempts: config.loginRateLimitMaxAttempts || DEFAULT_RATE_LIMIT_MAX_ATTEMPTS,
      windowSeconds: config.loginRateLimitWindowSeconds || DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
    };
  }

  function checkLoginRateLimit(clientKey, nowSeconds) {
    const settings = getRateLimitSettings();
    const current = failedLoginAttempts.get(clientKey);
    if (!current || nowSeconds - current.startedAt >= settings.windowSeconds) {
      failedLoginAttempts.delete(clientKey);
      return null;
    }
    if (current.count < settings.maxAttempts) return null;
    return Math.max(1, settings.windowSeconds - (nowSeconds - current.startedAt));
  }

  function recordLoginFailure(clientKey, nowSeconds) {
    const settings = getRateLimitSettings();
    const current = failedLoginAttempts.get(clientKey);
    if (!current || nowSeconds - current.startedAt >= settings.windowSeconds) {
      failedLoginAttempts.set(clientKey, { startedAt: nowSeconds, count: 1 });
      return;
    }
    current.count += 1;
  }

  function recordAudit(event, details = {}) {
    try { audit({ event, ...details }); } catch { /* auditing must not break authentication */ }
  }

  async function handleLogin(request) {
    const body = await parseLoginBody(request);
    if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
      return jsonResponse(400, { ok: false, error: '请输入账号和密码' });
    }

    const nowSeconds = clock();
    const clientKey = getClientKey(request);
    const retryAfter = checkLoginRateLimit(clientKey, nowSeconds);
    if (retryAfter) {
      recordAudit('login_rate_limited', { username: body.username.slice(0, 128), clientKey });
      return jsonResponse(429, { ok: false, error: '尝试次数过多，请稍后再试' }, { 'Retry-After': String(retryAfter) });
    }

    const userRecord = authConfig.users[body.username];
    const valid = userRecord ? await verifyPassword(body.password, userRecord) : false;
    if (!valid) {
      recordLoginFailure(clientKey, nowSeconds);
      recordAudit('login_failure', { username: body.username.slice(0, 128), clientKey });
      return jsonResponse(401, { ok: false, error: '账号或密码错误' });
    }

    failedLoginAttempts.delete(clientKey);
    recordAudit('login_success', { username: body.username.slice(0, 128), clientKey });

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
        const session = readSession(request, config, authConfig, nowSeconds);
        recordAudit('logout', { username: session?.username || 'unknown', clientKey: getClientKey(request) });
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
