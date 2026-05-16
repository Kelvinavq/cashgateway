const { pool } = require('../config/database');
const { resolveAccount } = require('../services/accountResolverService');
const { saveMovement, createDelivery } = require('../services/movementService');
const { webhookQueue } = require('../queues/webhookQueue');
const socketService = require('../services/socketService');
const { invalidateStatsCache } = require('../services/statsService');
const logger = require('../utils/logger');

async function receiveWebhook(req, res, next) {
  try {
    const { token } = req.params;
    const providerToken = req.headers['x-provider-token'];
    const payload = req.body;

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    // Validate gateway token
    const [accounts] = await pool.query(
      'SELECT * FROM hgcash_accounts WHERE gateway_token = ? AND is_active = 1 LIMIT 1',
      [token]
    );

    // If not found by gateway token, still try to process but log
    if (!accounts[0]) {
      logger.warn(`Unknown gateway token: ${token}`);
      // Still return 200 to avoid provider retries for unknown tokens
      return res.status(200).json({ success: false, message: 'Unknown token' });
    }

    const gatewayAccount = accounts[0];

    // Validate provider token if account has one configured
    if (gatewayAccount.provider_token && providerToken !== gatewayAccount.provider_token) {
      logger.warn(`Invalid provider token for account ${gatewayAccount.id}`);
      return res.status(401).json({ success: false, message: 'Invalid provider token' });
    }

    // Respond immediately
    res.status(200).json({ success: true, message: 'Webhook received' });

    // Process async
    setImmediate(async () => {
      try {
        // Resolve account from payload
        const account = await resolveAccount({
          accountId: payload.accountId,
          toCUIT: payload.toCUIT,
          toCBU: payload.toCBU,
          coelsaCode: payload.coelsaCode,
        });

        const resolvedAccount = account || gatewayAccount;

        // Save movement (handles duplicates)
        const { duplicate, id: movementId } = await saveMovement(payload, resolvedAccount, token);

        if (duplicate) {
          logger.info(`Duplicate webhook ignored: hg_id=${payload.id}`);
          return;
        }

        // Get full movement for socket emit
        const [movements] = await pool.query(`
          SELECT m.*, d.name as domain_name, a.name as account_name
          FROM movements m
          LEFT JOIN domains d ON m.domain_id = d.id
          LEFT JOIN hgcash_accounts a ON m.hgcash_account_id = a.id
          WHERE m.id = ?
        `, [movementId]);

        // Emit new movement event
        socketService.emit('movement:new', movements[0]);
        await invalidateStatsCache();

        // Create delivery and enqueue
        if (resolvedAccount && resolvedAccount.domain_id) {
          const [domains] = await pool.query(
            'SELECT * FROM domains WHERE id = ? AND is_active = 1',
            [resolvedAccount.domain_id]
          );
          const domain = domains[0];

          if (domain && domain.destination_webhook_url) {
            const deliveryId = await createDelivery(movementId, domain.id, domain.destination_webhook_url);

            await webhookQueue.add(
              'forward',
              { deliveryId, movementId },
              {
                attempts: 5,
                backoff: { type: 'exponential', delay: 5000 },
              }
            );

            logger.info(`Delivery ${deliveryId} queued for movement ${movementId}`);
          } else {
            logger.warn(`No active domain or destination URL for account ${resolvedAccount.id}`);
          }
        }
      } catch (err) {
        logger.error('Error processing webhook async:', err);
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { receiveWebhook };
