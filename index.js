import express from "express";
import path from "path";
import { envConfig, mongoClient, logger } from "./app/config/index.js";
import { router } from "./app/routers/index.js";
import { createUser } from "./app/utils/create-auth.js";
import cors from "cors";
import morgan from "morgan";
import { engine } from "express-handlebars";
import { GoogleGenAI } from "@google/genai";
import puppeteer from 'puppeteer';
import { fileURLToPath } from "url";
import { generarCodigoFactura } from "./app/utils/generador-codigo.js";
import fs from "fs";
import {
  processMessageQueue,
} from "./app/tasks/index.js";

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express();
const ai = new GoogleGenAI(process.env.GOOGLE_API_KEY || "AIzaSyDKchseokzZvIBlNFuw6h2ND6d8Q1pavP8")
//

app.use(express.json());

import { runAllTasks } from "./app/tasks/taskManager.js";


app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3032",
      "https://frontend-sms.vercel.app",
      "https://frontend-sms-git-main-cuido-farm.vercel.app",
      "https://frontend-sms-git-feat-walls-migrate-cuido-farm.vercel.app",
      "https://frontend-sms-cuido-farm.vercel.app",
      "https://frontend-sms-*.vercel.app",
      "https://backend-sms-three.vercel.app",
      "https://frontend-e2k70gn7u-cuido-farm.vercel.app",
      "https://frontend-sms-git-production-cuido-farm.vercel.app"
    ],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
  })
);

if (envConfig.env === "development") {
  app.use(morgan("dev"));
}

app.engine('handlebars', engine({
    defaultLayout: false,
    partialsDir: [
        path.join(__dirname, 'app', 'views', 'pdf', 'partials'),  
    ],
    helpers: {
        imagePath: function(imageName) {
            // Convertir imagen a Base64
            const imagePath = path.join(__dirname, 'public', 'images', 'pdf', imageName);
            try {
                const imageBuffer = fs.readFileSync(imagePath);
                const ext = path.extname(imageName).substring(1);
                const mimeType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
                return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
            } catch (error) {
                logger.error({ err: error, imageName }, `Error loading image ${imageName}`);
                return '';
            }
        },
    }
}));

app.set("view engine", 'handlebars');
app.set('views', path.join(__dirname, "app", "views","pdf"));
app.use("/", express.static(path.join(__dirname, "app", "public","images","pdf")));

app.get("/view-pdf-html", (req, res) => {
    res.render("report");
});

app.post('/api/v1/generate-pdf', async (req, res) => {
  try {

    const datos = req.body;
    //console.log('Datos recibidos del frontend:', datos);
    const codigoData = await generarCodigoFactura();
    //console.log(codigoData.codigo)


    const datosParaPdf = await prepararDatosPdf(datos)
    // Renderizar la plantilla con los datos del servidor
    const htmlContent = await renderTemplate("report", {...datosParaPdf,codigoData:codigoData.codigo});

    // Generar el PDF con Puppeteer
    const pdfBuffer = await generatePDF(htmlContent);

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="seguros.pdf"',
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  } catch (error) {
    logger.error({ err: error }, "Error al generar el PDF");
    res.status(500).json({ error: 'Error al generar el PDF.' });
  }
});

async function generarContenido(prompt) {
  try {
    logger.info({ prompt }, "Generating content")
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // El modelo que desees usar
      contents: prompt,
    });
    logger.info({ response: response.text }, "Content generated")
    return response.text;
  } catch (error) {
    return `Error al generar contenido: ${error}`;
  }
}
async function prepararDatosPdf(datos) {
    const nombreContrato = datos.nameContrato || 'No especificado';
    const nombrePueblo = datos.NombrePueblo || 'No especificado';

    const tiposServicio = datos.TipoServicio || [];
    const tipoServicioTexto = tiposServicio.length > 0 
    ? tiposServicio.join(', ') 
    : 'No especificado';
    const HorariosFormateados = formatearHorarios(datos.horarios); 
    let textoHorarios = await generarContenido(`Genera un texto corto (máximo dos líneas) que comience con "HORARIO:". El texto debe mostrar únicamente los días y horas actuales en formato ${HorariosFormateados}, sin agregar palabras ni frases adicionales que no estén relacionadas con los horarios. El resultado debe ser limpio y directo, ideal para mostrar a un cliente, Dame el resultado en español`)
    // Verificar si el texto contiene un mensaje de error
    if (textoHorarios && textoHorarios.includes('Error al generar contenido:')) {
      logger.error({ textoHorarios }, "Error en textoHorarios")
      textoHorarios = '' // Dejar textoHorarios vacío para que no aparezca en el PDF
    }

    const servicioLugar= datos.Servicio;
    const complementoTitulo = datos?.titleComplement || "";
    const horarioConvenir= datos.horarioConvenir;
    const mensajeHorarioConvenir= datos?.horario_Convenir || "";
    const presupuestos = datos.presupuestos;

    return({
      nombreContrato,
      nombrePueblo,
      tipoServicioTexto,
      servicioLugar,
      complementoTitulo,
      horarioConvenir,
      mensajeHorarioConvenir,
      textoHorarios,
      presupuestos
    })

}
// Función para renderizar la plantilla Handlebars
async function renderTemplate(templateName, data) {
  return new Promise((resolve, reject) => {
    app.render(templateName, data, (err, html) => {
      if (err) reject(err);
      else resolve(html);
    });
  });
}

