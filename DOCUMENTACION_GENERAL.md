# BackendSMS (Cuido-Fam) — Documentación General (Técnica)

## 1) Resumen

Este proyecto es un backend en **Node.js (ESM)** con **Express** y **MongoDB (Mongoose)**. Automatiza:

- Descarga/procesamiento de **Facturas** y **Nóminas** desde **CloudNavis**.
- Registro y trazabilidad de envíos en **MongoDB**.
- Envío de documentos y notificaciones por **WhatsApp (Twilio)**.
- Notificaciones de monitoreo por **Telegram**.
- Endpoints para ejecución programada (cron) y webhooks.

## 2) Estructura del proyecto

Raíz:

- `index.js`
  - Entry point del servidor Express.
  - CORS, middleware base, motor de vistas (Handlebars) y endpoints “globales” como crons.
- `package.json`
  - Scripts y dependencias.
- `.env` / `.env.example`
  - Configuración de entorno.
- `vercel.json`
  - Configuración de despliegue y cron (si se usa Vercel).

Carpeta `app/`:

- `app/config/`
  - `enviroments.js`: validación/carga de variables de entorno (Joi + dotenv).
  - `mongodb.js`: conexión a Mongo con retries.
  - `index.js`: exporta `envConfig` y `mongoClient`.
- `app/routers/`
  - Rutas por módulo.
  - `index.js` auto-carga todos los routers `.js` y los monta con prefijo `/<nombre-archivo>`.
- `app/controllers/`
  - Lógica HTTP (request/response) por módulo.
- `app/services/`
  - Integraciones externas (CloudNavis, Twilio, Telegram) y lógica de envío/cola.
- `app/tasks/`
  - Tareas automáticas (facturas/nóminas, envío de mensajes, manager de tareas).
- `app/schemas/`
  - Modelos Mongoose (principalmente `MessageLog`).
- `app/middlewares/`
  - Middlewares como verificación de JWT.
- `app/utils/`
  - Utilidades (cifrado, generación de códigos, creación de usuario admin, etc.).

## 3) Puntos de entrada y montaje de rutas

### 3.1) Servidor (`index.js`)

Responsabilidades principales:

- Cargar `envConfig`.
- Configurar Express (CORS, JSON parsing, logs en development).
- Inicializar Mongo (`mongoClient()`).
- Montar routers bajo `envConfig.urlPath` (por defecto `/api/v1/`).
- Exponer endpoints adicionales (por ejemplo crons “directos” y generación de PDF).

### 3.2) Router dinámico (`app/routers/index.js`)

- Recorre archivos `.js` dentro de `app/routers/` (excepto `index.js`).
- Importa cada router y lo monta como:

```
{URL_PATH}/{nombre-archivo}
```

Ejemplos:

- `app/routers/auth.js` -> `/api/v1/auth/...`
- `app/routers/invoices.js` -> `/api/v1/invoices/...`
- `app/routers/payrolls.js` -> `/api/v1/payrolls/...`
- `app/routers/sms-delivery-log.js` -> `/api/v1/sms-delivery-log/...`
- `app/routers/twilio.js` -> `/api/v1/twilio/...`

## 4) Flujos principales

### Flujo A — Autenticación (JWT)

Archivos principales:

- `app/routers/auth.js`
- `app/controllers/auth.js`
- `app/middlewares/authMiddleware.js`

Endpoints:

- `POST /api/v1/auth/login`
  - Valida credenciales contra colección `Auth`.
  - Firma JWT con `JWT_SECRET_KEY`.
- `POST /api/v1/auth/change-password`
  - Requiere `Authorization: Bearer <token>`.
  - Verifica token y actualiza contraseña.

Notas:

- La verificación usa `audience` e `issuer` fijos (definidos en el código).

### Flujo B — Descarga de PDF (Factura / Nómina) desde CloudNavis

Archivos principales:

- `app/routers/invoices.js` + `app/controllers/invoicesController.js`
- `app/routers/payrolls.js` + `app/controllers/payrollsController.js`
- `app/services/apiCloudnavis.js`

Endpoints:

- `GET /api/v1/invoices/:id/factura.pdf`
- `GET /api/v1/payrolls/:id/nomina.pdf`

