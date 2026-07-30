import express from "express";
import twilio from "twilio";
import { envConfig, logger } from "../config/index.js";
import {
  createQuoteAndSendWhatsApp,
  downloadQuotePdf,
} from "../controllers/quotesController.js";

const createQuotesRouter = (app) => {
  const router = express.Router();

  router.get("/ping", (req, res) =>
    res.json({ ok: true, route: "quotes/ping" })
  );

  router.post("/", (req, res) => createQuoteAndSendWhatsApp(req, res, app));
  router.get("/:id/presupuesto.pdf", (req, res) =>
    downloadQuotePdf(req, res, app)
  );

  // Nuevo endpoint: obtener estado del mensaje en Twilio
  router.get("/:messageId/status", async (req, res) => {
    try {
      const { messageId } = req.params;

      if (!messageId) {
        return res.status(400).json({ error: "messageId requerido" });
      }

      const client = twilio(
        envConfig.twilioAccountSid,
        envConfig.twilioAuthToken
      );

      const message = await client.messages(messageId).fetch();

      logger.info(
        { messageId, status: message.status },
        "Message status fetched"
      );

      return res.json({
        success: true,
        messageId: message.sid,
        status: message.status,
        errorCode: message.errorCode || null,
        errorMessage: message.errorMessage || null,
      });
    } catch (err) {
      logger.error({ error: err.message, messageId: req.params.messageId }, "Failed to fetch message status");
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  return router;
};

export default createQuotesRouter;
