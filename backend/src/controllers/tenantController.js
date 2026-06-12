const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const { sendDueRentReminders, getUpcomingReminderCalendarEvents } = require('../services/whatsappReminderService');
const { ensureTenantRentHistory, getPeriodFromDate, rentForPeriodExpression } = require('../services/rentHistoryService');

const confirmedWhere = "COALESCE(payment_status, 'confirmed') = 'confirmed'";
const currentPeriodExpression = "strftime('%Y-%m', 'now')";
const currentTenantRentExpression = rentForPeriodExpression('t', 'u', currentPeriodExpression);
const confirmedPaymentWhereForAlias = (alias = 'p') => confirmedWhere.replaceAll('payment_status', `${alias}.payment_status`);
const paymentPeriodForAlias = (alias = 'p') => `COALESCE(${alias}.payment_period, strftime('%Y-%m', ${alias}.payment_date))`;

const tenantFields = `
  t.*,
  u.unit_number,
  ${currentTenantRentExpression} as monthly_rent,
  u.floor,
  b.id as building_id,
  b.name as building_name,
  ${currentTenantRentExpression} as total_owed,
  (
    SELECT COALESCE(SUM(p.amount), 0)
    FROM payments p
    WHERE p.tenant_id = t.id
      AND p.unit_id = t.unit_id
      AND ${confirmedPaymentWhereForAlias('p')}
  ) as total_paid,
  (
    SELECT COALESCE(SUM(p.amount), 0)
    FROM payments p
    WHERE p.tenant_id = t.id
      AND p.unit_id = t.unit_id
      AND ${paymentPeriodForAlias('p')} = strftime('%Y-%m', 'now')
      AND ${confirmedPaymentWhereForAlias('p')}
  ) as current_period_paid,
  (
    SELECT COALESCE(SUM(p.amount), 0)
    FROM payments p
    WHERE p.tenant_id = t.id
      AND p.unit_id = t.unit_id
      AND ${paymentPeriodForAlias('p')} = strftime('%Y-%m', 'now')
      AND COALESCE(p.payment_status, 'confirmed') = 'pending'
  ) as pending_amount,
  MAX(${currentTenantRentExpression} - (
    SELECT COALESCE(SUM(p.amount), 0)
    FROM payments p
    WHERE p.tenant_id = t.id
      AND p.unit_id = t.unit_id
      AND ${paymentPeriodForAlias('p')} = strftime('%Y-%m', 'now')
      AND ${confirmedPaymentWhereForAlias('p')}
  ), 0) as balance
`;

const attachRentHistories = (tenants, callback) => {
  const tenantList = Array.isArray(tenants) ? tenants : [tenants].filter(Boolean);
  if (tenantList.length === 0) {
    callback(null, tenants);
    return;
  }

  const placeholders = tenantList.map(() => '?').join(',');
  db.all(
    `SELECT * FROM tenant_rent_history WHERE tenant_id IN (${placeholders}) ORDER BY tenant_id, start_period ASC`,
    tenantList.map((tenant) => tenant.id),
    (err, histories) => {
      if (err) {
        callback(err);
        return;
      }

      const historyMap = histories.reduce((acc, history) => {
        if (!acc[history.tenant_id]) acc[history.tenant_id] = [];
        acc[history.tenant_id].push(history);
        return acc;
      }, {});

      const withHistory = tenantList.map((tenant) => ({
        ...tenant,
        rent_history: historyMap[tenant.id] || []
      }));

      callback(null, Array.isArray(tenants) ? withHistory : withHistory[0]);
    }
  );
};

const getTodayDate = () => new Date().toISOString().slice(0, 10);

const normalizeDateValue = (dateValue) => {
  if (!dateValue) return null;
  const dateString = String(dateValue).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString) ? dateString : null;
};
const normalizeText = (value, maxLength = 180) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
const normalizeFollowUpStatus = (value) => {
  const normalized = String(value || 'open').toLowerCase().trim();
  return ['open', 'done', 'cancelled'].includes(normalized) ? normalized : 'open';
};
const normalizeFollowUpAction = (value) => {
  const normalized = String(value || 'note').toLowerCase().trim();
  return ['call', 'send_reminder', 'followed_up', 'promise_to_pay', 'note'].includes(normalized) ? normalized : 'note';
};

const validateStayDates = ({ moveInDate, moveOutDate }) => {
  if (moveInDate && moveOutDate && moveOutDate < moveInDate) {
    return 'Move-out date cannot be before move-in date';
  }

  return null;
};

