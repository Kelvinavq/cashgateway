const router = require('express').Router();
const { list, getById, getDeliveries, resolve } = require('../controllers/movementsController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.use(authMiddleware);
router.get('/', list);
router.get('/:id', getById);
router.get('/:id/deliveries', getDeliveries);
router.post('/:id/resolve', resolve);

module.exports = router;