Secuencia (simplificada):

1. Establece cookie de sesión en CloudNavis (`setCookie`).
2. Login CloudNavis (`loginCloudnavis`).
3. Descarga buffer del PDF (factura o nómina).
4. Responde el PDF en streaming.

### Flujo C — Registro y trazabilidad de envíos (MessageLog)

Archivo principal:

- `app/schemas/messageLog.js`

Características:

- Guarda el estado de cada envío (`pending`, `success`, `failure`).
- Guarda payloads sensibles (ej. `recipient`, `employe`, contenido de plantilla) **cifrados**.

Cifrado:

- `app/utils/cipher.js` usa `CLOUD_SECRET_KEY` y `CLOUD_SECRET_IV` para AES-256-CBC.

API de consulta:

- `app/routers/sms-delivery-log.js` + `app/controllers/smsDeliveryController.js`
  - `GET /api/v1/sms-delivery-log` (paginado)
  - `GET /api/v1/sms-delivery-log/:id`
  - `DELETE /api/v1/sms-delivery-log/:id`

### Flujo D — Envío de mensajes WhatsApp (Twilio) y procesamiento en lotes

Archivos principales:

- `app/services/redis-messages.js` (a pesar del nombre, hoy opera principalmente con Mongo + lógica de lotes)
- `app/services/twilioService.js`
- `app/services/send-template-invoce.js`
- `app/services/send-template-payroll.js`
- `app/services/update-status-message.js`

Idea general:

1. Se consultan logs `MessageLog` en estado `pending`.
2. Se procesan en lotes para evitar spam.
3. Se envía usando Twilio (mensajes o plantillas con `ContentSid`).
4. Se actualiza estado final y timestamps.
5. Se notifica por Telegram (éxitos/errores relevantes).

### Flujo E — Webhook de Twilio (mensajes entrantes)

Archivos principales:

- `app/routers/twilio.js`
- `app/controllers/twilioWebhookController.js`

Endpoint:

- `POST /api/v1/twilio/IACowNPULfOR`

Subflujos:

- **E1) Mensaje del administrador (redirect number) -> reenviar a usuario**
  - Si el remitente coincide con `REDIRECT_NUMBER`.
  - Si el body tiene formato `+numero-mensaje`, reenvía el mensaje al usuario.

- **E2) Mensaje de usuario -> notificar al administrador**
  - Notifica por Telegram.
  - Usa `twilioContextManager` para gestionar ventana de contexto (plantilla inicial vs texto libre).

### Flujo F — Tareas automáticas / Crons

Archivos principales:

- `app/tasks/taskManager.js` (orquesta facturas + nóminas)
- `app/tasks/processInvoicesTask.js`
- `app/tasks/processPayRollsTask.js`
- `app/tasks/processSendMessajes.js` (encola/procesa envíos WhatsApp)

Ejecución por cron (2 estrategias posibles):

1) **Cron por plataforma (Vercel)**

- `vercel.json` define crons que llaman endpoints HTTP.
- Endpoints:
  - `GET /api/cron` -> ejecuta `runAllTasks()`
  - `GET /api/cron-send` -> ejecuta `processMessageQueue()`
- Seguridad opcional por header `x-cron-secret` (variable `CRON_SECRET`).

2) **Cron interno (node-cron)**

- Cuando `NODE_ENV !== development`:
  - En `app/tasks/taskManager.js` se agenda `runAllTasks()` **cada 1 hora**.
  - En `app/tasks/processSendMessajes.js` se agenda `processMessageQueue()` **cada hora en el minuto 10**.
- Ambos tienen un guard para evitar solape (si una ejecución está corriendo, no inicia otra).

### Flujo G — Notificaciones Telegram

Archivo principal:

- `app/services/sendMessageTelegram.js`

Uso:

- Monitoreo de ejecuciones de tasks.
- Alertas ante errores de envío o errores de procesamiento.

### Flujo H — Generación de PDF (plantilla HTML -> PDF)

Archivo principal:

- `index.js` (endpoints y configuración Handlebars + Puppeteer)

Endpoints:

