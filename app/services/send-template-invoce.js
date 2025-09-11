import twilio from "twilio";
import { envConfig } from "../config/index.js";
import { formatWhatsAppNumber } from "../utils/formatWhatsAppNumber.js";
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
  const contentSidExample =
    envConfig.twilioInvoiceContentSid || "HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // ejemplo

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
  const safeNumero =
    numero != null && numero !== undefined ? String(numero) : "";
  const safeTotal = (() => {
    const n = Number(total);
    return Number.isFinite(n) ? n.toFixed(2) : String(total ?? "");
  })();
  const safeFecha = (() => {
    if (!fechaExpedicion) return "";
    try {
      const d = new Date(fechaExpedicion);
      if (isNaN(d.getTime())) return String(fechaExpedicion);
      return d.toISOString().slice(0, 10); // YYYY-MM-DD
    } catch {
      return String(fechaExpedicion);
    }
  })();

  const toWhatsApp = formatWhatsAppNumber(to);
  try {
    if (contentSidExample && contentSidExample.startsWith("HX")) {
      const vars = {
        1: safeName,
        2: monthName,
        3: safeNumero,
        4: safeTotal,
        5: safeFecha,
      };
      // Log de debug acotado
      if (process.env.NODE_ENV !== "production") {
        console.log("Twilio Invoice ContentVars:", vars);
        console.log("Twilio Invoice mediaUrl:", mediaUrl);
      }
      const result = await client.messages.create({
        from: envConfig.twilioWhatsappNumber,
        to: toWhatsApp,
        contentSid: contentSidExample,
        contentVariables: JSON.stringify(vars),
        mediaUrl: [mediaUrl],
      });
      return { success: true, messageId: result.sid, status: result.status };
    } else {
      return { success: false, error: "Content SID no configurado" };
    }
  } catch (err) {
    console.warn(
      "Fallo al enviar por Content API, haciendo fallback a media estándar:",
      err.message,
      { to: toWhatsApp, contentSid: contentSidExample }
    );
    return { success: false, error: err.message };
  }
};
