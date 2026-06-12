const express = require('express');
const buildingController = require('../controllers/buildingController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAnyRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/', buildingController.getAllBuildings);
router.get('/:id', buildingController.getBuildingById);
router.post('/', requireAnyRole(['manager', 'admin']), buildingController.createBuilding);
router.put('/:id/image', requireAnyRole(['manager', 'admin']), upload.single('building_image'), buildingController.updateBuildingImage);
router.put('/:id', requireAnyRole(['manager', 'admin']), buildingController.updateBuilding);
router.delete('/:id', requireAnyRole(['manager', 'admin']), buildingController.deleteBuilding);

module.exports = router;
