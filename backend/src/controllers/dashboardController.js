const db = require('../../config/database');
const { rentForPeriodExpression } = require('../services/rentHistoryService');

const confirmedWhere = "COALESCE(payment_status, 'confirmed') = 'confirmed'";
const currentPeriodExpression = "strftime('%Y-%m', 'now')";
const currentTenantRentExpression = rentForPeriodExpression('t', 'u', currentPeriodExpression);
const confirmedPaymentWhereForAlias = (alias = 'p') => confirmedWhere.replaceAll('payment_status', `${alias}.payment_status`);
const paymentPeriodForAlias = (alias = 'p') => `COALESCE(${alias}.payment_period, strftime('%Y-%m', ${alias}.payment_date))`;

const getDashboardSummary = (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toISOString().slice(0, 7);

  const queries = {
    totalTenants: ['SELECT COUNT(*) as value FROM tenants WHERE status = ?', ['active']],
    totalUnits: ['SELECT COUNT(*) as value FROM units', []],
    todayIncome: [
      `SELECT COALESCE(SUM(p.amount), 0) as value
       FROM payments p
       INNER JOIN tenants t ON p.tenant_id = t.id
       WHERE DATE(p.payment_date) = ?
         AND t.status = 'active'
         AND ${confirmedWhere.replaceAll('payment_status', 'p.payment_status')}`,
      [today]
    ],
    monthIncome: [
      `SELECT COALESCE(SUM(p.amount), 0) as value
       FROM payments p
       INNER JOIN tenants t ON p.tenant_id = t.id
       WHERE ${paymentPeriodForAlias('p')} = ?
         AND t.status = 'active'
         AND ${confirmedPaymentWhereForAlias('p')}`,
      [currentMonth]
    ],
    totalIncome: [
      `SELECT COALESCE(SUM(p.amount), 0) as value
       FROM payments p
       INNER JOIN tenants t ON p.tenant_id = t.id
       WHERE t.status = 'active'
         AND ${confirmedPaymentWhereForAlias('p')}`,
      []
    ],
    unpaidBalances: [
      `SELECT COALESCE(SUM(MAX(${currentTenantRentExpression} - (
         SELECT COALESCE(SUM(p.amount), 0)
         FROM payments p
         WHERE p.tenant_id = t.id
           AND p.unit_id = t.unit_id
           AND ${paymentPeriodForAlias('p')} = ?
           AND ${confirmedPaymentWhereForAlias('p')}
       ), 0)), 0) as value
       FROM tenants t
       LEFT JOIN units u ON t.unit_id = u.id
       WHERE t.status = 'active' AND t.unit_id IS NOT NULL`,
      [currentMonth]
    ],
    expectedIncome: [
      `SELECT COALESCE(SUM(${currentTenantRentExpression}), 0) as value
       FROM tenants t
       LEFT JOIN units u ON t.unit_id = u.id
       WHERE t.status = 'active' AND t.unit_id IS NOT NULL`,
      []
    ],
    pendingPayments: [
      `SELECT COUNT(*) as value
       FROM payments p
       INNER JOIN tenants t ON p.tenant_id = t.id
       WHERE t.status = 'active' AND COALESCE(p.payment_status, 'confirmed') = 'pending'`,
      []
    ]
  };

  const result = {};
  const entries = Object.entries(queries);
  let completed = 0;

  entries.forEach(([key, [sql, params]]) => {
    db.get(sql, params, (err, row) => {
      if (err) return res.status(500).json({ error: `Error loading ${key}` });

      result[key] = row?.value || 0;
      completed += 1;

      if (completed === entries.length) {
        const monthIncome = parseFloat(result.monthIncome || 0);
        const expectedIncome = parseFloat(result.expectedIncome || 0);

        result.hasCollectionOverflow = monthIncome > expectedIncome;
        result.collectionDelta = expectedIncome - monthIncome;

        db.all(
          `
            SELECT p.id, p.amount, p.payment_date, COALESCE(p.payment_status, 'confirmed') as payment_status,
                   t.id as tenant_id, t.full_name, u.unit_number
            FROM payments p
            LEFT JOIN tenants t ON p.tenant_id = t.id
            LEFT JOIN units u ON p.unit_id = u.id
            WHERE t.id IS NOT NULL
            ORDER BY p.payment_date DESC
            LIMIT 10
          `,
          [],
          (recentErr, recentPayments) => {
            if (recentErr) return res.status(500).json({ error: 'Error fetching recent payments' });
            res.json({ ...result, recentPayments: recentPayments || [] });
          }
        );
      }
    });
  });
};

