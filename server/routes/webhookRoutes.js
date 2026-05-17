const router = require('express').Router();
const { receiveWebhook, receiveWebhookUpdate } = require('../controllers/webhookController');

router.post('/provider/hgcash/:token', receiveWebhook);
router.post('/provider/hgcash/:token/update', receiveWebhookUpdate);

module.exports = router;
