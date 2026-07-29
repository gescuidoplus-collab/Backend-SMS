import twilio from "twilio";
import { envConfig, logger } from "../config/index.js";
import { formatWhatsAppNumber } from "../utils/formatWhatsAppNumber.js";
import {
  getQuoteTemplateSid,
  getTemplateFromTwilio,
  getTemplateContent,
  replaceTemplateVariables,
} from "../config/twilioTemplates.js";

export const sendTemplateQuote = async (to, quoteId, mediaUrl) => {
  try {
    if (!to || typeof to !== "string" || to.trim() === "") {
      return { success: false, error: "Número de destino 'to' no proporcionado" };
    }

    const client = twilio(
      envConfig.twilioAccountSid,
      envConfig.twilioAuthToken
    );

    const contentSid = getQuoteTemplateSid();
    if (!contentSid) {
      return {
        success: false,
        error: "No hay plantilla disponible para envío de presupuesto",
      };
    }

    const toWhatsApp = formatWhatsAppNumber(to);
    const quoteName = `Presupuesto ${quoteId}`;
    const vars = { 1: quoteName };

    if (envConfig.twilioEnviroment === "DUMMY") {
      logger.info(
        {
          to: toWhatsApp,
          quoteId,
          contentSid,
          mode: "DUMMY",
        },
        "TWILIO DUMMY MODE (Quote)"
      );
      return {
        success: true,
        messageId: "DUMMY_MODE",
        status: "dummy",
        templateContent: null,
        contentSid,
      };
    }

    const result = await client.messages.create({
      from: envConfig.twilioWhatsappNumber,
      to: toWhatsApp,
      contentSid: contentSid,
      contentVariables: JSON.stringify(vars),
      mediaUrl: [mediaUrl],
    });

    let rawTemplateContent = await getTemplateFromTwilio(contentSid, client);
    if (!rawTemplateContent) {
      rawTemplateContent = getTemplateContent(contentSid);
    }
    const templateContent = rawTemplateContent
      ? replaceTemplateVariables(rawTemplateContent, vars)
      : null;

    logger.info(
      {
        messageId: result.sid,
        to: toWhatsApp,
        quoteId,
        contentSid,
        status: result.status,
      },
      "Quote sent successfully via WhatsApp"
    );

    return {
      success: true,
      messageId: result.sid,
      status: result.status,
      templateContent,
      contentSid,
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
