import twilio from "twilio";
import { envConfig, logger } from "../config/index.js";
import { formatWhatsAppNumber } from "../utils/formatWhatsAppNumber.js";

export const sendTemplateQuote = async (to, clientName) => {
  try {
    if (!to || typeof to !== "string" || to.trim() === "") {
      return { success: false, error: "Número de destino 'to' no proporcionado" };
    }

    const client = twilio(
      envConfig.twilioAccountSid,
      envConfig.twilioAuthToken
    );

    const toWhatsApp = formatWhatsAppNumber(to);
    const quoteName = clientName;
    const contentSid = "HX39ecf3b7f6382be9fa18e8b39d5bd97d";

    if (envConfig.twilioEnviroment === "DUMMY") {
      logger.info(
        {
          to: toWhatsApp,
          clientName,
          contentSid,
          mode: "DUMMY",
        },
        "TWILIO DUMMY MODE (Quote)"
      );
      return {
        success: true,
        messageId: "DUMMY_MODE",
        status: "dummy",
      };
    }

    const result = await client.messages.create({
      from: envConfig.twilioWhatsappNumber,
      to: toWhatsApp,
      contentSid: contentSid,
      contentVariables: JSON.stringify({ 1: quoteName }),
    });

    // Validar que el mensaje se envió correctamente
    if (!result.sid || result.errorCode) {
      const errorMsg = result.errorMessage || "Error desconocido al enviar mensaje";
      logger.error(
        {
          to: toWhatsApp,
          clientName,
          errorCode: result.errorCode,
          errorMessage: errorMsg,
        },
        "Twilio API returned error"
      );
      return {
        success: false,
        error: `Error de Twilio: ${errorMsg}`,
      };
    }

    // Status debe ser "queued" o "sent", no "failed"
    if (result.status === "failed") {
      logger.error(
        {
          to: toWhatsApp,
          clientName,
          status: result.status,
          errorCode: result.errorCode,
        },
        "Message failed to send"
      );
      return {
        success: false,
        error: `Mensaje no se pudo enviar (${result.status})`,
      };
    }

    logger.info(
      {
        messageId: result.sid,
        to: toWhatsApp,
        clientName,
        contentSid,
        status: result.status,
      },
      "Quote sent successfully via WhatsApp"
    );

    return {
      success: true,
      messageId: result.sid,
      status: result.status,
      contentSid,
    };
  } catch (err) {
    logger.error(
      {
        to,
        clientName,
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