const resolveTenantStatus = ({ requestedStatus, moveInDate, moveOutDate, fallbackStatus = 'active' }) => {
  if (requestedStatus === 'inactive') return 'inactive';
  if (moveOutDate && moveOutDate <= getTodayDate()) return 'inactive';
  return requestedStatus === 'active' ? 'active' : (fallbackStatus || 'active');
};

const deactivateTenantPortalAccounts = (tenantId, callback = () => {}) => {
  if (!tenantId) {
    callback();
    return;
  }

  db.run(
    'UPDATE tenant_portal_accounts SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ?',
    [tenantId],
    callback
  );
};

const syncUnitStatus = (unitId, callback = () => {}) => {
  if (!unitId) {
    callback();
    return;
  }

  db.get(
    `SELECT COUNT(*) as activeTenantCount
     FROM tenants
     WHERE unit_id = ?
       AND status = 'active'
       AND (move_in_date IS NULL OR DATE(move_in_date) <= DATE('now'))
       AND (move_out_date IS NULL OR DATE(move_out_date) > DATE('now'))`,
    [unitId],
    (countErr, row) => {
      if (countErr) {
        callback(countErr);
        return;
      }

      const nextStatus = (row?.activeTenantCount || 0) > 0 ? 'occupied' : 'available';
      db.run(
        'UPDATE units SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [nextStatus, unitId],
        callback
      );
    }
  );
};

const validateUnitAssignment = ({ unitId, tenantId = null, moveInDate = null, moveOutDate = null, status = 'active' }, callback) => {
  if (!unitId) {
    callback(null);
    return;
  }

  if (status !== 'active') {
    callback(null);
    return;
  }

  const normalizedMoveInDate = moveInDate || getTodayDate();
  const normalizedMoveOutDate = moveOutDate || '9999-12-31';

  db.get('SELECT id, status FROM units WHERE id = ?', [unitId], (unitErr, unit) => {
    if (unitErr) {
      callback({ status: 500, error: 'Error checking unit assignment' });
      return;
    }

    if (!unit) {
      callback({ status: 400, error: 'Selected unit does not exist' });
      return;
    }

    db.get(
      `SELECT id, full_name
       FROM tenants
       WHERE unit_id = ?
         AND status = 'active'
         AND DATE(COALESCE(move_in_date, '0001-01-01')) <= DATE(?)
         AND DATE(COALESCE(move_out_date, '9999-12-31')) >= DATE(?)
         ${tenantId ? 'AND id != ?' : ''}
       LIMIT 1`,
      tenantId
        ? [unitId, normalizedMoveOutDate, normalizedMoveInDate, tenantId]
        : [unitId, normalizedMoveOutDate, normalizedMoveInDate],
      (tenantErr, existingTenant) => {
        if (tenantErr) {
          callback({ status: 500, error: 'Error validating unit occupancy' });
          return;
        }

        if (existingTenant) {
          callback({ status: 400, error: `This unit is already occupied by ${existingTenant.full_name}. You cannot register another tenant in the same room.` });
          return;
        }

        callback(null);
      }
    );
  });
};

const validateUniqueTenantIdentity = ({ email, phone, nationalId, tenantId = null }, callback) => {
  const clauses = [];
  const params = [];

  if (email) {
    clauses.push('LOWER(email) = LOWER(?)');
    params.push(email);
  }
  if (phone) {
    clauses.push('phone = ?');
    params.push(phone);
  }
  if (nationalId) {
    clauses.push('LOWER(national_id) = LOWER(?)');
    params.push(nationalId);
  }

  if (clauses.length === 0) {
    callback(null);
    return;
  }

  const tenantFilter = tenantId ? 'AND id != ?' : '';
  if (tenantId) params.push(tenantId);

  db.get(
    `SELECT email, phone, national_id
     FROM tenants
     WHERE (${clauses.join(' OR ')})
       AND status = 'active'
       AND (move_in_date IS NULL OR DATE(move_in_date) <= DATE('now'))
       AND (move_out_date IS NULL OR DATE(move_out_date) > DATE('now'))
       ${tenantFilter}
     LIMIT 1`,
    params,
    (err, existing) => {
      if (err) {
        callback({ status: 500, error: 'Error checking duplicate tenant identity' });
        return;
      }

      if (!existing) {
        callback(null);
        return;
      }

      if (email && String(existing.email || '').toLowerCase() === String(email).toLowerCase()) {
        callback({ status: 409, error: 'A tenant with this email already exists' });
        return;
      }
      if (phone && String(existing.phone || '') === String(phone)) {
        callback({ status: 409, error: 'A tenant with this phone number already exists' });
        return;
      }
      if (nationalId && String(existing.national_id || '').toLowerCase() === String(nationalId).toLowerCase()) {
        callback({ status: 409, error: 'A tenant with this national ID already exists' });
        return;
      }

      callback({ status: 409, error: 'A tenant with matching identity details already exists' });
    }
  );
};

