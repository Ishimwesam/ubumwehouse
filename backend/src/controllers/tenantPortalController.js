const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const paymentController = require('./paymentController');
const { rentForPeriodExpression } = require('../services/rentHistoryService');
const { sendPushToAllTenants, sendPushToTenant } = require('./pushController');
const {
  registerTenantPortalClient,
  registerAdminTenantPortalClient,
  notifyTenantStream,
  notifyAdminStream,
  notifyAllTenants
} = require('../services/tenantPortalRealtimeService');

const currentPeriodExpression = "strftime('%Y-%m', 'now')";
const currentTenantRentExpression = rentForPeriodExpression('t', 'u', currentPeriodExpression);
const paymentPeriodForAlias = (alias = 'p') => `COALESCE(${alias}.payment_period, strftime('%Y-%m', ${alias}.payment_date))`;
const lifecycleStatusSql = `
  CASE
    WHEN COALESCE(c.status, '') = 'terminated' THEN 'terminated'
    WHEN COALESCE(c.status, '') = 'active' AND DATE(c.contract_end) < DATE('now') THEN 'ended'
    WHEN COALESCE(c.status, '') = 'active' THEN 'active'
    ELSE 'others'
  END
`;
const tenantPortalJwtOptions = {
  issuer: 'ubumwe-tenant-portal',
  audience: 'tenant-portal-client',
  algorithm: 'HS256'
};

const getTenantPortalToken = (req) => {
  const headerToken = req.headers.authorization?.split(' ')[1];
  if (headerToken) return headerToken;
  const queryToken = String(req.query?.token || '').trim();
  return queryToken || '';
};

const tenantPortalFields = `
  t.id, t.full_name, t.email, t.phone, t.national_id, t.status,
  t.move_in_date, t.move_out_date,
  u.id as unit_id, u.unit_number, u.floor,
  ${currentTenantRentExpression} as monthly_rent,
  b.name as building_name,
  (
    SELECT COALESCE(SUM(p.amount), 0)
    FROM payments p
    WHERE p.tenant_id = t.id
      AND p.unit_id = t.unit_id
      AND ${paymentPeriodForAlias('p')} = strftime('%Y-%m', 'now')
      AND COALESCE(p.payment_status, 'confirmed') = 'confirmed'
  ) as current_period_paid,
  (
    SELECT COALESCE(SUM(p.amount), 0)
    FROM payments p
    WHERE p.tenant_id = t.id
      AND p.unit_id = t.unit_id
      AND ${paymentPeriodForAlias('p')} = strftime('%Y-%m', 'now')
      AND COALESCE(p.payment_status, 'confirmed') = 'pending'
  ) as pending_amount
`;

const normalizeIdentity = (value = '') => String(value || '').trim().toLowerCase();
const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const tail4 = (value = '') => digitsOnly(value).slice(-4);
const normalizeUsername = (value = '') => String(value || '').trim().toLowerCase();
const normalizeMessage = (value = '') => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeText = (value = '') => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeLongText = (value = '') => String(value || '').trim().replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
const maintenanceStatuses = new Set(['open', 'in_progress', 'resolved', 'closed']);
const maintenancePriorities = new Set(['low', 'normal', 'urgent']);
const tenantPaymentMethods = new Set(['cash', 'bank_transfer', 'check', 'mobile_money', 'other']);
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const isValidPeriod = (value) => /^\d{4}-\d{2}$/.test(String(value || ''));
const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must include at least one letter and one number.';
  return '';
};

const getCurrentTenantDueInfo = (tenant, monthlyRent, currentPaid) => {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const moveInDate = tenant.move_in_date ? new Date(tenant.move_in_date) : null;
  const preferredDueDay = moveInDate && !Number.isNaN(moveInDate.getTime()) ? moveInDate.getDate() : 1;
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dueDate = new Date(now.getFullYear(), now.getMonth(), Math.min(preferredDueDay, lastDayOfMonth));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntilDue = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));
  const remainingAmount = Math.max(monthlyRent - currentPaid, 0);

  let status = 'upcoming';
  if (remainingAmount <= 0) status = 'paid';
  else if (daysUntilDue < 0) status = 'overdue';
  else if (daysUntilDue === 0) status = 'due_today';

  return {
    period,
    due_date: `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`,
    days_until_due: daysUntilDue,
    status,
    monthly_rent: monthlyRent,
    paid_amount: currentPaid,
    pending_amount: parseFloat(tenant.pending_amount || 0),
    remaining_amount: remainingAmount
  };
};

const normalizeMaintenanceStatus = (value = 'open') => {
  const normalized = String(value || 'open').trim().toLowerCase();
  return maintenanceStatuses.has(normalized) ? normalized : 'open';
};

const normalizeMaintenancePriority = (value = 'normal') => {
  const normalized = String(value || 'normal').trim().toLowerCase();
  return maintenancePriorities.has(normalized) ? normalized : 'normal';
};

const normalizeTenantPaymentMethod = (value = 'bank_transfer') => {
  const normalized = String(value || 'bank_transfer').trim().toLowerCase();
  return tenantPaymentMethods.has(normalized) ? normalized : null;
};

const createTenantToken = (account, tenant) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('Tenant portal authentication is not configured.');
  }

  return jwt.sign(
    {
      type: 'tenant_portal',
      account_id: account.id,
      tenant_id: tenant.id,
      username: account.username
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.TENANT_PORTAL_JWT_EXPIRE || '30d',
      issuer: tenantPortalJwtOptions.issuer,
      audience: tenantPortalJwtOptions.audience,
      algorithm: tenantPortalJwtOptions.algorithm,
      subject: account.id
    }
  );
};

const sanitizeTenant = (tenant) => {
  const monthlyRent = parseFloat(tenant.monthly_rent || 0);
  const currentPaid = parseFloat(tenant.current_period_paid || 0);
  const pendingAmount = parseFloat(tenant.pending_amount || 0);
  return {
    id: tenant.id,
    full_name: tenant.full_name,
    email: tenant.email,
    phone: tenant.phone,
    status: tenant.status,
    move_in_date: tenant.move_in_date,
    move_out_date: tenant.move_out_date,
    unit_id: tenant.unit_id,
    unit_number: tenant.unit_number,
    floor: tenant.floor,
    building_name: tenant.building_name,
    monthly_rent: monthlyRent,
    current_period_paid: currentPaid,
    pending_amount: pendingAmount,
    balance: Math.max(monthlyRent - currentPaid, 0),
    rent_due: getCurrentTenantDueInfo(tenant, monthlyRent, currentPaid)
  };
};