- `GET /view-pdf-html` (renderiza HTML de prueba)
- `POST /api/v1/generate-pdf` (genera PDF vía Puppeteer)

## 5) Variables de entorno

La configuración se valida en `app/config/enviroments.js`.

### 5.1) Tabla de variables

| Variable | Requerida | Usada en | Propósito |
|---|---:|---|---|
| `NODE_ENV` | No (default `development`) | `index.js`, `app/tasks/*.js` | Controla comportamiento por entorno (logs, crons internos, etc.). |
| `PORT` | No (default `3000`) | `index.js` | Puerto del servidor. |
| `URL_PATH` | No (default `/api/v1/`) | `index.js` | Prefijo base donde se monta la API. |
| `MONGO_URI` | Sí (en runtime) | `app/config/mongodb.js` | URI de conexión a MongoDB. |
| `EMAIL_USER` | Depende del entorno | `app/utils/create-auth.js` (invocado desde `index.js`) | Usuario admin inicial (seed). |
| `PASSWORD_USER` | Depende del entorno | `app/utils/create-auth.js` | Password del admin inicial (seed). |
| `JWT_SECRET_KEY` | Sí (en runtime) | `app/controllers/auth.js`, `app/middlewares/authMiddleware.js` | Firmar y verificar JWT. |
| `CLOUD_NAVIS_USERNAME` | Sí (para tasks CloudNavis) | `app/services/apiCloudnavis.js` | Usuario para login en CloudNavis. |
| `CLOUD_NAVIS_PASSWORD` | Sí (para tasks CloudNavis) | `app/services/apiCloudnavis.js` | Password para login en CloudNavis. |
| `CLOUD_NAVIS_URL` | Sí (para tasks CloudNavis) | `app/services/apiCloudnavis.js` | Base URL de CloudNavis. |
| `CLOUD_SECRET_KEY` | Sí (para cifrado) | `app/utils/cipher.js`, `app/schemas/messageLog.js` | Key (hex) para cifrar/descifrar datos sensibles. |
| `CLOUD_SECRET_IV` | Sí (para cifrado) | `app/utils/cipher.js` | IV (hex) para cifrar/descifrar datos sensibles. |
| `API_URL` | Recomendado | `app/services/apiCloudnavis.js`, `app/services/redis-messages.js` | URL pública base del backend para construir links a PDFs/medias. |
| `MONTHS_SEARCH` | No (default `1`) | `app/tasks/processInvoicesTask.js`, `app/tasks/processPayRollsTask.js` | Cuántos meses hacia atrás procesar (0..12). |
| `TELEGRAM_APP_ID` | Recomendado | `app/services/sendMessageTelegram.js` | Chat ID destino para alertas. |
| `TELEGRAM_TOKEN_SECRET` | Recomendado | `app/services/sendMessageTelegram.js` | Token del bot de Telegram. |
| `TWILIO_ACCOUNT_SID` | Sí (si se envía por Twilio) | `app/services/twilioService.js` | Credenciales de Twilio. |
| `TWILIO_AUTH_TOKEN` | Sí (si se envía por Twilio) | `app/services/twilioService.js` | Credenciales de Twilio. |
| `TWILIO_WHATSAPP_NUMBER` | Sí (si se envía por Twilio) | `app/services/twilioService.js` | Número emisor de WhatsApp en Twilio. |
| `TWILIO_INVOICE_CONTENT_SID` | Depende de plantillas | `app/services/*template*` | Content SID para plantilla de factura. |
| `TWILIO_PAYROLL_CONTENT_SID` | Depende de plantillas | `app/services/*template*` | Content SID para plantilla de nómina (usuario). |
| `TWILIO_PAYROLL_CONTENT_SID_EMPLOYE` | Depende de plantillas | `app/services/*template*` | Content SID para plantilla de nómina (empleado). |
| `REDIRECT_NUMBER` | Recomendado | `app/controllers/twilioWebhookController.js` | Número admin (sin prefijo país) para flujo de redirección. |
| `REDIRECT_NUMBER_TWO` | Opcional | `app/controllers/twilioContextController.js` / otros | Segundo número de redirección (si aplica al flujo). |
| `CRON_SECRET` | Opcional | `index.js` (endpoints `/api/cron*`) | Secreto para autorizar crons via header `x-cron-secret`. |
| `GOOGLE_API_KEY` | Opcional | `index.js` | API key para Google GenAI (Gemini). |

