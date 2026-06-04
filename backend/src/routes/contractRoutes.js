const express = require('express');
const contractController = require('../controllers/contractController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAnyRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(authMiddleware);

router.get('/', contractController.getAllContracts);
router.get('/tenant/:tenantId', contractController.getContractsByTenant);
router.post('/', requireAnyRole(['manager', 'admin']), upload.single('contract_file'), contractController.createContract);
router.put('/:id', requireAnyRole(['manager', 'admin']), upload.single('contract_file'), contractController.updateContract);
router.put('/:id/terminate', requireAnyRole(['manager', 'admin']), contractController.terminateContract);
router.delete('/:id', requireAnyRole(['manager', 'admin']), contractController.deleteContract);

module.exports = router;
