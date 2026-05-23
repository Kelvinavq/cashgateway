# HG.Cash Webhook Gateway

Gateway centralizado para recibir, procesar y reenviar webhooks de HG.Cash desde proveedores externos hacia múltiples dominios/proyectos.

## Arquitectura

```
Proveedor Externo → [Este Gateway] → Dominio/Proyecto Final
        ↑                   ↓
   Auth por token      MySQL + Redis
   IP whitelist        BullMQ (colas)
   Rate limiting       Socket.IO (tiempo real)
   HMAC signing
```

El proveedor externo reenvía los webhooks de todas las cuentas HG.Cash a este gateway. El gateway autentica al proveedor por token (con verificación de IP), resuelve primero por `destination_domains[]`, luego `destination_domain`, luego `domain`, y si no hay destino explícito aplica el fallback por `accountId` → `toCBU` → `toCUIT`. Después registra el movimiento y reenvía al dominio correspondiente firmando el payload con HMAC. Los movimientos no resueltos quedan pendientes de asignación manual.

## Producción recomendada

- Panel/admin: `https://admin.flowhg.online`
- API pública y webhooks: `https://flowhg.online`
- Endpoint público para proveedores: `POST https://flowhg.online/api/webhooks/provider/hgcash/{provider_token}`

El proveedor externo solo conoce el endpoint público de `flowhg.online`. No necesita ni debe usar el subdominio del panel.

Variables clave en producción:

- `FRONTEND_URL=https://admin.flowhg.online`
- `PUBLIC_WEBHOOK_BASE_URL=https://flowhg.online`
- `COOKIE_DOMAIN=.flowhg.online`
- `VITE_API_URL=https://flowhg.online/api`
- `VITE_SOCKET_URL=https://flowhg.online`

### Nginx de ejemplo

```nginx
server {
    server_name flowhg.online;

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Los webhooks públicos llegan por /api/webhooks/provider/hgcash/:token
}

server {
    server_name admin.flowhg.online;

    root /home/flowhg/cashgateway/client/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }
}
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite, Material UI v5, Socket.IO client |
| Backend | Node.js, Express 4 |
| Base de datos | MySQL 8+ |
| Cola/Reintentos | BullMQ + Redis |
| Tiempo real | Socket.IO |
| Auth | JWT (cookie HTTP-only, 1 hora) + bcrypt |
| Rate limiting | rate-limiter-flexible + Redis |
| Logging | Pino + tabla `system_logs` en MySQL |
| Seguridad | Helmet, CORS, HMAC SHA256, IP whitelist CIDR |

## Estructura del proyecto

```
cashgateway/
├── alters.sql              # Schema MySQL inicial
├── migration_v2.sql        # Migración v2: resolución de movimientos
├── migration_v3.sql        # Migración v3: enterprise features
├── server/
│   ├── app.js
│   ├── server.js
│   ├── config/             # env, database, redis
│   ├── controllers/        # auth, webhook, movements, accounts, domains,
│   │                       # dashboard, deliveries, providers
│   ├── routes/             # Un archivo por recurso
│   ├── services/           # accountResolver, movement, webhookForward,
│   │                       # socket, stats, logService
│   ├── queues/             # webhookQueue (BullMQ), webhookWorker
│   ├── middlewares/        # auth, error, rawBody, requestId, providerRateLimit
│   └── utils/              # hmac, logger (Pino), ipValidator
└── client/src/
    ├── contexts/           # Auth, Theme
    ├── pages/              # Login, Dashboard, Movements, Deliveries,
    │                       # Accounts, Domains, Providers, Logs
    ├── components/         # Layout, StatusChip
    ├── hooks/              # useSocket
    └── lib/                # api (axios), socket (socket.io-client)
```

## Requisitos previos

- Node.js 18+
- MySQL 8+
- Redis 6+

## Instalación

### 1. Base de datos

```bash
# Schema inicial
mysql -u root -p < alters.sql

# Migración v2: resolución de movimientos
mysql -u root -p hgcash_gateway < migration_v2.sql

# Migración v3: enterprise features (provider_sources, system_logs, HMAC, DLQ, ACK)
mysql -u root -p hgcash_gateway < migration_v3.sql

