# Endpoints públicos para HG.Cash

Dominio de producción: `https://flowhg.online`

---

## Autenticación

El token del proveedor se envía en la URL. Se obtiene creando un **Proveedor** en el panel admin, en la sección *Proveedores*. El token se muestra una sola vez al crearlo, así que conviene guardarlo inmediatamente.

Si el proveedor tiene **IP whitelist** configurada, solo se aceptan requests desde esas IPs o CIDRs. El resto reciben `401`.

**Rate limiting:** 100 req/min por proveedor y 300 req/min por IP. Si se supera, el gateway responde `429 Too Many Requests`.

---

## 1. Alta de movimiento

```txt
POST https://flowhg.online/api/webhooks/provider/hgcash/{token}
```

Headers:

```txt
Content-Type: application/json
```

### Payload con wrapper

Recomendado cuando el proveedor quiere incluir metadatos del evento además del payload de movimiento.

```json
{
  "provider_event_id": "prov_001",
  "received_by_provider_at": "2026-05-16T14:36:59-03:00",
  "provider_status": "paid",
  "destination_domain": "siemprepaga.com",
  "payload": {
    "id": "b1642cbc-9458-4f08-aae2-72c285783fda",
    "amount": "1000",
    "currency": "ARS",
    "direction": "Inbound",
    "status": "done",
    "type": "inbound",
    "date": "2026-05-16T14:36:59",
    "timezone": "America/Argentina/Buenos_Aires",
    "fromName": "Matias Ariel Herrera",
    "toName": "AGROFORESTAL PAMPA S.A",
    "fromCBU": "0000003100060633019400",
    "toCBU": "0000151500036579912174",
    "fromCUIT": "23370206309",
    "toCUIT": "30718856740",
    "coelsaCode": "WGRXJE27DPD7L566N7MYQL",
    "accountId": "c68ec492-6a49-40f1-8060-7c1cb38ac1f9"
  }
}
```

### Payload con múltiples dominios

Si el proveedor ya sabe a qué dominios debe reenviar el webhook, puede enviarlos directamente.

```json
{
  "provider_event_id": "prov_001",
  "provider_status": "pending",
  "destination_domains": [
    "siemprepaga.com",
    "betcity.com"
  ],
  "payload": {
    "id": "b1642cbc-9458-4f08-aae2-72c285783fda",
    "accountId": "c68ec492-6a49-40f1-8060-7c1cb38ac1f9",
    "amount": "1000",
    "coelsaCode": "WGRXJE27DPD7L566N7MYQL"
  }
}
```

### Payload plano

También se acepta un payload sin wrapper. Si `destination_domain` o `destination_domains` vienen en el mismo objeto, también se detectan.

```json
{
  "id": "b1642cbc-9458-4f08-aae2-72c285783fda",
  "amount": "1000",
  "currency": "ARS",
  "direction": "Inbound",
  "status": "done",
  "provider_status": "rejected",
  "destination_domain": "siemprepaga.com",
  "accountId": "c68ec492-6a49-40f1-8060-7c1cb38ac1f9",
  "coelsaCode": "WGRXJE27DPD7L566N7MYQL"
}
```

### Prioridad de resolución

El gateway resuelve destinos con esta prioridad:

```txt
destination_domains[]
destination_domain
domain
accountId
toCBU
toCUIT
unresolved
```

### Normalización de dominios

Los dominios se normalizan antes de buscarse en la base:

```txt
https://www.SiemprePaga.com/webhook  -> siemprepaga.com
betcity.com/abc                      -> betcity.com
  CASINO123.NET                      -> casino123.net
```

Se elimina protocolo, path, querystring, slash final y `www.` opcional. Si el valor es inválido, se descarta.

### Comportamiento

- Si llega `destination_domains[]`, se crea un delivery por cada dominio válido encontrado.
- Si llega un solo `destination_domain` o `domain`, se crea un delivery para ese dominio.
- Si no viene ningún dominio explícito, el gateway mantiene el flujo actual por `accountId`, `toCBU` y `toCUIT`.
- Si ningún destino se resuelve, el movimiento queda `unresolved`.
- `provider_status` siempre se guarda fuera de `payload` y nunca pisa `payload.status`.
- No se descartan webhooks válidos.
- No se crean movimientos duplicados.
- No se crean deliveries duplicados para el mismo `movement_id + domain_id`.

### Respuesta: movimiento nuevo

```json
{
  "success": true,
  "duplicate": false,
  "message": "Webhook received",
  "gateway_event_id": "3f6a9c12-8b44-4e7f-b2c0-1d5e7f9a0123"
}
```

### Respuesta: webhook duplicado

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

