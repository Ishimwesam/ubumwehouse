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
router.get('/stream', tenantPortalController.streamTenantPortalMessages);
router.get('/messages', tenantPortalController.getTenantPortalMessages);
router.post('/messages', tenantPortalController.sendTenantPortalMessage);
router.get('/accounts/stream', tenantPortalController.streamAdminTenantMessages);
router.get('/accounts', authMiddleware, requireAnyRole(['manager', 'admin']), tenantPortalController.listTenantPortalAccounts);
router.put('/accounts/:accountId/status', authMiddleware, requireAnyRole(['manager', 'admin']), tenantPortalController.updateTenantPortalAccountStatus);
router.post('/accounts/:accountId/reset-password', authMiddleware, requireAnyRole(['manager', 'admin']), tenantPortalController.resetTenantPortalAccountPassword);
router.get('/accounts/:tenantId/messages', authMiddleware, requireAnyRole(['manager', 'admin']), tenantPortalController.getTenantMessagesForAdmin);
router.post('/accounts/:tenantId/messages', authMiddleware, requireAnyRole(['manager', 'admin']), tenantPortalController.sendAdminMessageToTenant);

module.exports = router;
