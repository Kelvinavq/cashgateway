const router = require('express').Router();
const { login, logout, me } = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { loginValidation } = require('../utils/validators');
const { validationResult } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  next();
}

router.post('/login', loginValidation, validate, login);
router.post('/logout', logout);
router.get('/me', authMiddleware, me);

module.exports = router;
