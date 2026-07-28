# Webhook API - CloudNavis Integration

## Overview

El webhook `/api/cron` permite que un sistema externo dispare el procesamiento completo: descarga de facturas y nóminas desde CloudNavis, y envío por WhatsApp. El backend recepciona el token de autenticación CloudNavis y realiza todas las operaciones en secuencia.

---

## Endpoint Único

### POST /api/cron - Procesamiento Completo

Flujo completo en una sola llamada:
1. Descarga facturas de CloudNavis
2. Descarga nóminas de CloudNavis
3. Envía por WhatsApp

**URL:**
```
GET /api/cron?token=TOKEN&month=MONTH&year=YEAR
```

**Parámetros:**
- `token` (string, requerido): Token de autenticación CloudNavis
- `month` (number, requerido): Mes (1-12)
- `year` (number, requerido): Año (ej: 2026)

**Ejemplo:**
```bash
curl "https://tu-backend.railway.app/api/cron?token=FKlMT6kNmA0AMiUE75atAzVETTkkuYGWS77hUb3z&month=5&year=2026"
```

**Response (200):**
```json
{
  "ok": true,
  "timestamp": "2026-07-27T10:30:00.000Z",
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

**Response (400):**
```json
{
  "ok": false,
  "error": "Parámetros requeridos: token, month, year",
  "example": "/api/cron?token=abc&month=5&year=2026"
}
```

**Response (500):**
```json
{
  "ok": false,
  "error": "Token inválido o expirado",
  "timestamp": "2026-07-27T10:30:00.000Z"
}
```

**Qué hace (Flujo Completo):**
1. Valida parámetros
2. **Facturas**: Obtiene lista de facturas del mes/año desde CloudNavis
   - Filtra por `tipoPago == "Remesa"`
   - Valida campos: `firma`, `codigoQr`, `codigoIdentificativo`
   - Crea registros `MessageLog` en MongoDB
3. **Espera 25 segundos**
4. **Nóminas**: Obtiene lista de nóminas del mes/año desde CloudNavis
   - Valida período completo del mes
   - Crea registros `MessageLog` en MongoDB
5. **Espera 5 segundos**
6. **WhatsApp**: Procesa todos los `MessageLog` pendientes
   - Descarga PDFs de CloudNavis
   - Envía mensajes por WhatsApp
   - Actualiza estados
7. Notifica a Telegram del resultado completo

---

## Flujo Típico

```
Sistema Externo (Make.com, Zapier, etc.)
         ↓
    [Scheduler - Primer día del mes]
         ↓
   GET /api/cron?token=...&month=5&year=2026
         ↓
   1. Descarga y procesa facturas (~5s)
   2. Espera 25s
   3. Descarga y procesa nóminas (~3s)
   4. Espera 5s
   5. Envía todo por WhatsApp (~3 minutos)
         ↓
   ✅ DONE - Respuesta con 3 reportes
```

---

## Logs y Monitoreo

### Telegram Notifications

El endpoint envía una notificación a Telegram:

**Éxito:**
```
✅ Ciclo completo finalizado - Facturas: 12, Nóminas: 8, Mensajes: 35 - 27/07/2026 10:35:00
```

**Error:**
```
❌ Error en webhook /api/cron: Token inválido o expirado
```

### Console Logs

El backend también loguea en consola:
```
[Facturas] Procesando mes 5/2026 con token: FKlM...
[Facturas] Encontradas 12 facturas
[Facturas] Log guardado para Juan Pérez
[Facturas] Completado: 12 procesadas, 0 errores

[Nóminas] Procesando mes 5/2026 con token: FKlM...
[Nóminas] Encontradas 8 nóminas
[Nóminas] Completado: 8 procesadas, 0 errores

