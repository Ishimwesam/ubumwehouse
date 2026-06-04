const jwt = require('jsonwebtoken');

const isDevTokenAllowed = () =>
  process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_TOKEN === 'true';

const getRequestUser = (req) => {
  if (req.user) {
    return req.user;
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return null;
  }

  if (token === 'dev-token' && isDevTokenAllowed()) {
    return {
      id: 'dev',
      username: 'dev',
      role: 'admin',
      full_name: 'Developer',
      email: 'dev@example.com'
    };
  }

  if (!process.env.JWT_SECRET) {
    throw new Error('Authentication is not configured');
  }

  return jwt.verify(token, process.env.JWT_SECRET);
};

// Middleware to validate JWT and attach decoded user to the request
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
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

// Middleware to check if user has required role
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    try {
      const decoded = getRequestUser(req);
      if (!decoded) {
        return res.status(401).json({ error: 'Access token required' });
      }

      // Check if user has the required role
      if (decoded.role !== requiredRole && decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
};

// Middleware to check if user has any of the required roles
const requireAnyRole = (requiredRoles) => {
  return (req, res, next) => {
    try {
      const decoded = getRequestUser(req);
      if (!decoded) {
        return res.status(401).json({ error: 'Access token required' });
      }

      // Check if user has any of the required roles or is admin
      if (!requiredRoles.includes(decoded.role) && decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
};

module.exports = {
  authenticate,
  requireRole,
  requireAnyRole
};
