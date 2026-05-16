const router = require('express').Router();
const { receiveWebhook } = require('../controllers/webhookController');

router.post('/provider/hgcash/:token', receiveWebhook);

module.exports = router;
