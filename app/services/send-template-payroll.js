import twilio from "twilio";
import { envConfig } from "../config/index.js";
import { formatWhatsAppNumber } from "../utils/formatWhatsAppNumber.js";
import { 
  getPayrollTemplateSid, 
  getPayrollEmployeTemplateSid,
  getTemplateFromTwilio,
  getTemplateContent,
  replaceTemplateVariables
} from "../config/twilioTemplates.js";

/**
 * Enviar plantilla de WhatsApp (Nómina) con media
 * Usa Content API si hay plantilla (contentSid) disponible; de lo contrario,
 * envía un mensaje con media y un texto de respaldo.
 * @param {string} to - Número del destinatario (E.164 o con prefijo whatsapp:)
 * @param {string} name - Nombre del destinatario para variables de plantilla
 * @param {string} mediaUrl - URL pública de la media (PDF/imagen)
 * @param {string|number} mes - Mes de la nómina (nombre o número)
 * @param {string} type - Tipo de nómina: "payrollUser" o "payrollEmployee"
 * @param {object} recipient - Datos del destinatario (usuario)
 * @param {object} employe - Datos del empleado
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
  // Inicializar cliente Twilio dentro de la función para asegurar que las credenciales estén cargadas
  const client = twilio(envConfig.twilioAccountSid, envConfig.twilioAuthToken);
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
  let monthName = typeof mes === "string" ? mes : "";
  if (Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12) {
    monthName = `${monthNames[monthNumber - 1]} ${currentYear}`;
  } else if (monthName) {
    monthName = `${monthName} ${currentYear}`;
  }

  // Helper para extraer primer y tercer nombre
  const firstAndThird = (fullName) => {
    if (!fullName) return "";
    const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
    const first = parts[0] || "";
    const third = parts[2] || "";
    return [first, third].filter(Boolean).join(" ");
  };

  // Obtener el Content SID dinámicamente según el mes y tipo
  let contentSid = null;
  let payload = {};

  if (type === "payrollUser") {
    // Nómina para empleador: variables 1 (nombre empleador) y 2 (archivo/mes)
    contentSid = getPayrollTemplateSid(mes);
    if (!contentSid) {
      console.error(`No se encontró plantilla de nómina (empleador) para el mes: ${mes}`);
      return { 
        success: false, 
        error: `No hay plantilla de nómina (empleador) configurada para el mes ${mes}` 
      };
    }
    payload = {
      // 1: String(firstAndThird(recipient?.fullName)),
      1: mediaUrl,
    };
  } else if (type === "payrollEmployee") {
    // Nómina para empleado: variables 1 (nombre empleado) y 2 (archivo/mes)
    contentSid = getPayrollEmployeTemplateSid(mes);
    if (!contentSid) {
      console.error(`No se encontró plantilla de nómina (empleado) para el mes: ${mes}`);
      return { 
        success: false, 
        error: `No hay plantilla de nómina (empleado) configurada para el mes ${mes}` 
      };
    }
    payload = {
      1: String(firstAndThird(employe?.fullName)),
      2: mediaUrl,
    };
  } else {
    return { 
      success: false, 
      error: `Tipo de nómina inválido: ${type}. Debe ser "payrollUser" o "payrollEmployee"` 
    };
  }

  if (to === undefined || to === null || String(to).trim() === "") {
    return { success: false, error: "Número de destino 'to' no proporcionado" };
  }

  const toWhatsApp = formatWhatsAppNumber(to);
  try {
    if (process.env.NODE_ENV !== "production") {
      console.log("Twilio Payroll ContentSid:", contentSid);
      console.log("Twilio Payroll ContentVars:", payload);
      console.log("Twilio Payroll Type:", type);
      console.log("Twilio Payroll Mes:", mes);
    }
    // console.log(toWhatsApp)
    // console.log(payload)
    const result = await client.messages.create({
      from: envConfig.twilioWhatsappNumber,
       to: toWhatsApp,
      contentSid: contentSid,
      contentVariables: JSON.stringify(payload),
      mediaUrl: [mediaUrl],
    });

    // Obtener el contenido de la plantilla desde Twilio API para guardar en MessageLog
    // Si falla, usar el mapeo local como fallback
    let rawTemplateContent = await getTemplateFromTwilio(contentSid, client);
    if (!rawTemplateContent) {
      rawTemplateContent = getTemplateContent(contentSid);
    }
    const templateContent = rawTemplateContent ? replaceTemplateVariables(rawTemplateContent, payload) : null;

    return { success: true, messageId: result.sid, status: result.status, templateContent, contentSid };
  } catch (err) {
    console.error(
      "Error al enviar nómina por WhatsApp:",
      err.message,
      { to: toWhatsApp, contentSid: contentSid, type: type, mes: mes }
    );
    return { success: false, error: err.message };
  }
};
