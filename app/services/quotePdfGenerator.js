import puppeteer from "puppeteer";
import { logger } from "../config/index.js";


export const prepareQuoteData = async (datos) => {
  const nombreContrato = datos.nameContrato || "No especificado";
  const nombrePueblo = datos.NombrePueblo || "No especificado";

  const tiposServicio = datos.TipoServicio || [];
  const tipoServicioTexto =
    tiposServicio.length > 0 ? tiposServicio.join(", ") : "No especificado";

  const mensajeHorarioConvenir = datos?.horario_Convenir || "";
  const textoHorarios = "";

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
    horarioConvenir,
    mensajeHorarioConvenir,
    textoHorarios,
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
    ],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, {
      waitUntil: "load",
      timeout: 120000,
    });
    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: 0,
      preferCSSPageSize: true,
      timeout: 120000,
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
};