const isAccessCodeValid = (tenant, accessCode) => {
  const normalizedCode = digitsOnly(accessCode);
  if (normalizedCode.length < 4) return false;
  return [tenant.phone, tenant.national_id].some((value) => tail4(value) === normalizedCode.slice(-4));
};

const findTenantForPortal = ({ identifier, accessCode }, callback) => {
  const normalizedIdentifier = normalizeIdentity(identifier);
  if (!normalizedIdentifier || !accessCode) {
    callback({ status: 400, error: 'Tenant identifier and access code are required.' });
    return;
  }

  db.get(
    `SELECT ${tenantPortalFields}
     FROM tenants t
     LEFT JOIN units u ON t.unit_id = u.id
     LEFT JOIN buildings b ON u.building_id = b.id
     WHERE t.status = 'active'
       AND (
         LOWER(t.email) = ?
         OR LOWER(t.phone) = ?
         OR LOWER(t.national_id) = ?
       )
     LIMIT 1`,
    [normalizedIdentifier, normalizedIdentifier, normalizedIdentifier],
    (err, tenant) => {
      if (err) {
        callback({ status: 500, error: 'Error checking tenant access.' });
        return;
      }

      if (!tenant || !isAccessCodeValid(tenant, accessCode)) {
        callback({ status: 401, error: 'Tenant access details do not match an active tenant.' });
        return;
      }

      callback(null, tenant);
    }
  );
};

const findTenantFromToken = (req, callback) => {
  const token = getTenantPortalToken(req);
  if (!token) {
    callback({ status: 401, error: 'Tenant portal login is required.' });
    return;
  }

  if (!process.env.JWT_SECRET) {
    callback({ status: 500, error: 'Tenant portal authentication is not configured.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: [tenantPortalJwtOptions.algorithm],
      issuer: tenantPortalJwtOptions.issuer,
      audience: tenantPortalJwtOptions.audience
    });
    if (decoded.type !== 'tenant_portal' || !decoded.tenant_id || !decoded.account_id) {
      callback({ status: 401, error: 'Invalid tenant portal token.' });
      return;
    }

    db.get(
      `SELECT ${tenantPortalFields}
       FROM tenants t
       LEFT JOIN units u ON t.unit_id = u.id
       LEFT JOIN buildings b ON u.building_id = b.id
       INNER JOIN tenant_portal_accounts a ON a.tenant_id = t.id
      WHERE t.id = ? AND t.status = 'active' AND a.id = ? AND a.is_active = 1
       LIMIT 1`,
      [decoded.tenant_id, decoded.account_id],
      (err, tenant) => {
        if (err) {
          callback({ status: 500, error: 'Error loading tenant portal account.' });
          return;
        }
        if (!tenant) {
          callback({ status: 401, error: 'Tenant portal account is not active.' });
          return;
        }
        callback(null, tenant);
      }
    );
  } catch (_) {
    callback({ status: 401, error: 'Invalid or expired tenant portal token.' });
  }
};

const findAdminFromToken = (req, callback) => {
  const token = getTenantPortalToken(req);
  if (!token) return callback({ status: 401, error: 'Admin token is required.' });
  if (!process.env.JWT_SECRET) return callback({ status: 500, error: 'Authentication is not configured.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const role = decoded?.role;
    if (!role || !['admin', 'manager'].includes(role)) {
      return callback({ status: 403, error: 'Insufficient permissions.' });
    }
    return callback(null, decoded);
  } catch (_) {
    return callback({ status: 401, error: 'Invalid token.' });
  }
};

const changeTenantPortalPassword = (req, res) => {
  const token = getTenantPortalToken(req);
  const { currentPassword, newPassword } = req.body || {};
  const passwordError = validatePassword(newPassword);

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required.' });
  }
  if (passwordError) return res.status(400).json({ error: passwordError });
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Tenant portal authentication is not configured.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: [tenantPortalJwtOptions.algorithm],
      issuer: tenantPortalJwtOptions.issuer,
      audience: tenantPortalJwtOptions.audience
    });
  } catch (_) {
    return res.status(401).json({ error: 'Invalid or expired tenant portal token.' });
  }

  if (decoded.type !== 'tenant_portal' || !decoded.account_id || !decoded.tenant_id) {
    return res.status(401).json({ error: 'Invalid tenant portal token.' });
  }

  return db.get(
    `SELECT a.id, a.password
     FROM tenant_portal_accounts a
     INNER JOIN tenants t ON t.id = a.tenant_id
     WHERE a.id = ? AND a.tenant_id = ? AND a.is_active = 1 AND t.status = 'active'
     LIMIT 1`,
    [decoded.account_id, decoded.tenant_id],
    (err, account) => {
      if (err) return res.status(500).json({ error: 'Error loading tenant portal account.' });
      if (!account) return res.status(401).json({ error: 'Tenant portal account is not active.' });
      if (!bcrypt.compareSync(currentPassword, account.password)) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      return db.run(
        'UPDATE tenant_portal_accounts SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [hashedPassword, decoded.account_id],
        function onUpdate(updateErr) {
          if (updateErr) return res.status(500).json({ error: 'Error changing tenant portal password.' });
          if (!this.changes) return res.status(404).json({ error: 'Tenant portal account not found.' });
          return res.json({ message: 'Password changed successfully.' });
        }
      );
    }
  );
};

const loadPortalPayload = (tenant, callback) => {
  db.all(
    `SELECT p.id, p.amount, p.payment_date,
            COALESCE(p.payment_period, strftime('%Y-%m', p.payment_date)) as payment_period,
            COALESCE(p.payment_status, 'confirmed') as payment_status,
            p.payment_method, p.receipt_path, p.notes, p.rejection_reason, p.rejected_at,
            u.unit_number, b.name as building_name
     FROM payments p
     LEFT JOIN units u ON u.id = p.unit_id
     LEFT JOIN buildings b ON b.id = u.building_id
     WHERE p.tenant_id = ?
     ORDER BY COALESCE(p.payment_period, strftime('%Y-%m', p.payment_date)) DESC, p.payment_date DESC`,
    [tenant.id],
    (paymentsErr, payments = []) => {
      if (paymentsErr) {
        callback({ status: 500, error: 'Error loading tenant payment history.' });
        return;
      }

      db.all(
        `SELECT c.id, c.contract_start, c.contract_end, c.status,
                ${lifecycleStatusSql} as lifecycle_status, c.terminated_at, c.termination_reason,
                u.unit_number, b.name as building_name
         FROM contracts c
         LEFT JOIN units u ON u.id = c.unit_id
         LEFT JOIN buildings b ON b.id = u.building_id
         WHERE c.tenant_id = ?
         ORDER BY c.contract_start DESC`,
        [tenant.id],
        (contractsErr, contracts = []) => {
          if (contractsErr) {
            callback({ status: 500, error: 'Error loading tenant contracts.' });
            return;
          }

          db.all(
            `SELECT id, tenant_id, unit_id, title, category, priority, description, status,
                    admin_note, resolved_at, created_at, updated_at
             FROM tenant_portal_maintenance_requests
             WHERE tenant_id = ?
             ORDER BY created_at DESC
             LIMIT 50`,
            [tenant.id],
            (maintenanceErr, maintenance_requests = []) => {
              if (maintenanceErr) {
                callback({ status: 500, error: 'Error loading maintenance requests.' });
                return;
              }

              db.all(
                `SELECT id, title, body, audience, published_at, expires_at, created_at
                 FROM tenant_portal_announcements
                 WHERE COALESCE(is_published, 1) = 1
                   AND (expires_at IS NULL OR DATETIME(expires_at) >= DATETIME('now'))
                 ORDER BY COALESCE(published_at, created_at) DESC
                 LIMIT 20`,
                [],
                (announcementsErr, announcements = []) => {
                  if (announcementsErr) {
                    callback({ status: 500, error: 'Error loading announcements.' });
                    return;
                  }

                  callback(null, {
                    tenant: sanitizeTenant(tenant),
                    payments,
                    contracts,
                    maintenance_requests,
                    announcements,
                    checked_at: new Date().toISOString()
                  });
                }
              );
            }
          );
        }
      );
    }
  );
};

