const https = require('https');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');

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

const formatAmount = (value) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

const getCurrentPeriod = () => new Date().toISOString().slice(0, 7);

const getCompanyName = () => process.env.WHATSAPP_COMPANY_NAME || process.env.SMTP_FROM_NAME || 'UBUMWE SYSTEM COMPANY';

const getMessagingConfig = () => ({
  configured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  remindersEnabled: String(process.env.WHATSAPP_REMINDERS_ENABLED || 'false').toLowerCase() === 'true',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ? 'configured' : '',
  defaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '250',
  companyName: getCompanyName(),
  graphVersion: process.env.WHATSAPP_GRAPH_VERSION || 'v20.0'
});

const parseProviderMessageId = (responseText) => {
  try {
    const parsed = JSON.parse(responseText || '{}');
    return parsed?.messages?.[0]?.id || null;
  } catch (_) {
    return null;
  }
};

const sendCloudApiText = (to, bodyText) => new Promise((resolve, reject) => {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || 'v20.0';

  if (!accessToken || !phoneNumberId) {
    return reject(new Error('WhatsApp Cloud API is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.'));
  }

  const payload = JSON.stringify({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: true, body: bodyText }
  });

  const req = https.request({
    hostname: 'graph.facebook.com',
    path: `/${graphVersion}/${phoneNumberId}/messages`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
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

const renderTemplate = (body, variables = {}) => {
  const normalized = Object.entries(variables).reduce((acc, [key, value]) => {
    acc[key] = value === undefined || value === null ? '' : String(value);
    return acc;
  }, {});

  return String(body || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => normalized[key] || '');
};

const getTemplates = () => dbAll(
  `SELECT id, name, category, language, body, status, created_at, updated_at
   FROM whatsapp_message_templates
   ORDER BY name ASC`
);

const getTemplateById = async (templateId) => {
  const template = await dbGet(
    `SELECT id, name, category, language, body, status
     FROM whatsapp_message_templates
     WHERE id = ? OR name = ?
     LIMIT 1`,
    [templateId, templateId]
  );
  return template;
};

const getTenantMessagingRows = async () => {
  const period = getCurrentPeriod();
  return dbAll(
    `SELECT t.id, t.full_name, t.phone, t.email, t.status,
            u.id AS unit_id, u.unit_number,
            COALESCE(rh.amount, u.monthly_rent, 0) AS monthly_rent,
            b.name AS building_name,
            COALESCE((
              SELECT SUM(p.amount)
              FROM payments p
              WHERE p.tenant_id = t.id
                AND COALESCE(p.payment_period, strftime('%Y-%m', p.payment_date)) = ?
                AND COALESCE(p.payment_status, 'confirmed') = 'confirmed'
            ), 0) AS confirmed_paid,
            COALESCE((
              SELECT SUM(p.amount)
              FROM payments p
              WHERE p.tenant_id = t.id
                AND COALESCE(p.payment_period, strftime('%Y-%m', p.payment_date)) = ?
                AND COALESCE(p.payment_status, 'confirmed') = 'pending'
            ), 0) AS pending_amount,
            (
              SELECT MAX(wml.created_at)
              FROM whatsapp_message_logs wml
              WHERE wml.tenant_id = t.id
            ) AS last_whatsapp_at
     FROM tenants t
     LEFT JOIN units u ON u.id = t.unit_id
     LEFT JOIN buildings b ON b.id = u.building_id
     LEFT JOIN tenant_rent_history rh ON rh.tenant_id = t.id
       AND rh.unit_id = t.unit_id
       AND rh.start_period <= ?
       AND (rh.end_period IS NULL OR rh.end_period >= ?)
     WHERE t.status = 'active'
       AND (t.move_out_date IS NULL OR DATE(t.move_out_date) > DATE('now'))
     ORDER BY t.full_name ASC`,
    [period, period, period, period]
  );
};

const enrichTenant = (tenant) => {
  const monthlyRent = Number(tenant.monthly_rent || 0);
  const paid = Number(tenant.confirmed_paid || 0);
  const balance = Math.max(monthlyRent - paid, 0);
  const normalizedPhone = normalizePhone(tenant.phone);

  return {
    ...tenant,
    normalized_phone: normalizedPhone,
    whatsapp_ready: Boolean(normalizedPhone),
    month: getCurrentPeriod(),
    amount: monthlyRent,
    balance,
    due_date: process.env.WHATSAPP_DEFAULT_DUE_DATE || 'month end',
    company_name: getCompanyName()
  };
};

const getTenantMessagingList = async () => {
  const tenants = await getTenantMessagingRows();
  return tenants.map(enrichTenant);
};

const getHistory = ({ tenantId = '', limit = 80 } = {}) => {
  const normalizedLimit = Math.min(Math.max(parseInt(limit, 10) || 80, 1), 250);
  const params = [];
  let where = '';
  if (tenantId) {
    where = 'WHERE wml.tenant_id = ?';
    params.push(tenantId);
  }

  params.push(normalizedLimit);
  return dbAll(
    `SELECT wml.*, COALESCE(t.full_name, wml.tenant_name) AS tenant_name,
            u.unit_number, b.name AS building_name
     FROM whatsapp_message_logs wml
     LEFT JOIN tenants t ON t.id = wml.tenant_id
     LEFT JOIN units u ON u.id = t.unit_id
     LEFT JOIN buildings b ON b.id = u.building_id
     ${where}
     ORDER BY wml.created_at DESC
     LIMIT ?`,
    params
  );
};

const getSummary = async () => {
  const config = getMessagingConfig();
  const rows = await dbAll(
    `SELECT status, COUNT(*) AS count
     FROM whatsapp_message_logs
     GROUP BY status`
  );
  const statusCounts = rows.reduce((acc, row) => {
    acc[row.status || 'unknown'] = row.count;
    return acc;
  }, {});
  const tenants = await getTenantMessagingList();

  return {
    config,
    statusCounts,
    totals: {
      tenants: tenants.length,
      readyTenants: tenants.filter((tenant) => tenant.whatsapp_ready).length,
      withOpenBalance: tenants.filter((tenant) => tenant.balance > 0).length
    }
  };
};

const createLog = async ({ tenant, phone, messageType, templateName, messageBody, sentBy }) => {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO whatsapp_message_logs (
      id, tenant_id, tenant_name, phone, message_type, template_name, message_body, status, sent_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?)`,
    [
      id,
      tenant?.id || null,
      tenant?.full_name || tenant?.tenant_name || null,
      phone,
      messageType,
      templateName || null,
      messageBody,
      sentBy || null
    ]
  );
  return id;
};

const markLog = async (id, status, responseText, providerMessageId = null) => {
  const timestampColumn = status === 'sent' ? 'sent_at' : (status === 'failed' ? 'failed_at' : null);
  const timestampSql = timestampColumn ? `, ${timestampColumn} = CURRENT_TIMESTAMP` : '';
  await dbRun(
    `UPDATE whatsapp_message_logs
     SET status = ?, response = ?, provider_message_id = COALESCE(?, provider_message_id)${timestampSql}
     WHERE id = ?`,
    [status, responseText || null, providerMessageId, id]
  );
};

const getTenantById = async (tenantId) => {
  const tenants = await getTenantMessagingList();
  return tenants.find((tenant) => tenant.id === tenantId) || null;
};

const buildVariables = (tenant, extraVariables = {}) => ({
  tenant_name: tenant?.full_name || tenant?.tenant_name || '',
  month: tenant?.month || getCurrentPeriod(),
  amount: formatAmount(tenant?.amount),
  balance: formatAmount(tenant?.balance),
  due_date: tenant?.due_date || process.env.WHATSAPP_DEFAULT_DUE_DATE || 'month end',
  company_name: getCompanyName(),
  receipt_link: '',
  announcement: '',
  ...extraVariables
});

const sendTenantMessage = async ({ tenantId, templateId, messageType = 'manual', messageBody = '', variables = {}, sentBy = null }) => {
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const phone = tenant.normalized_phone;
  if (!phone) {
    throw new Error('Tenant does not have a valid WhatsApp phone number');
  }

  let templateName = templateId || null;
  let body = messageBody;
  if (templateId) {
    const template = await getTemplateById(templateId);
    if (!template) throw new Error('WhatsApp template not found');
    templateName = template.name;
    body = renderTemplate(template.body, buildVariables(tenant, variables));
  } else {
    body = renderTemplate(messageBody, buildVariables(tenant, variables));
  }

  if (!String(body || '').trim()) {
    throw new Error('Message body is required');
  }

  const logId = await createLog({ tenant, phone, messageType, templateName, messageBody: body, sentBy });

  try {
    const responseText = await sendCloudApiText(phone, body);
    await markLog(logId, 'sent', responseText, parseProviderMessageId(responseText));
    return { id: logId, status: 'sent', response: responseText };
  } catch (error) {
    await markLog(logId, 'failed', error.message);
    return { id: logId, status: 'failed', error: error.message };
  }
};

const sendBulkMessage = async ({ tenantIds = [], templateId, messageType = 'manual', messageBody = '', variables = {}, sentBy = null }) => {
  const ids = Array.isArray(tenantIds) ? tenantIds : [];
  const results = [];

  for (const tenantId of ids) {
    try {
      const result = await sendTenantMessage({ tenantId, templateId, messageType, messageBody, variables, sentBy });
      results.push({ tenantId, ...result });
    } catch (error) {
      results.push({ tenantId, status: 'failed', error: error.message });
    }
  }

  return {
    total: results.length,
    sent: results.filter((result) => result.status === 'sent').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results
  };
};

const sendOpenBalanceReminders = async ({ sentBy = null, overdueOnly = false } = {}) => {
  const tenants = await getTenantMessagingList();
  const selected = tenants.filter((tenant) => tenant.balance > 0 && tenant.whatsapp_ready);
  const templateId = overdueOnly ? 'overdue' : 'rent_due';
  return sendBulkMessage({
    tenantIds: selected.map((tenant) => tenant.id),
    templateId,
    messageType: overdueOnly ? 'overdue' : 'rent_due',
    sentBy
  });
};

module.exports = {
  normalizePhone,
  getMessagingConfig,
  getTemplates,
  getTenantMessagingList,
  getHistory,
  getSummary,
  sendTenantMessage,
  sendBulkMessage,
  sendOpenBalanceReminders
};
