# Endpoints públicos para HG.Cash

Dominio de producción: `https://flowhg.online`

---

## Autenticación

El token va en la URL. Se obtiene creando un **Proveedor** en el panel admin → sección *Proveedores*. El token se muestra **una sola vez** al crearlo; guárdalo de inmediato.

Si el proveedor tiene **IP whitelist** configurada, solo se aceptan requests desde esas IPs/CIDRs. Otros IPs reciben `401`.

**Rate limiting:** 100 req/min por proveedor · 300 req/min por IP → exceder retorna `429 Too Many Requests`.

---

## 1. Alta de movimiento

```
POST https://flowhg.online/api/webhooks/provider/hgcash/{token}
```

Headers:

```
Content-Type: application/json
```

### Payload con wrapper (recomendado)

```json
{
  "provider_event_id": "prov_abc_123",
  "received_by_provider_at": "2026-05-16T14:36:59-03:00",
  "payload": {
    "id":        "b1642cbc-9458-4f08-aae2-72c285783fda",
    "amount":    "1000",
    "currency":  "ARS",
    "direction": "Inbound",
    "status":    "done",
    "type":      "inbound",
    "date":      "2026-05-16T14:36:59",
    "timezone":  "America/Argentina/Buenos_Aires",
    "fromName":  "Matias Ariel Herrera",
    "toName":    "AGROFORESTAL PAMPA S.A",
    "fromCBU":   "0000003100060633019400",
    "toCBU":     "0000151500036579912174",
    "fromCUIT":  "23370206309",
    "toCUIT":    "30718856740",
    "coelsaCode":"WGRXJE27DPD7L566N7MYQL",
    "accountId": "c68ec492-6a49-40f1-8060-7c1cb38ac1f9"
  }
}
```

### Payload plano (también aceptado)

```json
{
  "id":        "b1642cbc-9458-4f08-aae2-72c285783fda",
  "amount":    "1000",
  "currency":  "ARS",
  "direction": "Inbound",
  "status":    "done",
  "accountId": "c68ec492-6a49-40f1-8060-7c1cb38ac1f9",
  "coelsaCode":"WGRXJE27DPD7L566N7MYQL"
}
```

### Respuesta — movimiento nuevo

```json
{
  "success": true,
  "duplicate": false,
  "message": "Webhook received",
  "gateway_event_id": "3f6a9c12-8b44-4e7f-b2c0-1d5e7f9a0123"
}
```

### Respuesta — webhook duplicado

Si el `id` del payload o el `provider_event_id` ya fueron procesados, el gateway responde `200` con:

```json
{
  "success": true,
  "duplicate": true,
  "message": "Webhook already processed",
  "gateway_event_id": "uuid-del-movimiento-original"
}
```

No se crea un movimiento ni una entrega duplicada. El `gateway_event_id` devuelto es el del movimiento original.

---

## 2. Update de movimiento

```
POST https://flowhg.online/api/webhooks/provider/hgcash/{token}/update
```

Headers:

```
Content-Type: application/json
```

Busca el movimiento por `id` del payload o por `coelsaCode`. Si no existe, lo crea.

```json
{
  "id":        "b1642cbc-9458-4f08-aae2-72c285783fda",
  "status":    "reversed",
  "coelsaCode":"WGRXJE27DPD7L566N7MYQL"
}
```

---

## Ejemplos curl

### Alta de movimiento

```bash
curl -X POST \
  https://flowhg.online/api/webhooks/provider/hgcash/TU_TOKEN_DE_PROVEEDOR \
  -H "Content-Type: application/json" \
  -d '{
    "provider_event_id": "prov_001",
    "received_by_provider_at": "2026-05-16T14:36:59-03:00",
    "payload": {
      "id": "b1642cbc-9458-4f08-aae2-72c285783fda",
      "amount": "1000",
      "currency": "ARS",
      "direction": "Inbound",
      "status": "done",
      "accountId": "c68ec492-6a49-40f1-8060-7c1cb38ac1f9",
      "coelsaCode": "WGRXJE27DPD7L566N7MYQL"
    }
  }'
```

### Update de movimiento

```bash
curl -X POST \
  https://flowhg.online/api/webhooks/provider/hgcash/TU_TOKEN_DE_PROVEEDOR/update \
  -H "Content-Type: application/json" \
  -d '{
    "id": "b1642cbc-9458-4f08-aae2-72c285783fda",
    "status": "reversed",
    "coelsaCode": "WGRXJE27DPD7L566N7MYQL"
  }'
```

---

