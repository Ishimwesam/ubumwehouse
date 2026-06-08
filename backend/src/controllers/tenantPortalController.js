const db = require('../../config/database');
const paymentController = require('./paymentController');
const { rentForPeriodExpression } = require('../services/rentHistoryService');

const currentPeriodExpression = "strftime('%Y-%m', 'now')";
const currentTenantRentExpression = rentForPeriodExpression('t', 'u', currentPeriodExpression);
const paymentPeriodForAlias = (alias = 'p') => `COALESCE(${alias}.payment_period, strftime('%Y-%m', ${alias}.payment_date))`;

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
                c.lifecycle_status, c.terminated_at, c.termination_reason,
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

const uploadTenantPaymentProof = (req, res) => {
  findTenantForPortal(req.body || {}, (err, tenant) => {
    if (err) return res.status(err.status || 500).json({ error: err.error });

    req.body.tenant_id = tenant.id;
    req.body.unit_id = tenant.unit_id;
    req.body.payment_method = req.body.payment_method || 'bank_transfer';
    req.body.notes = `Tenant portal upload${req.body.notes ? `: ${req.body.notes}` : ''}`;

    return paymentController.createPayment(req, res);
  });
};

module.exports = {
  accessTenantPortal,
  uploadTenantPaymentProof
};
