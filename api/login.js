// Single-shared-password login. GET checks the current session; POST either logs in
// (with { password }) or logs out (with { action: 'logout' }).
require('dotenv').config({ path: '.env.local' });
const { createSessionCookie, clearSessionCookie, verifySession } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({ authenticated: verifySession(req) });
    return;
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (body.action === 'logout') {
      res.setHeader('Set-Cookie', clearSessionCookie());
      res.status(200).json({ authenticated: false });
      return;
    }

    if (!process.env.APP_PASSWORD || !process.env.SESSION_SECRET) {
      res.status(500).json({ error: 'Login is not configured on the server yet.' });
      return;
    }

    if (body.password === process.env.APP_PASSWORD) {
      res.setHeader('Set-Cookie', createSessionCookie());
      res.status(200).json({ authenticated: true });
      return;
    }

    res.status(401).json({ error: 'Incorrect password' });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
