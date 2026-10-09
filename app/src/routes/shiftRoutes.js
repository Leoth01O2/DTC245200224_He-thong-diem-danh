const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/', shiftController.listShifts);
router.post('/create', shiftController.createShift);
router.post('/:id/edit', shiftController.updateShift);
router.post('/:id/delete', shiftController.deleteShift);

module.exports = router;
