const express = require('express');
const realtimeController = require('../controllers/realtimeController');

const router = express.Router();

router.get('/stream', realtimeController.streamRentalNotifications);

module.exports = router;
