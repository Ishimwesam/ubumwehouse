const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');

const getCurrentPeriod = () => new Date().toISOString().slice(0, 7);
const getPreviousPeriod = (period) => {
  const [year, month] = String(period).split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getPeriodFromDate = (dateValue) => {
  if (!dateValue) return getCurrentPeriod();
  return String(dateValue).slice(0, 7);
};

const rentForPeriodExpression = (tenantAlias = 't', unitAlias = 'u', periodExpression = "strftime('%Y-%m', 'now')") => `
  COALESCE((
    SELECT rh.amount
    FROM tenant_rent_history rh
    WHERE rh.tenant_id = ${tenantAlias}.id
      AND rh.unit_id = ${unitAlias}.id
      AND rh.start_period <= ${periodExpression}
      AND (rh.end_period IS NULL OR rh.end_period >= ${periodExpression})
    ORDER BY rh.start_period DESC
    LIMIT 1
  ), ${unitAlias}.monthly_rent, 0)
`;

const paymentRentForPeriodExpression = (periodExpression = "COALESCE(p.payment_period, strftime('%Y-%m', p.payment_date))") => `
  COALESCE((
    SELECT rh.amount
    FROM tenant_rent_history rh
    WHERE rh.tenant_id = p.tenant_id
      AND rh.unit_id = p.unit_id
      AND rh.start_period <= ${periodExpression}
      AND (rh.end_period IS NULL OR rh.end_period >= ${periodExpression})
    ORDER BY rh.start_period DESC
    LIMIT 1
  ), u.monthly_rent, 0)
`;

const getRentForPeriod = ({ tenantId, unitId, period }, callback) => {
  db.get(
    `
      SELECT COALESCE((
        SELECT rh.amount
        FROM tenant_rent_history rh
        WHERE rh.tenant_id = ?
          AND rh.unit_id = ?
          AND rh.start_period <= ?
          AND (rh.end_period IS NULL OR rh.end_period >= ?)
        ORDER BY rh.start_period DESC
        LIMIT 1
      ), u.monthly_rent, 0) as rent
      FROM units u
      WHERE u.id = ?
    `,
    [tenantId, unitId, period, period, unitId],
    (err, row) => {
      if (err) {
        callback(err);
        return;
      }

      callback(null, parseFloat(row?.rent || 0));
    }
  );
};

const ensureTenantRentHistory = ({ tenantId, unitId, amount, startPeriod }, callback = () => {}) => {
  if (!tenantId || !unitId) {
    callback();
    return;
  }

  db.get(
    'SELECT id FROM tenant_rent_history WHERE tenant_id = ? AND unit_id = ? LIMIT 1',
    [tenantId, unitId],
    (findErr, existing) => {
      if (findErr) {
        callback(findErr);
        return;
      }

      if (existing) {
        callback();
        return;
      }

      db.run(
        'INSERT INTO tenant_rent_history (id, tenant_id, unit_id, amount, start_period, end_period) VALUES (?, ?, ?, ?, ?, NULL)',
        [uuidv4(), tenantId, unitId, amount || 0, startPeriod || getCurrentPeriod()],
        callback
      );
    }
  );
};

const createRentChangeForUnitTenants = ({ unitId, amount, startPeriod }, callback = () => {}) => {
  if (!unitId || amount === undefined || amount === null || amount === '') {
    callback();
    return;
  }

  const nextStartPeriod = startPeriod || getCurrentPeriod();
  const previousPeriod = getPreviousPeriod(nextStartPeriod);

  db.all(
    "SELECT id, move_in_date FROM tenants WHERE unit_id = ? AND status = 'active'",
    [unitId],
    (tenantErr, tenants) => {
      if (tenantErr) {
        callback(tenantErr);
        return;
      }

      db.serialize(() => {
        let pending = tenants.length;
        if (!pending) {
          callback();
          return;
        }

        tenants.forEach((tenant) => {
          db.run(
            `UPDATE tenant_rent_history
             SET end_period = ?
             WHERE tenant_id = ? AND unit_id = ? AND end_period IS NULL AND start_period < ?`,
            [previousPeriod, tenant.id, unitId, nextStartPeriod],
            (closeErr) => {
              if (closeErr) {
                callback(closeErr);
                callback = () => {};
                return;
              }

              db.get(
                'SELECT id FROM tenant_rent_history WHERE tenant_id = ? AND unit_id = ? AND start_period = ?',
                [tenant.id, unitId, nextStartPeriod],
                (findErr, existing) => {
                  if (findErr) {
                    callback(findErr);
                    callback = () => {};
                    return;
                  }

                  const done = (writeErr) => {
                    if (writeErr) {
                      callback(writeErr);
                      callback = () => {};
                      return;
                    }
                    pending -= 1;
                    if (pending === 0) callback();
                  };

                  if (existing) {
                    db.run('UPDATE tenant_rent_history SET amount = ?, end_period = NULL WHERE id = ?', [amount, existing.id], done);
                  } else {
                    db.run(
                      'INSERT INTO tenant_rent_history (id, tenant_id, unit_id, amount, start_period, end_period) VALUES (?, ?, ?, ?, ?, NULL)',
                      [uuidv4(), tenant.id, unitId, amount, nextStartPeriod || getPeriodFromDate(tenant.move_in_date)],
                      done
                    );
                  }
                }
              );
            }
          );
        });
      });
    }
  );
};

module.exports = {
  createRentChangeForUnitTenants,
  ensureTenantRentHistory,
  getCurrentPeriod,
  getPeriodFromDate,
  getRentForPeriod,
  paymentRentForPeriodExpression,
  rentForPeriodExpression
};
