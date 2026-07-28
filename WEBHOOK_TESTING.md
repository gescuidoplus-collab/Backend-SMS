# Webhook Testing Guide

## Endpoint Único

**URL:** `GET /api/cron?token=TOKEN&month=MONTH&year=YEAR`

**Parámetros:**
- `token`: Token CloudNavis
- `month`: Mes (1-12)
- `year`: Año

---

## Datos de Prueba

```
Token: FKlMT6kNmA0AMiUE75atAzVETTkkuYGWS77hUb3z
Mes: 5
Año: 2026
```

---

## Test: Flujo Completo (Facturas + Nóminas + WhatsApp)

### cURL
```bash
curl -X GET "http://localhost:3000/api/cron?token=FKlMT6kNmA0AMiUE75atAzVETTkkuYGWS77hUb3z&month=5&year=2026"
```

### PowerShell
```powershell
$token = "FKlMT6kNmA0AMiUE75atAzVETTkkuYGWS77hUb3z"
$month = 5
$year = 2026

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/cron?token=$token&month=$month&year=$year"
$response | ConvertTo-Json | Write-Host
```

### Node.js
```javascript
const token = 'FKlMT6kNmA0AMiUE75atAzVETTkkuYGWS77hUb3z';
const month = 5;
const year = 2026;

fetch(`http://localhost:3000/api/cron?token=${token}&month=${month}&year=${year}`)
  .then(res => res.json())
  .then(data => {
    console.log('=== RESPUESTA COMPLETA ===');
    console.log(`Facturas procesadas: ${data.invoices.invoicesProcessed}`);
    console.log(`Nóminas procesadas: ${data.payrolls.payrollsProcessed}`);
    console.log(`Mensajes enviados: ${data.messages.messagesSent}`);
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(err => console.error('Error:', err));
```

### JavaScript (Browser Console)
```javascript
const token = 'FKlMT6kNmA0AMiUE75atAzVETTkkuYGWS77hUb3z';
const month = 5;
const year = 2026;

fetch(`http://localhost:3000/api/cron?token=${token}&month=${month}&year=${year}`)
  .then(r => r.json())
  .then(d => {
    console.log('Facturas:', d.invoices);
    console.log('Nóminas:', d.payrolls);
    console.log('WhatsApp:', d.messages);
  })
  .catch(e => console.error(e));
```

### Postman
```
Method: GET
URL: http://localhost:3000/api/cron
Query Params:
  - token: FKlMT6kNmA0AMiUE75atAzVETTkkuYGWS77hUb3z
  - month: 5
  - year: 2026
```

**Expected Response (200):**
```json
{
  "ok": true,
  "timestamp": "2026-07-27T10:30:00.123Z",
  "invoices": {
    "token": "FKlM...",
    "month": 5,
    "year": 2026,
    "startTime": "2026-07-27T10:30:00.000Z",
    "endTime": "2026-07-27T10:35:00.000Z",
    "invoicesProcessed": 12,
    "invoicesFailed": 0,
    "logsSaved": 24,
    "errors": []
  },
  "payrolls": {
    "token": "FKlM...",
    "month": 5,
    "year": 2026,
    "startTime": "2026-07-27T10:35:25.000Z",
    "endTime": "2026-07-27T10:40:00.000Z",
    "payrollsProcessed": 8,
    "payrollsFailed": 0,
    "logsSaved": 16,
    "errors": []
  },
  "messages": {
    "token": "FKlM...",
    "startTime": "2026-07-27T10:40:05.000Z",
    "endTime": "2026-07-27T10:50:00.000Z",
    "messagesSent": 35,
    "messagesFailed": 2,
    "errors": [
      "Número inválido para +34...",
      "Template error para id456"
    ]
  }
}
```

---

## Error Handling

### Test sin Token
```bash
curl -X GET "http://localhost:3000/api/cron?month=5&year=2026"
```

**Expected Response (400):**
```json
{
  "ok": false,
  "error": "Parámetros requeridos: token, month, year",
  "example": "/api/cron?token=abc&month=5&year=2026"
}
```

### Test con Mes Inválido
```bash
curl -X GET "http://localhost:3000/api/cron?token=FKlMT6kNmA0AMiUE75atAzVETTkkuYGWS77hUb3z&month=13&year=2026"
```

**Expected Response (400):**
```json
{
  "ok": false,
  "error": "Parámetros inválidos: month (1-12) y year deben ser números válidos"
}
```

### Test con Token Inválido
```bash
curl -X GET "http://localhost:3000/api/cron?token=invalid_token&month=5&year=2026"
```

**Expected Response (500):**
```json
{
  "ok": false,
  "error": "Token inválido o expirado",
  "timestamp": "2026-07-27T10:30:00.000Z"
}
```

---

## Full Workflow Test

Una sola llamada hace TODO:

```bash
#!/bin/bash

TOKEN="FKlMT6kNmA0AMiUE75atAzVETTkkuYGWS77hUb3z"
MONTH=5
YEAR=2026
API_URL="http://localhost:3000"

echo "🚀 Iniciando ciclo completo..."
echo ""

START=$(date +%s)

RESPONSE=$(curl -s "$API_URL/api/cron?token=$TOKEN&month=$MONTH&year=$YEAR")

END=$(date +%s)
DURATION=$((END - START))

echo "📊 RESULTADO:"
echo "$RESPONSE" | jq '.'

echo ""
echo "⏱️  Tiempo total: ${DURATION} segundos"
echo "✅ Workflow completado"
echo ""
echo "Detalles:"
echo "$RESPONSE" | jq -r '.invoices | "Facturas: \(.invoicesProcessed) procesadas, \(.logsSaved) logs guardados"'
echo "$RESPONSE" | jq -r '.payrolls | "Nóminas: \(.payrollsProcessed) procesadas, \(.logsSaved) logs guardados"'
echo "$RESPONSE" | jq -r '.messages | "WhatsApp: \(.messagesSent) enviados, \(.messagesFailed) fallidos"'
```

---

## Monitoreo en Tiempo Real

### Logs del Backend
```bash
# Terminal 1: Ver logs del backend
npm run dev

# Terminal 2: Ejecutar test
curl "http://localhost:3000/api/cron?token=FKlM...&month=5&year=2026"

# En Terminal 1 verás:
# [Facturas] Procesando mes 5/2026 con token: FKlM...
# [Facturas] Encontradas 12 facturas
# [Facturas] Log guardado para Juan Pérez
# ...
```

### Ver en MongoDB
```javascript
// MongoDB Shell
use cuidofam
db.messagelogs.find({ status: "pending" }).count()
db.messagelogs.findOne({ status: "pending" })
```

### Ver Notificaciones Telegram
- Las notificaciones llegarán a tu chat de Telegram configurado

---

## Timing Esperado

| Fase | Duración |
|------|----------|
| Descarga de facturas (12 facturas) | ~3-5 segundos |
| Espera entre tareas | 25 segundos |
| Descarga de nóminas (8 nóminas) | ~2-3 segundos |
| Espera antes de WhatsApp | 5 segundos |
| Envío WhatsApp (35 mensajes @ 3.5s c/u) | ~2-3 minutos |
| **TOTAL** | **~3 minutos** |

**Una sola llamada maneja TODO automáticamente.**

---

## Troubleshooting

### Error: "Token inválido o expirado"
- Verificar que el token es correcto en CloudNavis
- Verificar que CloudNavis API está disponible
- Verificar conexión a CloudNavis

### Error: "Base de datos no disponible"
- Verificar que MongoDB está corriendo
- Verificar conexión string en `.env`
- Ver logs de MongoDB

### Cero facturas procesadas
- Verificar que existen facturas en CloudNavis para ese mes/año
- Verificar que las facturas tienen `tipoPago == "Remesa"`
- Verificar que los usuarios tienen teléfonos válidos

### Mensajes no enviados
- Verificar que los `MessageLog` se crearon (MongoDB)
- Verificar que WhatsApp API está disponible
- Ver logs de `whatsapp-batch-messages.js`

---

## Llamadas Programadas (Make.com Example)

**Escenario:** Procesar nóminas el 1º de cada mes a las 08:00

```
Paso 1: HTTP GET /api/cron (UNA SOLA LLAMADA)
  URL: https://tu-backend.railway.app/api/cron
  Parámetros:
    - token: FKlMT6kNmA0AMiUE75atAzVETTkkuYGWS77hUb3z
    - month: {{now.month}}
    - year: {{now.year}}
  
  El backend automáticamente:
    ✓ Descarga facturas
    ✓ Espera 25 segundos
    ✓ Descarga nóminas
    ✓ Espera 5 segundos
    ✓ Envía por WhatsApp
    ✓ Retorna respuesta con 3 reportes

Paso 2 (opcional): Enviar notificación a Slack/Teams
  - Usar la respuesta para notificar
  - Facturas: {{invoices.invoicesProcessed}}
  - Nóminas: {{payrolls.payrollsProcessed}}
  - Mensajes: {{messages.messagesSent}}
```

---

## Performance Tips

1. **Ejecutar una sola vez al mes**: No repitas `/api/cron` para el mismo mes
2. **Espaciar tareas**: Dejar 30-60s entre `/api/cron` y `/api/cron-send`
3. **Monitorear MongoDB**: Limpiar `messagelogs` antiguos periódicamente
4. **CloudNavis limits**: Verificar rate limits de CloudNavis API
5. **WhatsApp limits**: Esperar entre mensajes (ya configurado a 3.5s)
