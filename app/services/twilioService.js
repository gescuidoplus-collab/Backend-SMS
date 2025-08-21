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
    console.log(envConfig.twilioWhatsappNumber)
    console.log(to)
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

export default {
  sendWhatsAppMessage,
  sendWhatsAppPDF,
  sendWhatsAppMessageWithPDF
};