### 5.2) Ejemplo mínimo de `.env`

```env
NODE_ENV=development
PORT=3001
URL_PATH=/api/v1/
MONGO_URI=mongodb+srv://...
JWT_SECRET_KEY=...

CLOUD_NAVIS_USERNAME=...
CLOUD_NAVIS_PASSWORD=...
CLOUD_NAVIS_URL=https://www.cloudnavis.com

CLOUD_SECRET_KEY=<64-hex-bytes>
CLOUD_SECRET_IV=<32-hex-bytes>

API_URL=http://localhost:3001
MONTHS_SEARCH=1

TELEGRAM_APP_ID=...
TELEGRAM_TOKEN_SECRET=...

TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+...
```

## 6) Notas operativas

- Si se despliega en **Vercel**, normalmente conviene ejecutar tareas por **Vercel Cron** (HTTP) y no depender de `node-cron` interno (por naturaleza serverless).
- Las variables de cifrado (`CLOUD_SECRET_KEY`, `CLOUD_SECRET_IV`) deben ser **hex válidos** y estables: si cambian, no podrás descifrar registros antiguos.

---

## 7) Documentación para Cliente: Funcionamiento de la Aplicación (No técnica)

Esta sección explica de forma clara y sencilla el funcionamiento de la aplicación, sin entrar en detalles técnicos.

### 7.1) Configuración del Sistema (archivo: `enviroments.js`)

- **¿Qué es?** Este componente contiene todas las configuraciones necesarias para que la aplicación funcione correctamente, como claves secretas, parámetros de conexión y otros ajustes esenciales.
- **Función principal:** Garantiza que la aplicación se conecte a los servicios externos (como bases de datos y proveedores de mensajería) y defina la URL base de los servicios que se ofrecen.

### 7.2) Registro y Seguimiento de Mensajes (archivo: `messageLog.js`)

- **¿Qué es?** Es un registro que guarda cada mensaje que se envía desde la aplicación, ya sea una notificación, factura o aviso de nómina.
- **Función principal:** Permite saber si un mensaje se envió correctamente, falló o está pendiente, y almacena detalles importantes como el destinatario, fecha de envío, y en caso de error, el motivo.
- **Seguridad:** Utiliza procesos de cifrado para proteger la información sensible de los mensajes.

### 7.3) Procesamiento de Facturas (archivo: `processInvoicesTask.js`)

- **¿Qué es?** Esta tarea se encarga de recopilar y procesar la información de las facturas de forma automática desde la API de CloudNavis.
- **Función principal:** Organiza, valida y envía las facturas a través de los canales configurados, garantizando que la información se maneje de manera correcta y completa.
- **Búsqueda de múltiples meses:** La variable `MONTHS_SEARCH` controla cuántos meses se procesan:
  - **0**: Solo el mes actual
  - **1**: Mes actual + mes anterior (valor por defecto)
  - **N**: Mes actual + (N-1) meses anteriores
- **Validaciones:** Verifica que la factura tenga estado "PENDING", que los campos requeridos (firma, codigoQr, codigoIdentificativo) no estén vacíos o pendientes, y que el teléfono del destinatario sea válido.

### 7.4) Procesamiento de Nóminas (archivo: `processPayRollsTask.js`)

- **¿Qué es?** Es la tarea encargada de gestionar la información relacionada con las nóminas (liquidaciones de pago) desde la API de CloudNavis.
- **Función principal:** Verifica que los períodos de nómina sean completos y correctos, se encarga de obtener información de usuarios y empleados, y registra el resultado final de cada envío.
- **Búsqueda de múltiples meses:** La variable `MONTHS_SEARCH` controla cuántos meses se procesan:
  - **0**: Solo el mes actual
  - **1**: Mes actual + mes anterior (valor por defecto)
  - **N**: Mes actual + (N-1) meses anteriores
