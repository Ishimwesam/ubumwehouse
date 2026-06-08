const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const paymentController = require('./paymentController');
const { rentForPeriodExpression } = require('../services/rentHistoryService');

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
const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must include at least one letter and one number.';
  return '';
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
    pending_amount: parseFloat(tenant.pending_amount || 0),
    balance: Math.max(monthlyRent - currentPaid, 0)
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
  const token = req.headers.authorization?.split(' ')[1];
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

const loadPortalPayload = (tenant, callback) => {
  db.all(
    `SELECT p.id, p.amount, p.payment_date,
            COALESCE(p.payment_period, strftime('%Y-%m', p.payment_date)) as payment_period,
            COALESCE(p.payment_status, 'confirmed') as payment_status,
            p.payment_method, p.receipt_path, p.notes,
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

          callback(null, {
            tenant: sanitizeTenant(tenant),
            payments,
            contracts,
            checked_at: new Date().toISOString()
          });
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
    `SELECT a.id as account_id, a.username, a.password, t.id as tenant_id
     FROM tenant_portal_accounts a
     INNER JOIN tenants t ON t.id = a.tenant_id
    WHERE LOWER(a.username) = LOWER(?) AND a.is_active = 1 AND t.status = 'active'
     LIMIT 1`,
    [normalizedUsername],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Error checking tenant portal login.' });
      if (!row || !bcrypt.compareSync(password, row.password)) {
        return res.status(401).json({ error: 'Invalid tenant portal credentials.' });
      }

      const account = { id: row.account_id, username: row.username };
      const tenant = { id: row.tenant_id };
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
            u.unit_number, b.name as building_name,
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

      const accounts = rows.map((row) => ({
        ...row,
        is_active: Boolean(row.is_active)
      }));

      return res.json({
        accounts,
        summary: {
          total: accounts.length,
          active: accounts.filter((account) => account.is_active).length,
          inactive: accounts.filter((account) => !account.is_active).length
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

module.exports = {
  accessTenantPortal,
  registerTenantPortal,
  loginTenantPortal,
  getTenantPortalMe,
  uploadTenantPaymentProof,
  getTenantPortalMessages,
  sendTenantPortalMessage,
  getTenantMessagesForAdmin,
  sendAdminMessageToTenant,
  listTenantPortalAccounts,
  updateTenantPortalAccountStatus,
  resetTenantPortalAccountPassword
};
