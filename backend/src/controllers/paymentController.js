const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const { getRentForPeriod, paymentRentForPeriodExpression } = require('../services/rentHistoryService');

const getPaymentPeriod = (paymentPeriod, paymentDate) => {
  if (paymentPeriod) return paymentPeriod;
  return paymentDate ? paymentDate.slice(0, 7) : new Date().toISOString().slice(0, 7);
};

const allowedPaymentMethods = new Set(['cash', 'bank_transfer', 'check', 'mobile_money', 'other']);
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const isValidPeriod = (value) => /^\d{4}-\d{2}$/.test(String(value || ''));
const normalizePaymentMethod = (value) => {
  const method = String(value || 'cash').trim();
  return allowedPaymentMethods.has(method) ? method : null;
};
const normalizeNotes = (value) => String(value || '').trim().slice(0, 1000);
const normalizeOptionalNotes = (value) => (
  value === undefined || value === null ? null : normalizeNotes(value)
);
const createVerificationCode = (paymentId) => `UB-${String(paymentId || uuidv4()).replace(/-/g, '').slice(0, 10).toUpperCase()}`;

const validateTenantUnitAssignment = ({ tenantId, unitId }, callback) => {
  if (!tenantId || !unitId) {
    callback({ status: 400, error: 'Tenant and unit are required' });
    return;
  }

  db.get(
    `
      SELECT t.id as tenant_id, u.id as unit_id
      FROM tenants t
      JOIN units u ON u.id = ?
      WHERE t.id = ?
        AND (
          t.unit_id = ?
          OR EXISTS (
            SELECT 1
            FROM contracts c
            WHERE c.tenant_id = t.id AND c.unit_id = u.id
          )
        )
      LIMIT 1
    `,
    [unitId, tenantId, unitId],
    (err, row) => {
      if (err) {
        callback({ status: 500, error: 'Error validating tenant unit assignment' });
        return;
      }

      if (!row) {
        callback({ status: 400, error: 'Selected unit does not belong to this tenant or contract history' });
        return;
      }

      callback(null);
    }
  );
};

