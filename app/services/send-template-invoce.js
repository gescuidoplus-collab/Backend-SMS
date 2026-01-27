import twilio from "twilio";
import { envConfig, logger } from "../config/index.js";
import { formatWhatsAppNumber } from "../utils/formatWhatsAppNumber.js";
import { getInvoiceTemplateSid, getTemplateFromTwilio, getTemplateContent, replaceTemplateVariables } from "../config/twilioTemplates.js";

/**
 * Enviar plantilla de WhatsApp (Factura) con media.
 * Usa Content API si hay plantilla (contentSid) disponible; de lo contrario,
 * envía un mensaje con media y un texto de respaldo.
 * @param {string} to - Número del destinatario (E.164 o con prefijo whatsapp:)
 * @param {string} name - Nombre del destinatario para variables de plantilla
 * @param {string} mediaUrl - URL pública de la media (PDF/imagen)
 * @param {object} data - Datos adicionales para la plantilla
 */
export const sendInvoceTemplate = async (to, name, mediaUrl, data) => {
  // Inicializar cliente Twilio dentro de la función para asegurar que las credenciales estén cargadas
  const client = twilio(envConfig.twilioAccountSid, envConfig.twilioAuthToken);
  const { mes, numero, total, fechaExpedicion } = data || {};
  
  // Obtener el Content SID dinámicamente según el mes
  const contentSid = getInvoiceTemplateSid(mes);
  
  if (!contentSid) {
    logger.error({ mes }, "No se encontró plantilla de factura para el mes");
    return { 
      success: false, 
      error: `No hay plantilla configurada para el mes ${mes}` 
    };
  }

  // Convertir mes numérico a nombre en español y capitalizar
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
  let monthName = typeof mes === "string" ? mes : "";
  if (Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12) {
    monthName = monthNames[monthNumber - 1];
  }
  // Capitalizar primera letra (p.e. Septiembre)
  monthName = monthName
    ? monthName.charAt(0).toUpperCase() + monthName.slice(1)
    : "";

  // Normalizar valores a string y formatos esperados por la plantilla
  const safeName = String(name ?? "");

  if (to === undefined || to === null || String(to).trim() === "") {
    return { success: false, error: "Número de destino 'to' no proporcionado" };
  }

  const toWhatsApp = formatWhatsAppNumber(to);
  try {
    // Solo enviar variables 1 (nombre)
    const vars = {
      1: safeName,
      2 : mediaUrl
    };
    
    // Log de debug acotado
    if (process.env.NODE_ENV !== "production") {
      logger.debug({ contentSid, vars, mediaUrl }, "Twilio Invoice debug");
    }
    
    // Si TWILIO_ENVIROMENT es DUMMY, solo loguear y no enviar
    if (envConfig.twilioEnviroment === 'DUMMY') {
      logger.info({ from: envConfig.twilioWhatsappNumber, to: toWhatsApp, contentSid, vars, mediaUrl }, "TWILIO DUMMY MODE (Invoice)");
      return { success: true, messageId: 'DUMMY_MODE', status: 'dummy', templateContent: null, contentSid };
    }
    const result = await client.messages.create({
      from: envConfig.twilioWhatsappNumber,
      to: toWhatsApp,
      contentSid: contentSid,
      contentVariables: JSON.stringify(vars),
      mediaUrl: [mediaUrl],
    });
    
    // Obtener el contenido de la plantilla desde Twilio API para guardar en MessageLog
    // Si falla, usar el mapeo local como fallback
    let rawTemplateContent = await getTemplateFromTwilio(contentSid, client);
    if (!rawTemplateContent) {
      rawTemplateContent = getTemplateContent(contentSid);
    }
    const templateContent = rawTemplateContent ? replaceTemplateVariables(rawTemplateContent, vars) : null;
    
    return { success: true, messageId: result.sid, status: result.status, templateContent, contentSid };
  } catch (err) {
    logger.error({ err, to: toWhatsApp, contentSid, mes }, "Error al enviar factura por WhatsApp");
    return { success: false, error: err.message };
  }
};
