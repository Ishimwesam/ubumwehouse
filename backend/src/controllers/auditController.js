const db = require('../../config/database');

const getAuditLogs = (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '200', 10) || 200, 1000);

  db.all(
    `SELECT id, user_id, username, role, action, method, path, status_code,
            ip_address, user_agent, details, created_at
     FROM audit_logs
     ORDER BY datetime(created_at) DESC
     LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching audit logs' });
      }

      res.json(rows.map((row) => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : {}
      })));
    }
  );
};

module.exports = {
  getAuditLogs
};
