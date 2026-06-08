const webpush = require('web-push');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const jwt = require('jsonwebtoken');

const getVapidPublicKey = (_req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) return res.status(503).json({ error: 'Push notifications are not configured.' });
  return res.json({ publicKey });
};

const getTenantFromPushToken = (req) => {
  const token = req.headers.authorization?.split(' ')[1] || String(req.query?.token || '').trim();
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (_) {
    return null;
  }
};

const subscribeTenantPush = (req, res) => {
  const tenant = getTenantFromPushToken(req);
  if (!tenant) return res.status(401).json({ error: 'Tenant login required.' });

  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid push subscription payload.' });
  }

  const id = uuidv4();
  const userAgent = req.headers['user-agent'] || '';

  db.run(
    `INSERT INTO tenant_push_subscriptions (id, tenant_id, endpoint, p256dh, auth, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, endpoint) DO UPDATE SET
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       user_agent = excluded.user_agent`,
    [id, tenant.id, endpoint, keys.p256dh, keys.auth, userAgent],
    (err) => {
      if (err) return res.status(500).json({ error: 'Failed to save push subscription.' });
      return res.status(201).json({ message: 'Push subscription saved.' });
    }
  );

  return undefined;
};

const unsubscribeTenantPush = (req, res) => {
  const tenant = getTenantFromPushToken(req);
  if (!tenant) return res.status(401).json({ error: 'Tenant login required.' });

  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'Endpoint is required.' });

  db.run(
    'DELETE FROM tenant_push_subscriptions WHERE tenant_id = ? AND endpoint = ?',
    [tenant.id, endpoint],
    (err) => {
      if (err) return res.status(500).json({ error: 'Failed to remove subscription.' });
      return res.json({ message: 'Unsubscribed.' });
    }
  );

  return undefined;
};

const sendPushToTenant = (tenantId, title, body, url = '/tenant-portal/messages') => {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:ubumwehouseltd@gmail.com';

  if (!vapidPublicKey || !vapidPrivateKey) return;

  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

  db.all(
    'SELECT * FROM tenant_push_subscriptions WHERE tenant_id = ?',
    [tenantId],
    (err, rows) => {
      if (err || !rows?.length) return;

      const payload = JSON.stringify({ title, body, url });

      rows.forEach((row) => {
        const subscription = {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth }
        };

        webpush.sendNotification(subscription, payload).catch((pushErr) => {
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            // Subscription is expired or invalid — remove it
            db.run(
              'DELETE FROM tenant_push_subscriptions WHERE tenant_id = ? AND endpoint = ?',
              [tenantId, row.endpoint]
            );
          }
        });
      });
    }
  );
};

module.exports = {
  getVapidPublicKey,
  subscribeTenantPush,
  unsubscribeTenantPush,
  sendPushToTenant
};