- **Reintentos:** En caso de encontrar problemas, se reintenta el proceso para asegurar que la nómina se procese correctamente.
- **Validaciones:** Verifica que la nómina tenga estado "PENDING", que el período sea un mes completo (día 1 al último día), que los IDs de empleador y empleado sean válidos, y que los teléfonos sean válidos.

### 7.5) Gestión de Mensajes en Lotes (archivo: `redis-messages.js`)

- **¿Qué es?** Este servicio administra la cola de mensajes que se deben enviar por WhatsApp.
- **Función principal:** Agrupa y envía los mensajes en lotes, introduciendo pausas entre ellos para evitar la saturación o que se consideren como spam.
- **Seguimiento:** Después de cada envío, actualiza el estado del mensaje (éxito o fallo) en el registro de mensajes.

### 7.6) Gestión de Eventos y Notificaciones (archivo: `twilioWebhookController.js`)

- **¿Qué es?** Es el controlador que recibe las notificaciones de los servicios de mensajería (como Twilio) cuando se produce un evento, por ejemplo, al recibir una respuesta o confirmación de envío.
- **Función principal:** Procesa la información recibida y genera notificaciones automáticas hacia otros canales, como Telegram o nuevamente vía WhatsApp, para mantener informado al equipo o usuario final.

### 7.7) Paso a Paso: Instalación y Puesta en Marcha

1. **Clonación del Repositorio:**
   - Abre una terminal y usa el comando:
     ```bash
     git clone https://github.com/gescuidoplus-collab/Backend-SMS
     ```
   - Navega al directorio del proyecto:
     ```bash
     cd BackendSMS
     ```

2. **Instalación de Dependencias:**
   - Ejecuta el comando para instalar las dependencias:
     ```bash
     npm install
     ```

3. **Configuración del Archivo de Entorno:**
   - Crea un archivo `.env` en la raíz del proyecto.
   - Copia el contenido del ejemplo provisto en la sección de variables de entorno y personalízalo con tus credenciales y parámetros.

4. **Ejecución en Desarrollo o Producción:**
   - Para iniciar en modo desarrollo (con recarga automática):
     ```bash
     npm run start:dev
     ```
   - Para iniciar en modo producción:
     ```bash
     npm run start:prod
     ```

5. **Verificación y Pruebas:**
   - Accede a `http://localhost:PORT/api/v1/healtcheck` (reemplaza PORT por el valor configurado) para confirmar que el servidor está funcionando.

---

### 7.8) Diagrama de Funcionamiento

A continuación, se presenta el diagrama visual del flujo principal de la aplicación:

![Diagrama de Funcionamiento](./public/images/diagrama_funcionamiento.png)

### 7.9) Gestión de Errores

La aplicación incorpora mecanismos robustos para el manejo y registro de errores, asegurando que cualquier incidencia durante el flujo de trabajo sea documentada y notificada.

- **Registro Detallado:**
  - Cada proceso (envío de mensaje, procesamiento de nómina o factura) registra en el sistema un estado que puede ser `success`, `failure` o `pending`.
  - En caso de error, se almacena el motivo en el registro del mensaje, permitiendo un rastreo post-mortem de la incidencia.

- **Notificación en Tiempo Real:**
  - Los errores críticos y fallos en el envío de mensajes son enviados a través de Telegram, notificando de inmediato al equipo responsable.
  - Los logs de error incluyen información básica del contexto (número de destino, tipo de mensaje, etc.) para facilitar la identificación del problema.

- **Reintentos Automáticos:**
  - Para procesos críticos como el procesamiento de nóminas o inicio de sesión en servicios externos, se implementan mecanismos de reintentos automáticos que intentan ejecutar la tarea nuevamente antes de confirmar el fallo.

- **Manejo Centralizado:**
  - Todos los módulos cuentan con bloques `try/catch` que capturan y manejan excepciones de manera local, dirigiendo los errores a un sistema centralizado que facilita la monitorización y la respuesta rápida.

---

### 7.10) Flujo General de la Aplicación

1. **Inicio y Configuración:** Al iniciar, la aplicación carga todas las configuraciones necesarias (por ejemplo, credenciales y parámetros de red) definidas en el archivo de configuración.

2. **Procesamiento de Datos:** Dependiendo de la tarea, la aplicación procesa las facturas o nóminas, validando toda la información necesaria para asegurar su integridad.

