const fs = require('node:fs');

function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 8789,
    authConfigFile: env.AUTH_CONFIG_FILE || '/run/secrets/auth-config.json',
    cookieName: 'tiktok_ops_session',
    sessionTtlSeconds: Number(env.SESSION_TTL_SECONDS) || 28_800,
    cookieSecure: env.COOKIE_SECURE === 'true',
    loginRateLimitMaxAttempts: Number(env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS) || 5,
    loginRateLimitWindowSeconds: Number(env.LOGIN_RATE_LIMIT_WINDOW_SECONDS) || 60,
  };
}

function loadAuthConfig(filePath, readFile = fs.readFileSync) {
  const parsed = JSON.parse(readFile(filePath, 'utf8'));
  if (!parsed || typeof parsed.sessionSecret !== 'string' || parsed.sessionSecret.length < 32) {
    throw new Error('认证配置缺少足够长度的 sessionSecret');
  }
  if (!parsed.users || typeof parsed.users !== 'object' || Array.isArray(parsed.users)) {
    throw new Error('认证配置缺少 users 对象');
  }
  return parsed;
}

module.exports = { loadConfig, loadAuthConfig };
