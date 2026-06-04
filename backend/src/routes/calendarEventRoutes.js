const express = require('express');
const calendarEventController = require('../controllers/calendarEventController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAnyRole } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', calendarEventController.getAll);
router.post('/', requireAnyRole(['manager', 'admin']), calendarEventController.create);
router.put('/:id', requireAnyRole(['manager', 'admin']), calendarEventController.update);
router.delete('/:id', requireAnyRole(['manager', 'admin']), calendarEventController.remove);

module.exports = router;
