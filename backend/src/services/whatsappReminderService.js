const https = require('https');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');

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

const normalizePhone = (rawPhone) => {
  if (!rawPhone) return null;

  const defaultCountryCode = String(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '250').replace(/\D/g, '');
  let digits = String(rawPhone).replace(/\D/g, '');

  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);

  if (digits.startsWith(defaultCountryCode)) return digits;
  if (digits.startsWith('0')) return `${defaultCountryCode}${digits.slice(1)}`;
  if (digits.length <= 9) return `${defaultCountryCode}${digits}`;

  return digits;
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

const resolveBuildingReminderMessage = (buildingName = '') => {
  const normalized = String(buildingName || '').trim().toUpperCase();

  if (normalized.includes('IHURIRO HOUSE')) {
    return "MURAHO NEZA, Ubuyobozi bwihuriro house bwabibutsaga kwishyura ubukode, niba hari ikibazo kimbogamizi murasabwa kugera kuri office mukabimenyesha ubuyobozi.";
  }

  if (normalized.includes('UBUMWE HOUSE')) {
    return "MURAHO NEZA, Ubuyobozi bw'UBUMWE house bwabibutsaga kwishyura ubukode, niba hari ikibazo kimbogamizi murasabwa kugera kuri office mukabimenyesha ubuyobozi.";
  }

  return "MURAHO NEZA, Ubuyobozi bw'inyubako yanyu bwabibutsaga kwishyura ubukode, niba hari ikibazo kimbogamizi murasabwa kugera kuri office mukabimenyesha ubuyobozi.";
};

const getConfirmedPaidForPeriod = async (tenantId, duePeriod) => {
  const row = await dbGet(
    `SELECT COALESCE(SUM(amount), 0) AS confirmedPaid
     FROM payments
     WHERE tenant_id = ?
       AND (payment_period = ? OR substr(payment_date, 1, 7) = ?)
       AND (payment_status IS NULL OR payment_status != 'pending')`,
    [tenantId, duePeriod, duePeriod]
  );

  return parseFloat(row?.confirmedPaid || 0);
};

const hasSentReminderToday = async (tenantId, duePeriod, reminderDate) => {
  const row = await dbGet(
    `SELECT id
     FROM whatsapp_reminder_logs
     WHERE tenant_id = ? AND due_period = ? AND reminder_date = ?
     LIMIT 1`,
    [tenantId, duePeriod, reminderDate]
  );

  return Boolean(row);
};