## Reenvío al dominio final

Cuando el movimiento se resuelve, el gateway lo reenvía al `destination_webhook_url` del dominio asociado.

### Headers enviados al destino

| Header | Valor |
|--------|-------|
| `Content-Type` | `application/json` |
| `x-gateway-token` | Token del dominio destino (`destination_token`) |
| `x-gateway-event-id` | UUID único generado por el gateway |
| `x-provider-event-id` | `provider_event_id` del proveedor (si existe) |
| `x-hg-movement-id` | ID original del movimiento en HG.Cash (`payload.id`) |
| `x-gateway-movement-id` | ID interno del movimiento en la DB del gateway |
| `x-hg-account-id` | `accountId` del payload original |
| `x-hg-account-db-id` | ID de la cuenta en la DB del gateway |
| `x-domain-id` | ID del dominio en la DB del gateway |
| `x-coelsa-code` | Código COELSA del movimiento |
| `x-gateway-timestamp` | Unix timestamp de la entrega (incluido en la firma HMAC) |
| `x-gateway-signature` | `sha256=<HMAC>` — solo si el dominio tiene secreto de firma |

---

## Firma HMAC

### Cómo se genera

```
signed_payload = timestamp + "." + rawBody
signature      = sha256-HMAC(signed_payload, gateway_signing_secret)
header         = "sha256=" + hex(signature)
```

El timestamp está incluido en el payload firmado — esto liga la firma al momento exacto y permite detectar replay attacks sin almacenar nonces.

### Verificar la firma en el destino (Node.js)

```javascript
const crypto = require('crypto');

// Usar raw body — nunca JSON.stringify(req.body)
// El orden de propiedades JSON puede variar entre parsers
app.post('/webhooks/hgcash', express.raw({ type: 'application/json' }), (req, res) => {
  const rawBody   = req.body.toString('utf8');
  const secret    = process.env.GATEWAY_SIGNING_SECRET;
  const signature = req.headers['x-gateway-signature'];
  const timestamp = req.headers['x-gateway-timestamp'];

  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Missing signature headers' });
  }

  // Anti-replay: rechazar mensajes con más de 5 minutos de antigüedad
  const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp, 10));
  if (age > 300) {
    return res.status(401).json({ error: 'Replay attack detected' });
  }

  // El payload firmado incluye timestamp + cuerpo
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Comparación en tiempo constante — nunca usar ===
  const valid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );

  if (!valid) return res.status(401).json({ error: 'Invalid signature' });

  const payload = JSON.parse(rawBody);
  // Procesar...
  res.json({
    received: true,
    gateway_event_id: req.headers['x-gateway-event-id'],
    processed: true,
  });
});
```

### Verificar la firma en el destino (PHP)

```php
// Leer el raw body antes de que el framework lo parsee
$rawBody   = file_get_contents('php://input');
$secret    = getenv('GATEWAY_SIGNING_SECRET');
$signature = $_SERVER['HTTP_X_GATEWAY_SIGNATURE'] ?? '';
$timestamp = $_SERVER['HTTP_X_GATEWAY_TIMESTAMP'] ?? 0;

function verifyGatewaySignature(
    string $rawBody,
    string $secret,
    string $signature,
    int|string $timestamp,
    int $toleranceSec = 300
): bool {
    if (!$signature || !$timestamp) return false;

    // Anti-replay
    if (abs(time() - (int)$timestamp) > $toleranceSec) return false;

    // Payload firmado: timestamp.rawBody
    $signedPayload = "{$timestamp}.{$rawBody}";
    $expected = 'sha256=' . hash_hmac('sha256', $signedPayload, $secret);

    // Comparación en tiempo constante
    return hash_equals($expected, $signature);
}

if (!verifyGatewaySignature($rawBody, $secret, $signature, $timestamp)) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid signature']);
    exit;
}

$payload = json_decode($rawBody, true);
```

---

### Respuesta ACK esperada (si el dominio tiene `require_ack = 1`)

```json
{
  "received": true,
  "gateway_event_id": "<el mismo que envió el gateway>",
  "processed": true
}
```

Si la respuesta es inválida, el gateway reintenta la entrega y registra `ack_valid = 0`.

---

## Errores posibles

| HTTP | Motivo |
|------|--------|
| `200` | OK (incluyendo duplicados — verificar `duplicate` en el cuerpo) |
| `400` | Payload inválido o `id` faltante |
| `401` | Token inválido o IP no permitida |
| `429` | Rate limit excedido |
| `500` | Error interno del gateway |