# Migración v4: multi-destino por hostname
mysql -u root -p hgcash_gateway < migration_v4.sql
```

Seed data incluido:
- Usuario admin: `admin@hgcash.com` / contraseña: `admin123`
- Dominio de ejemplo: "Demo Project"
- Cuenta HG de ejemplo: AGROFORESTAL PAMPA (`accountId: c68ec492-...`)

### 2. Backend

```bash
cd server
npm install

cp .env.example .env
# Editar server/.env

npm run dev       # Servidor API
npm run worker    # Worker de colas (en otra terminal)
```

### 3. Frontend

```bash
cd client
npm install
npm run dev
```

Abrir: http://localhost:5173

## Variables de entorno

### Backend (`server/.env`)

| Variable | Valor por defecto | Descripción |
|----------|-------------------|-------------|
| `PORT` | `3000` | Puerto del servidor |
| `NODE_ENV` | `development` | Entorno |
| `FRONTEND_URL` | `http://localhost:5173` | URL del panel frontend. En producción: `https://admin.flowhg.online` |
| `MYSQL_HOST` | `localhost` | Host MySQL |
| `MYSQL_PORT` | `3306` | Puerto MySQL |
| `MYSQL_USER` | `root` | Usuario MySQL |
| `MYSQL_PASSWORD` | _(vacío)_ | Contraseña MySQL |
| `MYSQL_DATABASE` | `hgcash_gateway` | Base de datos |
| `JWT_SECRET` | ⚠️ cambiar | Clave JWT |
| `JWT_EXPIRES_IN` | `1h` | Expiración JWT |
| `COOKIE_NAME` | `hgcash_gateway_token` | Nombre de la cookie |
| `COOKIE_DOMAIN` | _(vacío)_ | Dominio de cookie para producción. En producción: `.flowhg.online` |
| `REDIS_HOST` | `127.0.0.1` | Host Redis |
| `REDIS_PORT` | `6379` | Puerto Redis |
| `PUBLIC_WEBHOOK_BASE_URL` | `http://localhost:3000` | Base URL pública del gateway. En producción: `https://flowhg.online` |

### Frontend (`client/.env`)

| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | `http://localhost:3000/api` | En producción: `https://flowhg.online/api` |
| `VITE_SOCKET_URL` | `http://localhost:3000` | En producción: `https://flowhg.online` |

## Configuración inicial

### Paso 1 — Crear un Proveedor (v3)

En la sección **Proveedores** del panel:
- Crear un proveedor con nombre e IP whitelist opcional
- El sistema genera automáticamente un token seguro
- El token **solo se muestra una vez** — cópialo inmediatamente

### Paso 2 — Crear dominio

En **Dominios**:
- `hostname`: hostname destino normalizado. Si no lo ingresás, se deriva desde `base_url`
- `destination_webhook_url`: URL destino
- `destination_token`: token enviado en `x-gateway-token`
- `gateway_signing_secret`: generado automáticamente (usado para `x-gateway-signature`)
- `require_ack`: si el destino debe confirmar recepción con `{received: true, ...}`

### Paso 3 — Crear cuenta HG.Cash

En **Cuentas**:
- `account_id`: UUID de la cuenta en HG.Cash
- `cbu` / `cuit`: opcionales (fallback de resolución)
- Asociar al dominio correspondiente

### Paso 4 — Configurar el proveedor externo

El proveedor debe enviar a:
```
POST https://flowhg.online/api/webhooks/provider/hgcash/{token_del_proveedor}
```

Donde `{token_del_proveedor}` es el token generado en el Paso 1. El proveedor no necesita conocer `admin.flowhg.online`.

---

## Endpoints

### Auth
```
POST /api/auth/login      { email, password }
POST /api/auth/logout
GET  /api/auth/me
```

### Dashboard
```
GET /api/dashboard/stats
```

### Movimientos
```
GET  /api/movements                     # Paginado + filtros
GET  /api/movements/:id                 # Detalle
GET  /api/movements/:id/deliveries      # Historial de entregas
POST /api/movements/:id/resolve         # Resolver manualmente { hgcash_account_id }
```

**Filtros:** `page`, `limit`, `domain_id`, `hgcash_account_id`, `account_id`, `direction`, `delivery_status`, `resolution_status`, `resolution_method`, `coelsa_code`, `cuit`, `cbu`, `date_from`, `date_to`, `amount_min`, `amount_max`

