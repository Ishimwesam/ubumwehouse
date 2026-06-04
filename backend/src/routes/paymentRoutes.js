const express = require('express');
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAnyRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Reports and exports require manager or admin role
router.get('/report', requireAnyRole(['manager', 'admin']), paymentController.generateIncomeReport);
router.get('/report/pdf', requireAnyRole(['manager', 'admin']), paymentController.exportIncomeReportPDF);
router.get('/building/:buildingId/export', requireAnyRole(['manager', 'admin']), paymentController.exportPaymentsByBuilding);

// Regular payment operations available to all authenticated users
router.get('/', paymentController.getAllPayments);
router.get('/building/:buildingId', paymentController.getPaymentsByBuilding);
router.get('/tenant/:tenantId', paymentController.getPaymentsByTenant);
router.get('/:id', paymentController.getPaymentById);
router.post('/', upload.single('receipt'), paymentController.createPayment);
router.put('/:id/confirm', requireAnyRole(['manager', 'admin']), paymentController.confirmPayment);
router.put('/:id/reject', requireAnyRole(['manager', 'admin']), paymentController.rejectPayment);
router.put('/:id/receipt-printed', paymentController.markReceiptPrinted);
router.put('/:id', requireAnyRole(['manager', 'admin']), upload.single('receipt'), paymentController.updatePayment);
router.delete('/:id', requireAnyRole(['manager', 'admin']), paymentController.deletePayment);

module.exports = router;
