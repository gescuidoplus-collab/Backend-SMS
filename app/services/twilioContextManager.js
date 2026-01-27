import twilio from "twilio";
import { envConfig, logger } from "../config/index.js";
import TwilioContextWindow from "../schemas/twilioContextWindow.js";
import { formatWhatsAppNumber } from "../utils/formatWhatsAppNumber.js";
import { getInvoiceTemplateSid, getTemplateContent, replaceTemplateVariables } from "../config/twilioTemplates.js";

/**
 * Normaliza un número de teléfono a formato limpio (+XX...)
 * @param {string} phoneNumber - Número en cualquier formato
 * @returns {string} Número limpio con + al inicio
 */
const normalizePhoneNumber = (phoneNumber) => {
  let clean = phoneNumber;
  
  // Remover prefijo whatsapp: si existe
  if (clean.startsWith("whatsapp:")) {
    clean = clean.replace("whatsapp:", "");
  }
  
  // Asegurar que tenga + al inicio
  if (!clean.startsWith("+")) {
    clean = `+${clean}`;
  }
  
  return clean;
};

/**
 * Verifica si un número tiene ventana de contexto activa
 * @param {string} phoneNumber - Número de teléfono
 * @returns {Promise<boolean>} true si tiene contexto activo
 */
export const hasActiveContextWindow = async (phoneNumber) => {
  try {
    const normalizedNumber = normalizePhoneNumber(phoneNumber);
    
    const contextWindow = await TwilioContextWindow.findOne({
      phoneNumber: normalizedNumber,
      status: "active",
      expiresAt: { $gt: new Date() },
    });

    return !!contextWindow;
  } catch (error) {
    logger.error({ err: error }, "Error verificando ventana de contexto");
    return false;
  }
};

/**
 * Inicializa la ventana de contexto para un número
 * Envía una plantilla aprobada para abrir la ventana de 24 horas
 * @param {string} phoneNumber - Número de teléfono del destinatario
 * @param {string} senderName - Nombre del usuario que envió el mensaje original
 * @param {string} senderPhone - Teléfono del usuario que envió el mensaje original
 * @param {string} messageBody - Contenido del mensaje recibido
 * @returns {Promise<Object>} { success: boolean, messageId?: string, error?: string }
 */