### Entregas
```
GET  /api/deliveries                    # Paginado + filtro por status
POST /api/deliveries/:id/retry          # Reintentar (bloqueado si status=dead)
POST /api/deliveries/:id/reactivate     # Reactivar desde Dead Letter Queue
```

### Cuentas HG
```
GET    /api/accounts
POST   /api/accounts
PUT    /api/accounts/:id
DELETE /api/accounts/:id
```

### Dominios
```
GET    /api/domains
POST   /api/domains
PUT    /api/domains/:id
DELETE /api/domains/:id
POST   /api/domains/:id/regenerate-signing-secret
```

### Proveedores (v3)
```
GET    /api/providers
POST   /api/providers                    # Retorna token completo (solo una vez)
PUT    /api/providers/:id
DELETE /api/providers/:id
POST   /api/providers/:id/regenerate-token
```

### Logs del sistema (v3)
```
GET /api/logs   ?level=&source=&event_type=&date_from=&date_to=&page=&limit=
```

### Webhook (recepción desde proveedor)
```
POST /api/webhooks/provider/hgcash/:token          # Movimiento nuevo
POST /api/webhooks/provider/hgcash/:token/update   # Update de movimiento existente
```

---

## Flujo del webhook

```
1. Proveedor → POST /api/webhooks/provider/hgcash/{token}
2. Rate limiting: 100 req/min por proveedor, 300 req/min por IP
3. Autenticación:
   a. Busca token en provider_sources (nuevo sistema)
   b. Fallback: busca en hgcash_accounts.gateway_token (legado)
4. Verificación de IP whitelist (si configurada, soporta CIDR)
5. Normaliza payload: acepta {provider_event_id, payload} o payload plano
6. Genera gateway_event_id (UUID único)
7. Deduplicación: rechaza si hg_id o provider_event_id ya existen
8. Detecta destinos explícitos en este orden: destination_domains[] → destination_domain → domain
9. Si no vino dominio, mantiene el fallback actual: accountId → toCBU → toCUIT
10. Guarda movimiento en MySQL con resolution_status + resolution_method
11. Responde 200 { success, gateway_event_id }

   Si resolved:
     → Crea webhook_delivery
     → Encola en BullMQ (Redis)
     → Worker: POST al domain.destination_webhook_url con headers firmados
     → Si require_ack: valida respuesta {received: true, gateway_event_id, processed: true}
     → Reintento exponencial (hasta 5 intentos)
     → Al 5to fallo: status = 'dead' (Dead Letter Queue)
     → Emite Socket.IO: movement:new

   Si unresolved:
     → Guarda unresolved_reason
     → Emite Socket.IO: movement:unresolved
     → Admin resuelve manualmente → reenvía inmediatamente
```

---

## Proveedores y Autenticación (v3)

Los proveedores reemplazan el sistema de autenticación por token por cuenta:

| Campo | Descripción |
|-------|-------------|
| `name` | Nombre identificador |
| `token` | Token de autenticación (generado automáticamente, 32 bytes hex) |
| `ip_whitelist` | Array JSON de IPs/CIDRs permitidas (vacío = cualquier IP) |
| `is_active` | Habilitado/deshabilitado |

**Backward compatibility:** Si el token no pertenece a ningún proveedor, el gateway busca en `hgcash_accounts.gateway_token` (sistema legado).

---

## Firma HMAC de entregas (v3)

Cuando un dominio tiene `gateway_signing_secret` configurado, cada entrega incluye:

```
x-gateway-signature: sha256=<HMAC-SHA256>
x-gateway-timestamp: <unix_timestamp>
```

**Payload firmado:** `${timestamp}.${rawBody}` — el timestamp se incluye en la firma para prevenir replay attacks sin necesidad de almacenar nonces.

### Verificación en el dominio destino (Node.js)

```javascript
const crypto = require('crypto');

// IMPORTANTE: usar el raw body (Buffer), no JSON.stringify(req.body)
// El orden de las propiedades JSON puede variar entre parsers.
app.post('/webhooks/hgcash', express.raw({ type: 'application/json' }), (req, res) => {
  const rawBody   = req.body.toString('utf8'); // bytes exactos recibidos
  const secret    = process.env.GATEWAY_SIGNING_SECRET;
  const signature = req.headers['x-gateway-signature'];
  const timestamp = req.headers['x-gateway-timestamp'];

  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Missing signature headers' });
  }

  // Anti-replay: rechazar si el mensaje tiene más de 5 minutos
  const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp, 10));
  if (age > 300) {
    return res.status(401).json({ error: 'Replay attack detected' });
  }

  // El payload firmado incluye el timestamp para ligar la firma al momento
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Comparación en tiempo constante — NUNCA usar ===
  const valid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );

  if (!valid) return res.status(401).json({ error: 'Invalid signature' });

  const payload = JSON.parse(rawBody);
  // Procesar el webhook...
  res.json({ received: true, gateway_event_id: req.headers['x-gateway-event-id'], processed: true });
});
```

