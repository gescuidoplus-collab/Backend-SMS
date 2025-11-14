import { send_telegram_message } from "../services/sendMessageTelegram.js";
import { sendWhatsAppMessage } from "../services/twilioService.js";
import { envConfig } from "../config/index.js";
import { hasActiveContextWindow, initializeContextWindow, sendTemplateWithinContextWindow } from "../services/twilioContextManager.js";

/**
 * Webhook para recibir eventos de Twilio (SMS entrantes, status, etc.)
 * Twilio enviará un POST a este endpoint.
 * 
 * Valida ventana de contexto antes de enviar mensajes directos
 */
export const handleTwilioWebhook = async (req, res) => {
  try {
    const {
      ProfileName,
      From,
      Body,
      MessageType,
      ButtonText,
      ButtonPayload,
      ChannelMetadata,
    } = req.body;

    let senderName = ProfileName;
    if (!senderName && ChannelMetadata) {
      try {
        const meta = JSON.parse(ChannelMetadata);
        senderName = meta?.data?.context?.ProfileName || senderName;
      } catch (e) {
      }
    }

    let content = `Nueva respuesta recibida de Twilio:\n`;
    content += `Nombre: ${senderName || "Desconocido"}\n`;
    content += `Número: ${From || "Desconocido"}\n`;
    content += `Tipo: ${MessageType || "texto"}\n`;

    if (MessageType === "button") {
      content += `Botón: ${ButtonText || "N/A"}\n`;
      content += `Payload: ${ButtonPayload || "N/A"}\n`;
    }

    content += `Mensaje: ${Body || "Sin contenido"}\n`;

    // Notificar a Telegram (siempre)
    await send_telegram_message(content);

    // Verificar si redirectNumber tiene ventana de contexto activa
    const redirectNumberFormatted = `+34${envConfig.redirectNumber}`;
    let hasContext = await hasActiveContextWindow(redirectNumberFormatted);

    if (!hasContext) {
      // ❌ SIN contexto: Enviar plantilla de inicialización
      console.log(`🔄 Enviando plantilla de inicialización para ${redirectNumberFormatted}...`);
      const initResult = await initializeContextWindow(redirectNumberFormatted, "Automatizador", Body);
      
      if (initResult.success) {
        console.log(`✅ Plantilla de inicialización enviada exitosamente`);
      } else {
        console.warn(`⚠️ Fallo al enviar plantilla de inicialización:`, initResult.error);
      }
    } else {
      // ✅ Hay contexto: Enviar mensaje directo (texto libre)
      console.log(`✅ Contexto activo para ${redirectNumberFormatted}. Enviando respuesta directa...`);
      
      const result = await sendWhatsAppMessage(
        `whatsapp:${redirectNumberFormatted}`,
        `${content}`
      );

      if (!result.success) {
        console.warn(`⚠️ Fallo al enviar respuesta:`, result.error);
      } else {
        console.log(`✅ Respuesta enviada exitosamente`);
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Error en handleTwilioWebhook:", error);
    res.status(500).json({ error: error.message });
  }
};