```txt
POST https://flowhg.online/api/webhooks/provider/hgcash/{token}/update
```

Headers:

```txt
Content-Type: application/json
```

Busca el movimiento por:

1. `payload.id`
2. `coelsaCode`
3. `provider_event_id`

Si el movimiento existe, reutiliza sus dominios y deliveries salvo que el update traiga nuevos `destination_domain` o `destination_domains`.

Si no existe, se crea como un webhook nuevo y se resuelve con la misma lógica que en el alta.

```json
{
  "id": "b1642cbc-9458-4f08-aae2-72c285783fda",
  "provider_status": "paid",
  "status": "reversed",
  "coelsaCode": "WGRXJE27DPD7L566N7MYQL",
  "destination_domains": [
    "siemprepaga.com",
    "betcity.com"
  ]
}
```

---

## Dominio final

Para que un dominio pueda recibir webhooks debe existir en la sección **Domains** del panel admin.

Campos relevantes:

- `name`
- `slug`
- `base_url`
- `hostname`
- `destination_webhook_url`
- `destination_token`
- `gateway_signing_secret`
- `require_ack`
- `is_active`

### `hostname`

`hostname` es el valor que el gateway usa para resolver destinos. Si no se ingresa manualmente, puede autogenerarse desde `base_url`.

Ejemplo:

```txt
base_url: https://www.siemprepaga.com
hostname: siemprepaga.com
```

### Entregas múltiples

Cuando un webhook se resuelve a más de un dominio:

- el movimiento se marca con `resolution_status = multi_resolved`
- `resolution_method = destination_domains`
- se crea una fila en `webhook_deliveries` por cada dominio
- cada delivery conserva su propio estado, ACK y reintentos

---

## Reenvío al dominio final

Cuando el movimiento se resuelve, el gateway lo reenvía al `destination_webhook_url` de cada dominio asociado.

### Headers enviados al destino

| Header | Valor |
|--------|-------|
| `Content-Type` | `application/json` |
| `x-gateway-token` | Token del dominio destino (`destination_token`) |
| `x-gateway-event-id` | UUID único generado por el gateway |
| `x-provider-event-id` | `provider_event_id` del proveedor, si existe |
| `x-hg-movement-id` | ID original del movimiento en HG.Cash (`payload.id`) |
| `x-gateway-movement-id` | ID interno del movimiento en la DB del gateway |
| `x-hg-account-id` | `accountId` del payload original |
| `x-hg-account-db-id` | ID de la cuenta en la DB del gateway |
| `x-domain-id` | ID del dominio en la DB del gateway |
| `x-destination-domain` | `domain.hostname` |
| `x-destination-domain-id` | ID del dominio destino |
| `x-destination-domain-name` | Nombre del dominio destino |
| `x-coelsa-code` | Código COELSA del movimiento |
| `x-gateway-timestamp` | Unix timestamp de la entrega, incluido en la firma HMAC |
| `x-gateway-signature` | `sha256=<HMAC>` si el dominio tiene secreto de firma |

---

## Firma HMAC

### Cómo se genera

```txt
signed_payload = timestamp + "." + rawBody
signature      = sha256-HMAC(signed_payload, gateway_signing_secret)
header         = "sha256=" + hex(signature)
```

El timestamp está incluido en el payload firmado. Esto liga la firma al momento exacto y ayuda a detectar replay attacks sin guardar nonces.

### Verificar la firma en el destino (Node.js)

```javascript
const crypto = require('crypto');

app.post('/webhooks/hgcash', express.raw({ type: 'application/json' }), (req, res) => {
  const rawBody = req.body.toString('utf8');
  const secret = process.env.GATEWAY_SIGNING_SECRET;
  const signature = req.headers['x-gateway-signature'];
  const timestamp = req.headers['x-gateway-timestamp'];

  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Missing signature headers' });
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp, 10));
  if (age > 300) {
    return res.status(401).json({ error: 'Replay attack detected' });
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  const valid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );

  if (!valid) return res.status(401).json({ error: 'Invalid signature' });

  const payload = JSON.parse(rawBody);
  res.json({
    received: true,
    gateway_event_id: req.headers['x-gateway-event-id'],
    processed: true,
  });
});
```

### Verificar la firma en el destino (PHP)

```php
$rawBody = file_get_contents('php://input');
$secret = getenv('GATEWAY_SIGNING_SECRET');
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

    if (abs(time() - (int)$timestamp) > $toleranceSec) return false;

    $signedPayload = "{$timestamp}.{$rawBody}";
    $expected = 'sha256=' . hash_hmac('sha256', $signedPayload, $secret);

    return hash_equals($expected, $signature);
}

if (!verifyGatewaySignature($rawBody, $secret, $signature, $timestamp)) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid signature']);
    exit;
}

$payload = json_decode($rawBody, true);
```

