const express = require('express');
const tenantController = require('../controllers/tenantController');
const upload = require('../middleware/upload');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/', tenantController.getAllTenants);
router.get('/reminders/events', tenantController.getReminderCalendarEvents);
router.post('/reminders/whatsapp/send-now', requireAnyRole(['manager', 'admin']), tenantController.triggerWhatsAppReminders);
router.get('/building/:buildingId', tenantController.getTenantsByBuilding);
router.get('/:id/ledger', tenantController.getTenantLedger);
router.post('/:id/followups', requireAnyRole(['manager', 'admin']), tenantController.createTenantFollowUp);
router.put('/followups/:followUpId', requireAnyRole(['manager', 'admin']), tenantController.updateTenantFollowUp);
router.get('/:id', tenantController.getTenantById);
router.post('/', requireAnyRole(['manager', 'admin']), upload.single('identification_document_file'), tenantController.createTenant);
router.put('/:id', requireAnyRole(['manager', 'admin']), upload.single('identification_document_file'), tenantController.updateTenant);
router.delete('/:id', requireAnyRole(['manager', 'admin']), tenantController.deleteTenant);

module.exports = router;