export const initializeContextWindow = async (phoneNumber, senderName = "Usuario", senderPhone = "", messageBody = "") => {
  try {
    const formattedNumber = normalizePhoneNumber(phoneNumber);
    
    // Verificar si ya tiene contexto activo
    const hasContext = await hasActiveContextWindow(phoneNumber);
    if (hasContext) {
      logger.info({ phoneNumber: formattedNumber }, "Ya tiene contexto activo");
      return { success: true, alreadyActive: true };
    }

    // Obtener una plantilla de inicialización (usamos invoice como template genérico)
    const templateSid = getInvoiceTemplateSid();
    if (!templateSid) {
      return { success: false, error: "No hay plantillas disponibles" };
    }

    // Enviar plantilla a Twilio con 3 variables:
    // 1: Nombre del usuario que respondió
    // 2: Teléfono del usuario que respondió
    // 3: Mensaje que envió el usuario
    const client = twilio(envConfig.twilioAccountSid, envConfig.twilioAuthToken);
    
    logger.info({ to: `whatsapp:${formattedNumber}` }, "Enviando plantilla");
    const result = await client.messages.create({
      from: envConfig.twilioWhatsappNumber,
      to: `whatsapp:${formattedNumber}`,
      contentSid: "HX54ea2b37cc6d7fac373dfb1384e88a85",
      contentVariables: JSON.stringify({
        1: senderName || "Desconocido",
        2: senderPhone || "Sin número",
        3: messageBody || "Sin contenido"
      }),
    });

    // Registrar la inicialización en DB
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await TwilioContextWindow.findOneAndUpdate(
      { phoneNumber: formattedNumber },
      {
        phoneNumber: formattedNumber,
        initializedAt: now,
        expiresAt,
        templateSid,
        messageType: "initialization",
        status: "active",
      },
      { upsert: true, new: true }
    );

    logger.info({ phoneNumber: formattedNumber, expiresAt }, "Contexto inicializado (expira en 24h)");
    
    return {
      success: true,
      messageId: result.sid,
      phoneNumber: formattedNumber,
      expiresAt,
    };
  } catch (error) {
    logger.error({ err: error }, "Error inicializando contexto");
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Registra que se envió un mensaje (renueva la ventana de contexto)
 * @param {string} phoneNumber - Número de teléfono
 * @param {string} messageType - Tipo de mensaje (invoice, payroll, etc)
 * @param {string} templateSid - Content SID usado
 * @returns {Promise<void>}
 */
export const recordMessageSent = async (phoneNumber, messageType = "message", templateSid = null) => {
  try {
    const normalizedNumber = normalizePhoneNumber(phoneNumber);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await TwilioContextWindow.findOneAndUpdate(
      { phoneNumber: normalizedNumber },
      {
        phoneNumber: normalizedNumber,
        initializedAt: now,
        expiresAt,
        templateSid: templateSid || undefined,
        messageType,
        status: "active",
      },
      { upsert: true, new: true }
    );

    logger.info({ phoneNumber: normalizedNumber }, "Contexto renovado");
  } catch (error) {
    logger.error({ err: error }, "Error registrando envío de mensaje");
  }
};

/**
 * Envía un mensaje usando plantilla dentro de la ventana de contexto
 * @param {string} phoneNumber - Número de teléfono del destinatario
 * @param {string} senderName - Nombre del usuario que envió el mensaje original
 * @param {string} senderPhone - Teléfono del usuario que envió el mensaje original
 * @param {string} messageBody - Contenido del mensaje recibido
 * @returns {Promise<Object>} { success: boolean, messageId?: string, error?: string }
 */
export const sendTemplateWithinContextWindow = async (phoneNumber, senderName = "", senderPhone = "", messageBody = "") => {
  try {
    const normalizedNumber = normalizePhoneNumber(phoneNumber);
    
    // Obtener una plantilla
    const templateSid = getInvoiceTemplateSid();
    if (!templateSid) {
      return { success: false, error: "No hay plantillas disponibles" };
    }

    // Enviar plantilla a Twilio con 3 variables
    const client = twilio(envConfig.twilioAccountSid, envConfig.twilioAuthToken);
    
    logger.info({ to: `whatsapp:${normalizedNumber}` }, "Enviando plantilla dentro de contexto");

    const result = await client.messages.create({
      from: envConfig.twilioWhatsappNumber,
      to: `whatsapp:${normalizedNumber}`,
      contentSid: "HX54ea2b37cc6d7fac373dfb1384e88a85",
      contentVariables: JSON.stringify({
        1: senderName || "Desconocido",
        2: senderPhone || "Sin número",
        3: messageBody || "Sin contenido"
      }),
    });

    logger.info({ phoneNumber: normalizedNumber }, "Plantilla enviada exitosamente");
    
    return {
      success: true,
      messageId: result.sid,
      phoneNumber: normalizedNumber,
    };
  } catch (error) {
    logger.error({ err: error }, "Error enviando plantilla dentro de contexto");
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Limpia registros expirados de la BD
 * @returns {Promise<number>} Cantidad de registros eliminados
 */
export const cleanupExpiredContextWindows = async () => {
  try {
    const result = await TwilioContextWindow.deleteMany({
      expiresAt: { $lt: new Date() },
    });
    logger.info({ deletedCount: result.deletedCount }, "Limpieza de ventanas de contexto expiradas");
    return result.deletedCount;
  } catch (error) {
    logger.error({ err: error }, "Error limpiando ventanas expiradas");
    return 0;
  }
};

export default {
  hasActiveContextWindow,
  initializeContextWindow,
  recordMessageSent,
  sendTemplateWithinContextWindow,
  cleanupExpiredContextWindows,
};