const getTenantCreateErrorMessage = (err) => {
  const message = String(err?.message || '');

  if (/no column named/i.test(message)) {
    return 'Tenant database fields are not ready yet. Please try again after the latest update finishes.';
  }
  if (/FOREIGN KEY constraint failed/i.test(message)) {
    return 'Selected unit was not found. Refresh the page and choose the unit again.';
  }
  if (/UNIQUE constraint failed/i.test(message)) {
    return 'A tenant with matching details already exists.';
  }

  return 'Error creating tenant';
};

// Get all tenants
const getAllTenants = (req, res) => {
  db.all(`
    SELECT ${tenantFields}
    FROM tenants t 
    LEFT JOIN units u ON t.unit_id = u.id 
    LEFT JOIN buildings b ON u.building_id = b.id 
    ORDER BY t.created_at DESC
  `, [], (err, tenants) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching tenants' });
    }

    attachRentHistories(tenants, (historyErr, tenantsWithHistory) => {
      if (historyErr) {
        return res.status(500).json({ error: 'Error fetching tenant rent history' });
      }

      res.json(tenantsWithHistory);
    });
  });
};

// Get tenant by ID
const getTenantById = (req, res) => {
  const { id } = req.params;

  db.get(`
    SELECT ${tenantFields}
    FROM tenants t 
    LEFT JOIN units u ON t.unit_id = u.id 
    LEFT JOIN buildings b ON u.building_id = b.id 
    WHERE t.id = ?
  `, [id], (err, tenant) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching tenant' });
    }

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    attachRentHistories(tenant, (historyErr, tenantWithHistory) => {
      if (historyErr) {
        return res.status(500).json({ error: 'Error fetching tenant rent history' });
      }

      res.json(tenantWithHistory);
    });
  });
};

// Get tenants by building
const getTenantsByBuilding = (req, res) => {
  const { buildingId } = req.params;

  db.all(`
    SELECT ${tenantFields}
    FROM tenants t
    LEFT JOIN units u ON t.unit_id = u.id
    LEFT JOIN buildings b ON u.building_id = b.id
    WHERE u.building_id = ?
    ORDER BY t.full_name ASC
  `, [buildingId], (err, tenants) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching tenants for building' });
    }

    attachRentHistories(tenants, (historyErr, tenantsWithHistory) => {
      if (historyErr) {
        return res.status(500).json({ error: 'Error fetching tenant rent history' });
      }

      res.json(tenantsWithHistory);
    });
  });
};

