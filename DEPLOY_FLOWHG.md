# Deploy en VPS para flowhg.online

## Variables

Backend: copiar `server/.env.production.example` a `server/.env` y cambiar:

```
MYSQL_PASSWORD=...
JWT_SECRET=...
```

Frontend: `client/.env.production` ya apunta a:

```
VITE_API_URL=https://flowhg.online/api
VITE_SOCKET_URL=https://flowhg.online
```

## Build

```bash
cd server
npm install --omit=dev

cd ../client
npm install
npm run build
```

## Procesos con PM2

Desde la raiz del proyecto:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Esto levanta:

```
hgcash-api     -> server/server.js
hgcash-worker  -> server/queues/webhookWorker.js
```

## Nginx

Ejemplo de server block:

```nginx
server {
    listen 80;
    server_name flowhg.online www.flowhg.online;

    root /var/www/cashgateway/client/dist;
    index index.html;

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

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Despues emitir SSL:

```bash
certbot --nginx -d flowhg.online -d www.flowhg.online
```

## Endpoints del proveedor

Ver `WEBHOOK_ENDPOINTS.md`.
