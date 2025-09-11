import twilio from "twilio";
import { envConfig } from "../config/index.js";
import { formatWhatsAppNumber } from "../utils/formatWhatsAppNumber.js";
const client = twilio(envConfig.twilioAccountSid, envConfig.twilioAuthToken);

/**
 * Enviar mensaje de WhatsApp
 * @param {string} to - Número de teléfono del destinatario
 * @param {string} message - Texto del mensaje
 * @returns {Promise<Object>} Resultado del envío
 */
export const sendWhatsAppMessage = async (to, message) => {
  try {
    const result = await client.messages.create({
      from: envConfig.twilioWhatsappNumber,
      to,
      body: message,
    });
    return {
      success: true,
      messageId: result.sid,
      status: result.status,
    };
  } catch (error) {
    console.error(`Error al enviar mensaje de WhatsApp: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Enviar archivo PDF por WhatsApp
 * @param {string} to - Número de teléfono del destinatario
 * @param {string} mediaUrl - URL del archivo PDF
 * @param {string} caption - Texto descriptivo opcional
 * @returns {Promise<Object>} Resultado del envío
 */
export const sendWhatsAppPDF = async (to, mediaUrl, caption = "") => {
  try {
    const result = await client.messages.create({
      from: envConfig.twilioWhatsappNumber,
      to,
      body: caption,
      mediaUrl: [mediaUrl],
    });
    return {
      success: true,
      messageId: result.sid,
      status: result.status,
    };
  } catch (error) {
    console.error(`Error al enviar PDF por WhatsApp: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Enviar mensaje con PDF adjunto
 * @param {string} to - Número de teléfono del destinatario
 * @param {string} message - Texto del mensaje
 * @param {string} mediaUrl - URL del archivo PDF
 * @returns {Promise<Object>} Resultado del envío
 */
export const sendWhatsAppMessageWithPDF = async (to, message, mediaUrl) => {
  try {
    const result = await client.messages.create({
      from: envConfig.twilioWhatsappNumber,
      to,
      body: message,
      mediaUrl: [mediaUrl],
    });
    return {
      success: true,
      messageId: result.sid,
      status: result.status,
    };
  } catch (error) {
    console.error(`Error al enviar mensaje con PDF: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Enviar plantilla de WhatsApp (Factura) con media.
 * Usa Content API si hay plantilla (contentSid) disponible; de lo contrario,
 * envía un mensaje con media y un texto de respaldo.
 * @param {string} to - Número del destinatario (E.164 o con prefijo whatsapp:)
 * @param {string} name - Nombre del destinatario para variables de plantilla
 * @param {string} mediaUrl - URL pública de la media (PDF/imagen)
 */
export const sendInvoceTemplate = async (to, name, mediaUrl, data) => {
  debugger;
  const { mes, numero, total, fechaExpedicion } = data || {};
  // Ejemplo de SID de plantilla de Twilio Content (reemplace por el real en producción)
  // Puede configurarse vía variable de entorno para producción: TWILIO_INVOICE_CONTENT_SID
  const contentSidExample =
    envConfig.twilioInvoiceContentSid || "HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // ejemplo

  // Convertir mes numérico a nombre en español
  const monthNumber = parseInt(mes, 10);
  const monthNames = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const monthName =
    Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12
      ? monthNames[monthNumber - 1]
      : String(mes);

  // Asegurar prefijo whatsapp:
  const toWhatsApp = formatWhatsAppNumber(to);
  try {
    if (contentSidExample && contentSidExample.startsWith("HX")) {
      const result = await client.messages.create({
        from: envConfig.twilioWhatsappNumber,
        to: toWhatsApp,
        contentSid: contentSidExample,
        contentVariables: JSON.stringify({
          1: name,
          2: monthName,
          3: numero,
          4: total,
          5: fechaExpedicion,
        }),
        mediaUrl: [mediaUrl],
      });
      return { success: true, messageId: result.sid, status: result.status };
    } else {
      return { success: false, error: "Content SID no configurado" };
    }
  } catch (err) {
    console.warn(
      "Fallo al enviar por Content API, haciendo fallback a media estándar:",
      err.message
    );
    return { success: false, error: err.message };
  }
};

/**
 * Enviar plantilla de WhatsApp (Nómina) con media.
 * Usa Content API si hay plantilla (contentSid) disponible; de lo contrario,
 * envía un mensaje con media y un texto de respaldo.
 * @param {string} to - Número del destinatario (E.164 o con prefijo whatsapp:)
 * @param {string} name - Nombre del destinatario para variables de plantilla
 * @param {string} mediaUrl - URL pública de la media (PDF/imagen)
 */
export const sendInvocePayRool = async (
  to,
  name,
  mediaUrl,
  mes,
  type,
  recipient,
  employe
) => {
  const monthNumber = parseInt(mes, 10);
  const monthNames = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const currentYear = new Date().getFullYear();
  const monthName =
    Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12
      ? `${monthNames[monthNumber - 1]} ${currentYear}`
      : `${String(mes)} ${currentYear}`;

  // Ejemplo de SID de plantilla de Twilio Content (reemplace por el real en producción)
  // Puede configurarse vía variable de entorno para producción: TWILIO_PAYROLL_CONTENT_SID
  let contentSidExample = null;
  let payload = {};
  if (type === "payrollUser") {
    contentSidExample =
      envConfig.twilioPayrollContentSid || "HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // ejemplo
    payload = (() => {
      const firstAndThird = (fullName) => {
        if (!fullName) return "";
        const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
        const first = parts[0] || "";
        const third = parts[2] || "";
        return [first, third].filter(Boolean).join(" ");
      };
      return {
        1: firstAndThird(recipient?.fullName),
        2: firstAndThird(employe?.fullName),
        3: monthName,
      };
    })();
  } else if (type === "payrollEmployee") {
    contentSidExample =
      envConfig.twilioPayrollContentSidEmploye ||
      "HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // ejemplo
    payload = (() => {
      const firstAndThird = (fullName) => {
        if (!fullName) return "";
        const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
        const first = parts[0] || "";
        const third = parts[2] || "";
        return [first, third].filter(Boolean).join(" ");
      };
      return {
        1: firstAndThird(employe?.fullName),
        2: monthName,
      };
    })();
  }
  const toWhatsApp = formatWhatsAppNumber(to);
  try {
    if (contentSidExample && contentSidExample.startsWith("HX")) {
      const result = await client.messages.create({
        from: envConfig.twilioWhatsappNumber,
        to: toWhatsApp,
        contentSid: contentSidExample,
        contentVariables: JSON.stringify(payload),
        mediaUrl: [mediaUrl],
      });
      return { success: true, messageId: result.sid, status: result.status };
    } else {
      return { success: false, error: "Content SID no configurado" };
    }
  } catch (err) {
    console.warn(
      "Fallo al enviar por Content API, haciendo fallback a media estándar:",
      err.message
    );
    return { success: false, error: err.message };
  }
};

export const sendTextForWhatsApp = async (to, name) => {
  try {
    // const numebers = []
    // // Elegir un número aleatorio del array `numebers` y formatearlo para WhatsApp
    // const randomIndex = Math.floor(Math.random() * numebers.length);
    // const randomNumber = numebers[randomIndex];
    // const toWhatsApp = formatWhatsAppNumber(randomNumber);
    // const contentSidExample = envConfig.twilioPayrollContentSid || "HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

    // console.log("Enviando a:", toWhatsApp, "con nombre:", name);
    // console.log("Usando contentSid:", contentSidExample);
    // console.log("Desde número:", envConfig.twilioWhatsappNumber);

    // const result = await client.messages.create({
    //   from: envConfig.twilioWhatsappNumber,
    //   to: toWhatsApp,
    //   contentSid: contentSidExample,
    //   contentVariables: JSON.stringify({
    //     1: name,
    //     2: "Cuido Fam",
    //   }),
    // });
    return { success: true };
    return { success: true, messageId: result.sid, status: result.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default {
  sendWhatsAppMessage,
  sendWhatsAppPDF,
  sendWhatsAppMessageWithPDF,
  sendInvoceTemplate,
  sendInvocePayRool,
  sendTextForWhatsApp,
};
