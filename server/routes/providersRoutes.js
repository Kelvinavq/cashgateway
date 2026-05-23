const router = require('express').Router();
const { list, create, update, regenerateToken, remove } = require('../controllers/providersController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.use(authMiddleware);
router.get('/', list);
router.post('/', create);
router.put('/:id', update);
router.post('/:id/regenerate-token', regenerateToken);
router.delete('/:id', remove);

module.exports = router;
