const express = require('express');
const expenseController = require('../controllers/expenseController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAnyRole } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', expenseController.getAll);
router.post('/', requireAnyRole(['manager', 'admin']), expenseController.create);
router.delete('/:id', requireAnyRole(['manager', 'admin']), expenseController.remove);

module.exports = router;
