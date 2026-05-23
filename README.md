# HG.Cash Webhook Gateway

Gateway centralizado para recibir, procesar y reenviar webhooks de HG.Cash desde un proveedor externo hacia múltiples dominios/proyectos.

## Arquitectura

```
HG.Cash → Proveedor Externo → [Este Gateway] → Dominio/Proyecto Final
```

El proveedor externo reenvía los webhooks de todas las cuentas HG.Cash a este gateway. El gateway identifica la cuenta por `accountId` (con fallback por CBU y CUIT), registra el movimiento y reenvía al dominio correspondiente con reintentos automáticos. Los movimientos que no pueden resolverse se guardan como `unresolved` para asignación manual.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite, Material UI v5, Socket.IO client |
| Backend | Node.js, Express 4 |
| Base de datos | MySQL 8+ |
| Cola/Reintentos | BullMQ + Redis |
| Tiempo real | Socket.IO |
| Auth | JWT (cookie HTTP-only, 1 hora) + bcrypt |
| Seguridad | Helmet, CORS, rate-limit, express-validator |

## Estructura del proyecto

```
cashgateway/
├── alters.sql              # Schema MySQL completo + seed data
├── migration_v2.sql        # Migración v2: resolución de movimientos
├── server/                 # Backend Express
│   ├── app.js
│   ├── server.js
│   ├── config/             # env, database, redis
│   ├── controllers/        # auth, webhook, movements, accounts, domains, dashboard, deliveries
│   ├── routes/             # Un archivo por recurso
│   ├── services/           # accountResolver, movement, webhookForward, socket, stats
│   ├── queues/             # webhookQueue (BullMQ), webhookWorker
│   ├── middlewares/        # auth, error, rawBody
│   └── utils/              # hmac, logger, validators
└── client/                 # Frontend React + Vite
    └── src/
        ├── contexts/       # Auth, Theme
        ├── pages/          # Login, Dashboard, Movements, Deliveries, Accounts, Domains
        ├── components/     # Layout, StatusChip
        ├── hooks/          # useSocket
        └── lib/            # api (axios), socket (socket.io-client)
```

## Requisitos previos

- Node.js 18+
- MySQL 8+
- Redis 6+

## Instalación

### 1. Base de datos

```bash
# Schema inicial (crea la DB, tablas, índices y seed data):
mysql -u root -p < alters.sql

# Migración v2 (agrega campos de resolución a movements):
mysql -u root -p hgcash_gateway < migration_v2.sql
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
# Editar server/.env con tus credenciales MySQL y JWT_SECRET

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
| `FRONTEND_URL` | `http://localhost:5173` | URL frontend (para CORS) |
| `MYSQL_HOST` | `localhost` | Host MySQL |
| `MYSQL_PORT` | `3306` | Puerto MySQL |
| `MYSQL_USER` | `root` | Usuario MySQL |
| `MYSQL_PASSWORD` | _(vacío)_ | Contraseña MySQL |
| `MYSQL_DATABASE` | `hgcash_gateway` | Base de datos |
| `JWT_SECRET` | ⚠️ cambiar | Clave JWT |
| `JWT_EXPIRES_IN` | `1h` | Expiración JWT |
| `COOKIE_NAME` | `hgcash_gateway_token` | Nombre de la cookie |
| `REDIS_HOST` | `127.0.0.1` | Host Redis |
| `REDIS_PORT` | `6379` | Puerto Redis |
| `PUBLIC_WEBHOOK_BASE_URL` | `https://flowhg.online` | Base URL pública del gateway |

### Frontend (`client/.env`)

| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | `http://localhost:3000/api` |
| `VITE_SOCKET_URL` | `http://localhost:3000` |

## Cómo registrar una cuenta y recibir webhooks

### Paso 1 — Crear dominio

En la sección **Dominios** del panel, crear un dominio con:
- Nombre, slug
- `destination_webhook_url`: URL a la que el gateway enviará los webhooks
- `destination_token`: token que se enviará en el header `x-gateway-token`

### Paso 2 — Crear cuenta HG.Cash

En la sección **Cuentas** del panel, crear una cuenta asociada al dominio:
- `account_id`: el UUID de la cuenta en HG.Cash (campo `accountId` del payload)
- `cbu` y `cuit` opcionales (usados como fallback de resolución)

### Paso 3 — Configurar el proveedor externo

El proveedor debe enviar sus webhooks a:
```
POST https://tu-gateway/api/webhooks/provider/hgcash/{gateway_token}
```
donde `{gateway_token}` es el token de la cuenta HG.Cash.

### Paso 4 — Resolución automática

Cuando llega un webhook, el gateway:
1. Busca cuenta activa por `payload.accountId`
2. Si no encuentra, busca por `payload.toCBU`
3. Si no encuentra, busca por `payload.toCUIT`
4. Si no encuentra → guarda como `unresolved`

### Paso 5 — Movimientos no resueltos