### Respuesta ACK esperada

Si el dominio tiene `require_ack = 1`, la respuesta válida debe ser:

```json
{
  "received": true,
  "gateway_event_id": "<el mismo que envió el gateway>",
  "processed": true
}
```

Si la respuesta es inválida, el gateway reintenta la entrega y registra `ack_valid = 0`.

---

## Estados de resolución de movimientos

| Estado | Descripción |
|--------|-------------|
| `resolved` | Resuelto automáticamente hacia un único destino |
| `multi_resolved` | Resuelto automáticamente hacia múltiples dominios |
| `unresolved` | No se pudo resolver automáticamente |
| `manually_resolved` | Resuelto manualmente desde el panel |

---

## Detalle de entregas iniciales y updates

El gateway distingue el tipo de entrega en `webhook_deliveries.delivery_kind`:

| Tipo | CuÃ¡ndo se usa |
|------|---------------|
| `initial` | Primer reenvÃ­o del movimiento al dominio final |
| `update` | ReenvÃ­o generado por `POST /api/webhooks/provider/hgcash/{token}/update` |
| `manual_retry` | Reintento manual desde el panel |

La tabla tambiÃ©n guarda:

| Campo | DescripciÃ³n |
|-------|-------------|
| `initial_delivered_at` | Fecha/hora en que se entregÃ³ correctamente el alta inicial |
| `last_update_delivered_at` | Fecha/hora de la Ãºltima actualizaciÃ³n entregada correctamente |

En la pÃ¡gina **Entregas** se muestran el tipo, estado, HTTP, ACK, errores y fechas de entrega para saber si llegÃ³ el webhook inicial y si tambiÃ©n llegÃ³ su update.

---

## Errores posibles

| HTTP | Motivo |
|------|--------|
| `200` | OK, incluyendo duplicados. Revisar `duplicate` en el cuerpo |
| `400` | Payload inválido o `id` faltante |
| `401` | Token inválido, firma inválida o IP no permitida |
| `429` | Rate limit excedido |
| `500` | Error interno del gateway |

---

## Ejemplos curl

### Bash: alta con dominio único

```bash
curl -X POST \
  https://flowhg.online/api/webhooks/provider/hgcash/TU_TOKEN_DE_PROVEEDOR \
  -H "Content-Type: application/json" \
  -d '{
    "provider_event_id": "prov_001",
    "received_by_provider_at": "2026-05-16T14:36:59-03:00",
    "destination_domain": "siemprepaga.com",
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

### Bash: alta con múltiples dominios

```bash
curl -X POST \
  https://flowhg.online/api/webhooks/provider/hgcash/TU_TOKEN_DE_PROVEEDOR \
  -H "Content-Type: application/json" \
  -d '{
    "provider_event_id": "prov_001",
    "destination_domains": ["siemprepaga.com", "betcity.com"],
    "payload": {
      "id": "b1642cbc-9458-4f08-aae2-72c285783fda",
      "accountId": "c68ec492-6a49-40f1-8060-7c1cb38ac1f9",
      "coelsaCode": "WGRXJE27DPD7L566N7MYQL"
    }
  }'
```

### Bash: update

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

### PowerShell: alta con dominio único

```powershell
$body = @{
  provider_event_id = "prov_001"
  received_by_provider_at = "2026-05-16T14:36:59-03:00"
  destination_domain = "siemprepaga.com"
  payload = @{
    id = "b1642cbc-9458-4f08-aae2-72c285783fda"
    amount = "1000"
    currency = "ARS"
    direction = "Inbound"
    status = "done"
    accountId = "c68ec492-6a49-40f1-8060-7c1cb38ac1f9"
    coelsaCode = "WGRXJE27DPD7L566N7MYQL"
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod `
  -Method Post `
  -Uri "https://flowhg.online/api/webhooks/provider/hgcash/TU_TOKEN_DE_PROVEEDOR" `
  -ContentType "application/json" `
  -Body $body
```

### PowerShell: update

```powershell
$body = @{
  id = "b1642cbc-9458-4f08-aae2-72c285783fda"
  status = "reversed"
  coelsaCode = "WGRXJE27DPD7L566N7MYQL"
} | ConvertTo-Json -Depth 10

Invoke-RestMethod `
  -Method Post `
  -Uri "https://flowhg.online/api/webhooks/provider/hgcash/TU_TOKEN_DE_PROVEEDOR/update" `
  -ContentType "application/json" `
  -Body $body
```
