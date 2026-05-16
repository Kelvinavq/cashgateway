const { body, param, query } = require('express-validator');

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
];

const accountValidation = [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name required'),
  body('account_id').trim().isLength({ min: 1 }).withMessage('account_id required'),
  body('cuit').trim().matches(/^\d{11}$/).withMessage('CUIT must be 11 digits'),
  body('cbu').trim().matches(/^\d{22}$/).withMessage('CBU must be 22 digits'),
  body('domain_id').isInt({ min: 1 }).withMessage('Valid domain_id required'),
];

const domainValidation = [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name required'),
  body('slug').trim().matches(/^[a-z0-9-]+$/).withMessage('Slug: lowercase letters, numbers, hyphens only'),
  body('base_url').isURL().withMessage('Valid base_url required'),
  body('destination_webhook_url').isURL().withMessage('Valid destination_webhook_url required'),
];

module.exports = { loginValidation, accountValidation, domainValidation };
