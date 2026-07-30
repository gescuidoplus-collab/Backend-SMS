import twilio from "twilio";
import { envConfig, logger } from "../config/index.js";
import { formatWhatsAppNumber } from "../utils/formatWhatsAppNumber.js";

export const sendTemplateQuote = async (to, quoteId, mediaUrl) => {
  try {
    if (!to || typeof to !== "string" || to.trim() === "") {
      return { success: false, error: "Número de destino 'to' no proporcionado" };
    }

    const client = twilio(
      envConfig.twilioAccountSid,
      envConfig.twilioAuthToken
    );

    const toWhatsApp = formatWhatsAppNumber(to);

    if (envConfig.twilioEnviroment === "DUMMY") {
      logger.info(
        {
          to: toWhatsApp,
          quoteId,
          mediaUrl,
          mode: "DUMMY",
        },
        "TWILIO DUMMY MODE (Quote)"
      );
      return {
        success: true,
        messageId: "DUMMY_MODE",
        status: "dummy",
        templateContent: null,
      };
    }

    const result = await client.messages.create({
      from: envConfig.twilioWhatsappNumber,
      to: toWhatsApp,
      body: "Estimado/a, le compartimos su presupuesto solicitado. Descargue el PDF adjunto para revisar los detalles.",
      mediaUrl: [mediaUrl],
    });

    logger.info(
      {
        messageId: result.sid,
        to: toWhatsApp,
        quoteId,
        status: result.status,
      },
      "Quote sent successfully via WhatsApp"
    );

    return {
      success: true,
      messageId: result.sid,
      status: result.status,
    };
  } catch (err) {
    logger.error(
      {
        to,
        quoteId,
        error: err.message,
      },
      "Failed to send quote via WhatsApp"
    );
    return {
      success: false,
      error: err.message,
    };
  }
};
