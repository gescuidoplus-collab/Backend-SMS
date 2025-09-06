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
export const sendInvoceTemplate = async (to, name, mediaUrl) => {
  // Ejemplo de SID de plantilla de Twilio Content (reemplace por el real en producción)
  // Puede configurarse vía variable de entorno para producción: TWILIO_INVOICE_CONTENT_SID
  const contentSidExample = envConfig.twilioInvoiceContentSid || "HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // ejemplo

  // Asegurar prefijo whatsapp:
  const toWhatsApp = formatWhatsAppNumber(to);

  try {
    // Intento con Content API (si el SID de ejemplo no ha sido reemplazado, Twilio lo rechazará)
    if (contentSidExample && !contentSidExample.startsWith("HX")) {
      const result = await client.messages.create({
        from: envConfig.twilioWhatsappNumber,
        to: toWhatsApp,
        contentSid: contentSidExample, // ejemplo de uso de plantilla (Content API)
        // En Content API, las variables deben serializarse a string JSON
        // Ajuste las claves a las variables definidas en su plantilla
        contentVariables: JSON.stringify({
          1: name,
          media_url: mediaUrl,
        }),
      });
      return { success: true, messageId: result.sid, status: result.status };
    }
  } catch (err) {
    console.warn("Fallo al enviar por Content API, haciendo fallback a media estándar:", err.message);
  }

  // Fallback moderno: mensaje con mediaUrl y copy usable
  try {
    const result = await client.messages.create({
      from: envConfig.twilioWhatsappNumber,
      to: toWhatsApp,
      body: `Hola ${name}, aquí tienes tu factura en formato PDF.`,
      mediaUrl: [mediaUrl],
    });
    return { success: true, messageId: result.sid, status: result.status };
  } catch (error) {
    console.error(`Error al enviar plantilla de factura: ${error.message}`);
    return { success: false, error: error.message };
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
export const sendInvocePayRool = async (to, name, mediaUrl) => {
  // Ejemplo de SID de plantilla de Twilio Content (reemplace por el real en producción)
  // Puede configurarse vía variable de entorno para producción: TWILIO_PAYROLL_CONTENT_SID
  const contentSidExample = envConfig.twilioPayrollContentSid || "HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // ejemplo

  const toWhatsApp = formatWhatsAppNumber(to);

  try {
    if (contentSidExample && !contentSidExample.startsWith("HX")) {
      const result = await client.messages.create({
        from: envConfig.twilioWhatsappNumber,
        to: toWhatsApp,
        contentSid: contentSidExample, // ejemplo de uso de plantilla (Content API)
        contentVariables: JSON.stringify({
          1: name,
          media_url: mediaUrl,
        }),
      });
      return { success: true, messageId: result.sid, status: result.status };
    }
  } catch (err) {
    console.warn("Fallo al enviar por Content API, haciendo fallback a media estándar:", err.message);
  }

  try {
    const result = await client.messages.create({
      from: envConfig.twilioWhatsappNumber,
      to: toWhatsApp,
      body: `Hola ${name}, aquí tienes tu comprobante de nómina en PDF.`,
      mediaUrl: [mediaUrl],
    });
    return { success: true, messageId: result.sid, status: result.status };
  } catch (error) {
    console.error(`Error al enviar plantilla de nómina: ${error.message}`);
    return { success: false, error: error.message };
  }
};

export default {
  sendWhatsAppMessage,
  sendWhatsAppPDF,
  sendWhatsAppMessageWithPDF,
  sendInvoceTemplate,
  sendInvocePayRool,
};