//FUNCIÓN MEJORADA PARA GENERAR PDF
async function generatePDF(htmlContent) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ],
  });
  
  const page = await browser.newPage();
  
  page.setDefaultNavigationTimeout(120000);
  page.setDefaultTimeout(120000);
  
  await page.setContent(htmlContent, {
    waitUntil: 'load',
    timeout: 120000
  });
  
  const pdfBuffer = await page.pdf({ 
    format: 'A4',
    landscape: true,  //ESTO CAMBIA A HORIZONTAL
    printBackground: true,
    margin: {
      top: '0mm',
      right: '0mm',
      bottom: '0mm',
      left: '0mm'
    },
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    timeout: 120000
  });
  
  await browser.close();
  return pdfBuffer;
}

function formatearHorarios(horarios) {
  if (!horarios || typeof horarios !== 'object') {
    return 'No se especificaron horarios';
  }

  const diasActivos = Object.entries(horarios)
    .filter(([_, valor]) => valor && valor.inicio && valor.fin)
    .map(([dia, valor]) => {
      const diaCapitalizado = dia.charAt(0).toUpperCase() + dia.slice(1);
      return `${diaCapitalizado}: ${valor.inicio} - ${valor.fin}`;
    });

  if (diasActivos.length === 0) {
    return 'No hay horarios configurados';
  }

  return diasActivos.join(', ');
}

// app.use(helmet());

// const limiter = rateLimit({
//   windowMs: 5 * 60 * 1000,
//   max: 100,

// const limiter = rateLimit({
//   windowMs: 5 * 60 * 1000,
//   max: 150,
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use(limiter);

app.use(express.json({ limit: "1kb" }));
app.use(express.urlencoded({ extended: true, limit: "1kb" }));

mongoClient();

app.use("/public", express.static(path.join(process.cwd(), "public")));

createUser({
  email: envConfig.emailUser,
  password: envConfig.passwordUser,
})
  .then(() => {
    logger.info("User Admin created successfully");
  })
  .catch((error) => {
    logger.warn({ err: error }, "User Admin was not created");
  });

app.get(`${envConfig.urlPath}healtcheck`, (req, res) => {
  res.status(200).json({ message: "version 1.0.0" });
});

app.get(`${envConfig.urlPath}healtcheck`, (req, res) => {
  res.status(200).json({ message: "version 1.0.0" });
});

app.get("/api/cron", async (req, res) => {
  try {
    logger.info("Cron job triggered")
    const ua = (req.headers["user-agent"] || "").toLowerCase();
    const isVercel = ua.includes("vercel-cron");
    const provided = req.headers["x-cron-secret"];
    if (
      !isVercel &&
      envConfig.cronSecret &&
      provided !== envConfig.cronSecret
    ) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    await runAllTasks();
    res.json({ ok: true, runAt: new Date().toISOString() });
  } catch (e) {
    logger.error({ err: e }, "Cron endpoint error");
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/cron-send", async (req, res) => {
  try {

    logger.info("Cron SEND job triggered");
    const ua = (req.headers["user-agent"] || "").toLowerCase();
    const isVercel = ua.includes("vercel-cron");
    const provided = req.headers["x-cron-secret"];
    if (
      !isVercel &&
      envConfig.cronSecret &&
      provided !== envConfig.cronSecret
    ) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    await mongoClient(); 
    await processMessageQueue();
    res.json({ ok: true, runAt: new Date().toISOString(), processed: true });
  } catch (e) {
    logger.error({ err: e }, "Cron SEND endpoint error");
    res.status(500).json({ ok: false, error: e.message });
  }
});


app.use(envConfig.urlPath, router);

const HOST = "127.0.0.1";
app.listen(envConfig.port, HOST, () => {
  logger.info({ port: envConfig.port, host: HOST }, `Server running on ${HOST}:${envConfig.port}`);
});
