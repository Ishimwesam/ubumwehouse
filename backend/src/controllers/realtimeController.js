const jwt = require('jsonwebtoken');
const { registerRentalAppClient } = require('../services/realtimeService');

const getToken = (req) => {
  const authToken = req.headers.authorization?.split(' ')[1];
  if (authToken) return authToken;
  return String(req.query?.token || '').trim();
};

const streamRentalNotifications = (req, res) => {
  const token = getToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Authentication is not configured' });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (_) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const cleanup = registerRentalAppClient(res);
  req.on('close', cleanup);

  return undefined;
};

module.exports = {
  streamRentalNotifications
};
