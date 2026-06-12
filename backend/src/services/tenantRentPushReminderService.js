const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const { notifyTenantStream } = require('./tenantPortalRealtimeService');
const { sendPushToTenant } = require('../controllers/pushController');

const MS_PER_DAY = 1000 * 60 * 60 * 24;
let reminderInterval = null;

const dbAll = (query, params = []) => new Promise((resolve, reject) => {
  db.all(query, params, (err, rows) => {
    if (err) return reject(err);
    resolve(rows || []);
  });
});

const dbGet = (query, params = []) => new Promise((resolve, reject) => {
  db.get(query, params, (err, row) => {
    if (err) return reject(err);
    resolve(row || null);
  });
});

const dbRun = (query, params = []) => new Promise((resolve, reject) => {
  db.run(query, params, function onRun(err) {
    if (err) return reject(err);
    resolve(this);
  });
});

const parseLocalDate = (dateValue) => {
  if (!dateValue) return null;
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const [year, month, day] = dateValue.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveDueDate = (moveInDate, referenceDate = new Date()) => {
  const dueDay = moveInDate.getDate();
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  const forMonth = (year, month) => {
    const lastDayInMonth = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(dueDay, lastDayInMonth));
  };

  let dueDate = forMonth(today.getFullYear(), today.getMonth());
  if (dueDate < today) {
    dueDate = forMonth(today.getFullYear(), today.getMonth() + 1);
  }

  const daysUntilDue = Math.round((dueDate - today) / MS_PER_DAY);
  const duePeriod = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;

  return { dueDate, daysUntilDue, duePeriod };
};

const getConfirmedPaidForPeriod = async (tenantId, duePeriod) => {
  const row = await dbGet(
    `SELECT COALESCE(SUM(amount), 0) AS confirmed_paid
     FROM payments
     WHERE tenant_id = ?
       AND (payment_period = ? OR substr(payment_date, 1, 7) = ?)
       AND COALESCE(payment_status, 'confirmed') = 'confirmed'`,
    [tenantId, duePeriod, duePeriod]
  );

  return parseFloat(row?.confirmed_paid || 0);
};

const hasPushSubscription = async (tenantId) => {
  const row = await dbGet(
    'SELECT COUNT(*) AS subscription_count FROM tenant_push_subscriptions WHERE tenant_id = ?',
    [tenantId]
  );

  return Number(row?.subscription_count || 0) > 0;
};

const hasReminderLog = async ({ tenantId, duePeriod, reminderDate }) => {
  const row = await dbGet(
    `SELECT id
     FROM tenant_notification_logs
     WHERE tenant_id = ?
       AND due_period = ?
       AND reminder_date = ?
       AND notification_type = 'rent_due'
     LIMIT 1`,
    [tenantId, duePeriod, reminderDate]
  );

  return Boolean(row);
};

const logReminder = async ({ tenantId, duePeriod, reminderDate, status, message }) => {
  await dbRun(
    `INSERT INTO tenant_notification_logs
     (id, tenant_id, due_period, reminder_date, notification_type, status, message)
     VALUES (?, ?, ?, ?, 'rent_due', ?, ?)`,
    [uuidv4(), tenantId, duePeriod, reminderDate, status, message || null]
  );
};

const getTenantRentReminderEntries = async ({ referenceDate = new Date(), daysBefore = 5 } = {}) => {
  const tenants = await dbAll(
    `SELECT t.id, t.full_name, t.move_in_date, t.move_out_date, u.monthly_rent, u.unit_number, b.name AS building_name
     FROM tenants t
     LEFT JOIN units u ON t.unit_id = u.id
     LEFT JOIN buildings b ON u.building_id = b.id
     WHERE t.status = 'active'
       AND t.move_in_date IS NOT NULL
       AND DATE(t.move_in_date) <= DATE('now')
       AND (t.move_out_date IS NULL OR DATE(t.move_out_date) > DATE('now'))`
  );

  const entries = [];
  for (const tenant of tenants) {
    const moveInDate = parseLocalDate(tenant.move_in_date);
    const monthlyRent = parseFloat(tenant.monthly_rent || 0);
    if (!moveInDate || monthlyRent <= 0) continue;

    const due = resolveDueDate(moveInDate, referenceDate);
    if (due.daysUntilDue < 0 || due.daysUntilDue > daysBefore) continue;

    const confirmedPaid = await getConfirmedPaidForPeriod(tenant.id, due.duePeriod);
    const remainingAmount = Math.max(monthlyRent - confirmedPaid, 0);
    if (remainingAmount <= 0) continue;

    entries.push({
      tenant,
      ...due,
      monthlyRent,
      confirmedPaid,
      remainingAmount
    });
  }

  return entries;
};

