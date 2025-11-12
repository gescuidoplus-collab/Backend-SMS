import twilio from "twilio";
import { envConfig } from "../config/index.js";
import { formatWhatsAppNumber } from "../utils/formatWhatsAppNumber.js";
import { getInvoiceTemplateSid, getTemplateFromTwilio, replaceTemplateVariables } from "../config/twilioTemplates.js";

console.log("\n sendInvoceTemplate:")
console.log(envConfig.twilioAccountSid)
console.log(envConfig.twilioAuthToken)

const client = twilio(envConfig.twilioAccountSid, envConfig.twilioAuthToken);

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
  const { mes, numero, total, fechaExpedicion } = data || {};
  
  // Obtener el Content SID dinámicamente según el mes
  const contentSid = getInvoiceTemplateSid(mes);
  
  if (!contentSid) {
    console.error(`No se encontró plantilla de factura para el mes: ${mes}`);
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
      console.log("Twilio Invoice ContentSid:", contentSid);
      console.log("Twilio Invoice ContentVars:", vars);
      console.log("Twilio Invoice mediaUrl:", mediaUrl);
    }
    
    // console.log(toWhatsApp)
    // console.log(envConfig.twilioWhatsappNumber)
    const result = await client.messages.create({
      from: envConfig.twilioWhatsappNumber,
      to: "whatsapp:+584247285815", // toWhatsApp,
      contentSid: contentSid,
      contentVariables: JSON.stringify(vars),
      mediaUrl: [mediaUrl],
    });
    
    // Obtener el contenido de la plantilla desde Twilio API para guardar en MessageLog
    const rawTemplateContent = await getTemplateFromTwilio(contentSid, client);
    const templateContent = rawTemplateContent ? replaceTemplateVariables(rawTemplateContent, vars) : null;
    
    return { success: true, messageId: result.sid, status: result.status, templateContent, contentSid };
  } catch (err) {
    console.error(
      "Error al enviar factura por WhatsApp:",
      err.message,
      { to: toWhatsApp, contentSid: contentSid, mes: mes }
    );
    return { success: false, error: err.message };
  }
};
