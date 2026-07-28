import puppeteer from "puppeteer";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../config/index.js";

const ai = new GoogleGenAI(process.env.GOOGLE_API_KEY || "AIzaSyDKchseokzZvIBlNFuw6h2ND6d8Q1pavP8");

async function generarContenido(prompt) {
  try {
    logger.info({ prompt }, "Generating content");
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    logger.info({ response: response.text }, "Content generated");
    return response.text;
  } catch (error) {
    return `Error al generar contenido: ${error}`;
  }
}

function formatearHorarios(horarios) {
  if (!horarios || typeof horarios !== "object") {
    return "No se especificaron horarios";
  }

  const diasActivos = Object.entries(horarios)
    .filter(([_, valor]) => valor && valor.inicio && valor.fin)
    .map(([dia, valor]) => {
      const diaCapitalizado = dia.charAt(0).toUpperCase() + dia.slice(1);
      return `${diaCapitalizado}: ${valor.inicio} - ${valor.fin}`;
    });

  if (diasActivos.length === 0) {
    return "No hay horarios configurados";
  }

  return diasActivos.join(", ");
}

export const prepareQuoteData = async (datos) => {
  const nombreContrato = datos.nameContrato || "No especificado";
  const nombrePueblo = datos.NombrePueblo || "No especificado";

  const tiposServicio = datos.TipoServicio || [];
  const tipoServicioTexto =
    tiposServicio.length > 0 ? tiposServicio.join(", ") : "No especificado";
  const HorariosFormateados = formatearHorarios(datos.horarios);
  let textoHorarios = await generarContenido(
    `Genera un texto corto (máximo dos líneas) que comience con "HORARIO:". El texto debe mostrar únicamente los días y horas actuales en formato ${HorariosFormateados}, sin agregar palabras ni frases adicionales que no estén relacionadas con los horarios. El resultado debe ser limpio y directo, ideal para mostrar a un cliente, Dame el resultado en español`
  );
  // Verificar si el texto contiene un mensaje de error
  if (textoHorarios && textoHorarios.includes("Error al generar contenido:")) {
    logger.error({ textoHorarios }, "Error en textoHorarios");
    textoHorarios = ""; // Dejar textoHorarios vacío para que no aparezca en el PDF
  }

  const servicioLugar = datos.Servicio;
  const complementoTitulo = datos?.titleComplement || "";
  const horarioConvenir = datos.horarioConvenir;
  const mensajeHorarioConvenir = datos?.horario_Convenir || "";
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