const getMonthlyIncome = (req, res) => {
  db.all(
    `
      SELECT COALESCE(payment_period, strftime('%Y-%m', payment_date)) as month, SUM(amount) as total, COUNT(*) as count
      FROM payments
      WHERE ${confirmedWhere}
      GROUP BY COALESCE(payment_period, strftime('%Y-%m', payment_date))
      ORDER BY month DESC
      LIMIT 12
    `,
    [],
    (err, data) => {
      if (err) return res.status(500).json({ error: 'Error fetching monthly income' });
      res.json(data);
    }
  );
};

const getUnpaidTenants = (req, res) => {
  const currentMonth = new Date().toISOString().slice(0, 7);

  db.all(
    `
      SELECT t.id, t.full_name, t.email, t.phone, u.unit_number,
             ${currentTenantRentExpression} as monthly_rent,
             b.name as building_name,
             (
               SELECT COALESCE(SUM(p.amount), 0)
               FROM payments p
               WHERE p.tenant_id = t.id
                 AND p.unit_id = t.unit_id
                 AND ${paymentPeriodForAlias('p')} = ?
                 AND ${confirmedPaymentWhereForAlias('p')}
             ) as confirmed_paid,
             (
               SELECT COALESCE(SUM(p.amount), 0)
               FROM payments p
               WHERE p.tenant_id = t.id
                 AND p.unit_id = t.unit_id
                 AND ${paymentPeriodForAlias('p')} = ?
                 AND COALESCE(p.payment_status, 'confirmed') = 'pending'
             ) as pending_amount,
             MAX(${currentTenantRentExpression} - (
               SELECT COALESCE(SUM(p.amount), 0)
               FROM payments p
               WHERE p.tenant_id = t.id
                 AND p.unit_id = t.unit_id
                 AND ${paymentPeriodForAlias('p')} = ?
                 AND ${confirmedPaymentWhereForAlias('p')}
             ), 0) as balance
      FROM tenants t
      LEFT JOIN units u ON t.unit_id = u.id
      LEFT JOIN buildings b ON u.building_id = b.id
      WHERE t.status = 'active'
        AND t.unit_id IS NOT NULL
        AND MAX(${currentTenantRentExpression} - (
          SELECT COALESCE(SUM(p.amount), 0)
          FROM payments p
          WHERE p.tenant_id = t.id
            AND p.unit_id = t.unit_id
            AND ${paymentPeriodForAlias('p')} = ?
            AND ${confirmedPaymentWhereForAlias('p')}
        ), 0) > 0
      ORDER BY balance DESC
    `,
    [currentMonth, currentMonth, currentMonth, currentMonth],
    (err, tenants) => {
      if (err) return res.status(500).json({ error: 'Error fetching unpaid tenants' });
      res.json(tenants);
    }
  );
};

const getOccupancyReport = (req, res) => {
  db.all(
    `
      SELECT b.id, b.name as building_name, COUNT(u.id) as total_units,
             SUM(CASE WHEN u.status = 'occupied' THEN 1 ELSE 0 END) as occupied_units,
             SUM(CASE WHEN u.status = 'available' THEN 1 ELSE 0 END) as available_units,
             ROUND((SUM(CASE WHEN u.status = 'occupied' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(u.id), 0)), 2) as occupancy_rate
      FROM buildings b
      LEFT JOIN units u ON b.id = u.building_id
      GROUP BY b.id, b.name
    `,
    [],
    (err, buildings) => {
      if (err) return res.status(500).json({ error: 'Error fetching occupancy report' });
      res.json(buildings);
    }
  );
};

const getBuildingPerformance = (req, res) => {
  const currentMonth = new Date().toISOString().slice(0, 7);

  db.all(
    `
      SELECT b.id, b.name as building_name,
             (
               SELECT COUNT(*)
               FROM tenants t
               LEFT JOIN units u2 ON t.unit_id = u2.id
               WHERE t.status = 'active' AND u2.building_id = b.id
             ) as tenant_count,
             (
               SELECT COUNT(*)
               FROM units u2
               WHERE u2.building_id = b.id
             ) as total_units,
             (
               SELECT COUNT(*)
               FROM units u2
               WHERE u2.building_id = b.id AND u2.status = 'occupied'
             ) as occupied_units,
             (
               SELECT COUNT(*)
               FROM units u2
               WHERE u2.building_id = b.id AND u2.status = 'available'
             ) as available_units,
             (
               SELECT COALESCE(SUM(${rentForPeriodExpression('t', 'u2', currentPeriodExpression)}), 0)
               FROM tenants t
               LEFT JOIN units u2 ON t.unit_id = u2.id
               WHERE t.status = 'active' AND u2.building_id = b.id
             ) as expected_income,
             (
               SELECT COALESCE(SUM(p.amount), 0)
               FROM payments p
               LEFT JOIN units u2 ON p.unit_id = u2.id
               WHERE u2.building_id = b.id
                 AND ${paymentPeriodForAlias('p')} = ?
                 AND ${confirmedPaymentWhereForAlias('p')}
             ) as this_month_income,
             (
               SELECT COALESCE(SUM(p.amount), 0)
               FROM payments p
               LEFT JOIN units u2 ON p.unit_id = u2.id
               WHERE u2.building_id = b.id
                 AND ${confirmedPaymentWhereForAlias('p')}
             ) as total_income
      FROM buildings b
      ORDER BY this_month_income DESC
    `,
    [currentMonth],
    (err, buildings) => {
      if (err) return res.status(500).json({ error: 'Error fetching building performance' });

      const normalized = (buildings || []).map((building) => {
        const expected = parseFloat(building.expected_income || 0);
        const collected = parseFloat(building.this_month_income || 0);

        return {
          ...building,
          has_collection_overflow: collected > expected,
          collection_delta: expected - collected
        };
      });

      res.json(normalized);
    }
  );
};

