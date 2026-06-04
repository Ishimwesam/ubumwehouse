const jwt = require('jsonwebtoken');

const isDevTokenAllowed = () =>
  process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_TOKEN === 'true';

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Local-only escape hatch, disabled unless explicitly requested.
    if (token === 'dev-token' && isDevTokenAllowed()) {
      req.user = {
        id: 'dev',
        username: 'dev',
        role: 'admin',
        full_name: 'Developer',
        email: 'dev@example.com',
      };
      return next();
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Authentication is not configured' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware;