### Verificación en el dominio destino (PHP)

```php
// IMPORTANTE: leer el raw body antes de que cualquier framework lo parsee
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

    // El payload firmado incluye el timestamp
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

## Validación ACK (v3)

Si un dominio tiene `require_ack = 1`, el gateway espera esta respuesta del destino:

```json
{
  "received": true,
  "gateway_event_id": "<el mismo que envió el gateway>",
  "processed": true
}
```

Si la respuesta es inválida o no incluye `processed: true`, la entrega se marca con `ack_valid = 0` y se reintenta. Activar esto solo en integraciones de confianza.

---

## Rate Limiting (v3)

| Límite | Clave | Ventana |
|--------|-------|---------|
| 100 req/min | Por proveedor (`provider_id`) | 60 segundos |
| 300 req/min | Por IP | 60 segundos |

Al exceder el límite, la respuesta es `HTTP 429 Too Many Requests`. Los eventos de rate limiting se registran en `system_logs` con `event_type: rate_limit_provider` o `rate_limit_ip`. Si Redis no está disponible, el rate limiter falla abierto (permite la request).

---

## Dead Letter Queue (v3)

Después de 5 intentos fallidos, una entrega pasa a estado `dead`:
- No se reintenta automáticamente
- Aparece en la página de Entregas con filtro "Dead Letter"
- Puede reactivarse manualmente desde el panel: `POST /api/deliveries/:id/reactivate`
- La reactivación reinicia el contador de intentos y vuelve a encolar

---

## Respuesta del webhook

### Movimiento nuevo
```json
{ "success": true, "duplicate": false, "message": "Webhook received", "gateway_event_id": "uuid" }
```

### Webhook duplicado (mismo `hg_id` o `provider_event_id` ya procesado)
```json
{ "success": true, "duplicate": true, "message": "Webhook already processed", "gateway_event_id": "uuid-original" }
```
HTTP siempre `200`. El `gateway_event_id` devuelto en duplicados es el del movimiento original.

---

## Logs del sistema (v3)

Todos los eventos significativos se persisten en la tabla `system_logs`:

| `event_type` | Descripción |
|-------------|-------------|
| `webhook_received` | Webhook recibido del proveedor |
| `duplicate_webhook` | Webhook duplicado detectado y descartado |
| `movement_unresolved` | Movimiento sin cuenta/dominio asignable |
| `delivery_success` | Entrega exitosa |
| `delivery_retry` | Reintento de entrega |
| `delivery_dead` | Entrega enviada a DLQ |
| `delivery_reactivated` | Entrega reactivada desde DLQ |
| `rate_limit_provider` | Rate limit por proveedor |
| `rate_limit_ip` | Rate limit por IP |
| `webhook_processing_error` | Error al procesar webhook |

Los logs son visibles en la página **Logs** del panel con filtros por nivel, source y tipo de evento.

---

## Headers enviados al dominio destino

| Header | Valor |
|--------|-------|
| `Content-Type` | `application/json` |
| `x-gateway-token` | `domain.destination_token` |
| `x-gateway-event-id` | UUID generado por el gateway |
| `x-provider-event-id` | ID del proveedor (si existe) |
| `x-hg-movement-id` | ID original del movimiento en HG.Cash (`payload.id`) |
| `x-gateway-movement-id` | ID interno del movimiento en la DB del gateway |
| `x-hg-account-id` | `accountId` del payload original |
| `x-hg-account-db-id` | ID de la cuenta en la DB del gateway |
| `x-domain-id` | ID del dominio en la DB del gateway |
| `x-coelsa-code` | Código COELSA del movimiento |
| `x-gateway-timestamp` | Unix timestamp de la entrega (usado en firma HMAC) |
| `x-gateway-signature` | `sha256=<HMAC>` — solo si el dominio tiene secreto configurado |

---

## Eventos Socket.IO

| Evento | Cuándo se emite |
|--------|-----------------|
| `movement:new` | Nuevo movimiento resuelto. Incluye `resolution_status`, `domains_count` y `metadata` |
| `movement:unresolved` | Movimiento sin resolución automática |
| `movement:resolved` | Movimiento asignado manualmente. Incluye `resolution_status`, `domains_count` y `metadata` |
| `movement:updated` | Update de movimiento existente |
| `delivery:updated` | Cambio de estado en una entrega |
| `stats:updated` | Estadísticas del dashboard invalidadas |

---

## Estados de resolución de movimientos

| Estado | Descripción |
|--------|-------------|
| `resolved` | Resuelto automáticamente |
| `multi_resolved` | Resuelto automáticamente hacia múltiples dominios |
| `unresolved` | Sin cuenta/dominio → pendiente de asignación |
| `manually_resolved` | Asignado manualmente por un administrador |

## Estados de entregas

| Estado | Descripción |
|--------|-------------|
| `pending` | En cola, esperando ser procesada |
| `processing` | En proceso |
| `success` | Entregada exitosamente |
| `failed` | Falló, con reintentos restantes |
| `dead` | Agotó todos los intentos → Dead Letter Queue |

---

## Ejemplo curl con proveedor (v3)

```bash
# Usando token de provider_source (nuevo sistema)
curl -X POST https://tu-gateway/api/webhooks/provider/hgcash/TOKEN_DEL_PROVEEDOR \
  -H "Content-Type: application/json" \
  -d '{
    "provider_event_id": "prov_abc_123",
    "received_by_provider_at": "2026-05-16T14:36:59-03:00",
    "payload": {
      "id": "b1642cbc-9458-4f08-aae2-72c285783fda",
      "amount": "1000",
      "currency": "ARS",
      "direction": "Inbound",
      "status": "done",
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
  }'
