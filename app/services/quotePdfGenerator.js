import puppeteer from "puppeteer";
import PDFDocument from "pdfkit";
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
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });

    const startTime = Date.now();

    const screenBuffer = await page.screenshot({
      type: "png",
      fullPage: true,
      optimizeForSpeed: true,
    });

    const screenshots = [screenBuffer];

    const puppeteerTime = Date.now() - startTime;
    logger.info(
      { screenshots: screenshots.length, totalSize: screenBuffer.length, time: puppeteerTime },
      "Screenshots generated from Puppeteer"
    );

    const pdfBuffer = createPdfFromScreenshots(screenshots);

    const reduction = (((screenBuffer.length - pdfBuffer.length) / screenBuffer.length) * 100).toFixed(1);

    logger.info(
      {
        screenshotSize: screenBuffer.length,
        pdfSize: pdfBuffer.length,
        reduction: `${reduction}%`,
      },
      "PDF created from screenshots"
    );

    return pdfBuffer;
  } finally {
    await browser.close();
  }
};

function createPdfFromScreenshots(screenshots) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        landscape: true,
        compress: true,
      });

      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      for (const screenshot of screenshots) {
        doc.image(screenshot, 0, 0, { fit: [842, 595] });
        doc.addPage();
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
