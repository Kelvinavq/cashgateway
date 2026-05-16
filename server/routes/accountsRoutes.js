const router = require('express').Router();
const { list, create, update, remove } = require('../controllers/accountsController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { accountValidation } = require('../utils/validators');
const { validationResult } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });
  next();
}

router.use(authMiddleware);
router.get('/', list);
router.post('/', accountValidation, validate, create);
router.put('/:id', accountValidation, validate, update);
router.delete('/:id', remove);

module.exports = router;