const validatePaymentAmountLimit = ({ tenantId, unitId, paymentPeriod, amount, excludePaymentId = null }, callback) => {
  const normalizedAmount = parseFloat(amount);

  if (Number.isNaN(normalizedAmount) || normalizedAmount <= 0) {
    callback({ status: 400, error: 'Payment amount must be greater than zero' });
    return;
  }

  getRentForPeriod({ tenantId, unitId, period: paymentPeriod }, (unitErr, monthlyRent) => {
    if (unitErr) {
      callback({ status: 500, error: 'Error validating unit rent' });
      return;
    }

    const periodRent = parseFloat(monthlyRent || 0);
    if (periodRent <= 0) {
      callback({ status: 400, error: 'Cannot record payment: unit monthly rent is not configured' });
      return;
    }

    const sumQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM payments
      WHERE tenant_id = ?
        AND unit_id = ?
        AND COALESCE(payment_period, strftime('%Y-%m', payment_date)) = ?
        ${excludePaymentId ? 'AND id != ?' : ''}
    `;

    const queryParams = excludePaymentId
      ? [tenantId, unitId, paymentPeriod, excludePaymentId]
      : [tenantId, unitId, paymentPeriod];

    db.get(sumQuery, queryParams, (sumErr, row) => {
      if (sumErr) {
        callback({ status: 500, error: 'Error validating existing payments' });
        return;
      }

      const alreadyRecorded = parseFloat(row?.total || 0);
      const nextTotal = alreadyRecorded + normalizedAmount;

      if (nextTotal > periodRent + 0.000001) {
        callback({
          status: 400,
          error: `Cannot record payment above monthly rent. Monthly rent for ${paymentPeriod} is ${periodRent.toLocaleString()} RWF and remaining allowed is ${Math.max(periodRent - alreadyRecorded, 0).toLocaleString()} RWF.`
        });
        return;
      }

      callback(null, {
        monthlyRent: periodRent,
        alreadyRecorded,
        nextTotal
      });
    });
  });
};

const validateNoDuplicatePendingPayment = ({ tenantId, unitId, paymentPeriod, amount, excludePaymentId = null }, callback) => {
  const params = [tenantId, unitId, paymentPeriod, parseFloat(amount || 0)];
  let excludeSql = '';
  if (excludePaymentId) {
    excludeSql = 'AND id != ?';
    params.push(excludePaymentId);
  }

  db.get(
    `SELECT id
     FROM payments
     WHERE tenant_id = ?
       AND unit_id = ?
       AND COALESCE(payment_period, strftime('%Y-%m', payment_date)) = ?
       AND ABS(COALESCE(amount, 0) - ?) < 0.000001
       AND COALESCE(payment_status, 'confirmed') = 'pending'
       ${excludeSql}
     LIMIT 1`,
    params,
    (err, existing) => {
      if (err) {
        callback({ status: 500, error: 'Error checking duplicate payment' });
        return;
      }
      if (existing) {
        callback({ status: 409, error: 'A matching pending payment already exists for this tenant and month. Confirm, reject, or edit it before adding another one.' });
        return;
      }
      callback(null);
    }
  );
};

const confirmedPaymentWhere = "COALESCE(payment_status, 'confirmed') = 'confirmed'";

const paymentFields = `
  p.*,
  COALESCE(p.payment_period, strftime('%Y-%m', p.payment_date)) as payment_period,
  COALESCE(p.payment_status, 'confirmed') as payment_status,
  COALESCE(p.receipt_printed, 0) as receipt_printed,
  p.receipt_printed_at,
  t.full_name as tenant_name,
  u.unit_number,
  ${paymentRentForPeriodExpression()} as monthly_rent,
  b.name as building_name,
  b.id as building_id,
  (
    SELECT COALESCE(SUM(p2.amount), 0)
    FROM payments p2
    WHERE p2.tenant_id = p.tenant_id
      AND p2.unit_id = p.unit_id
      AND COALESCE(p2.payment_status, 'confirmed') = 'confirmed'
      AND COALESCE(p2.payment_period, strftime('%Y-%m', p2.payment_date)) = COALESCE(p.payment_period, strftime('%Y-%m', p.payment_date))
  ) as period_total_paid,
  MAX(
    ${paymentRentForPeriodExpression()} - (
      SELECT COALESCE(SUM(p2.amount), 0)
      FROM payments p2
      WHERE p2.tenant_id = p.tenant_id
        AND p2.unit_id = p.unit_id
        AND COALESCE(p2.payment_status, 'confirmed') = 'confirmed'
        AND COALESCE(p2.payment_period, strftime('%Y-%m', p2.payment_date)) = COALESCE(p.payment_period, strftime('%Y-%m', p.payment_date))
    ),
    0
  ) as period_balance
`;

const basePaymentQuery = `
  SELECT ${paymentFields}
  FROM payments p
  LEFT JOIN tenants t ON p.tenant_id = t.id
  LEFT JOIN units u ON p.unit_id = u.id
  LEFT JOIN buildings b ON u.building_id = b.id
`;

const recomputeBalance = (tenantId, unitId, callback = () => {}) => {
  if (!tenantId || !unitId) {
    callback();
    return;
  }

  db.all(
    `
      SELECT
        COALESCE(payment_period, strftime('%Y-%m', payment_date)) as period,
        COALESCE(SUM(amount), 0) as paid
      FROM payments
      WHERE tenant_id = ? AND unit_id = ? AND ${confirmedPaymentWhere}
      GROUP BY COALESCE(payment_period, strftime('%Y-%m', payment_date))
    `,
    [tenantId, unitId],
    (paymentsErr, periods) => {
      if (paymentsErr) {
        callback(paymentsErr);
        return;
      }

      if (periods.length === 0) {
        db.run(
          'UPDATE balances SET total_owed = 0, total_paid = 0, balance = 0, last_updated = CURRENT_TIMESTAMP WHERE tenant_id = ? AND unit_id = ?',
          [tenantId, unitId],
          callback
        );
        return;
      }

      let pending = periods.length;
      const periodRentRows = [];
      periods.forEach((period) => {
        getRentForPeriod({ tenantId, unitId, period: period.period }, (rentErr, rent) => {
          if (rentErr) {
            callback(rentErr);
            callback = () => {};
            return;
          }

          periodRentRows.push({ ...period, rent: parseFloat(rent || 0) });
          pending -= 1;

          if (pending > 0) return;

          const totalOwed = periodRentRows.reduce((sum, periodRow) => sum + periodRow.rent, 0);
          const totalPaid = periodRentRows.reduce((sum, periodRow) => sum + parseFloat(periodRow.paid || 0), 0);
          const unpaidBalance = periodRentRows.reduce((sum, periodRow) => (
            sum + Math.max(periodRow.rent - parseFloat(periodRow.paid || 0), 0)
          ), 0);

        db.get(
          'SELECT id FROM balances WHERE tenant_id = ? AND unit_id = ?',
          [tenantId, unitId],
          (balanceErr, balance) => {
            if (balanceErr) {
              callback(balanceErr);
              return;
            }

            if (balance) {
              db.run(
                'UPDATE balances SET total_owed = ?, total_paid = ?, balance = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
                [totalOwed, totalPaid, unpaidBalance, balance.id],
                callback
              );
            } else {
              db.run(
                'INSERT INTO balances (id, tenant_id, unit_id, total_owed, total_paid, balance) VALUES (?, ?, ?, ?, ?, ?)',
                [uuidv4(), tenantId, unitId, totalOwed, totalPaid, unpaidBalance],
                callback
              );
            }
          }
        );
        });
      });
    }
  );
};

const getAllPayments = (req, res) => {
  db.all(`${basePaymentQuery} WHERE t.id IS NOT NULL ORDER BY p.payment_date DESC`, [], (err, payments) => {
    if (err) return res.status(500).json({ error: 'Error fetching payments' });
    res.json(payments);
  });
};

const getPaymentsByBuilding = (req, res) => {
  db.all(
    `${basePaymentQuery} WHERE u.building_id = ? ORDER BY p.payment_date DESC`,
    [req.params.buildingId],
    (err, payments) => {
      if (err) return res.status(500).json({ error: 'Error fetching payments for building' });
      res.json(payments);
    }
  );
};

const getPaymentsByTenant = (req, res) => {
  db.all(
    `${basePaymentQuery} WHERE p.tenant_id = ? ORDER BY p.payment_date DESC`,
    [req.params.tenantId],
    (err, payments) => {
      if (err) return res.status(500).json({ error: 'Error fetching payments' });
      res.json(payments);
    }
  );
};

const getPaymentById = (req, res) => {
  db.get(`${basePaymentQuery} WHERE p.id = ?`, [req.params.id], (err, payment) => {
    if (err) return res.status(500).json({ error: 'Error fetching payment' });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json(payment);
  });
};

const createPayment = (req, res) => {
  const { tenant_id, unit_id, amount, payment_date, payment_period, payment_method, notes } = req.body;

  if (!tenant_id || !unit_id || !amount || !payment_date) {
    return res.status(400).json({ error: 'Tenant ID, unit ID, amount, and payment date are required' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Receipt file is required before recording a payment' });
  }

  if (parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than zero' });
  }

  if (!isValidDate(payment_date)) {
    return res.status(400).json({ error: 'Payment date must use YYYY-MM-DD format' });
  }

  const paymentId = uuidv4();
  const receiptPath = req.file ? `/uploads/${req.file.filename}` : null;
  const normalizedPeriod = getPaymentPeriod(payment_period, payment_date);
  const normalizedMethod = normalizePaymentMethod(payment_method);

  if (!isValidPeriod(normalizedPeriod)) {
    return res.status(400).json({ error: 'Payment period must use YYYY-MM format' });
  }

  if (!normalizedMethod) {
    return res.status(400).json({ error: 'Invalid payment method' });
  }

  return validateTenantUnitAssignment({ tenantId: tenant_id, unitId: unit_id }, (assignmentErr) => {
    if (assignmentErr) {
      return res.status(assignmentErr.status || 400).json({ error: assignmentErr.error });
    }

    return validatePaymentAmountLimit(
      {
        tenantId: tenant_id,
        unitId: unit_id,
        paymentPeriod: normalizedPeriod,
        amount
      },
      (validationErr) => {
        if (validationErr) {
          return res.status(validationErr.status || 400).json({ error: validationErr.error });
        }

        return validateNoDuplicatePendingPayment(
          {
            tenantId: tenant_id,
            unitId: unit_id,
            paymentPeriod: normalizedPeriod,
            amount
          },
          (duplicateErr) => {
            if (duplicateErr) {
              return res.status(duplicateErr.status || 400).json({ error: duplicateErr.error });
            }

            const verificationCode = createVerificationCode(paymentId);

            db.run(
              `INSERT INTO payments (
                id, tenant_id, unit_id, amount, payment_date, payment_period,
                payment_status, payment_method, receipt_path, notes, verification_code
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                paymentId,
                tenant_id,
                unit_id,
                amount,
                payment_date,
                normalizedPeriod,
                'pending',
                normalizedMethod,
                receiptPath,
                normalizeNotes(notes),
                verificationCode
              ],
              function(err) {
                if (err) return res.status(500).json({ error: 'Error creating payment' });

                res.status(201).json({
                  message: 'Payment saved as pending. Confirm it after checking the receipt.',
                  payment: {
                    id: paymentId,
                    tenant_id,
                    unit_id,
                    amount,
                    payment_date,
                    payment_period: normalizedPeriod,
                    payment_status: 'pending',
                    payment_method: normalizedMethod,
                    receipt_path: receiptPath,
                    verification_code: verificationCode,
                    notes: normalizeNotes(notes)
                  }
                });
              }
            );
          }
        );
      }
    );
  });
};

