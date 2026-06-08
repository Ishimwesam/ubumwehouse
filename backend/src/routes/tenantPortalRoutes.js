const express = require('express');
const tenantPortalController = require('../controllers/tenantPortalController');
const upload = require('../middleware/upload');

const router = express.Router();

router.post('/access', tenantPortalController.accessTenantPortal);
router.post('/register', tenantPortalController.registerTenantPortal);
router.post('/login', tenantPortalController.loginTenantPortal);
router.get('/me', tenantPortalController.getTenantPortalMe);
router.post('/payment-proof', upload.single('receipt'), tenantPortalController.uploadTenantPaymentProof);

module.exports = router;
