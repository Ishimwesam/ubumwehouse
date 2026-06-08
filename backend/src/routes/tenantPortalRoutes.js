const express = require('express');
const tenantPortalController = require('../controllers/tenantPortalController');
const upload = require('../middleware/upload');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAnyRole } = require('../middleware/auth');

const router = express.Router();

router.post('/access', tenantPortalController.accessTenantPortal);
router.post('/register', tenantPortalController.registerTenantPortal);
router.post('/login', tenantPortalController.loginTenantPortal);
router.get('/me', tenantPortalController.getTenantPortalMe);
router.post('/payment-proof', upload.single('receipt'), tenantPortalController.uploadTenantPaymentProof);
router.get('/accounts', authMiddleware, requireAnyRole(['manager', 'admin']), tenantPortalController.listTenantPortalAccounts);
router.put('/accounts/:accountId/status', authMiddleware, requireAnyRole(['manager', 'admin']), tenantPortalController.updateTenantPortalAccountStatus);
router.post('/accounts/:accountId/reset-password', authMiddleware, requireAnyRole(['manager', 'admin']), tenantPortalController.resetTenantPortalAccountPassword);

module.exports = router;
