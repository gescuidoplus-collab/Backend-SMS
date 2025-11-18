# Cuido-Fam

Backend para la aplicación Cuido-Fam, un servicio robusto. Este proyecto proporciona una API RESTful para manejar datos, autenticación de usuarios y más.

---

## 📖 Tabla de Contenidos

- [Sobre el Proyecto](#sobre-el-proyecto)
- [Construido Con](#construido-con)
- [🚀 Empezando](#-empezando)
- [Pre-requisitos](#pre-requisitos)
- [Instalación](#instalación)
- [🛠️ Uso](#️-uso)
- [📜 Scripts Disponibles](#-scripts-disponibles)
- [🔑 Variables de Entorno](#-variables-de-entorno)
- [🤝 Contribuciones](#-contribuciones)
- [📄 Licencia](#-licencia)
- [📧 Contacto](#-contacto)

---

## Sobre el Proyecto

Este repositorio contiene el código fuente del servidor backend para Cuido-Fam. El servidor está construido con Node.js y Express, y utiliza MongoDB como base de datos. Entre sus funcionalidades se incluyen:

- **Cron Jobs**: 
  - Un cron job se ejecuta el primer día de cada mes a las 9:00 AM, recopila información de una API externa y la almacena en MongoDB.
  - Otro cron job encola mensajes que son enviados a través de Twilio a WhatsApp de los clientes.
- **Notificaciones**:
  - Se utiliza Redis con la técnica pub/sub para la gestión de eventos y notificaciones internas.
  - Se integra con la API de Telegram para enviar mensajes a un bot cuando se ejecutan los cron jobs y si ocurre algún fallo.
- **API RESTful** bajo la ruta `/api/v1/`.
- **Autenticación y autorización** mediante JWT.
- **Seguridad** mejorada con Helmet y limitación de peticiones.
- **Validación de datos** de entrada.
- **Integración con servicios externos** como CloudNavis.
- **Generación de reportes** en PDF y códigos QR.

---

## Construido Con

Este proyecto fue desarrollado utilizando las siguientes tecnologías principales:

- Node.js
- Express.js
- Mongoose
- JSON Web Token (JWT)
- Twilio
- Axios
- Redis (ioredis)
- Telegram Bot API
- Nodemon (desarrollo)
- Helmet, Express-rate-limit, Express-validator

---

## 🚀 Empezando

Sigue estos pasos para obtener una copia local del proyecto y ponerla en funcionamiento.

### Pre-requisitos

Asegúrate de tener instalado el siguiente software en tu máquina:

- **Node.js**: Se requiere la versión `v23.5.0` o superior.

  ```bash
  node -v
  ```

- **npm** (normalmente se instala con Node.js):

  ```bash
  npm -v
  ```

- **MongoDB**: Una instancia de base de datos MongoDB en ejecución.

---

### Instalación

1. **Clona el repositorio**

    ```bash
    git clone https://github.com/Walls-Team/BackendSMS
    ```

2. **Navega al directorio del proyecto**

    ```bash
    cd BackendSMS
    ```

3. **Instala las dependencias**

    ```bash
    npm install
    ```

4. **Crea y configura el archivo de entorno**

    Crea un archivo llamado `.env` en la raíz del proyecto y copia el contenido de la sección [Variables de Entorno](#-variables-de-entorno).

---

## 🛠️ Uso

Una vez completada la instalación, puedes ejecutar la aplicación en modo de desarrollo o producción.

- Para iniciar el servidor en modo de desarrollo (con recarga automática):

    ```bash
    npm run start:dev
    ```

- Para iniciar el servidor en modo de producción:

    ```bash
    npm run start:prod
    ```

El servidor estará disponible en `http://localhost:PORT`, donde `PORT` es el valor que definiste en tu archivo `.env`. Los endpoints de la API estarán disponibles bajo la ruta `/api/v1/`.

---

## 📜 Scripts Disponibles

En el archivo `package.json`, encontrarás los siguientes scripts:

- **start:dev**: Inicia la aplicación usando nodemon, que reinicia automáticamente el servidor cada vez que detecta un cambio en los archivos. Ideal para el desarrollo.
- **start:prod**: Inicia la aplicación usando node. Este es el comando recomendado para un entorno de producción.

---

## 🔑 Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto y configura las siguientes variables:

| Variable                  | Descripción                                                                 |
|---------------------------|-----------------------------------------------------------------------------|
| NODE_ENV                  | Entorno de ejecución (`development` o `production`).                        |
| PORT                      | Puerto en el que se ejecuta el servidor.                                    |
| URL_PATH                  | Ruta base para la API (ej: `/api/v1/`).                                     |
| MONGO_URI                 | URI de conexión a la base de datos MongoDB.                                 |
| EMAIL_USER                | Email del usuario administrador por defecto.                                |
| PASSWORD_USER             | Contraseña del usuario administrador por defecto.                           |
| JWT_SECRET_KEY            | Clave secreta para la firma de JWT.                                         |
| CLOUD_NAVIS_USERNAME      | Usuario para el servicio externo CloudNavis.                                |
| CLOUD_NAVIS_PASSWORD      | Contraseña para CloudNavis.                                                 |
| CLOUD_NAVIS_URL           | URL del servicio CloudNavis.                                                |
| CLOUD_SECRET_KEY          | Clave secreta para cifrado de CloudNavis.                                   |
| CLOUD_SECRET_IV           | Vector de inicialización para cifrado de CloudNavis.                        |
| TWILIO_ACCOUNT_SID        | SID de la cuenta de Twilio para envío de mensajes.                          |
| TWILIO_AUTH_TOKEN         | Token de autenticación de Twilio.                                           |
| TWILIO_WHATSAPP_NUMBER    | Número de WhatsApp habilitado en Twilio.                                    |
| TELEGRAM_APP_ID           | ID de la aplicación de Telegram para el bot de notificaciones.              |
| TELEGRAM_TOKEN_SECRET     | Token secreto del bot de Telegram.                                          |
| MONTHS_SEARCH             | Cantidad de meses a buscar en las tasks (0-12). Ver detalles abajo.          |

### Detalles de MONTHS_SEARCH

La variable `MONTHS_SEARCH` controla cuántos meses se procesan en las tasks de facturas y nóminas:

- **0**: Solo el mes actual
- **1**: Mes actual + mes anterior (2 meses total) - **Valor por defecto**
- **2**: Mes actual + 2 meses anteriores (3 meses total)
- **3**: Mes actual + 3 meses anteriores (4 meses total)
- **N**: Mes actual + (N-1) meses anteriores

**Ejemplo:**
- Si hoy es 15 de noviembre (mes 11) y `MONTHS_SEARCH=3`:
  - Se procesarán facturas/nóminas de: noviembre (11), octubre (10), septiembre (09)

Ejemplo de archivo `.env`:

```env
NODE_ENV=development
PORT=3000
URL_PATH="/api/v1/"
MONGO_URI=
EMAIL_USER=
PASSWORD_USER=
JWT_SECRET_KEY=
CLOUD_NAVIS_USERNAME=
CLOUD_NAVIS_PASSWORD=
CLOUD_NAVIS_URL=
CLOUD_SECRET_KEY=
CLOUD_SECRET_IV=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=
TELEGRAM_APP_ID=
TELEGRAM_TOKEN_SECRET=
MONTHS_SEARCH=1
```

---

## 🤝 Contribuciones

Las contribuciones son lo que hace que la comunidad de código abierto sea un lugar increíble para aprender, inspirar y crear. Cualquier contribución que hagas será muy apreciada.

1. Haz un **Fork** del Proyecto.
2. Crea tu **Rama de Característica** (`git checkout -b feature/AmazingFeature`).
3. Confirma tus Cambios (`git commit -m 'Add some AmazingFeature'`).
4. Empuja a la Rama (`git push origin feature/AmazingFeature`).
5. Abre una **Pull Request**.

---

## 📄 Licencia

Este proyecto está distribuido bajo la Licencia ISC.

---
