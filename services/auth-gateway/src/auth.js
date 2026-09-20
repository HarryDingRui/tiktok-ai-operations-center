const crypto = require('node:crypto');

const PASSWORD_KEY_LENGTH = 32;
const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};
const SESSION_COOKIE_NAME = 'tiktok_ops_session';

function derivePasswordKey(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, PASSWORD_KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function createPasswordRecord(password, salt = crypto.randomBytes(16).toString('base64')) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }

  const saltBuffer = Buffer.from(salt, 'utf8');
  const passwordHash = await derivePasswordKey(password, saltBuffer);
  return {
    algorithm: 'scrypt',
    salt: saltBuffer.toString('base64'),
    passwordHash: passwordHash.toString('base64'),
  };
}

async function verifyPassword(password, record) {
  if (typeof password !== 'string' || !record || record.algorithm !== 'scrypt') return false;

  try {
    const salt = Buffer.from(record.salt, 'base64');
    const expectedHash = Buffer.from(record.passwordHash, 'base64');
    const actualHash = await derivePasswordKey(password, salt);
    return expectedHash.length === actualHash.length && crypto.timingSafeEqual(expectedHash, actualHash);
  } catch {
    return false;
  }
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function createSessionToken(username, secret, nowSeconds = Math.floor(Date.now() / 1000), ttlSeconds = 28_800) {
  const payload = encodeBase64Url(JSON.stringify({
    username,
    expiresAt: nowSeconds + ttlSeconds,
    nonce: crypto.randomBytes(12).toString('base64url'),
  }));
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifySessionToken(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string' || typeof secret !== 'string') return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature || token.split('.').length !== 2) return null;

  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof parsed.username !== 'string' || !parsed.username || !Number.isSafeInteger(parsed.expiresAt)) return null;
    if (parsed.expiresAt <= nowSeconds) return null;
    return { username: parsed.username, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function parseCookies(header = '') {
  return header.split(';').reduce((cookies, item) => {
    const separator = item.indexOf('=');
    if (separator < 1) return cookies;
    const name = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
    return cookies;
  }, {});
}

function serializeSessionCookie(token, { secure = false, maxAge = 28_800 } = {}) {
  const securePart = secure ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${securePart}`;
}

function serializeClearedCookie({ secure = false } = {}) {
  const securePart = secure ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${securePart}`;
}

module.exports = {
  SESSION_COOKIE_NAME,
  createPasswordRecord,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  parseCookies,
  serializeSessionCookie,
  serializeClearedCookie,
};