const buildRentReminderCopy = (entry) => {
  const dueDateText = entry.dueDate.toISOString().slice(0, 10);
  const amountText = `${Math.round(entry.remainingAmount).toLocaleString('en-US')} RWF`;
  const unitText = entry.tenant.unit_number ? ` for room/office ${entry.tenant.unit_number}` : '';
  const title = entry.daysUntilDue === 0 ? 'Rent is due today' : 'Rent payment reminder';
  const body = entry.daysUntilDue === 0
    ? `Your rent${unitText} is due today. Remaining amount: ${amountText}.`
    : `Your rent${unitText} is due on ${dueDateText}. Remaining amount: ${amountText}.`;

  return { title, body };
};

const sendTenantRentPushReminders = async () => {
  const enabled = String(process.env.TENANT_RENT_PUSH_REMINDERS_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) {
    return { enabled: false, scanned: 0, sent: 0, skipped: 0, errors: ['TENANT_RENT_PUSH_REMINDERS_ENABLED=false'] };
  }

  const daysBefore = Math.max(0, parseInt(process.env.TENANT_RENT_PUSH_DAYS_BEFORE || '5', 10));
  const reminderDate = new Date().toISOString().slice(0, 10);
  const entries = await getTenantRentReminderEntries({ daysBefore });

  let sent = 0;
  let skipped = 0;
  const errors = [];

  for (const entry of entries) {
    try {
      const tenantId = entry.tenant.id;
      const alreadySent = await hasReminderLog({ tenantId, duePeriod: entry.duePeriod, reminderDate });
      if (alreadySent) {
        skipped += 1;
        continue;
      }

      const canPush = await hasPushSubscription(tenantId);
      if (!canPush) {
        skipped += 1;
        continue;
      }

      const copy = buildRentReminderCopy(entry);
      const payload = {
        event_type: 'tenant_rent_due',
        id: `rent-due-${tenantId}-${entry.duePeriod}-${reminderDate}`,
        title: copy.title,
        message: copy.body,
        due_period: entry.duePeriod,
        due_date: entry.dueDate.toISOString(),
        remaining_amount: entry.remainingAmount,
        created_at: new Date().toISOString(),
        actionPath: '/tenant-portal/upload'
      };

      notifyTenantStream(tenantId, payload);
      sendPushToTenant(tenantId, copy.title, copy.body, '/tenant-portal/upload');
      await logReminder({
        tenantId,
        duePeriod: entry.duePeriod,
        reminderDate,
        status: 'sent',
        message: copy.body
      });
      sent += 1;
    } catch (error) {
      errors.push(`Tenant ${entry.tenant.full_name}: ${error.message}`);
    }
  }

  return { enabled: true, scanned: entries.length, sent, skipped, errors };
};

const startTenantRentPushReminderScheduler = () => {
  const enabled = String(process.env.TENANT_RENT_PUSH_REMINDERS_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) {
    console.log('Tenant rent push reminders disabled (TENANT_RENT_PUSH_REMINDERS_ENABLED=false)');
    return;
  }

  const intervalHours = Math.max(1, parseInt(process.env.TENANT_RENT_PUSH_INTERVAL_HOURS || '12', 10));

  sendTenantRentPushReminders()
    .then((result) => {
      console.log(`Tenant rent push reminders startup run: scanned=${result.scanned}, sent=${result.sent}, skipped=${result.skipped}`);
      if (result.errors.length > 0) console.error('Tenant rent push reminder startup errors:', result.errors);
    })
    .catch((error) => {
      console.error('Tenant rent push reminder startup run failed:', error.message);
    });

  reminderInterval = setInterval(() => {
    sendTenantRentPushReminders()
      .then((result) => {
        console.log(`Tenant rent push reminders scheduled run: scanned=${result.scanned}, sent=${result.sent}, skipped=${result.skipped}`);
        if (result.errors.length > 0) console.error('Tenant rent push reminder scheduled errors:', result.errors);
      })
      .catch((error) => {
        console.error('Tenant rent push reminder scheduled run failed:', error.message);
      });
  }, intervalHours * 60 * 60 * 1000);

  console.log(`Tenant rent push reminder scheduler started: every ${intervalHours} hour(s)`);
};

const stopTenantRentPushReminderScheduler = () => {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
};

module.exports = {
  getTenantRentReminderEntries,
  sendTenantRentPushReminders,
  startTenantRentPushReminderScheduler,
  stopTenantRentPushReminderScheduler
};
