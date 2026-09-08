import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";
import { logger } from "../config/index.js";


export const prepareQuoteData = async (datos) => {
  const nombreContrato = datos.nameContrato || "No especificado";
  const nombrePueblo = datos.NombrePueblo || "No especificado";

  const tiposServicio = datos.TipoServicio || [];
  const tipoServicioTexto =
    tiposServicio.length > 0 ? tiposServicio.join(", ") : "No especificado";

  const servicioLugar = datos.Servicio;
  const complementoTitulo = datos?.titleComplement || "";
  const presupuestos = datos.presupuestos;
  const considerationOne =
    datos?.considerationOne ||
    "Salario según SMI (Salario Mínimo Interprofesional La cuota de la Seguridad Social y el SMI segun legislación)";
  const considerationTwo =
    datos?.considerationTwo ||
    "Pagas Prorrateadas Incluidas. Vacaciones NO incluidas.";
  const considerationThree =
    datos?.considerationThree ||
    "Relalizacion de altas, bajas, contratos, nominas. Festivos NO incluidos";

  return {
    nombreContrato,
    nombrePueblo,
    tipoServicioTexto,
    servicioLugar,
    complementoTitulo,
    presupuestos,
    considerationOne,
    considerationTwo,
    considerationThree,
  };
};

export const renderQuoteTemplate = async (app, templateName, data) => {
  // app.render() necesita acceso a la instancia Express
  // Firma: app.render(viewName, options, callback)
  return new Promise((resolve, reject) => {
    app.render(templateName, data, (err, html) => {
      if (err) reject(err);
      else resolve(html);
    });
  });
};

export const generateQuotePDF = async (htmlContent) => {
  const browser = await puppeteer.launch({
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process=false",
    ],
  });
  try {
    const page = await browser.newPage();

    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });

    const rawPdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: 0,
      preferCSSPageSize: true,
      timeout: 120000,
    });

    logger.info({ rawSize: rawPdfBuffer.length }, "Raw PDF size from Puppeteer");

    const pdfDoc = await PDFDocument.load(rawPdfBuffer);

    const compressedPdfBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    const finalSize = Buffer.from(compressedPdfBytes).length;
    const rawSize = rawPdfBuffer.length;
    const reduction = (((rawSize - finalSize) / rawSize) * 100).toFixed(1);

    logger.info(
      { rawSize, finalSize, reduction: `${reduction}%` },
      "PDF compression complete"
    );

    return Buffer.from(compressedPdfBytes);
  } finally {
    await browser.close();
  }
};
