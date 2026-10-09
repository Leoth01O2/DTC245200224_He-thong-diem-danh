const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/', memberController.listMembers);
router.post('/create', memberController.createMember);
router.post('/:id/edit', memberController.updateMember);
router.post('/:id/delete', memberController.deleteMember);

module.exports = router;