const accessTenantPortal = (req, res) => {
  findTenantForPortal(req.body || {}, (err, tenant) => {
    if (err) return res.status(err.status || 500).json({ error: err.error });

    return loadPortalPayload(tenant, (payloadErr, payload) => {
      if (payloadErr) return res.status(payloadErr.status || 500).json({ error: payloadErr.error });
      return res.json(payload);
    });
  });
};

const registerTenantPortal = (req, res) => {
  const { identifier, accessCode, username, password } = req.body || {};
  const normalizedUsername = normalizeUsername(username || identifier);
  const passwordError = validatePassword(password);

  if (!normalizedUsername) return res.status(400).json({ error: 'Username is required.' });
  if (passwordError) return res.status(400).json({ error: passwordError });

  findTenantForPortal({ identifier, accessCode }, (err, tenant) => {
    if (err) return res.status(err.status || 500).json({ error: err.error });

    db.get(
      'SELECT id FROM tenant_portal_accounts WHERE tenant_id = ? OR LOWER(username) = LOWER(?) LIMIT 1',
      [tenant.id, normalizedUsername],
      (accountErr, existingAccount) => {
        if (accountErr) return res.status(500).json({ error: 'Error checking tenant portal account.' });
        if (existingAccount) return res.status(409).json({ error: 'A tenant portal account already exists for this tenant or username.' });

        const account = {
          id: uuidv4(),
          username: normalizedUsername
        };
        const hashedPassword = bcrypt.hashSync(password, 10);

        db.run(
          `INSERT INTO tenant_portal_accounts (id, tenant_id, username, password)
           VALUES (?, ?, ?, ?)`,
          [account.id, tenant.id, normalizedUsername, hashedPassword],
          (insertErr) => {
            if (insertErr) return res.status(500).json({ error: 'Error creating tenant portal account.' });

            const token = createTenantToken(account, tenant);
            return loadPortalPayload(tenant, (payloadErr, payload) => {
              if (payloadErr) return res.status(payloadErr.status || 500).json({ error: payloadErr.error });
              return res.status(201).json({ message: 'Tenant portal account created.', token, account: { username: normalizedUsername }, ...payload });
            });
          }
        );
      }
    );
  });
};

const loginTenantPortal = (req, res) => {
  const { username, password } = req.body || {};
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  if (normalizedUsername.length > 120 || password.length > 160) {
    return res.status(400).json({ error: 'Invalid username or password format.' });
  }

  db.get(
    `SELECT a.id as account_id, a.username, a.password, ${tenantPortalFields}
     FROM tenant_portal_accounts a
     INNER JOIN tenants t ON t.id = a.tenant_id
     LEFT JOIN units u ON t.unit_id = u.id
     LEFT JOIN buildings b ON u.building_id = b.id
    WHERE LOWER(a.username) = LOWER(?) AND a.is_active = 1 AND t.status = 'active'
     LIMIT 1`,
    [normalizedUsername],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Error checking tenant portal login.' });
      if (!row || !bcrypt.compareSync(password, row.password)) {
        return res.status(401).json({ error: 'Invalid tenant portal credentials.' });
      }

      const account = { id: row.account_id, username: row.username };
      const tenant = row;
      const token = createTenantToken(account, tenant);

      db.run('UPDATE tenant_portal_accounts SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [account.id], () => {});

      return loadPortalPayload(tenant, (payloadErr, payload) => {
        if (payloadErr) return res.status(payloadErr.status || 500).json({ error: payloadErr.error });
        return res.json({ message: 'Tenant portal login successful.', token, account: { username: account.username }, ...payload });
      });
    }
  );
};

const getTenantPortalMe = (req, res) => {
  findTenantFromToken(req, (err, tenant) => {
    if (err) return res.status(err.status || 500).json({ error: err.error });

    return loadPortalPayload(tenant, (payloadErr, payload) => {
      if (payloadErr) return res.status(payloadErr.status || 500).json({ error: payloadErr.error });
      return res.json(payload);
    });
  });
};