const logReminder = async ({ tenantId, phone, duePeriod, reminderDate, status, responseText }) => {
  await dbRun(
    `INSERT INTO whatsapp_reminder_logs
     (id, tenant_id, phone, due_period, reminder_date, status, response)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), tenantId, phone, duePeriod, reminderDate, status, responseText || null]
  );
};

const sendWhatsAppMessage = (to, bodyText) => new Promise((resolve, reject) => {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    return reject(new Error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID'));
  }

  const payload = JSON.stringify({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: bodyText }
  });

  const options = {
    hostname: 'graph.facebook.com',
    path: `/v20.0/${phoneNumberId}/messages`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      if (ok) {
        resolve(data);
      } else {
        reject(new Error(`WhatsApp API error (${res.statusCode}): ${data}`));
      }
    });
  });

  req.on('error', reject);
  req.write(payload);
  req.end();
});

const buildReminderMessage = ({ buildingName }) => {
  return resolveBuildingReminderMessage(buildingName);
};

const getTenantDueReminderEntries = async ({ referenceDate = new Date(), daysBefore = 3 } = {}) => {
  const tenants = await dbAll(
    `SELECT t.id, t.full_name, t.phone, t.move_in_date, u.monthly_rent, b.name AS building_name, u.unit_number
     FROM tenants t
     LEFT JOIN units u ON t.unit_id = u.id
     LEFT JOIN buildings b ON u.building_id = b.id
     WHERE t.status = 'active'
       AND t.phone IS NOT NULL
       AND TRIM(t.phone) != ''
       AND t.move_in_date IS NOT NULL`
  );

  const dueEntries = [];

  for (const tenant of tenants) {
    const moveInDate = parseLocalDate(tenant.move_in_date);
    const monthlyRent = parseFloat(tenant.monthly_rent || 0);
    if (!moveInDate || monthlyRent <= 0) continue;

    const normalizedPhone = normalizePhone(tenant.phone);
    if (!normalizedPhone) continue;

    const { dueDate, daysUntilDue, duePeriod } = resolveDueDate(moveInDate, referenceDate);
    if (daysUntilDue < 0 || daysUntilDue > daysBefore) continue;

    const confirmedPaid = await getConfirmedPaidForPeriod(tenant.id, duePeriod);
    if (confirmedPaid >= monthlyRent) continue;

    dueEntries.push({
      tenant,
      normalizedPhone,
      dueDate,
      daysUntilDue,
      duePeriod,
      remainingAmount: Math.max(monthlyRent - confirmedPaid, 0)
    });
  }

  return dueEntries;
};

const getUpcomingReminderCalendarEvents = async () => {
  const daysBefore = Math.max(0, parseInt(process.env.WHATSAPP_REMINDER_DAYS_BEFORE || '3', 10));
  const entries = await getTenantDueReminderEntries({ daysBefore });

  return entries.map((entry) => ({
    id: `rent-due-${entry.tenant.id}-${entry.duePeriod}`,
    title: `Rent due: ${entry.tenant.full_name}`,
    start: entry.dueDate.toISOString(),
    end: entry.dueDate.toISOString(),
    category: 'Rent',
    note: `${entry.tenant.full_name} (${entry.tenant.unit_number || 'N/A'}) - ${entry.tenant.building_name || 'Building'} | Remaining ${entry.remainingAmount.toLocaleString()} RWF`,
    actionPath: '/tenants',
    actionLabel: 'Open tenants with balances',
    tenant_id: entry.tenant.id,
    building_name: entry.tenant.building_name || ''
  }));
};

const sendDueRentReminders = async () => {
  const remindersEnabled = String(process.env.WHATSAPP_REMINDERS_ENABLED || 'false').toLowerCase() === 'true';
  if (!remindersEnabled) {
    return {
      enabled: false,
      scanned: 0,
      sent: 0,
      skipped: 0,
      errors: ['WHATSAPP_REMINDERS_ENABLED is false']
    };
  }

  const daysBefore = Math.max(0, parseInt(process.env.WHATSAPP_REMINDER_DAYS_BEFORE || '3', 10));
  const reminderDate = new Date().toISOString().slice(0, 10);

  const dueEntries = await getTenantDueReminderEntries({ daysBefore });

  let sent = 0;
  let skipped = 0;
  const errors = [];

  for (const entry of dueEntries) {
    const tenant = entry.tenant;
    try {
      const normalizedPhone = entry.normalizedPhone;
      const duePeriod = entry.duePeriod;

      const alreadySent = await hasSentReminderToday(tenant.id, duePeriod, reminderDate);
      if (alreadySent) {
        skipped += 1;
        continue;
      }

      const message = buildReminderMessage({
        buildingName: tenant.building_name
      });

      const responseText = await sendWhatsAppMessage(normalizedPhone, message);
      await logReminder({
        tenantId: tenant.id,
        phone: normalizedPhone,
        duePeriod,
        reminderDate,
        status: 'sent',
        responseText
      });
      sent += 1;
    } catch (error) {
      errors.push(`Tenant ${tenant.full_name}: ${error.message}`);

      try {
        await logReminder({
          tenantId: tenant.id,
          phone: normalizePhone(tenant.phone) || tenant.phone,
          duePeriod: entry.duePeriod,
          reminderDate,
          status: 'failed',
          responseText: error.message
        });
      } catch (logError) {
        errors.push(`Log failure for ${tenant.full_name}: ${logError.message}`);
      }
    }
  }

  return {
    enabled: true,
    scanned: dueEntries.length,
    sent,
    skipped,
    errors
  };
};

const startWhatsAppReminderScheduler = () => {
  const remindersEnabled = String(process.env.WHATSAPP_REMINDERS_ENABLED || 'false').toLowerCase() === 'true';
  if (!remindersEnabled) {
    console.log('WhatsApp reminders scheduler disabled (WHATSAPP_REMINDERS_ENABLED=false)');
    return;
  }

  const intervalHours = Math.max(1, parseInt(process.env.WHATSAPP_REMINDER_INTERVAL_HOURS || '24', 10));

  sendDueRentReminders()
    .then((result) => {
      console.log(`WhatsApp reminders startup run: scanned=${result.scanned}, sent=${result.sent}, skipped=${result.skipped}`);
      if (result.errors.length > 0) {
        console.error('WhatsApp reminders startup errors:', result.errors);
      }
    })
    .catch((error) => {
      console.error('WhatsApp reminders startup run failed:', error.message);
    });

  reminderInterval = setInterval(() => {
    sendDueRentReminders()
      .then((result) => {
        console.log(`WhatsApp reminders scheduled run: scanned=${result.scanned}, sent=${result.sent}, skipped=${result.skipped}`);
        if (result.errors.length > 0) {
          console.error('WhatsApp reminders scheduled errors:', result.errors);
        }
      })
      .catch((error) => {
        console.error('WhatsApp reminders scheduled run failed:', error.message);
      });
  }, intervalHours * 60 * 60 * 1000);

  console.log(`WhatsApp reminders scheduler started: every ${intervalHours} hour(s)`);
};

const stopWhatsAppReminderScheduler = () => {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
};

module.exports = {
  getUpcomingReminderCalendarEvents,
  getTenantDueReminderEntries,
  sendDueRentReminders,
  startWhatsAppReminderScheduler,
  stopWhatsAppReminderScheduler
};
