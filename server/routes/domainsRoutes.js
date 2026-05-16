const router = require('express').Router();
const { list, create, update, remove } = require('../controllers/domainsController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { domainValidation } = require('../utils/validators');
const { validationResult } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });
  next();
}

router.use(authMiddleware);
router.get('/', list);
router.post('/', domainValidation, validate, create);
router.put('/:id', domainValidation, validate, update);
router.delete('/:id', remove);

module.exports = router;
