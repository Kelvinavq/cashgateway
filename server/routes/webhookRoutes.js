const router = require('express').Router();
const { receiveWebhook, receiveWebhookUpdate } = require('../controllers/webhookController');
const providerRateLimit = require('../middlewares/providerRateLimit');

router.post('/provider/hgcash/:token', providerRateLimit, receiveWebhook);
router.post('/provider/hgcash/:token/update', providerRateLimit, receiveWebhookUpdate);

module.exports = router;