```

Respuesta:
```json
{ "success": true, "duplicate": false, "message": "Webhook received", "gateway_event_id": "uuid-generado" }
```

---

## Producción con PM2

```bash
pm2 start ecosystem.config.cjs

# Worker separado
cd server && pm2 start --name "gateway-worker" npm -- run worker
```

## Payloads con destinos

El proveedor puede enviar un dominio único:

```json
{
  "provider_event_id": "prov_001",
  "destination_domain": "siemprepaga.com",
  "payload": {}
}
```

O varios dominios:

```json
{
  "provider_event_id": "prov_001",
  "destination_domains": ["siemprepaga.com", "betcity.com"],
  "payload": {}
}
```

Prioridad de resolución:

```txt
destination_domains[]
destination_domain
domain
accountId
toCBU
toCUIT
unresolved
```

Notas:

- `destination_domains[]` se normaliza a hostname y elimina duplicados
- `destination_domain` y `domain` se tratan como hostnames individuales
- Si llega un dominio inválido, se registra en `system_logs` con `invalid_destination_domain`
- Si llegan varios dominios válidos, se crea un delivery por cada uno
- No se crean deliveries duplicados para el mismo `movement_id + domain_id`

### Ejemplo curl Bash

```bash
curl -X POST https://tu-gateway/api/webhooks/provider/hgcash/TOKEN_DEL_PROVEEDOR \
  -H "Content-Type: application/json" \
  -d '{
    "provider_event_id": "prov_001",
    "destination_domains": ["siemprepaga.com", "betcity.com"],
    "payload": {
      "id": "b1642cbc-9458-4f08-aae2-72c285783fda",
      "amount": "1000",
      "currency": "ARS",
      "accountId": "c68ec492-6a49-40f1-8060-7c1cb38ac1f9"
    }
  }'
```

### Ejemplo curl PowerShell

```powershell
$body = @{
  provider_event_id = 'prov_001'
  destination_domain = 'siemprepaga.com'
  payload = @{
    id = 'b1642cbc-9458-4f08-aae2-72c285783fda'
    amount = '1000'
    currency = 'ARS'
    accountId = 'c68ec492-6a49-40f1-8060-7c1cb38ac1f9'
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post `
  -Uri 'https://tu-gateway/api/webhooks/provider/hgcash/TOKEN_DEL_PROVEEDOR' `
  -ContentType 'application/json' `
  -Body $body
```
