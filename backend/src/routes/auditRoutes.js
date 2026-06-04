const express = require('express');
const auditController = require('../controllers/auditController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAnyRole } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);
router.get('/', requireAnyRole(['admin']), auditController.getAuditLogs);

module.exports = router;