const confirmPayment = (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT tenant_id, unit_id, amount, payment_date, COALESCE(payment_period, strftime('%Y-%m', payment_date)) as payment_period,
            payment_status, receipt_path
     FROM payments
     WHERE id = ?`,
    [id],
    (findErr, payment) => {
    if (findErr) return res.status(500).json({ error: 'Error fetching payment' });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (!payment.receipt_path) return res.status(400).json({ error: 'Receipt file is required before confirming payment' });
    if ((payment.payment_status || 'confirmed') === 'confirmed') return res.json({ message: 'Payment is already confirmed' });

    return validatePaymentAmountLimit(
      {
        tenantId: payment.tenant_id,
        unitId: payment.unit_id,
        paymentPeriod: payment.payment_period,
        amount: payment.amount,
        excludePaymentId: id
      },
      (validationErr) => {
        if (validationErr) {
          return res.status(validationErr.status || 400).json({ error: validationErr.error });
        }

        db.run(
          `UPDATE payments
           SET payment_status = 'confirmed',
               approved_by = ?,
               approved_at = CURRENT_TIMESTAMP,
               rejection_reason = NULL,
               rejected_by = NULL,
               rejected_at = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [req.user?.id || null, id],
          function(err) {
            if (err) return res.status(500).json({ error: 'Error confirming payment' });

            recomputeBalance(payment.tenant_id, payment.unit_id, (balanceErr) => {
              if (balanceErr) {
                return res.status(500).json({ error: 'Payment confirmed, but balance could not be updated' });
              }

              res.json({ message: 'Payment confirmed successfully' });
            });
          }
        );
      }
    );
  });
};

