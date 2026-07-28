import express from "express";
import path from "path";
import { envConfig, mongoClient, logger } from "./app/config/index.js";
import { router } from "./app/routers/index.js";
import { createUser } from "./app/utils/create-auth.js";
import cors from "cors";
import morgan from "morgan";
import { engine } from "express-handlebars";
import { fileURLToPath } from "url";
import { generarCodigoFactura } from "./app/utils/generador-codigo.js";
import fs from "fs";
import {
  processMessageQueue,
} from "./app/tasks/processSendMessajes.js";
import { processInvoicesTask } from "./app/tasks/processInvoicesTask.js";
import { processPayRollsTask } from "./app/tasks/processPayRollsTask.js";
import {
  prepareQuoteData,
  renderQuoteTemplate,
  generateQuotePDF,
} from "./app/services/quotePdfGenerator.js";
import createQuotesRouter from "./app/routers/quotes.js";
import { send_telegram_message } from "./app/services/sendMessageTelegram.js";

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express();

app.use(express.json());


app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
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
    const codigoData = await generarCodigoFactura();
    const datosParaPdf = await prepareQuoteData(datos);
    const htmlContent = await renderQuoteTemplate(app, "report", {
      ...datosParaPdf,
      codigoData: codigoData.codigo,
    });
    const pdfBuffer = await generateQuotePDF(htmlContent);
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="presupuesto.pdf"',
      "Content-Length": pdfBuffer.length,
    });
    res.end(pdfBuffer);
  } catch (err) {
    logger.error({ err }, "Error generando PDF:");
    res.status(500).json({ error: err.message });
  }
});

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
    console.log("✅ User Admin created successfully");
  })
  .catch((error) => {
    console.warn("⚠️ User Admin was not created:", error.message);
  });

app.get(`${envConfig.urlPath}healtcheck`, (req, res) => {
  res.status(200).json({ message: "version 1.0.0" });
});

app.get(`${envConfig.urlPath}healtcheck`, (req, res) => {
  res.status(200).json({ message: "version 1.0.0" });
});

app.get("/api/cron", async (req, res) => {
  try {
    const { token, month, year } = req.query;

    // Validar parámetros requeridos
    if (!token || !month || !year) {
      return res.status(400).json({
        ok: false,
        error: "Parámetros requeridos: token, month, year",
        example: "/api/cron?token=abc&month=5&year=2026"
      });
    }

    // Validar mes/año
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    if (isNaN(monthNum) || isNaN(yearNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        ok: false,
        error: "Parámetros inválidos: month (1-12) y year deben ser números válidos"
      });
    }

    logger.info(`[Webhook] Iniciando: token=${token.substring(0, 5)}..., month=${month}, year=${year}`);

    // 1. Procesar facturas
    const invoiceReport = await processInvoicesTask(token, monthNum, yearNum);
    await new Promise((res) => setTimeout(res, 25000)); // Esperar 25s

    // 2. Procesar nóminas
    const payrollReport = await processPayRollsTask(token, monthNum, yearNum);
    await new Promise((res) => setTimeout(res, 5000)); // Esperar 5s

    // 3. Conectar DB y enviar por WhatsApp
    await mongoClient();
    const messageReport = await processMessageQueue(token);

    const now = new Date();
    send_telegram_message(
      `✅ Ciclo completo finalizado - Facturas: ${invoiceReport.invoicesProcessed}, Nóminas: ${payrollReport.payrollsProcessed}, Mensajes: ${messageReport.messagesSent} - ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`
    );

    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      invoices: invoiceReport,
      payrolls: payrollReport,
      messages: messageReport,
    });

  } catch (error) {
    logger.error({ err: error }, "Webhook /api/cron error");
    send_telegram_message(`❌ Error en webhook /api/cron: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});


app.use(envConfig.urlPath, router);

// Mount quotes router (requires app for pdf generation)
const quotesRouter = createQuotesRouter(app);
app.use(`${envConfig.urlPath}quotes`, quotesRouter);

const HOST = "0.0.0.0";
const PORT = process.env.PORT || envConfig.port || 3000;

mongoClient().catch((err) => {
  console.error("❌ MongoDB connection error:", err);
});

createUser({
  email: envConfig.emailUser,
  password: envConfig.passwordUser,
}).catch((error) => {
  console.warn("⚠️ User Admin creation error:", error.message);
});

app.listen(PORT, HOST, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
