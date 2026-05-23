const router = require('express').Router();
const { list, retry, reactivate } = require('../controllers/deliveriesController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.use(authMiddleware);
router.get('/', list);
router.post('/:id/retry', retry);
router.post('/:id/reactivate', reactivate);

module.exports = router;
