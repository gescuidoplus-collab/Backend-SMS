import Quote from "../schemas/quote.js";
import MessageLog from "../schemas/messageLog.js";
import {
  prepareQuoteData,
  renderQuoteTemplate,
  generateQuotePDF,
} from "../services/quotePdfGenerator.js";
import { sendTemplateQuote } from "../services/send-template-quote.js";
import { envConfig, logger } from "../config/index.js";
import { generarCodigoFactura } from "../utils/generador-codigo.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const createQuoteAndSendWhatsApp = async (req, res, app) => {
  try {
    const datos = req.body;
    const { numeroWhatsApp } = datos;

    if (!numeroWhatsApp || numeroWhatsApp.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Número de WhatsApp requerido",
      });
    }

    const datosParaPdf = await prepareQuoteData(datos);
    const codigoData = await generarCodigoFactura();

    console.log("DEBUG - Presupuestos a renderizar:", JSON.stringify(datosParaPdf.presupuestos, null, 2));

    const htmlContent = await renderQuoteTemplate(app, "report", {
      ...datosParaPdf,
      codigoData: codigoData.codigo,
    });

    const pdfBuffer = await generateQuotePDF(htmlContent);
    if (!pdfBuffer || pdfBuffer.length === 0) {
      return res.status(500).json({
        success: false,
        error: "Error al generar PDF",
      });
    }

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pdfDir = path.join(process.cwd(), "public", "media", "pdfs");
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }
    const pdfPath = path.join(pdfDir, "Presupuesto.pdf");
    fs.writeFileSync(pdfPath, pdfBuffer);

    const quote = new Quote({
      nameContrato: datosParaPdf.nombreContrato,
      titleComplement: datos?.titleComplement || "",
      NombrePueblo: datosParaPdf.nombrePueblo,
      Servicio: datosParaPdf.servicioLugar,
      TipoServicio: datos.TipoServicio || [],
      horarioConvenir: datos.horarioConvenir || false,
      horario_Convenir: datos.horario_Convenir || "",
      horarios: datos.horarios || {},
      Dias: datos.Dias || [],
      presupuestos: datos.presupuestos || [],
      considerationOne: datosParaPdf.considerationOne,
      considerationTwo: datosParaPdf.considerationTwo,
      considerationThree: datosParaPdf.considerationThree,
      numeroWhatsApp: numeroWhatsApp.trim(),
      pdfUrl: `${envConfig.apiUrl.replace(/\/api\/v1$/, "")}/public/media/pdfs/presupuesto-actual.pdf`,
    });

    const savedQuote = await quote.save();

    const whatsappResult = await sendTemplateQuote(
      numeroWhatsApp,
      savedQuote._id.toString()
    );

    if (whatsappResult.success) {
      const messageLog = new MessageLog({
        source: savedQuote._id,
        recipient: numeroWhatsApp,
        messageType: "quote",
        pdfUrl: savedQuote.pdfUrl,
        status: "success",
        sentAt: new Date(),
        message: whatsappResult.templateContent || "",
        templateContentSid: whatsappResult.contentSid || "",
      });
      await messageLog.save();

      savedQuote.messageLogId = messageLog._id;
      await savedQuote.save();
    }

    logger.info(
      {
        quoteId: savedQuote._id,
        whatsappSent: whatsappResult.success,
      },
      "Quote created and WhatsApp sent"
    );

    return res.status(201).json({
      success: true,
      quoteId: savedQuote._id,
      whatsappSuccess: whatsappResult.success,
      error: whatsappResult.error || null,
    });
  } catch (err) {
    logger.error(
      {
        error: err.message,
        stack: err.stack,
      },
      "Error in createQuoteAndSendWhatsApp"
    );
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

export const downloadQuotePdf = async (req, res, app) => {
  try {
    const { id } = req.params;

    const quote = await Quote.findById(id);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    const datosParaPdf = await prepareQuoteData({
      nameContrato: quote.nameContrato,
      titleComplement: quote.titleComplement,
      NombrePueblo: quote.NombrePueblo,
      Servicio: quote.Servicio,
      TipoServicio: quote.TipoServicio,
      horarioConvenir: quote.horarioConvenir,
      horario_Convenir: quote.horario_Convenir,
      horarios: quote.horarios,
      Dias: quote.Dias,
      presupuestos: quote.presupuestos,
      considerationOne: quote.considerationOne,
      considerationTwo: quote.considerationTwo,
      considerationThree: quote.considerationThree,
    });

    const codigoData = await generarCodigoFactura();
    const htmlContent = await renderQuoteTemplate(app, "report", {
      ...datosParaPdf,
      codigoData: codigoData.codigo,
    });

    const pdfBuffer = await generateQuotePDF(htmlContent);

    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=presupuesto.pdf",
      "Content-Length": pdfBuffer.length,
    });
    res.end(pdfBuffer);

    logger.info({ quoteId: id }, "Quote PDF downloaded");
  } catch (err) {
    logger.error(
      { error: err.message, quoteId: req.params.id },
      "Error downloading quote PDF"
    );
    res.status(500).json({ error: err.message });
  }
};
