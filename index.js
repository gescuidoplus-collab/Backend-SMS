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
} from "./app/tasks/index.js";
import {
  prepareQuoteData,
  renderQuoteTemplate,
  generateQuotePDF,
} from "./app/services/quotePdfGenerator.js";
import createQuotesRouter from "./app/routers/quotes.js";

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express();

app.use(express.json());

import { runAllTasks } from "./app/tasks/taskManager.js";


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
