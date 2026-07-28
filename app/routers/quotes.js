import express from "express";
import {
  createQuoteAndSendWhatsApp,
  downloadQuotePdf,
} from "../controllers/quotesController.js";

const createQuotesRouter = (app) => {
  const router = express.Router();

  router.post("/", (req, res) => createQuoteAndSendWhatsApp(req, res, app));
  router.get("/:id/presupuesto.pdf", (req, res) =>
    downloadQuotePdf(req, res, app)
  );

  return router;
};

export default createQuotesRouter;
