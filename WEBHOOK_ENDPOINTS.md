# Endpoints publicos para HG.Cash

Dominio de produccion: `https://flowhg.online`

## 1. Alta de movimiento

```
POST https://flowhg.online/api/webhooks/provider/hgcash/{gateway_token}
```

Este endpoint recibe movimientos nuevos del proveedor externo. El `gateway_token` identifica la cuenta HG.Cash configurada en el panel.

Headers:

```
Content-Type: application/json
x-provider-token: {provider_token_configurado_en_la_cuenta}
x-HG-Webhook-Signature: {firma_hmac_opcional}
```

## 2. Update de movimiento

```
POST https://flowhg.online/api/webhooks/provider/hgcash/{gateway_token}/update
```

Este endpoint recibe actualizaciones de un movimiento existente. Busca el movimiento por `id` del payload HG.Cash o por `coelsaCode`. Si no existe, lo crea para no perder el evento.

Headers:

```
Content-Type: application/json
x-provider-token: {provider_token_configurado_en_la_cuenta}
x-HG-Webhook-Signature: {firma_hmac_opcional}
```

## Ejemplo rapido

```bash
curl -X POST \
  https://flowhg.online/api/webhooks/provider/hgcash/gw-token-agroforestal-2024 \
  -H "Content-Type: application/json" \
  -H "x-provider-token: prov-token-123" \
  -d '{"id":"b1642cbc-9458-4f08-aae2-72c285783fda","amount":"1000","currency":"ARS","direction":"Inbound","status":"done","accountId":"c68ec492-6a49-40f1-8060-7c1cb38ac1f9","coelsaCode":"WGRXJE27DPD7L566N7MYQL"}'
```

```bash
curl -X POST \
  https://flowhg.online/api/webhooks/provider/hgcash/gw-token-agroforestal-2024/update \
  -H "Content-Type: application/json" \
  -H "x-provider-token: prov-token-123" \
  -d '{"id":"b1642cbc-9458-4f08-aae2-72c285783fda","status":"reversed","coelsaCode":"WGRXJE27DPD7L566N7MYQL"}'
```

## Reenvio al dominio final

Cuando el movimiento o update se procesa, el gateway lo reenvia al `destination_webhook_url` del dominio asociado a la cuenta HG.Cash.

Headers enviados al destino:

```
Content-Type: application/json
x-gateway-token: {destination_token_del_dominio}
x-hg-account-id: {accountId_del_payload}
x-hg-movement-id: {id_interno_del_movimiento}
x-coelsa-code: {coelsaCode_del_payload}
```
