const jwt = require('jsonwebtoken');

const isDevTokenAllowed = () =>
  process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_TOKEN === 'true';

const getToken = (req) => {
  const bearerToken = req.headers.authorization?.split(' ')[1];
  if (bearerToken) return bearerToken;
  return req.query?.token || '';
};

const fileAccessAuth = (req, res, next) => {
  try {
    const token = getToken(req);

    if (!token) {
      return res.status(401).json({ error: 'File access requires authentication' });
    }

    if (token === 'dev-token' && isDevTokenAllowed()) {
      req.user = { id: 'dev', username: 'dev', role: 'admin' };
      return next();
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Authentication is not configured' });
    }

    req.user = jwt.verify(token, process.env.JWT_SECRET);
    res.setHeader('Cache-Control', 'private, no-store');
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired file access token' });
  }
};

module.exports = fileAccessAuth;
