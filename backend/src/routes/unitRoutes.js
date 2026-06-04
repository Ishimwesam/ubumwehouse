const express = require('express');
const unitController = require('../controllers/unitController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/', unitController.getAllUnits);
router.get('/building/:buildingId', unitController.getUnitsByBuilding);
router.get('/:id', unitController.getUnitById);
router.post('/', requireAnyRole(['manager', 'admin']), unitController.createUnit);
router.put('/:id', requireAnyRole(['manager', 'admin']), unitController.updateUnit);
router.delete('/:id', requireAnyRole(['manager', 'admin']), unitController.deleteUnit);

module.exports = router;