Los movimientos `unresolved` aparecen destacados en la página de Movimientos. Para resolverlos manualmente:
1. Clic en el ícono de llave (🔧) en la fila
2. Seleccionar la cuenta HG.Cash destino
3. Confirmar → el gateway reenvía inmediatamente al dominio

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
POST /api/movements/:id/resolve         # Resolver manualmente (body: { hgcash_account_id })
```

**Filtros disponibles:** `page`, `limit`, `domain_id`, `hgcash_account_id`, `account_id`, `direction`, `delivery_status`, `resolution_status`, `resolution_method`, `coelsa_code`, `cuit`, `cbu`, `date_from`, `date_to`, `amount_min`, `amount_max`

### Entregas
```
GET  /api/deliveries                    # Paginado + filtro por status
POST /api/deliveries/:id/retry          # Reintentar manualmente
```

### Cuentas HG
```
GET    /api/accounts
POST   /api/accounts
PUT    /api/accounts/:id
DELETE /api/accounts/:id
```

Campos: `name`, `account_id` (obligatorio y único), `cuit`, `cbu`, `alias`, `domain_id` (obligatorio), `is_active`

### Dominios
```
GET    /api/domains
POST   /api/domains
PUT    /api/domains/:id
DELETE /api/domains/:id
```

Campos: `name`, `slug`, `base_url`, `destination_webhook_url`, `destination_token`, `is_active`

### Webhook (recepción desde proveedor)
```
POST /api/webhooks/provider/hgcash/:gateway_token          # Movimiento nuevo
POST /api/webhooks/provider/hgcash/:gateway_token/update   # Update de movimiento
```

Headers esperados:
- `x-provider-token`: Token del proveedor (si la cuenta lo tiene configurado)

## Flujo del webhook

```
1. Proveedor externo  →  POST /api/webhooks/provider/hgcash/{gateway_token}
2. Gateway valida gateway_token (+ optional x-provider-token header)
3. Normaliza payload: acepta wrapper {provider_event_id, payload} o payload plano
4. Genera gateway_event_id (UUID único)
5. Resuelve cuenta/dominio: accountId → toCBU → toCUIT
6. Guarda movimiento en MySQL con resolution_status
7. Responde 200 (después de guardar en DB)
   ↓
   Si RESOLVED:
     → Crea webhook_delivery
     → Encola en BullMQ (Redis)
     → Worker hace POST al domain.destination_webhook_url
     → Emite evento Socket.IO movement:new
     → Reintento exponencial hasta 5 veces si falla

   Si UNRESOLVED:
     → Guarda unresolved_reason
     → Emite evento Socket.IO movement:unresolved
     → Aparece en dashboard y tabla con badge rojo
     → Admin resuelve manualmente → reenvía
```

## Payload del proveedor — formatos aceptados

### Con wrapper
```json
{
  "provider_event_id": "prov_abc_123",
  "received_by_provider_at": "2026-05-16T14:36:59-03:00",
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

### Plano (sin wrapper)
```json
{
  "id": "b1642cbc-9458-4f08-aae2-72c285783fda",
  "amount": "1000",
  "accountId": "c68ec492-6a49-40f1-8060-7c1cb38ac1f9",
  ...
}
```

## Ejemplo curl

```bash
curl -X POST http://localhost:3000/api/webhooks/provider/hgcash/gw-token-agroforestal-2024 \
  -H "Content-Type: application/json" \
  -H "x-provider-token: prov-token-123" \
  -d '{
    "provider_event_id": "prov_123",
    "received_by_provider_at": "2026-05-16T14:36:59-03:00",
    "payload": {
      "id": "b1642cbc-9458-4f08-aae2-72c285783fda",
      "externalID": "E-WGRXJE27DPD7L566N7MYQL-2026-05-16 14:36:59",
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
  }'
```

Respuesta esperada:
```json
{ "success": true, "message": "Webhook received", "gateway_event_id": "uuid-generado" }
```

## Headers enviados al dominio destino

Cuando el gateway reenvía el webhook al dominio:

| Header | Valor |
|--------|-------|
| `x-gateway-token` | `domain.destination_token` |
| `x-gateway-event-id` | UUID generado por el gateway |
| `x-provider-event-id` | ID del proveedor (si existe) |
| `x-hg-movement-id` | ID interno del movimiento |
| `x-hg-account-id` | `accountId` del payload |
| `x-hg-account-db-id` | ID de la cuenta en la DB del gateway |
| `x-domain-id` | ID del dominio en la DB del gateway |
| `x-coelsa-code` | Código COELSA del movimiento |

## Eventos Socket.IO

| Evento | Cuándo se emite |
|--------|-----------------|
| `movement:new` | Nuevo movimiento resuelto |
| `movement:unresolved` | Movimiento no pudo resolverse |
| `movement:resolved` | Movimiento asignado manualmente |
| `movement:updated` | Update de movimiento existente |
| `delivery:updated` | Cambio de estado en una entrega |
| `stats:updated` | Estadísticas del dashboard invalidadas |

## Estados de resolución

| Estado | Descripción |
|--------|-------------|
| `resolved` | Resuelto automáticamente por accountId, CBU o CUIT |
| `unresolved` | No se encontró cuenta/dominio → pendiente de asignación manual |
| `manually_resolved` | Asignado manualmente por un administrador |

## Producción con PM2

```bash
# Backend API
pm2 start ecosystem.config.cjs

# Worker (separado)
cd server && pm2 start --name "gateway-worker" npm -- run worker
```
