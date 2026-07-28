import { send_telegram_message } from "../services/sendMessageTelegram.js";
import { enqueueWhatsAppMessage } from "../services/whatsapp-batch-messages.js";

/**
 * Procesar y enviar cola de mensajes por WhatsApp
 * @param {string} token - Token de autenticación CloudNavis (requerido para obtener PDFs si es necesario)
 */
export const processMessageQueue = async (token) => {
  const report = {
    token: token?.substring(0, 5) + "...",
    startTime: new Date().toISOString(),
    messagesSent: 0,
    messagesFailed: 0,
    errors: [],
  };

  try {
    if (!token) {
      throw new Error("Token no proporcionado");
    }

    console.log(`[WhatsApp] Iniciando envío de mensajes con token: ${token.substring(0, 5)}...`);

    // Procesar la cola de WhatsApp
    const result = await enqueueWhatsAppMessage(token);

    report.messagesSent = result?.sent || 0;
    report.messagesFailed = result?.failed || 0;
    if (result?.errors) {
      report.errors = result.errors;
    }

    report.endTime = new Date().toISOString();
    const now = new Date();
    send_telegram_message(
      `✅ Envío de mensajes finalizado - Enviados: ${report.messagesSent}, Fallidos: ${report.messagesFailed} - ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`
    );

    console.log(`[WhatsApp] Completado: ${report.messagesSent} enviados, ${report.messagesFailed} errores`);
    return report;

  } catch (err) {
    report.endTime = new Date().toISOString();
    report.errors.push(err.message);
    const errMsg = `Error en processMessageQueue: ${err.message}`;
    console.error(`[WhatsApp] ${errMsg}`);
    send_telegram_message(`❌ ${errMsg}`);
    throw err;
  }
};

