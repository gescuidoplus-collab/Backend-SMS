import twilio from "twilio";
import { envConfig, logger } from "../config/index.js";
import { formatWhatsAppNumber } from "../utils/formatWhatsAppNumber.js";
import fs from "fs";
import path from "path";

export const sendTemplateQuote = async (to, quoteId) => {
  try {
    if (!to || typeof to !== "string" || to.trim() === "") {
      return { success: false, error: "Número de destino 'to' no proporcionado" };
    }

    const client = twilio(
      envConfig.twilioAccountSid,
      envConfig.twilioAuthToken
    );

    const toWhatsApp = formatWhatsAppNumber(to);
    const quoteName = `Presupuesto ${quoteId}`;
    const contentSid = "HX39ecf3b7f6382be9fa18e8b39d5bd97d";

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
      };
    }

    const result = await client.messages.create({
      from: envConfig.twilioWhatsappNumber,
      to: toWhatsApp,
      contentSid: contentSid,
      contentVariables: JSON.stringify({ 1: quoteName }),
    });

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

    const pdfPath = path.join(process.cwd(), "public", "media", "pdfs", "presupuesto-actual.pdf");
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
      logger.info({ pdfPath }, "Presupuesto PDF deleted after successful send");
    }

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
