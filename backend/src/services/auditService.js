const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const { getClientIp } = require('../middleware/rateLimit');

const sanitizeDetails = (details = {}) => {
  const blockedKeys = new Set(['password', 'newPassword', 'token', 'otp', 'reset_token', 'login_otp']);
  const safe = {};

  Object.entries(details || {}).forEach(([key, value]) => {
    if (blockedKeys.has(key)) return;
    if (value === undefined) return;
    safe[key] = typeof value === 'string' ? value.slice(0, 500) : value;
  });

  return safe;
};

const logAuditEvent = ({
  req,
  user = null,
  action,
  statusCode,
  details = {}
}) => {
  if (!action) return;

  const actor = user || req?.user || {};
  const payload = JSON.stringify(sanitizeDetails(details)).slice(0, 4000);

  db.run(
    `INSERT INTO audit_logs
      (id, user_id, username, role, action, method, path, status_code, ip_address, user_agent, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      actor.id || null,
      actor.username || actor.email || null,
      actor.role || null,
      action,
      req?.method || null,
      req?.originalUrl || req?.url || null,
      statusCode || null,
      req ? getClientIp(req) : null,
      req?.headers?.['user-agent'] || null,
      payload
    ],
    (err) => {
      if (err) {
        console.error('Audit log failed:', err.message);
      }
    }
  );
};

module.exports = {
  logAuditEvent
};
