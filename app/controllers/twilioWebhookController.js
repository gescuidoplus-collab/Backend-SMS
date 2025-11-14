import { send_telegram_message } from "../services/sendMessageTelegram.js";
import { sendWhatsAppMessage } from "../services/twilioService.js";
import { envConfig } from "../config/index.js";
/**
 * Webhook para recibir eventos de Twilio (SMS entrantes, status, etc.)
 * Twilio enviará un POST a este endpoint.
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

    await send_telegram_message(content);

    await sendWhatsAppMessage(
      `whatsapp:+34${envConfig.redirectNumber}`,
      `Respuesta al Automatizador: "${content}"`
    );

    res.status(200).send("OK");
  } catch (error) {
    console.error("Error en handleTwilioWebhook:", error);
    res.status(500).json({ error: error.message });
  }
};
