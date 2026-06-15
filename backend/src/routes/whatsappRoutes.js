const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAnyRole } = require('../middleware/auth');
const whatsappController = require('../controllers/whatsappController');

const router = express.Router();

router.use(authMiddleware);
router.use(requireAnyRole(['manager', 'admin']));

router.get('/dashboard', whatsappController.getDashboard);
router.get('/history', whatsappController.getHistory);
router.post('/send', whatsappController.sendMessage);
router.post('/reminders/open-balances', whatsappController.sendOpenBalanceReminders);

module.exports = router;
