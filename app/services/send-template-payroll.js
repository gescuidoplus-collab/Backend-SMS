/**
 * Enviar plantilla de WhatsApp (Nómina) con media.
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

  let contentSidExample = null;
  let payload = {};
  const firstAndThird = (fullName) => {
    if (!fullName) return "";
    const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
    const first = parts[0] || "";
    const third = parts[2] || "";
    return [first, third].filter(Boolean).join(" ");
  };

  if (type === "payrollUser") {
    contentSidExample =
      envConfig.twilioPayrollContentSid || "HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    payload = {
      1: String(firstAndThird(recipient?.fullName)),
      2: String(firstAndThird(employe?.fullName)),
      3: String(monthName),
    };
  } else if (type === "payrollEmployee") {
    contentSidExample =
      envConfig.twilioPayrollContentSidEmploye ||
      "HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    payload = {
      1: String(firstAndThird(employe?.fullName)),
      2: String(monthName),
    };
  }

  const toWhatsApp = formatWhatsAppNumber(to);
  try {
    if (contentSidExample && contentSidExample.startsWith("HX")) {
      if (process.env.NODE_ENV !== "production") {
        console.log("Twilio Payroll ContentVars:", payload, "type:", type);
      }
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
      err.message,
      { to: toWhatsApp, contentSid: contentSidExample, type }
    );
    return { success: false, error: err.message };
  }
};
