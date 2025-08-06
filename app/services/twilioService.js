import twilio from "twilio";
import { envConfig } from "../config/index.js";
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

    // console.log(`Mensaje enviado exitosamente: ${result.sid}`);
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

     // console.log(`PDF enviado exitosamente: ${result.sid}`);
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

    // console.log(`Mensaje con PDF enviado exitosamente: ${result.sid}`);
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
 * Validar y formatear número de teléfono para WhatsApp
 * @param {string} phoneNumber - Número de teléfono
 * @returns {string} Número formateado para WhatsApp
 */
export const formatWhatsAppNumber = (phoneNumber) => {
  // Usando template literals y operador ternario
  const isWhatsAppFormat = phoneNumber.startsWith("whatsapp:");
  const hasPlus = phoneNumber.startsWith("+");

  return isWhatsAppFormat
    ? phoneNumber
    : hasPlus
    ? `whatsapp:${phoneNumber}`
    : `whatsapp:+57${phoneNumber}`;
};

/**
 * Enviar mensaje masivo a múltiples destinatarios
 * @param {Array<string>} phoneNumbers - Array de números de teléfono
 * @param {string} message - Mensaje a enviar
 * @returns {Promise<Array>} Array con resultados de envío
 */
export const sendBulkWhatsAppMessages = async (phoneNumbers, message) => {
  // Usando Promise.all con async/await y map
  const results = await Promise.all(
    phoneNumbers.map(async (number) => {
      const formattedNumber = formatWhatsAppNumber(number);
      return await sendWhatsAppMessage(formattedNumber, message);
    })
  );

  return results;
};

// Exportación por defecto con todas las funciones
export default {
  sendWhatsAppMessage,
  sendWhatsAppPDF,
  sendWhatsAppMessageWithPDF,
  formatWhatsAppNumber,
  sendBulkWhatsAppMessages,
};
