const router = require('express').Router();
const { list, retry } = require('../controllers/deliveriesController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.use(authMiddleware);
router.get('/', list);
router.post('/:id/retry', retry);

module.exports = router;