[WhatsApp] Iniciando envío de mensajes: FKlM...
[WhatsApp] Completado: 35 enviados, 2 errores
```

---

## Estructura de Respuesta

Respuesta única con 3 reportes:

```json
{
  "ok": true,
  "timestamp": "ISO-8601",
  "invoices": {
    "token": "FKlM...",
    "month": 5,
    "year": 2026,
    "startTime": "ISO-8601",
    "endTime": "ISO-8601",
    "invoicesProcessed": number,
    "invoicesFailed": number,
    "logsSaved": number,
    "errors": []
  },
  "payrolls": {
    "token": "FKlM...",
    "month": 5,
    "year": 2026,
    "startTime": "ISO-8601",
    "endTime": "ISO-8601",
    "payrollsProcessed": number,
    "payrollsFailed": number,
    "logsSaved": number,
    "errors": []
  },
  "messages": {
    "token": "FKlM...",
    "startTime": "ISO-8601",
    "endTime": "ISO-8601",
    "messagesSent": number,
    "messagesFailed": number,
    "errors": []
  }
}
```

---

## Casos de Éxito y Errores

### ✅ Éxito Completo
- Todos los parámetros válidos
- Token válido en CloudNavis
- Datos descargados correctamente
- Logs creados en MongoDB
- Mensajes enviados por WhatsApp

### ⚠️ Parcial (Some data missing)
- Se procesan registros válidos
- Se ignoran registros sin teléfono, con campos incompletos, o inválidos
- Se retorna reporte con contador de errores

### ❌ Error Crítico
- Token inválido o expirado
- CloudNavis API no disponible
- MongoDB no disponible
- Parámetros faltantes o inválidos

---

## Validaciones

### Token
- Debe ser una cadena de texto no vacía
- Se valida en cada llamada a CloudNavis

### Mes
- Rango: 1-12
- Debe ser número entero

### Año
- Debe ser número entero
- Rango recomendado: 2020-2099

### Datos de Factura (requeridos para envío)
- `tipoPago == "Remesa"`
- `firma`: no puede ser null/vacío/"PENDIENTE"
- `codigoQr`: no puede ser null/vacío/"PENDIENTE"
- `codigoIdentificativo`: no puede ser null/vacío/"PENDIENTE"
- `idUsuario`: debe ser UUID válido
- Usuario debe tener teléfono válido

### Datos de Nómina (requeridos para envío)
- Período completo del mes (inicioLiquidacion día 1, finLiquidacion último día)
- `idEmpleador`: UUID válido
- `idTrabajador`: UUID válido
- Empleador debe tener teléfono válido
- Empleado debe tener teléfono válido

---

## Integration Examples

### Make.com (Zapier alternative)
```
Trigger: Schedule (Monthly, first day at 08:00)
  ↓
Make HTTP Request:
  - Method: GET
  - URL: https://tu-backend.railway.app/api/cron
  - Params:
    - token: FKlMT6kNmA0AMiUE75atAzVETTkkuYGWS77hUb3z
    - month: {{now.month}}
    - year: {{now.year}}
  ↓
Webhook realiza TODO automáticamente:
  ✓ Descarga facturas
  ✓ Descarga nóminas
  ✓ Envía por WhatsApp
  ✓ Retorna 1 respuesta con 3 reportes
```

### Node.js Script
```javascript
const token = 'FKlMT6kNmA0AMiUE75atAzVETTkkuYGWS77hUb3z';
const month = 5;
const year = 2026;

// Una sola llamada que hace TODO
const response = await fetch(
  `https://tu-backend.railway.app/api/cron?token=${token}&month=${month}&year=${year}`
);
const report = await response.json();

console.log('Facturas:', report.invoices);
console.log('Nóminas:', report.payrolls);
console.log('WhatsApp:', report.messages);
```

---

## Notas

- El token es específico de CloudNavis
- El mes es obligatorio (no hay lógica de "mes actual")
- El año también es obligatorio
- Se pueden procesar meses anteriores
- Los registros MessageLog se marcan como pendientes hasta que se envíen
- Los Telegram notifications se envían siempre (éxito y error)
- Los tiempos de respuesta dependen de:
  - Cantidad de facturas/nóminas
  - Velocidad de CloudNavis
  - Disponibilidad de base de datos
  - Velocidad de WhatsApp API