const getProfitTrends = (req, res) => {
  db.all(
    `
      SELECT COALESCE(payment_period, strftime('%Y-%m', payment_date)) as month,
             SUM(amount) as income,
             COUNT(*) as payment_count,
             ROUND(AVG(amount), 2) as avg_payment
      FROM payments
      WHERE ${confirmedWhere}
      GROUP BY COALESCE(payment_period, strftime('%Y-%m', payment_date))
      ORDER BY month DESC
      LIMIT 12
    `,
    [],
    (trendErr, monthlyTrends) => {
      if (trendErr) return res.status(500).json({ error: 'Error fetching profit trends' });

      db.all(
        `
          SELECT t.id, t.full_name, COUNT(p.id) as total_payments,
                 ROUND(AVG(CAST(strftime('%d', p.payment_date) AS INTEGER)), 1) as avg_payment_day,
                 MAX(CAST(strftime('%d', p.payment_date) AS INTEGER)) as latest_payment_day
          FROM tenants t
          LEFT JOIN payments p ON t.id = p.tenant_id AND ${confirmedPaymentWhereForAlias('p')}
          GROUP BY t.id, t.full_name
          HAVING avg_payment_day > 10
          ORDER BY avg_payment_day DESC
          LIMIT 10
        `,
        [],
        (delayErr, delayedTenants) => {
          if (delayErr) return res.status(500).json({ error: 'Error fetching delayed tenants' });
          res.json({ monthlyTrends, delayedTenants });
        }
      );
    }
  );
};

const getMonthlyExpectedIncome = (req, res) => {
  const currentMonth = new Date().toISOString().slice(0, 7);

  db.get(
    `SELECT COALESCE(SUM(${currentTenantRentExpression}), 0) as expectedIncome
     FROM tenants t
     LEFT JOIN units u ON t.unit_id = u.id
     WHERE t.status = 'active' AND t.unit_id IS NOT NULL`,
    [],
    (expectedErr, expected) => {
      if (expectedErr) return res.status(500).json({ error: 'Error calculating expected income' });

      db.get(
        `SELECT COALESCE(SUM(amount), 0) as actualIncome
         FROM payments
         WHERE COALESCE(payment_period, strftime('%Y-%m', payment_date)) = ?
           AND ${confirmedWhere}`,
        [currentMonth],
        (actualErr, actual) => {
          if (actualErr) return res.status(500).json({ error: 'Error calculating actual income' });

          const expectedIncome = parseFloat(expected?.expectedIncome || 0);
          const actualIncome = parseFloat(actual?.actualIncome || 0);

          res.json({
            month: currentMonth,
            expectedIncome,
            actualIncome,
            hasCollectionOverflow: actualIncome > expectedIncome,
            collectionDelta: expectedIncome - actualIncome
          });
        }
      );
    }
  );
};

const getTenantPaymentHistory = (req, res) => {
  const { tenantId } = req.params;

  db.all(
    `
      SELECT p.id, p.amount, p.payment_date, p.payment_period, p.payment_method,
             COALESCE(p.payment_status, 'confirmed') as payment_status,
             p.notes, p.receipt_path, u.unit_number, u.monthly_rent, b.name as building_name
      FROM payments p
      LEFT JOIN units u ON p.unit_id = u.id
      LEFT JOIN buildings b ON u.building_id = b.id
      WHERE p.tenant_id = ?
      ORDER BY p.payment_date DESC
    `,
    [tenantId],
    (err, payments) => {
      if (err) return res.status(500).json({ error: 'Error fetching tenant payment history' });
      res.json(payments);
    }
  );
};

module.exports = {
  getDashboardSummary,
  getMonthlyIncome,
  getUnpaidTenants,
  getOccupancyReport,
  getBuildingPerformance,
  getProfitTrends,
  getMonthlyExpectedIncome,
  getTenantPaymentHistory
};