const getTenantPortalMaintenanceRequests = (req, res) => {
  return findTenantFromToken(req, (err, tenant) => {
    if (err) return res.status(err.status || 500).json({ error: err.error });

    db.all(
      `SELECT id, tenant_id, unit_id, title, category, priority, description, status,
              admin_note, resolved_at, created_at, updated_at
       FROM tenant_portal_maintenance_requests
       WHERE tenant_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [tenant.id],
      (maintenanceErr, rows = []) => {
        if (maintenanceErr) return res.status(500).json({ error: 'Error loading maintenance requests.' });
        return res.json({ requests: rows });
      }
    );
  });
};

const createTenantPortalMaintenanceRequest = (req, res) => {
  return findTenantFromToken(req, (err, tenant) => {
    if (err) return res.status(err.status || 500).json({ error: err.error });

    const title = normalizeText(req.body?.title);
    const category = normalizeText(req.body?.category || 'General').slice(0, 80) || 'General';
    const priority = normalizeMaintenancePriority(req.body?.priority);
    const description = normalizeLongText(req.body?.description);

    if (!title) return res.status(400).json({ error: 'Maintenance title is required.' });
    if (!description) return res.status(400).json({ error: 'Maintenance description is required.' });
    if (title.length > 140) return res.status(400).json({ error: 'Maintenance title is too long (max 140 characters).' });
    if (description.length > 1600) return res.status(400).json({ error: 'Maintenance description is too long (max 1600 characters).' });

    const requestId = uuidv4();
    db.run(
      `INSERT INTO tenant_portal_maintenance_requests
       (id, tenant_id, unit_id, title, category, priority, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`,
      [requestId, tenant.id, tenant.unit_id || null, title, category, priority, description],
      (insertErr) => {
        if (insertErr) return res.status(500).json({ error: 'Error creating maintenance request.' });

        db.get(
          `SELECT r.id, r.tenant_id, r.unit_id, r.title, r.category, r.priority, r.description,
                  r.status, r.admin_note, r.resolved_at, r.created_at, r.updated_at,
                  t.full_name as tenant_name, u.unit_number, b.name as building_name
           FROM tenant_portal_maintenance_requests r
           INNER JOIN tenants t ON t.id = r.tenant_id
           LEFT JOIN units u ON u.id = r.unit_id
           LEFT JOIN buildings b ON b.id = u.building_id
           WHERE r.id = ?`,
          [requestId],
          (fetchErr, row) => {
            if (fetchErr) return res.status(500).json({ error: 'Maintenance request created but failed to load response.' });
            notifyAdminStream({
              event_type: 'maintenance_request',
              id: row.id,
              tenant_id: row.tenant_id,
              tenant_name: row.tenant_name,
              title: row.title,
              priority: row.priority
            });
            return res.status(201).json(row);
          }
        );
      }
    );
  });
};

const updateTenantPortalMaintenanceRequest = (req, res) => {
  return findTenantFromToken(req, (err, tenant) => {
    if (err) return res.status(err.status || 500).json({ error: err.error });

    const requestId = String(req.params.requestId || '').trim();
    const title = normalizeText(req.body?.title);
    const category = normalizeText(req.body?.category || 'General').slice(0, 80) || 'General';
    const priority = normalizeMaintenancePriority(req.body?.priority);
    const description = normalizeLongText(req.body?.description);

    if (!requestId) return res.status(400).json({ error: 'Maintenance request id is required.' });
    if (!title) return res.status(400).json({ error: 'Maintenance title is required.' });
    if (!description) return res.status(400).json({ error: 'Maintenance description is required.' });
    if (title.length > 140) return res.status(400).json({ error: 'Maintenance title is too long (max 140 characters).' });
    if (description.length > 1600) return res.status(400).json({ error: 'Maintenance description is too long (max 1600 characters).' });

    db.get(
      `SELECT id, status
       FROM tenant_portal_maintenance_requests
       WHERE id = ? AND tenant_id = ?`,
      [requestId, tenant.id],
      (findErr, existing) => {
        if (findErr) return res.status(500).json({ error: 'Error loading maintenance request.' });
        if (!existing) return res.status(404).json({ error: 'Maintenance request not found.' });
        if (!['open', 'in_progress'].includes(String(existing.status || '').toLowerCase())) {
          return res.status(400).json({ error: 'Resolved or closed requests can no longer be edited.' });
        }

        return db.run(
          `UPDATE tenant_portal_maintenance_requests
           SET title = ?, category = ?, priority = ?, description = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND tenant_id = ?`,
          [title, category, priority, description, requestId, tenant.id],
          function onUpdate(updateErr) {
            if (updateErr) return res.status(500).json({ error: 'Error updating maintenance request.' });
            if (!this.changes) return res.status(404).json({ error: 'Maintenance request not found.' });

            return db.get(
              `SELECT id, tenant_id, unit_id, title, category, priority, description, status,
                      admin_note, resolved_at, created_at, updated_at
               FROM tenant_portal_maintenance_requests
               WHERE id = ? AND tenant_id = ?`,
              [requestId, tenant.id],
              (fetchErr, row) => {
                if (fetchErr) return res.status(500).json({ error: 'Maintenance request updated but failed to load response.' });
                notifyAdminStream({
                  event_type: 'maintenance_request_updated',
                  id: row.id,
                  tenant_id: row.tenant_id,
                  tenant_name: tenant.full_name,
                  title: row.title,
                  priority: row.priority
                });
                return res.json(row);
              }
            );
          }
        );
      }
    );
  });
};

const deleteTenantPortalMaintenanceRequest = (req, res) => {
  return findTenantFromToken(req, (err, tenant) => {
    if (err) return res.status(err.status || 500).json({ error: err.error });

    const requestId = String(req.params.requestId || '').trim();
    if (!requestId) return res.status(400).json({ error: 'Maintenance request id is required.' });

    db.get(
      `SELECT id, title, status
       FROM tenant_portal_maintenance_requests
       WHERE id = ? AND tenant_id = ?`,
      [requestId, tenant.id],
      (findErr, existing) => {
        if (findErr) return res.status(500).json({ error: 'Error loading maintenance request.' });
        if (!existing) return res.status(404).json({ error: 'Maintenance request not found.' });
        if (String(existing.status || '').toLowerCase() !== 'open') {
          return res.status(400).json({ error: 'Only open requests can be deleted.' });
        }

        return db.run(
          `DELETE FROM tenant_portal_maintenance_requests
           WHERE id = ? AND tenant_id = ?`,
          [requestId, tenant.id],
          function onDelete(deleteErr) {
            if (deleteErr) return res.status(500).json({ error: 'Error deleting maintenance request.' });
            if (!this.changes) return res.status(404).json({ error: 'Maintenance request not found.' });
            notifyAdminStream({
              event_type: 'maintenance_request_deleted',
              id: requestId,
              tenant_id: tenant.id,
              tenant_name: tenant.full_name,
              title: existing.title
            });
            return res.json({ message: 'Maintenance request deleted successfully.', id: requestId });
          }
        );
      }
    );
  });
};

const getTenantPortalAnnouncements = (req, res) => {
  return findTenantFromToken(req, (err) => {
    if (err) return res.status(err.status || 500).json({ error: err.error });

    db.all(
      `SELECT id, title, body, audience, published_at, expires_at, created_at
       FROM tenant_portal_announcements
       WHERE COALESCE(is_published, 1) = 1
         AND (expires_at IS NULL OR DATETIME(expires_at) >= DATETIME('now'))
       ORDER BY COALESCE(published_at, created_at) DESC
       LIMIT 100`,
      [],
      (announcementErr, rows = []) => {
        if (announcementErr) return res.status(500).json({ error: 'Error loading announcements.' });
        return res.json({ announcements: rows });
      }
    );
  });
};

const uploadTenantPaymentProof = (req, res) => {
  return findTenantFromToken(req, (err, tenant) => {
    if (err) return res.status(err.status || 500).json({ error: err.error });

    const amount = Number(req.body?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than zero.' });
    }

    req.body.tenant_id = tenant.id;
    req.body.unit_id = tenant.unit_id;
    req.body.payment_method = req.body.payment_method || 'bank_transfer';
    req.body.notes = `Tenant portal upload${req.body.notes ? `: ${req.body.notes}` : ''}`;

    return paymentController.createPayment(req, res);
  });
};

const updateTenantPaymentProof = (req, res) => {
  return findTenantFromToken(req, (err, tenant) => {
    if (err) return res.status(err.status || 500).json({ error: err.error });

    const paymentId = String(req.params.paymentId || '').trim();
    const amount = Number(req.body?.amount || 0);
    const paymentDate = normalizeText(req.body?.payment_date);
    const paymentPeriod = normalizeText(req.body?.payment_period || (paymentDate ? paymentDate.slice(0, 7) : ''));
    const paymentMethod = normalizeTenantPaymentMethod(req.body?.payment_method);
    const notes = normalizeLongText(req.body?.notes || '');
    const receiptPath = req.file ? `/uploads/${req.file.filename}` : null;

    if (!paymentId) return res.status(400).json({ error: 'Payment id is required.' });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Payment amount must be greater than zero.' });
    if (!isValidDate(paymentDate)) return res.status(400).json({ error: 'Payment date must use YYYY-MM-DD format.' });
    if (!isValidPeriod(paymentPeriod)) return res.status(400).json({ error: 'Payment period must use YYYY-MM format.' });
    if (!paymentMethod) return res.status(400).json({ error: 'Invalid payment method.' });

    db.get(
      `SELECT id, tenant_id, unit_id, payment_status, receipt_path
       FROM payments
       WHERE id = ? AND tenant_id = ?`,
      [paymentId, tenant.id],
      (findErr, payment) => {
        if (findErr) return res.status(500).json({ error: 'Error loading payment proof.' });
        if (!payment) return res.status(404).json({ error: 'Payment proof not found.' });

        const status = String(payment.payment_status || 'confirmed').toLowerCase();
        if (status === 'confirmed') {
          return res.status(400).json({ error: 'Confirmed payments cannot be edited from the tenant portal.' });
        }
        if (!receiptPath && !payment.receipt_path) {
          return res.status(400).json({ error: 'Receipt file is required.' });
        }

        const sql = receiptPath
          ? `UPDATE payments
             SET amount = ?, payment_date = ?, payment_period = ?, payment_method = ?,
                 receipt_path = ?, notes = ?, payment_status = 'pending',
                 rejection_reason = NULL, rejected_by = NULL, rejected_at = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND tenant_id = ?`
          : `UPDATE payments
             SET amount = ?, payment_date = ?, payment_period = ?, payment_method = ?,
                 notes = ?, payment_status = 'pending',
                 rejection_reason = NULL, rejected_by = NULL, rejected_at = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND tenant_id = ?`;

        const params = receiptPath
          ? [amount, paymentDate, paymentPeriod, paymentMethod, receiptPath, `Tenant portal update${notes ? `: ${notes}` : ''}`, paymentId, tenant.id]
          : [amount, paymentDate, paymentPeriod, paymentMethod, `Tenant portal update${notes ? `: ${notes}` : ''}`, paymentId, tenant.id];

        return db.run(sql, params, function onUpdate(updateErr) {
          if (updateErr) return res.status(500).json({ error: 'Error updating payment proof.' });
          if (!this.changes) return res.status(404).json({ error: 'Payment proof not found.' });

          return db.get(
            `SELECT id, amount, payment_date, payment_period, payment_status, payment_method,
                    receipt_path, notes, rejection_reason, rejected_at
             FROM payments
             WHERE id = ? AND tenant_id = ?`,
            [paymentId, tenant.id],
            (fetchErr, row) => {
              if (fetchErr) return res.status(500).json({ error: 'Payment proof updated but failed to load response.' });
              notifyAdminStream({
                event_type: 'tenant_payment_proof_updated',
                id: row.id,
                tenant_id: tenant.id,
                tenant_name: tenant.full_name,
                amount: row.amount,
                payment_period: row.payment_period
              });
              return res.json(row);
            }
          );
        });
      }
    );
  });
};

const deleteTenantPaymentProof = (req, res) => {
  return findTenantFromToken(req, (err, tenant) => {
    if (err) return res.status(err.status || 500).json({ error: err.error });

    const paymentId = String(req.params.paymentId || '').trim();
    if (!paymentId) return res.status(400).json({ error: 'Payment id is required.' });

    db.get(
      `SELECT id, amount, payment_period, payment_status
       FROM payments
       WHERE id = ? AND tenant_id = ?`,
      [paymentId, tenant.id],
      (findErr, payment) => {
        if (findErr) return res.status(500).json({ error: 'Error loading payment proof.' });
        if (!payment) return res.status(404).json({ error: 'Payment proof not found.' });

        const status = String(payment.payment_status || 'confirmed').toLowerCase();
        if (status === 'confirmed') {
          return res.status(400).json({ error: 'Confirmed payments cannot be deleted from the tenant portal.' });
        }

        return db.run(
          'DELETE FROM payments WHERE id = ? AND tenant_id = ?',
          [paymentId, tenant.id],
          function onDelete(deleteErr) {
            if (deleteErr) return res.status(500).json({ error: 'Error deleting payment proof.' });
            if (!this.changes) return res.status(404).json({ error: 'Payment proof not found.' });
            notifyAdminStream({
              event_type: 'tenant_payment_proof_deleted',
              id: paymentId,
              tenant_id: tenant.id,
              tenant_name: tenant.full_name,
              amount: payment.amount,
              payment_period: payment.payment_period
            });
            return res.json({ message: 'Payment proof deleted successfully.', id: paymentId });
          }
        );
      }
    );
  });
};

const getTenantPortalMessages = (req, res) => {
  return findTenantFromToken(req, (err, tenant) => {
    if (err) return res.status(err.status || 500).json({ error: err.error });

    db.all(
      `SELECT m.id, m.tenant_id, m.sender_type, m.sender_user_id, m.message, m.created_at,
              COALESCE(u.full_name, u.username, 'Admin') as sender_name
       FROM tenant_portal_messages m
       LEFT JOIN users u ON u.id = m.sender_user_id
       WHERE m.tenant_id = ?
       ORDER BY m.created_at ASC
       LIMIT 200`,
      [tenant.id],
      (messagesErr, rows = []) => {
        if (messagesErr) return res.status(500).json({ error: 'Error loading support messages.' });

        db.run(
          `UPDATE tenant_portal_messages
           SET read_by_tenant = 1
           WHERE tenant_id = ? AND sender_type = 'admin'`,
          [tenant.id],
          () => {}
        );

        return res.json({ messages: rows });
      }
    );
  });
};

const streamTenantPortalMessages = (req, res) => {
  return findTenantFromToken(req, (err, tenant) => {
    if (err) return res.status(err.status || 500).json({ error: err.error });

    const tenantId = String(tenant.id);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const cleanup = registerTenantPortalClient(tenantId, res);
    req.on('close', cleanup);

    return undefined;
  });
};

const streamAdminTenantMessages = (req, res) => {
  return findAdminFromToken(req, (err) => {
    if (err) return res.status(err.status || 500).json({ error: err.error });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const cleanup = registerAdminTenantPortalClient(res);
    req.on('close', cleanup);

    return undefined;
  });
};

const sendTenantPortalMessage = (req, res) => {
  return findTenantFromToken(req, (err, tenant) => {
    if (err) return res.status(err.status || 500).json({ error: err.error });

    const message = normalizeMessage(req.body?.message);
    if (!message) return res.status(400).json({ error: 'Message is required.' });
    if (message.length > 1000) return res.status(400).json({ error: 'Message is too long (max 1000 characters).' });

    const messageId = uuidv4();
    db.run(
      `INSERT INTO tenant_portal_messages (id, tenant_id, sender_type, message, read_by_tenant, read_by_admin)
       VALUES (?, ?, 'tenant', ?, 1, 0)`,
      [messageId, tenant.id, message],
      (insertErr) => {
        if (insertErr) return res.status(500).json({ error: 'Error sending support message.' });

        db.get(
          `SELECT id, tenant_id, sender_type, sender_user_id, message, created_at, 'You' as sender_name
           FROM tenant_portal_messages
           WHERE id = ?`,
          [messageId],
          (fetchErr, row) => {
            if (fetchErr) return res.status(500).json({ error: 'Support message sent but failed to load response.' });
            notifyTenantStream(tenant.id, row);
            notifyAdminStream({ ...row, tenant_name: tenant.full_name });
            return res.status(201).json(row);
          }
        );
      }
    );
  });
};

const getTenantMessagesForAdmin = (req, res) => {
  const tenantId = String(req.params.tenantId || '').trim();
  if (!tenantId) return res.status(400).json({ error: 'Tenant id is required.' });

  db.all(
    `SELECT m.id, m.tenant_id, m.sender_type, m.sender_user_id, m.message, m.created_at,
            COALESCE(u.full_name, u.username, 'Admin') as sender_name
     FROM tenant_portal_messages m
     LEFT JOIN users u ON u.id = m.sender_user_id
     WHERE m.tenant_id = ?
     ORDER BY m.created_at ASC
     LIMIT 200`,
    [tenantId],
    (err, rows = []) => {
      if (err) return res.status(500).json({ error: 'Error loading tenant support messages.' });

      db.run(
        `UPDATE tenant_portal_messages
         SET read_by_admin = 1
         WHERE tenant_id = ? AND sender_type = 'tenant'`,
        [tenantId],
        () => {}
      );

      return res.json({ messages: rows });
    }
  );
};

const sendAdminMessageToTenant = (req, res) => {
  const tenantId = String(req.params.tenantId || '').trim();
  const message = normalizeMessage(req.body?.message);
  if (!tenantId) return res.status(400).json({ error: 'Tenant id is required.' });
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  if (message.length > 1000) return res.status(400).json({ error: 'Message is too long (max 1000 characters).' });

  db.get('SELECT id FROM tenants WHERE id = ?', [tenantId], (tenantErr, tenantRow) => {
    if (tenantErr) return res.status(500).json({ error: 'Error validating tenant.' });
    if (!tenantRow) return res.status(404).json({ error: 'Tenant not found.' });

    const messageId = uuidv4();
    db.run(
      `INSERT INTO tenant_portal_messages (id, tenant_id, sender_type, sender_user_id, message, read_by_tenant, read_by_admin)
       VALUES (?, ?, 'admin', ?, ?, 0, 1)`,
      [messageId, tenantId, req.user?.id || null, message],
      (insertErr) => {
        if (insertErr) return res.status(500).json({ error: 'Error sending admin support message.' });

        db.get(
          `SELECT m.id, m.tenant_id, m.sender_type, m.sender_user_id, m.message, m.created_at,
                  COALESCE(u.full_name, u.username, 'Admin') as sender_name
           FROM tenant_portal_messages m
           LEFT JOIN users u ON u.id = m.sender_user_id
           WHERE m.id = ?`,
          [messageId],
          (fetchErr, row) => {
            if (fetchErr) return res.status(500).json({ error: 'Message sent but failed to load response.' });
            notifyTenantStream(tenantId, row);
            notifyAdminStream(row);
            sendPushToTenant(
              tenantId,
              'UBUMWE HOUSE LTD',
              row.message || 'You have a new message from support.',
              '/tenant-portal/messages'
            );
            return res.status(201).json(row);
          }
        );
      }
    );
  });
};

const listTenantPortalAccounts = (req, res) => {
  db.all(
    `SELECT a.id, a.tenant_id, a.username, a.is_active, a.last_login_at, a.created_at,
            t.full_name as tenant_name, t.email as tenant_email, t.phone as tenant_phone,
            t.move_in_date, t.move_out_date,
            u.unit_number, b.name as building_name,
            ${currentTenantRentExpression} as monthly_rent,
            (
              SELECT COALESCE(SUM(p.amount), 0)
              FROM payments p
              WHERE p.tenant_id = t.id
                AND p.unit_id = t.unit_id
                AND ${paymentPeriodForAlias('p')} = strftime('%Y-%m', 'now')
                AND COALESCE(p.payment_status, 'confirmed') = 'confirmed'
            ) as current_period_paid,
            (
              SELECT COALESCE(SUM(p.amount), 0)
              FROM payments p
              WHERE p.tenant_id = t.id
                AND p.unit_id = t.unit_id
                AND ${paymentPeriodForAlias('p')} = strftime('%Y-%m', 'now')
                AND COALESCE(p.payment_status, 'confirmed') = 'pending'
            ) as pending_amount,
            (
              SELECT COUNT(*)
              FROM tenant_portal_messages m
              WHERE m.tenant_id = a.tenant_id AND m.sender_type = 'tenant' AND COALESCE(m.read_by_admin, 0) = 0
            ) as unread_tenant_messages
     FROM tenant_portal_accounts a
     INNER JOIN tenants t ON t.id = a.tenant_id
     LEFT JOIN units u ON u.id = t.unit_id
     LEFT JOIN buildings b ON b.id = u.building_id
     ORDER BY a.created_at DESC`,
    [],
    (err, rows = []) => {
      if (err) return res.status(500).json({ error: 'Error loading tenant portal accounts.' });

      const accounts = rows.map((row) => {
        const monthlyRent = parseFloat(row.monthly_rent || 0);
        const currentPaid = parseFloat(row.current_period_paid || 0);
        const pendingAmount = parseFloat(row.pending_amount || 0);
        const due = getCurrentTenantDueInfo(row, monthlyRent, currentPaid);

        return {
          ...row,
          is_active: Boolean(row.is_active),
          monthly_rent: monthlyRent,
          current_period_paid: currentPaid,
          pending_amount: pendingAmount,
          due_period: due.period,
          due_date: due.due_date,
          due_status: due.status,
          days_until_due: due.days_until_due,
          remaining_amount: due.remaining_amount
        };
      });

      return res.json({
        accounts,
        summary: {
          total: accounts.length,
          active: accounts.filter((account) => account.is_active).length,
          inactive: accounts.filter((account) => !account.is_active).length,
          rent_due: accounts.filter((account) => Number(account.remaining_amount || 0) > 0).length,
          overdue: accounts.filter((account) => account.due_status === 'overdue').length,
          due_today: accounts.filter((account) => account.due_status === 'due_today').length,
          total_remaining_amount: accounts.reduce((sum, account) => sum + Number(account.remaining_amount || 0), 0),
          total_pending_amount: accounts.reduce((sum, account) => sum + Number(account.pending_amount || 0), 0)
        }
      });
    }
  );
};

const updateTenantPortalAccountStatus = (req, res) => {
  const { accountId } = req.params;
  const { is_active } = req.body || {};
  const nextStatus = is_active ? 1 : 0;

  db.run(
    'UPDATE tenant_portal_accounts SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [nextStatus, accountId],
    function onUpdate(err) {
      if (err) return res.status(500).json({ error: 'Error updating tenant portal account status.' });
      if (!this.changes) return res.status(404).json({ error: 'Tenant portal account not found.' });
      return res.json({ message: `Tenant portal account ${nextStatus ? 'activated' : 'deactivated'} successfully.` });
    }
  );
};

const resetTenantPortalAccountPassword = (req, res) => {
  const { accountId } = req.params;
  const { password } = req.body || {};
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const hashedPassword = bcrypt.hashSync(password, 10);
  db.run(
    'UPDATE tenant_portal_accounts SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [hashedPassword, accountId],
    function onUpdate(err) {
      if (err) return res.status(500).json({ error: 'Error resetting tenant portal password.' });
      if (!this.changes) return res.status(404).json({ error: 'Tenant portal account not found.' });
      return res.json({ message: 'Tenant portal password reset successfully.' });
    }
  );
};

const listTenantPortalMaintenanceRequestsForAdmin = (req, res) => {
  db.all(
    `SELECT r.id, r.tenant_id, r.unit_id, r.title, r.category, r.priority, r.description,
            r.status, r.admin_note, r.resolved_at, r.created_at, r.updated_at,
            t.full_name as tenant_name, t.email as tenant_email, t.phone as tenant_phone,
            u.unit_number, b.name as building_name,
            COALESCE(resolver.full_name, resolver.username) as resolved_by_name
     FROM tenant_portal_maintenance_requests r
     INNER JOIN tenants t ON t.id = r.tenant_id
     LEFT JOIN units u ON u.id = r.unit_id
     LEFT JOIN buildings b ON b.id = u.building_id
     LEFT JOIN users resolver ON resolver.id = r.resolved_by
     ORDER BY
       CASE r.status
         WHEN 'open' THEN 0
         WHEN 'in_progress' THEN 1
         WHEN 'resolved' THEN 2
         ELSE 3
       END,
       r.created_at DESC
     LIMIT 300`,
    [],
    (err, rows = []) => {
      if (err) return res.status(500).json({ error: 'Error loading maintenance requests.' });
      return res.json({
        requests: rows,
        summary: {
          total: rows.length,
          open: rows.filter((item) => item.status === 'open').length,
          in_progress: rows.filter((item) => item.status === 'in_progress').length,
          resolved: rows.filter((item) => item.status === 'resolved' || item.status === 'closed').length
        }
      });
    }
  );
};

const updateTenantPortalMaintenanceRequestForAdmin = (req, res) => {
  const requestId = String(req.params.requestId || '').trim();
  const status = normalizeMaintenanceStatus(req.body?.status);
  const adminNote = normalizeLongText(req.body?.admin_note || '');
  if (!requestId) return res.status(400).json({ error: 'Maintenance request id is required.' });
  if (adminNote.length > 1200) return res.status(400).json({ error: 'Admin note is too long (max 1200 characters).' });

  const resolvedAtSql = status === 'resolved' || status === 'closed' ? 'CURRENT_TIMESTAMP' : 'NULL';
  const resolvedBy = status === 'resolved' || status === 'closed' ? (req.user?.id || null) : null;

  db.run(
    `UPDATE tenant_portal_maintenance_requests
     SET status = ?, admin_note = ?, resolved_by = ?, resolved_at = ${resolvedAtSql}, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, adminNote, resolvedBy, requestId],
    function onUpdate(err) {
      if (err) return res.status(500).json({ error: 'Error updating maintenance request.' });
      if (!this.changes) return res.status(404).json({ error: 'Maintenance request not found.' });

      db.get(
        `SELECT id, tenant_id, unit_id, title, category, priority, description, status,
                admin_note, resolved_at, created_at, updated_at
         FROM tenant_portal_maintenance_requests
         WHERE id = ?`,
        [requestId],
          (fetchErr, row) => {
            if (fetchErr) return res.status(500).json({ error: 'Maintenance request updated but failed to load response.' });
          notifyTenantStream(row.tenant_id, {
            event_type: 'tenant_maintenance_update',
            id: `maintenance-${row.id}-${row.updated_at || Date.now()}`,
            maintenance_id: row.id,
            title: 'Maintenance updated',
            message: `${row.title || 'Your maintenance request'} is now ${String(row.status || 'updated').replace(/_/g, ' ')}.`,
            status: row.status,
            admin_note: row.admin_note,
            created_at: row.updated_at || new Date().toISOString(),
            actionPath: '/tenant-portal/maintenance'
          });
          sendPushToTenant(
            row.tenant_id,
            'Maintenance updated',
            `${row.title || 'Your request'} is now ${String(row.status || 'updated').replace(/_/g, ' ')}.`,
            '/tenant-portal/maintenance'
          );
          return res.json(row);
        }
      );
    }
  );
};

const listTenantPortalAnnouncementsForAdmin = (req, res) => {
  db.all(
    `SELECT a.id, a.title, a.body, a.audience, a.is_published, a.published_at,
            a.expires_at, a.created_at, a.updated_at,
            COALESCE(u.full_name, u.username) as created_by_name
     FROM tenant_portal_announcements a
     LEFT JOIN users u ON u.id = a.created_by
     ORDER BY COALESCE(a.published_at, a.created_at) DESC
     LIMIT 200`,
    [],
    (err, rows = []) => {
      if (err) return res.status(500).json({ error: 'Error loading announcements.' });
      return res.json({
        announcements: rows.map((row) => ({ ...row, is_published: Boolean(row.is_published) }))
      });
    }
  );
};

const createTenantPortalAnnouncementForAdmin = (req, res) => {
  const title = normalizeText(req.body?.title);
  const body = normalizeLongText(req.body?.body);
  const audience = normalizeText(req.body?.audience || 'all').slice(0, 40) || 'all';
  const isPublished = req.body?.is_published === false ? 0 : 1;
  const expiresAt = normalizeText(req.body?.expires_at || '');

  if (!title) return res.status(400).json({ error: 'Announcement title is required.' });
  if (!body) return res.status(400).json({ error: 'Announcement body is required.' });
  if (title.length > 140) return res.status(400).json({ error: 'Announcement title is too long (max 140 characters).' });
  if (body.length > 2200) return res.status(400).json({ error: 'Announcement body is too long (max 2200 characters).' });

  const announcementId = uuidv4();
  db.run(
    `INSERT INTO tenant_portal_announcements
     (id, title, body, audience, is_published, created_by, published_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ${isPublished ? 'CURRENT_TIMESTAMP' : 'NULL'}, ?)`,
    [announcementId, title, body, audience, isPublished, req.user?.id || null, expiresAt || null],
    (insertErr) => {
      if (insertErr) return res.status(500).json({ error: 'Error creating announcement.' });

      db.get('SELECT * FROM tenant_portal_announcements WHERE id = ?', [announcementId], (fetchErr, row) => {
        if (fetchErr) return res.status(500).json({ error: 'Announcement created but failed to load response.' });
        if (row.is_published) {
          notifyAllTenants({
            event_type: 'tenant_announcement',
            id: `announcement-${row.id}-${row.published_at || row.created_at || Date.now()}`,
            announcement_id: row.id,
            title: row.title,
            message: row.body,
            created_at: row.published_at || row.created_at || new Date().toISOString(),
            actionPath: '/tenant-portal/announcements'
          });
          sendPushToAllTenants(row.title, row.body, '/tenant-portal/announcements');
        }
        return res.status(201).json({ ...row, is_published: Boolean(row.is_published) });
      });
    }
  );
};

const updateTenantPortalAnnouncementForAdmin = (req, res) => {
  const announcementId = String(req.params.announcementId || '').trim();
  const title = normalizeText(req.body?.title);
  const body = normalizeLongText(req.body?.body);
  const audience = normalizeText(req.body?.audience || 'all').slice(0, 40) || 'all';
  const isPublished = req.body?.is_published ? 1 : 0;
  const expiresAt = normalizeText(req.body?.expires_at || '');

  if (!announcementId) return res.status(400).json({ error: 'Announcement id is required.' });
  if (!title) return res.status(400).json({ error: 'Announcement title is required.' });
  if (!body) return res.status(400).json({ error: 'Announcement body is required.' });
  if (title.length > 140) return res.status(400).json({ error: 'Announcement title is too long (max 140 characters).' });
  if (body.length > 2200) return res.status(400).json({ error: 'Announcement body is too long (max 2200 characters).' });

  db.run(
    `UPDATE tenant_portal_announcements
     SET title = ?, body = ?, audience = ?, is_published = ?,
         published_at = CASE WHEN ? = 1 AND published_at IS NULL THEN CURRENT_TIMESTAMP ELSE published_at END,
         expires_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [title, body, audience, isPublished, isPublished, expiresAt || null, announcementId],
    function onUpdate(err) {
      if (err) return res.status(500).json({ error: 'Error updating announcement.' });
      if (!this.changes) return res.status(404).json({ error: 'Announcement not found.' });

      db.get('SELECT * FROM tenant_portal_announcements WHERE id = ?', [announcementId], (fetchErr, row) => {
        if (fetchErr) return res.status(500).json({ error: 'Announcement updated but failed to load response.' });
        if (row.is_published) {
          notifyAllTenants({
            event_type: 'tenant_announcement',
            id: `announcement-${row.id}-${row.updated_at || row.published_at || Date.now()}`,
            announcement_id: row.id,
            title: row.title,
            message: row.body,
            created_at: row.updated_at || row.published_at || row.created_at || new Date().toISOString(),
            actionPath: '/tenant-portal/announcements'
          });
          sendPushToAllTenants(row.title, row.body, '/tenant-portal/announcements');
        }
        return res.json({ ...row, is_published: Boolean(row.is_published) });
      });
    }
  );
};

const deleteTenantPortalAnnouncementForAdmin = (req, res) => {
  const announcementId = String(req.params.announcementId || '').trim();
  if (!announcementId) return res.status(400).json({ error: 'Announcement id is required.' });

  db.run('DELETE FROM tenant_portal_announcements WHERE id = ?', [announcementId], function onDelete(err) {
    if (err) return res.status(500).json({ error: 'Error deleting announcement.' });
    if (!this.changes) return res.status(404).json({ error: 'Announcement not found.' });
    return res.json({ message: 'Announcement deleted successfully.' });
  });
};

module.exports = {
  accessTenantPortal,
  registerTenantPortal,
  loginTenantPortal,
  changeTenantPortalPassword,
  getTenantPortalMe,
  getTenantPortalMaintenanceRequests,
  createTenantPortalMaintenanceRequest,
  updateTenantPortalMaintenanceRequest,
  deleteTenantPortalMaintenanceRequest,
  getTenantPortalAnnouncements,
  uploadTenantPaymentProof,
  updateTenantPaymentProof,
  deleteTenantPaymentProof,
  getTenantPortalMessages,
  streamTenantPortalMessages,
  sendTenantPortalMessage,
  streamAdminTenantMessages,
  getTenantMessagesForAdmin,
  sendAdminMessageToTenant,
  listTenantPortalAccounts,
  updateTenantPortalAccountStatus,
  resetTenantPortalAccountPassword,
  listTenantPortalMaintenanceRequestsForAdmin,
  updateTenantPortalMaintenanceRequestForAdmin,
  listTenantPortalAnnouncementsForAdmin,
  createTenantPortalAnnouncementForAdmin,
  updateTenantPortalAnnouncementForAdmin,
  deleteTenantPortalAnnouncementForAdmin
};
