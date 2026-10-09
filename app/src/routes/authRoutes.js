const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireGuest } = require('../middlewares/authMiddleware');

router.get('/login', requireGuest, authController.showLogin);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

module.exports = router;
