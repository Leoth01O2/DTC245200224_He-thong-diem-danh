const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/', attendanceController.showAttendancePage);
router.post('/check-in', attendanceController.checkIn);
router.post('/check-out', attendanceController.checkOut);
router.get('/history', attendanceController.showHistory);

module.exports = router;