const updatePayment = (req, res) => {
  const { id } = req.params;
  const { tenant_id, unit_id, amount, payment_date, payment_period, payment_method, notes, payment_status, confirmation_notes } = req.body;
  const receiptPath = req.file ? `/uploads/${req.file.filename}` : null;

  db.get('SELECT tenant_id, unit_id FROM payments WHERE id = ?', [id], (findErr, payment) => {
    if (findErr) return res.status(500).json({ error: 'Error fetching payment' });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    const nextTenantId = tenant_id || payment.tenant_id;
    const nextUnitId = unit_id || payment.unit_id;

    if (payment_status === 'rejected') {
      const reason = normalizeNotes(req.body.rejection_reason || notes || confirmation_notes);
      if (!reason) {
        return res.status(400).json({ error: 'Rejection reason is required' });
      }

      return db.run(
        `UPDATE payments
         SET payment_status = 'rejected',
             rejection_reason = ?,
             rejected_by = ?,
             rejected_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [reason, req.user?.id || null, id],
        function(rejectErr) {
          if (rejectErr) return res.status(500).json({ error: 'Error rejecting payment' });

          return recomputeBalance(payment.tenant_id, payment.unit_id, (balanceErr) => {
            if (balanceErr) return res.status(500).json({ error: 'Payment rejected, but balance could not be updated' });
            return res.json({ message: 'Payment rejected' });
          });
        }
      );
    }

    // Confirmation flow from manual confirmation screen: allow status/note/receipt update only.
    if (payment_status === 'confirmed') {
      const nextNotes = confirmation_notes ?? notes ?? null;
      const sql = receiptPath
        ? `UPDATE payments
           SET payment_status = 'confirmed',
               notes = COALESCE(?, notes),
               receipt_path = ?,
               approved_by = ?,
               approved_at = CURRENT_TIMESTAMP,
               rejection_reason = NULL,
               rejected_by = NULL,
               rejected_at = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        : `UPDATE payments
           SET payment_status = 'confirmed',
               notes = COALESCE(?, notes),
               approved_by = ?,
               approved_at = CURRENT_TIMESTAMP,
               rejection_reason = NULL,
               rejected_by = NULL,
               rejected_at = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`;

      const params = receiptPath
        ? [normalizeOptionalNotes(nextNotes), receiptPath, req.user?.id || null, id]
        : [normalizeOptionalNotes(nextNotes), req.user?.id || null, id];

      return db.get(
        `SELECT amount, COALESCE(payment_period, strftime('%Y-%m', payment_date)) as payment_period
         FROM payments
         WHERE id = ?`,
        [id],
        (amountErr, currentPayment) => {
          if (amountErr) return res.status(500).json({ error: 'Error validating payment confirmation' });

          validatePaymentAmountLimit(
            {
              tenantId: payment.tenant_id,
              unitId: payment.unit_id,
              paymentPeriod: currentPayment.payment_period,
              amount: currentPayment.amount,
              excludePaymentId: id
            },
            (validationErr) => {
              if (validationErr) {
                return res.status(validationErr.status || 400).json({ error: validationErr.error });
              }

              return db.run(sql, params, function(confirmErr) {
                if (confirmErr) return res.status(500).json({ error: 'Error confirming payment' });

                recomputeBalance(payment.tenant_id, payment.unit_id, (balanceErr) => {
                  if (balanceErr) {
                    return res.status(500).json({ error: 'Payment confirmed, but balance could not be updated' });
                  }

                  res.json({ message: 'Payment confirmed successfully' });
                });
              });
            }
          );
        }
      );
    }

    if (payment_status === 'pending' && !receiptPath) {
      // Continue through the regular update path; existing receipt remains unchanged.
    }

    return validateTenantUnitAssignment({ tenantId: nextTenantId, unitId: nextUnitId }, (assignmentErr) => {
      if (assignmentErr) {
        return res.status(assignmentErr.status || 400).json({ error: assignmentErr.error });
      }

      if (parseFloat(amount) <= 0) {
        return res.status(400).json({ error: 'Payment amount must be greater than zero' });
      }

      if (!payment_date) {
        return res.status(400).json({ error: 'Payment date is required' });
      }

      if (!isValidDate(payment_date)) {
        return res.status(400).json({ error: 'Payment date must use YYYY-MM-DD format' });
      }

      const normalizedPeriod = getPaymentPeriod(payment_period, payment_date);
      const normalizedMethod = normalizePaymentMethod(payment_method);

      if (!isValidPeriod(normalizedPeriod)) {
        return res.status(400).json({ error: 'Payment period must use YYYY-MM format' });
      }

      if (!normalizedMethod) {
        return res.status(400).json({ error: 'Invalid payment method' });
      }

      return validatePaymentAmountLimit(
        {
          tenantId: nextTenantId,
          unitId: nextUnitId,
          paymentPeriod: normalizedPeriod,
          amount,
          excludePaymentId: id
        },
        (validationErr) => {
          if (validationErr) {
            return res.status(validationErr.status || 400).json({ error: validationErr.error });
          }

          return validateNoDuplicatePendingPayment(
            {
              tenantId: nextTenantId,
              unitId: nextUnitId,
              paymentPeriod: normalizedPeriod,
              amount,
              excludePaymentId: id
            },
            (duplicateErr) => {
              if (duplicateErr) {
                return res.status(duplicateErr.status || 400).json({ error: duplicateErr.error });
              }

              const updateSql = receiptPath
                ? `UPDATE payments
                   SET tenant_id = ?, unit_id = ?, amount = ?, payment_date = ?, payment_period = ?, payment_method = ?, notes = ?, receipt_path = ?, updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`
                : `UPDATE payments
                   SET tenant_id = ?, unit_id = ?, amount = ?, payment_date = ?, payment_period = ?, payment_method = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`;
              const updateParams = receiptPath
                ? [nextTenantId, nextUnitId, amount, payment_date, normalizedPeriod, normalizedMethod, normalizeNotes(notes), receiptPath, id]
                : [nextTenantId, nextUnitId, amount, payment_date, normalizedPeriod, normalizedMethod, normalizeNotes(notes), id];

              db.run(
                updateSql,
                updateParams,
                function(err) {
                  if (err) return res.status(500).json({ error: 'Error updating payment' });

                  const recomputeNext = () => {
                    recomputeBalance(nextTenantId, nextUnitId, (balanceErr) => {
                      if (balanceErr) {
                        return res.status(500).json({ error: 'Payment updated, but balance could not be updated' });
                      }

                      res.json({ message: 'Payment updated successfully' });
                    });
                  };

                  if (payment.tenant_id !== nextTenantId || payment.unit_id !== nextUnitId) {
                    return recomputeBalance(payment.tenant_id, payment.unit_id, (oldBalanceErr) => {
                      if (oldBalanceErr) {
                        return res.status(500).json({ error: 'Payment updated, but previous balance could not be updated' });
                      }

                      recomputeNext();
                    });
                  }

                  recomputeNext();
                }
              );
            }
          );
        }
      );
    });
  });
};

const deletePayment = (req, res) => {
  const { id } = req.params;

  db.get('SELECT tenant_id, unit_id FROM payments WHERE id = ?', [id], (err, payment) => {
    if (err || !payment) return res.status(404).json({ error: 'Payment not found' });

    db.run('DELETE FROM payments WHERE id = ?', [id], function(deleteErr) {
      if (deleteErr) return res.status(500).json({ error: 'Error deleting payment' });

      recomputeBalance(payment.tenant_id, payment.unit_id, (balanceErr) => {
        if (balanceErr) {
          return res.status(500).json({ error: 'Payment deleted, but balance could not be updated' });
        }

        res.json({ message: 'Payment deleted successfully' });
      });
    });
  });
};

const rejectPayment = (req, res) => {
  req.body.payment_status = 'rejected';
  return updatePayment(req, res);
};

const markReceiptPrinted = (req, res) => {
  const { id } = req.params;

  db.get(
    "SELECT payment_status, receipt_path FROM payments WHERE id = ?",
    [id],
    (findErr, payment) => {
      if (findErr) return res.status(500).json({ error: 'Error checking payment status' });
      if (!payment) return res.status(404).json({ error: 'Payment not found' });
      if ((payment.payment_status || 'confirmed') !== 'confirmed') {
        return res.status(400).json({ error: 'Only confirmed payments can be marked as receipt printed' });
      }
      if (!payment.receipt_path) {
        return res.status(400).json({ error: 'Receipt file is required before marking printed' });
      }

      db.run(
        `UPDATE payments
         SET receipt_printed = 1,
             receipt_printed_at = CURRENT_TIMESTAMP,
             receipt_print_count = COALESCE(receipt_print_count, 0) + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [id],
        function(err) {
          if (err) return res.status(500).json({ error: 'Error updating receipt print status' });
          return res.json({ message: 'Receipt print status updated' });
        }
      );
    }
  );
};

const buildReportWhere = (query) => {
  const { from, to, buildingId, tenantId } = query;
  const clauses = ["COALESCE(p.payment_status, 'confirmed') = 'confirmed'"];
  const params = [];

  if (from) {
    clauses.push('p.payment_date >= ?');
    params.push(from);
  }
  if (to) {
    clauses.push('p.payment_date <= ?');
    params.push(to);
  }
  if (buildingId) {
    clauses.push('b.id = ?');
    params.push(buildingId);
  }
  if (tenantId) {
    clauses.push('t.id = ?');
    params.push(tenantId);
  }

  return { where: clauses.join(' AND '), params };
};

const generateIncomeReport = (req, res) => {
  const { where, params } = buildReportWhere(req.query);

  db.all(
    `${basePaymentQuery} WHERE ${where} ORDER BY p.payment_date DESC`,
    params,
    (err, payments) => {
      if (err) return res.status(500).json({ error: 'Error generating report' });

      const totalIncome = payments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
      res.json({
        report: {
          generatedAt: new Date().toISOString(),
          filters: req.query,
          summary: {
            totalIncome,
            paymentCount: payments.length
          }
        },
        payments
      });
    }
  );
};

const exportPaymentsByBuilding = (req, res) => {
  db.all(
    `${basePaymentQuery} WHERE u.building_id = ? ORDER BY p.payment_date DESC`,
    [req.params.buildingId],
    (err, payments) => {
      if (err) return res.status(500).json({ error: 'Error exporting payments' });

      const headers = ['Payment Date', 'Tenant Name', 'Unit Number', 'Building Name', 'Amount', 'Payment Period', 'Status', 'Payment Method', 'Notes'];
      const rows = payments.map((payment) => [
        payment.payment_date,
        payment.tenant_name || '',
        payment.unit_number || '',
        payment.building_name || '',
        payment.amount,
        payment.payment_period || '',
        payment.payment_status || '',
        payment.payment_method || '',
        payment.notes || ''
      ]);
      const csvContent = [
        headers.map((header) => `"${header}"`).join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="payment-history.csv"');
      res.send(csvContent);
    }
  );
};

const exportIncomeReportPDF = (req, res) => {
  const PDFDocument = require('pdfkit');
  const { where, params } = buildReportWhere(req.query);

  db.all(`${basePaymentQuery} WHERE ${where} ORDER BY p.payment_date DESC`, params, (err, payments) => {
    if (err) return res.status(500).json({ error: 'Error generating PDF report' });

    const totalIncome = payments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="income-report.pdf"');
    doc.pipe(res);

    doc.fontSize(20).text('Income Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).text(`Generated: ${new Date().toLocaleString()}`);
    doc.text(`Total Income: ${totalIncome.toLocaleString()} RWF`);
    doc.text(`Payments: ${payments.length}`);
    doc.moveDown();

    payments.forEach((payment) => {
      doc.fontSize(9).text(
        `${payment.payment_date} | ${payment.tenant_name || '-'} | ${payment.building_name || '-'} | ${payment.unit_number || '-'} | ${parseFloat(payment.amount || 0).toLocaleString()} RWF`
      );
    });

    doc.end();
  });
};

module.exports = {
  getAllPayments,
  generateIncomeReport,
  exportIncomeReportPDF,
  getPaymentsByBuilding,
  exportPaymentsByBuilding,
  getPaymentsByTenant,
  getPaymentById,
  createPayment,
  confirmPayment,
  rejectPayment,
  updatePayment,
  deletePayment,
  markReceiptPrinted
};