// Create tenant
const createTenant = (req, res) => {
  const {
    full_name,
    email,
    phone,
    national_id,
    identification_document,
    address,
    occupation_status,
    occupation_place,
    emergency_contact_name,
    emergency_contact_phone,
    unit_id,
    move_in_date,
    move_out_date,
    status
  } = req.body;

  // If a file was uploaded, use its path as the identification_document
  let identification_document_value = identification_document;
  if (req.file) {
    identification_document_value = `/uploads/${req.file.filename}`;
  }

  if (!full_name || !email || !phone || !national_id || !address || !occupation_status || !occupation_place || !emergency_contact_name || !emergency_contact_phone || !unit_id || !move_in_date) {
    return res.status(400).json({ error: 'Please complete all tenant registration fields before saving' });
  }

  const normalizedMoveInDate = normalizeDateValue(move_in_date);
  const normalizedMoveOutDate = normalizeDateValue(move_out_date);
  const dateError = validateStayDates({ moveInDate: normalizedMoveInDate, moveOutDate: normalizedMoveOutDate });
  if (dateError) {
    return res.status(400).json({ error: dateError });
  }

  const normalizedStatus = resolveTenantStatus({
    requestedStatus: status,
    moveInDate: normalizedMoveInDate,
    moveOutDate: normalizedMoveOutDate
  });
  const tenantId = uuidv4();

  return validateUniqueTenantIdentity({
    email: normalizeText(email),
    phone: normalizeText(phone),
    nationalId: normalizeText(national_id)
  }, (duplicateErr) => {
    if (duplicateErr) {
      return res.status(duplicateErr.status || 400).json({ error: duplicateErr.error });
    }

  return validateUnitAssignment({
    unitId: unit_id,
    moveInDate: normalizedMoveInDate,
    moveOutDate: normalizedMoveOutDate,
    status: normalizedStatus
  }, (validationErr) => {
    if (validationErr) {
      return res.status(validationErr.status || 400).json({ error: validationErr.error });
    }

    db.run(
      `INSERT INTO tenants (
        id, full_name, email, phone, national_id, identification_document, address,
        occupation_status, occupation_place, emergency_contact_name, emergency_contact_phone,
        unit_id, move_in_date, move_out_date, status
      ) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        normalizeText(full_name),
        normalizeText(email),
        normalizeText(phone),
        normalizeText(national_id),
        normalizeText(identification_document_value, 255),
        normalizeText(address, 255),
        normalizeText(occupation_status),
        normalizeText(occupation_place),
        normalizeText(emergency_contact_name),
        normalizeText(emergency_contact_phone),
        unit_id || null,
        normalizedMoveInDate,
        normalizedMoveOutDate,
        normalizedStatus
      ],
      function(err) {
        if (err) {
          console.error('Error creating tenant:', err.message);
          return res.status(500).json({ error: getTenantCreateErrorMessage(err) });
        }

        const balanceId = uuidv4();
        db.run(
          'INSERT INTO balances (id, tenant_id, unit_id, total_owed, total_paid, balance) VALUES (?, ?, ?, ?, ?, ?)',
          [balanceId, tenantId, unit_id || null, 0, 0, 0],
          () => {
            db.get('SELECT monthly_rent FROM units WHERE id = ?', [unit_id], (unitErr, unit) => {
              ensureTenantRentHistory({
                tenantId,
                unitId: unit_id,
                amount: unit?.monthly_rent || 0,
                startPeriod: getPeriodFromDate(normalizedMoveInDate)
              }, () => {
                syncUnitStatus(unit_id, () => {
                  res.status(201).json({
                    message: 'Tenant created successfully',
                    tenant: {
                      id: tenantId,
                      full_name: normalizeText(full_name),
                      email: normalizeText(email),
                      phone: normalizeText(phone),
                      national_id: normalizeText(national_id),
                      identification_document: identification_document_value,
                      address: normalizeText(address, 255),
                      occupation_status: normalizeText(occupation_status),
                      occupation_place: normalizeText(occupation_place),
                      emergency_contact_name: normalizeText(emergency_contact_name),
                      emergency_contact_phone: normalizeText(emergency_contact_phone),
                      unit_id,
                      move_in_date: normalizedMoveInDate,
                      move_out_date: normalizedMoveOutDate,
                      status: normalizedStatus
                    }
                  });
                });
              });
            });
          }
        );
      }
    );
  });
  });
};

// Update tenant
const updateTenant = (req, res) => {
  const { id } = req.params;
  const {
    full_name,
    email,
    phone,
    national_id,
    identification_document,
    address,
    occupation_status,
    occupation_place,
    emergency_contact_name,
    emergency_contact_phone,
    unit_id,
    move_in_date,
    move_out_date,
    status
  } = req.body;

  // If a file was uploaded, use its path as the identification_document
  let identification_document_value = identification_document;
  if (req.file) {
    identification_document_value = `/uploads/${req.file.filename}`;
  }

  db.get('SELECT unit_id, status FROM tenants WHERE id = ?', [id], (findErr, existingTenant) => {
    if (findErr) {
      return res.status(500).json({ error: 'Error updating tenant' });
    }

    if (!existingTenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const normalizedUnitId = unit_id || null;
    if (!full_name || !email || !phone || !national_id || !address || !occupation_status || !occupation_place || !emergency_contact_name || !emergency_contact_phone || !normalizedUnitId || !move_in_date) {
      return res.status(400).json({ error: 'Please complete all tenant registration fields before saving' });
    }

    const normalizedMoveInDate = normalizeDateValue(move_in_date);
    const normalizedMoveOutDate = normalizeDateValue(move_out_date);
    const dateError = validateStayDates({ moveInDate: normalizedMoveInDate, moveOutDate: normalizedMoveOutDate });
    if (dateError) {
      return res.status(400).json({ error: dateError });
    }

    const normalizedStatus = resolveTenantStatus({
      requestedStatus: status,
      moveInDate: normalizedMoveInDate,
      moveOutDate: normalizedMoveOutDate,
      fallbackStatus: existingTenant.status || 'active'
    });

    validateUniqueTenantIdentity({
      email: normalizeText(email),
      phone: normalizeText(phone),
      nationalId: normalizeText(national_id),
      tenantId: id
    }, (duplicateErr) => {
      if (duplicateErr) {
        return res.status(duplicateErr.status || 400).json({ error: duplicateErr.error });
      }

    validateUnitAssignment({
      unitId: normalizedUnitId,
      tenantId: id,
      moveInDate: normalizedMoveInDate,
      moveOutDate: normalizedMoveOutDate,
      status: normalizedStatus
    }, (validationErr) => {
      if (validationErr) {
        return res.status(validationErr.status || 400).json({ error: validationErr.error });
      }

      db.run(
        `UPDATE tenants SET full_name = ?, email = ?, phone = ?, national_id = ?, identification_document = ?,
         address = ?, occupation_status = ?, occupation_place = ?, emergency_contact_name = ?,
         emergency_contact_phone = ?, unit_id = ?, move_in_date = ?, move_out_date = ?, status = ?,
         updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [
          normalizeText(full_name),
          normalizeText(email),
          normalizeText(phone),
          normalizeText(national_id),
          normalizeText(identification_document_value, 255),
          normalizeText(address, 255),
          normalizeText(occupation_status),
          normalizeText(occupation_place),
          normalizeText(emergency_contact_name),
          normalizeText(emergency_contact_phone),
          normalizedUnitId,
          normalizedMoveInDate,
          normalizedMoveOutDate,
          normalizedStatus,
          id
        ],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error updating tenant' });
          }

          syncUnitStatus(existingTenant.unit_id, () => {
            syncUnitStatus(normalizedUnitId, () => {
              if (normalizedStatus === 'inactive') {
                deactivateTenantPortalAccounts(id, () => {
                  res.json({ message: 'Tenant updated successfully' });
                });
                return;
              }

              res.json({ message: 'Tenant updated successfully' });
            });
          });
        }
      );
    });
    });
  });
};

