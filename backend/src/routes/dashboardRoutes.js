const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/summary', dashboardController.getDashboardSummary);
router.get('/monthly-income', dashboardController.getMonthlyIncome);
router.get('/unpaid-tenants', dashboardController.getUnpaidTenants);
router.get('/occupancy', dashboardController.getOccupancyReport);
router.get('/building-performance', dashboardController.getBuildingPerformance);
router.get('/profit-trends', dashboardController.getProfitTrends);
router.get('/monthly-expected-income', dashboardController.getMonthlyExpectedIncome);
router.get('/tenant-payment-history/:tenantId', dashboardController.getTenantPaymentHistory);

module.exports = router;