3. **Envío de Mensajes:** Una vez procesados los datos, se crean mensajes que se envían a través de WhatsApp. Este envío se realiza en lotes para evitar problemas de spam.

4. **Registro y Seguimiento:** Cada mensaje enviado se registra en el sistema para poder consultarlo después y ver el estado de cada operación.

5. **Recepción de Notificaciones:** La aplicación escucha las notificaciones de Twilio. Cuando se reciben, se reenvían a otros servicios (como Telegram) para alertar sobre el estado o problemas en tiempo real.

---

### 7.11) Configuración de Búsqueda de Múltiples Meses (`MONTHS_SEARCH`)

#### ¿Qué es `MONTHS_SEARCH`?

`MONTHS_SEARCH` es una variable de configuración que controla cuántos meses se procesan en las tareas de facturas y nóminas. Esto es útil cuando necesitas recuperar documentos de meses anteriores que no fueron procesados correctamente.

#### Valores y Comportamiento

| Valor | Descripción | Ejemplo (Hoy: 15 Nov) |
|-------|-------------|----------------------|
| **0** | Solo el mes actual | Procesa: Noviembre |
| **1** | Mes actual + 1 mes anterior | Procesa: Noviembre, Octubre |
| **2** | Mes actual + 2 meses anteriores | Procesa: Noviembre, Octubre, Septiembre |
| **3** | Mes actual + 3 meses anteriores | Procesa: Noviembre, Octubre, Septiembre, Agosto |
| **N** | Mes actual + (N-1) meses anteriores | Procesa: Mes actual + N-1 meses atrás |

#### Casos de Uso

1. **Recuperación de documentos perdidos:** Si un cron job falló en octubre, puedes establecer `MONTHS_SEARCH=3` para procesar octubre junto con los meses actuales.

2. **Procesamiento inicial:** Al desplegar por primera vez, establece un valor alto para procesar meses anteriores.

3. **Operación normal:** Mantén `MONTHS_SEARCH=1` para procesar solo el mes actual y el anterior (valor por defecto).

#### Cómo Funciona Internamente

1. La tarea obtiene el mes y año actual.
2. Calcula los meses a procesar según `MONTHS_SEARCH`.
3. Para cada mes, realiza una llamada a la API de CloudNavis.
4. Procesa todas las facturas/nóminas encontradas.
5. Registra cada documento en la base de datos.

#### Ejemplo de Ejecución

Si hoy es **15 de noviembre de 2025** y `MONTHS_SEARCH=3`:

```
Meses a buscar en Facturas (MONTHS_SEARCH=3): 2025-11, 2025-10, 2025-09
Procesando facturas del mes: 2025-11
  → Encontradas 5 facturas
Procesando facturas del mes: 2025-10
  → Encontradas 3 facturas
Procesando facturas del mes: 2025-09
  → Encontradas 2 facturas
Total procesadas: 10 facturas
```

#### Recomendaciones

- **Desarrollo:** Usa `MONTHS_SEARCH=1` para pruebas rápidas.
- **Producción:** Mantén `MONTHS_SEARCH=1` para operación normal.
- **Recuperación:** Aumenta temporalmente si necesitas procesar meses anteriores, luego vuelve a `1`.
- **Máximo recomendado:** No excedas `MONTHS_SEARCH=12` para evitar sobrecarga de la API.

---

### 7.12) Conclusión

La aplicación está diseñada para automatizar el envío y seguimiento de notificaciones y documentos (facturas y nóminas) a través de servicios de mensajería. Gracias a su arquitectura modular, cada componente se encarga de una función específica, permitiendo un manejo eficiente y seguro de la información, garantizando que tanto los mensajes como los documentos se envíen correctamente y se registre cualquier incidencia para su monitoreo.

La configuración flexible mediante `MONTHS_SEARCH` permite adaptarse a diferentes escenarios operativos, desde recuperación de datos hasta procesamiento rutinario.

Esta documentación ofrece una visión general y no técnica del funcionamiento del sistema, para que cualquier usuario o cliente pueda entender el proceso sin necesitar conocimientos especializados en tecnología.
