const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const chatController = require('../controllers/chatController');

const router = express.Router();

router.use(authMiddleware);

router.get('/users', chatController.getUsers);
router.get('/messages', chatController.getMessages);
router.post('/messages', chatController.sendMessage);

module.exports = router;
