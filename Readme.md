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

- Autenticación y autorización mediante JWT.
- Gestión de recursos a través de una API RESTful bajo la ruta `/api/v1/`.
- Seguridad mejorada con Helmet y limitación de peticiones.
- Validación de datos de entrada.
- Notificaciones a través de Twilio (WhatsApp).
- Integración con servicios externos como CloudNavis.
- Generación de reportes en PDF y códigos QR.

---

## Construido Con

Este proyecto fue desarrollado utilizando las siguientes tecnologías principales:

- Node.js
- Express.js
- Mongoose
- JSON Web Token (JWT)
- Twilio
- Axios

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

Crea un archivo `.env` en la raíz del proyecto y pega el siguiente contenido, ajustando los valores según tus necesidades.

```env
# Configuración del Servidor
NODE_ENV=development
PORT=3000
URL_PATH="/api/v1/"

# Base de Datos MongoDB
MONGO_URI=""

# Credenciales de Usuario Administrador por defecto
EMAIL_USER=
PASSWORD_USER=

# Autenticación JWT
JWT_SECRET_KEY=

# Servicio Externo: CloudNavis
CLOUD_NAVIS_USERNAME=
CLOUD_NAVIS_PASSWORD=
CLOUD_NAVIS_URL=
CLOUD_SECRET_KEY=
CLOUD_SECRET_IV=

# Servicio de Mensajería: Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=
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

## 📧 Contacto

lm5708144@gmail.com
