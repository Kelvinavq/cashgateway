# Endpoints públicos para HG.Cash

Dominio de producción: `https://flowhg.online`

---

## Autenticación

El token va en la URL. Se obtiene creando un **Proveedor** en el panel admin → sección *Proveedores*. El token se muestra **una sola vez** al crearlo; guárdalo de inmediato.

```
{token} = token generado al crear el proveedor en el panel
```

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

### Respuesta exitosa

```json
{
  "success": true,
  "message": "Webhook received",
  "gateway_event_id": "3f6a9c12-8b44-4e7f-b2c0-1d5e7f9a0123"
}
```

> **Deduplicación:** si `id` del payload o `provider_event_id` ya existen en la base, el gateway responde `200` sin crear un duplicado.

---

## 2. Update de movimiento

```
POST https://flowhg.online/api/webhooks/provider/hgcash/{token}/update
```

Headers:

```
Content-Type: application/json
```

Busca el movimiento por `id` del payload (campo HG.Cash) o por `coelsaCode`. Si no existe, lo crea para no perder el evento.

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
| `x-hg-movement-id` | ID interno del movimiento en el gateway |
| `x-hg-account-id` | `accountId` del payload original |
| `x-hg-account-db-id` | ID de la cuenta en la DB del gateway |
| `x-domain-id` | ID del dominio en la DB del gateway |
| `x-coelsa-code` | Código COELSA del movimiento |
| `x-gateway-timestamp` | Unix timestamp de la entrega |
| `x-gateway-signature` | `sha256=<HMAC>` — solo si el dominio tiene secreto de firma |

### Verificar la firma HMAC en el destino (Node.js)

```javascript
const crypto = require('crypto');

function verifyGatewaySignature(req) {
  const secret    = process.env.GATEWAY_SIGNING_SECRET;
  const signature = req.headers['x-gateway-signature'];
  const timestamp = req.headers['x-gateway-timestamp'];

  if (!signature || !timestamp) return false;

  // Prevenir replay attacks (tolerancia 5 minutos)
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### Verificar la firma HMAC en el destino (PHP)

```php
function verifyGatewaySignature(string $body, array $headers, string $secret): bool {
    $signature = $headers['x-gateway-signature'] ?? '';
    $timestamp  = $headers['x-gateway-timestamp']  ?? 0;
    if (abs(time() - (int)$timestamp) > 300) return false;
    return hash_equals('sha256=' . hash_hmac('sha256', $body, $secret), $signature);
}
```

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
| `200` | OK (incluso en duplicados — ver `success: false` en el cuerpo) |
| `401` | Token inválido o IP no permitida |
| `429` | Rate limit excedido |
| `500` | Error interno del gateway |