const createTenantFollowUp = (req, res) => {
  const { id } = req.params;
  const { unit_id, payment_period, action_type, note, promise_date, status } = req.body;
  const followUpId = uuidv4();
  const normalizedPromiseDate = normalizeDateValue(promise_date);

  db.get('SELECT id, unit_id FROM tenants WHERE id = ?', [id], (tenantErr, tenant) => {
    if (tenantErr) return res.status(500).json({ error: 'Error checking tenant' });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    db.run(
      `INSERT INTO tenant_followups (
        id, tenant_id, unit_id, payment_period, action_type, note, promise_date, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        followUpId,
        id,
        unit_id || tenant.unit_id || null,
        normalizeText(payment_period, 20),
        normalizeFollowUpAction(action_type),
        normalizeText(note, 1200),
        normalizedPromiseDate,
        normalizeFollowUpStatus(status),
        req.user?.id || null
      ],
      function(insertErr) {
        if (insertErr) return res.status(500).json({ error: 'Error creating tenant follow-up' });
        return res.status(201).json({ message: 'Follow-up saved', id: followUpId });
      }
    );
  });
};

const updateTenantFollowUp = (req, res) => {
  const { followUpId } = req.params;
  const { note, promise_date, status } = req.body;

  db.run(
    `UPDATE tenant_followups
     SET note = COALESCE(?, note),
         promise_date = ?,
         status = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      note === undefined ? null : normalizeText(note, 1200),
      normalizeDateValue(promise_date),
      normalizeFollowUpStatus(status),
      followUpId
    ],
    function(err) {
      if (err) return res.status(500).json({ error: 'Error updating tenant follow-up' });
      if (this.changes === 0) return res.status(404).json({ error: 'Follow-up not found' });
      return res.json({ message: 'Follow-up updated' });
    }
  );
};

const getTenantLedger = (req, res) => {
  const { id } = req.params;

  db.get(`
    SELECT ${tenantFields}
    FROM tenants t
    LEFT JOIN units u ON t.unit_id = u.id
    LEFT JOIN buildings b ON u.building_id = b.id
    WHERE t.id = ?
  `, [id], (tenantErr, tenant) => {
    if (tenantErr) return res.status(500).json({ error: 'Error fetching tenant ledger' });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    db.all(
      `SELECT p.*, COALESCE(p.payment_period, strftime('%Y-%m', p.payment_date)) as payment_period,
              u.unit_number, b.name as building_name
       FROM payments p
       LEFT JOIN units u ON u.id = p.unit_id
       LEFT JOIN buildings b ON b.id = u.building_id
       WHERE p.tenant_id = ?
       ORDER BY COALESCE(p.payment_period, strftime('%Y-%m', p.payment_date)) DESC, p.payment_date DESC`,
      [id],
      (paymentsErr, payments = []) => {
        if (paymentsErr) return res.status(500).json({ error: 'Error fetching tenant payments' });

        db.all(
          `SELECT f.*, COALESCE(u.unit_number, '') as unit_number, COALESCE(creator.full_name, creator.username, 'System') as created_by_name
           FROM tenant_followups f
           LEFT JOIN units u ON u.id = f.unit_id
           LEFT JOIN users creator ON creator.id = f.created_by
           WHERE f.tenant_id = ?
           ORDER BY f.created_at DESC`,
          [id],
          (followErr, followups = []) => {
            if (followErr) return res.status(500).json({ error: 'Error fetching tenant follow-ups' });

            const periods = {};
            payments.forEach((payment) => {
              const period = payment.payment_period || 'unknown';
              if (!periods[period]) {
                periods[period] = { period, confirmed: 0, pending: 0, rejected: 0, payments: [] };
              }
              const amount = parseFloat(payment.amount || 0);
              const statusValue = payment.payment_status || 'confirmed';
              if (statusValue === 'confirmed') periods[period].confirmed += amount;
              else if (statusValue === 'pending') periods[period].pending += amount;
              else if (statusValue === 'rejected') periods[period].rejected += amount;
              periods[period].payments.push(payment);
            });

            const monthlyRent = parseFloat(tenant.monthly_rent || 0);
            const periodSummaries = Object.values(periods)
              .map((period) => ({
                ...period,
                required: monthlyRent,
                balance: Math.max(monthlyRent - period.confirmed, 0),
                status: monthlyRent > 0 && period.confirmed >= monthlyRent ? 'Fully paid' : (period.confirmed > 0 || period.pending > 0 ? 'Partially paid' : 'Unpaid')
              }))
              .sort((a, b) => String(b.period).localeCompare(String(a.period)));

            return res.json({
              tenant,
              payments,
              followups,
              periods: periodSummaries,
              totals: {
                confirmed: payments.filter((payment) => (payment.payment_status || 'confirmed') === 'confirmed').reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0),
                pending: payments.filter((payment) => payment.payment_status === 'pending').reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0),
                rejected: payments.filter((payment) => payment.payment_status === 'rejected').reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0),
                open_followups: followups.filter((followup) => followup.status === 'open').length
              }
            });
          }
        );
      }
    );
  });
};

