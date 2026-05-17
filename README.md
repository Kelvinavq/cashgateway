# HG.Cash Webhook Gateway

Gateway centralizado para recibir, procesar y reenviar webhooks de HG.Cash desde un proveedor externo hacia múltiples dominios/proyectos.

## Arquitectura

```
HG.Cash → Proveedor Externo → [Este Gateway] → Dominio/Proyecto Final
```

El proveedor externo reenvía los webhooks de todas las cuentas HG.Cash a este gateway. El gateway identifica la cuenta, registra el movimiento y reenvía al dominio correspondiente con reintentos automáticos.

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

```sql
-- Importar en MySQL (crea la DB, tablas, índices y seed data):
mysql -u root -p < alters.sql
```

Esto crea:
- Usuario admin: `admin@hgcash.com` / contraseña: `admin123`
- Dominio de ejemplo: "Demo Project"
- Cuenta HG de ejemplo: AGROFORESTAL PAMPA

### 2. Backend

```bash
cd server
npm install

# Copiar y editar variables de entorno
cp .env.example .env
# Editar server/.env con tus credenciales MySQL y JWT_SECRET

# Iniciar servidor
npm run dev

# En otra terminal: iniciar worker de colas
npm run worker
```

### 3. Frontend

```bash
cd client
npm install

# El archivo .env ya está configurado para desarrollo
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
GET  /api/movements                          # Paginado + filtros
GET  /api/movements/:id                      # Detalle
GET  /api/movements/:id/deliveries           # Historial de entregas
```

**Filtros disponibles:** `page`, `limit`, `domain_id`, `account_id`, `direction`, `delivery_status`, `coelsa_code`, `cuit`, `date_from`, `date_to`, `amount_min`, `amount_max`

### Entregas
```
GET  /api/deliveries                         # Paginado + filtro por status
POST /api/deliveries/:id/retry               # Reintentar manualmente
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
```

### Webhook (recepción desde proveedor)
```
POST /api/webhooks/provider/hgcash/:gateway_token          # Movimiento nuevo
POST /api/webhooks/provider/hgcash/:gateway_token/update   # Update de movimiento
```

En producción con `flowhg.online`:

```
POST https://flowhg.online/api/webhooks/provider/hgcash/:gateway_token
POST https://flowhg.online/api/webhooks/provider/hgcash/:gateway_token/update
```

Headers esperados:
- `x-provider-token`: Token del proveedor (si la cuenta lo tiene configurado)
- `x-HG-Webhook-Signature`: Firma HMAC opcional

## Flujo del webhook

```
1. Proveedor externo  →  POST /api/webhooks/provider/hgcash/{gateway_token}
2. Gateway valida gateway_token + provider_token
3. Responde 200 inmediatamente (sin bloquear)
4. Async: resuelve cuenta por accountId → CUIT → CBU
5. Guarda movimiento en MySQL (ignora duplicados por hg_id)
6. Crea registro en webhook_deliveries
7. Encola en BullMQ (Redis)
8. Worker toma el job y hace POST al destino del dominio
9. Emite eventos Socket.IO al frontend en tiempo real
10. Si falla: reintento exponencial hasta 5 veces
```

## Payload esperado del proveedor externo

```json
{
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
```

## Ejemplo curl — simular webhook

```bash
curl -X POST \
  http://localhost:3000/api/webhooks/provider/hgcash/gw-token-agroforestal-2024 \
  -H "Content-Type: application/json" \
  -H "x-provider-token: prov-token-123" \
  -d '{
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
  }'
```

## Eventos Socket.IO

| Evento | Descripción |
|--------|-------------|
| `movement:new` | Nuevo movimiento recibido |
| `movement:updated` | Movimiento actualizado |
| `delivery:updated` | Estado de entrega cambiado |
| `stats:updated` | Estadísticas del dashboard actualizadas |

## Headers enviados al dominio destino

```
Content-Type: application/json
x-gateway-token: {destination_token del dominio}
x-hg-account-id: {accountId del payload}
x-hg-movement-id: {id interno del movimiento}
x-coelsa-code: {coelsaCode del payload}
```

## Reintentos automáticos

| Intento | Delay |
|---------|-------|
| 1 | Inmediato |
| 2 | 5 segundos |
| 3 | 10 segundos |
| 4 | 20 segundos |
| 5 | 40 segundos |

Backoff exponencial. Máximo 5 intentos. Luego se marca `failed` y se puede reintentar manualmente.

## Producción

```bash
# Backend
NODE_ENV=production npm start

# Worker (proceso separado, usar PM2 o similar)
NODE_ENV=production node queues/webhookWorker.js
```

**Checklist producción:**
- [ ] Cambiar `JWT_SECRET` por un valor aleatorio largo
- [ ] Configurar `MYSQL_PASSWORD`
- [ ] Configurar `PUBLIC_WEBHOOK_BASE_URL` con el dominio real
- [ ] Configurar Redis con contraseña si aplica
- [ ] Habilitar HTTPS (reverse proxy con nginx)
- [ ] Cambiar contraseña del admin desde la BD
- [ ] Ajustar `COOKIE_NAME` y opciones `secure: true` (ya automático con `NODE_ENV=production`)

## Scripts npm

### Backend (`server/`)
| Script | Descripción |
|--------|-------------|
| `npm start` | Inicia el servidor |
| `npm run dev` | Modo desarrollo con nodemon |
| `npm run worker` | Inicia el worker de BullMQ |

### Frontend (`client/`)
| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run preview` | Preview del build |
