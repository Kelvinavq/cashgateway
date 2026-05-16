const router = require('express').Router();
const { getStats } = require('../controllers/dashboardController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.get('/stats', authMiddleware, getStats);

module.exports = router;