// Archive tenant after move-out while keeping payment and balance history.
const deleteTenant = (req, res) => {
  const { id } = req.params;

  db.get('SELECT id, unit_id, status FROM tenants WHERE id = ?', [id], (findErr, tenant) => {
    if (findErr) {
      return res.status(500).json({ error: 'Error archiving tenant' });
    }

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    db.run(
      `UPDATE tenants
       SET status = 'inactive',
           move_out_date = COALESCE(move_out_date, DATE('now')),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id],
      function(archiveErr) {
        if (archiveErr) {
          return res.status(500).json({ error: 'Error archiving tenant' });
        }

        syncUnitStatus(tenant.unit_id, () => {
          deactivateTenantPortalAccounts(id, () => {
            res.json({ message: 'Tenant moved out and archived. Unit is available and portal access was disabled.' });
          });
        });
      }
    );
  });
};

const triggerWhatsAppReminders = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can trigger reminders manually' });
    }

    const result = await sendDueRentReminders();
    return res.json({ message: 'WhatsApp reminder run completed', ...result });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to run WhatsApp reminders', details: err.message });
  }
};

const getReminderCalendarEvents = async (req, res) => {
  try {
    const events = await getUpcomingReminderCalendarEvents();
    return res.json(events);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load reminder calendar events', details: err.message });
  }
};

module.exports = {
  getAllTenants,
  getTenantById,
  getTenantsByBuilding,
  createTenant,
  updateTenant,
  deleteTenant,
  getTenantLedger,
  createTenantFollowUp,
  updateTenantFollowUp,
  getReminderCalendarEvents,
  triggerWhatsAppReminders
};
