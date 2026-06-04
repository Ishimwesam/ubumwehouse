const express = require('express');
const systemController = require('../controllers/systemController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAnyRole } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);
router.use(requireAnyRole(['admin']));

router.get('/backups/status', systemController.getSystemBackupStatus);
router.post('/backups/run', systemController.runSystemBackup);
router.post('/backups/verify', systemController.verifySystemBackup);
router.post('/backups/restore', systemController.restoreSystemBackup);
router.get('/messaging/status', systemController.getMessagingStatus);

module.exports = router;
