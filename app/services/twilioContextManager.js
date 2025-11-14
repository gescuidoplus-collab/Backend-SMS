import twilio from "twilio";
import { envConfig } from "../config/index.js";
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
    console.error("Error verificando ventana de contexto:", error);
    return false;
  }
};

/**
 * Inicializa la ventana de contexto para un número
 * Envía una plantilla aprobada para abrir la ventana de 24 horas
 * @param {string} phoneNumber - Número de teléfono
 * @param {string} recipientName - Nombre del destinatario
 * @returns {Promise<Object>} { success: boolean, messageId?: string, error?: string }
 */
export const initializeContextWindow = async (phoneNumber, recipientName = "Usuario" , content= "") => {
  try {
    const formattedNumber = normalizePhoneNumber(phoneNumber);
    
    // Verificar si ya tiene contexto activo
    const hasContext = await hasActiveContextWindow(phoneNumber);
    if (hasContext) {
      console.log(`✅ ${formattedNumber} ya tiene contexto activo`);
      return { success: true, alreadyActive: true };
    }

    // Obtener una plantilla de inicialización (usamos invoice como template genérico)
    const templateSid = getInvoiceTemplateSid();
    if (!templateSid) {
      return { success: false, error: "No hay plantillas disponibles" };
    }

    // Obtener contenido de la plantilla
    const templateContent = getTemplateContent(templateSid);
    if (!templateContent) {
      return { success: false, error: "No se pudo obtener contenido de plantilla" };
    }

    // Reemplazar variables (nombre y mes actual)
    const currentMonth = new Date().toLocaleString("es-ES", { month: "long" });
    const messageContent = replaceTemplateVariables(templateContent, {
      1: recipientName,
      2 : content
    });

    // Enviar plantilla a Twilio
    const client = twilio(envConfig.twilioAccountSid, envConfig.twilioAuthToken);
    
    console.log(`📱 Enviando a: whatsapp:${formattedNumber}`)
    const result = await client.messages.create({
      from: envConfig.twilioWhatsappNumber,
      to: `whatsapp:${formattedNumber}`,
      contentSid: "HX66fee7a590db3a49b3d28bb52c337789",
      contentVariables: JSON.stringify({
        1: recipientName,
        2:`Mensaje de ${formattedNumber} resp : ${content}`
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

    console.log(`✅ Contexto inicializado para ${formattedNumber} (expira en 24h)`);
    
    return {
      success: true,
      messageId: result.sid,
      phoneNumber: formattedNumber,
      expiresAt,
    };
  } catch (error) {
    console.error("Error inicializando contexto:", error);
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

    console.log(`📝 Contexto renovado para ${normalizedNumber}`);
  } catch (error) {
    console.error("Error registrando envío de mensaje:", error);
  }
};

/**
 * Envía un mensaje usando plantilla dentro de la ventana de contexto
 * @param {string} phoneNumber - Número de teléfono
 * @param {string} messageContent - Contenido del mensaje para la variable 1
 * @returns {Promise<Object>} { success: boolean, messageId?: string, error?: string }
 */
export const sendTemplateWithinContextWindow = async (phoneNumber, messageContent = "", content= "") => {
  try {
    const normalizedNumber = normalizePhoneNumber(phoneNumber);
    
    // Obtener una plantilla
    const templateSid = getInvoiceTemplateSid();
    if (!templateSid) {
      return { success: false, error: "No hay plantillas disponibles" };
    }

    // Enviar plantilla a Twilio
    const client = twilio(envConfig.twilioAccountSid, envConfig.twilioAuthToken);
    
    console.log(`📱 Enviando plantilla a: whatsapp:${normalizedNumber}`);

    const result = await client.messages.create({
      from: envConfig.twilioWhatsappNumber,
      to: `whatsapp:${normalizedNumber}`,
      contentSid: "HX66fee7a590db3a49b3d28bb52c337789",
      contentVariables: JSON.stringify({
        1: messageContent || "Respuesta",
        2 : content
      }),
    });

    console.log(`✅ Plantilla enviada exitosamente a ${normalizedNumber}`);
    
    return {
      success: true,
      messageId: result.sid,
      phoneNumber: normalizedNumber,
    };
  } catch (error) {
    console.error("Error enviando plantilla dentro de contexto:", error);
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
    console.log(`🧹 Limpieza: ${result.deletedCount} ventanas de contexto expiradas eliminadas`);
    return result.deletedCount;
  } catch (error) {
    console.error("Error limpiando ventanas expiradas:", error);
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
