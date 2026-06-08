const express = require('express');
const pushController = require('../controllers/pushController');

const router = express.Router();

// Public — returns VAPID public key for SW subscription
router.get('/vapid-public-key', pushController.getVapidPublicKey);

// Tenant-authenticated (token in header or query for SW context)
router.post('/subscribe', pushController.subscribeTenantPush);
router.post('/unsubscribe', pushController.unsubscribeTenantPush);

module.exports = router;
