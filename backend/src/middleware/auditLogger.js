const { logAuditEvent } = require('../services/auditService');

const shouldAudit = (req) => {
  if (!req.path.startsWith('/api')) return false;
  if (req.path === '/api/health') return false;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return true;
  return /\/(report|export|pdf|backup|audit)/i.test(req.path);
};

const getAction = (req) => {
  const resource = req.path
    .replace(/^\/api\/?/, '')
    .split('/')
    .filter(Boolean)
    .slice(0, 2)
    .join(':') || 'api';

  if (req.method === 'POST' && req.path.includes('/auth/login')) return 'AUTH_LOGIN_ATTEMPT';
  if (req.method === 'POST' && req.path.includes('/auth/register')) return 'AUTH_REGISTER_ATTEMPT';
  if (req.method === 'GET' && /\/(report|export|pdf)/i.test(req.path)) return `EXPORT:${resource}`;
  return `${req.method}:${resource}`;
};

const auditLogger = (req, res, next) => {
  if (!shouldAudit(req)) return next();

  const startedAt = Date.now();
  res.on('finish', () => {
    logAuditEvent({
      req,
      action: getAction(req),
      statusCode: res.statusCode,
      details: {
        duration_ms: Date.now() - startedAt,
        success: res.statusCode < 400
      }
    });
  });

  return next();
};

module.exports = auditLogger;
