// Shared session helpers for the single-shared-password login gate. Not itself a route —
// Vercel excludes files under api/ that start with an underscore from routing.
//
// Session = "<expiryTimestamp>.<hmacSignature>" stored in an HttpOnly cookie. Signing with
// SESSION_SECRET means a client can't forge or extend a session without knowing the secret;
// the server re-issues a fresh cookie on every authenticated request, which is what makes
// expiry "slide" — a week of *inactivity* logs the device out, not a week from login time.
const crypto = require('crypto');

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const COOKIE_NAME = 'mp_session';

function sign(value) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('hex');
}

function createSessionCookie() {
  const expires = Date.now() + SESSION_DURATION_MS;
  const payload = String(expires);
  const token = `${payload}.${sign(payload)}`;
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_DURATION_MS / 1000)}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function parseCookies(header) {
  const cookies = {};
  (header || '').split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    cookies[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return cookies;
}

function verifySession(req) {
  if (!process.env.SESSION_SECRET) return false;
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return false;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = sign(payload);
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  const expires = Number(payload);
  return Boolean(expires) && Date.now() <= expires;
}

// Call at the top of every protected endpoint (after the OPTIONS/CORS setup). Writes a 401
// and returns false if the session is missing/invalid/expired; otherwise refreshes the
// sliding-expiry cookie and returns true so the handler can proceed.
function requireAuth(req, res) {
  if (!verifySession(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  res.setHeader('Set-Cookie', createSessionCookie());
  return true;
}

module.exports = { requireAuth, createSessionCookie, clearSessionCookie, verifySession };
