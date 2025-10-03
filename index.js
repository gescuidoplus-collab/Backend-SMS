import express from "express";
import path from "path";
import { envConfig, mongoClient } from "./app/config/index.js";
import { router } from "./app/routers/index.js";
import { createUser } from "./app/utils/create-auth.js";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { engine } from "express-handlebars";
import puppeteer from 'puppeteer';
import { fileURLToPath } from "url";
import {
  processInvoicesTask,
  processMessageQueue,
  processPayRollsTask,
} from "./app/tasks/index.js";

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3032"],
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
            return `public/images/pdf/${imageName}`;
        },
    }
}));

app.set("view engine", 'handlebars');
app.set('views', path.join(__dirname, "app", "views"));
app.use("/", express.static(path.join(__dirname, "app", "public")));

app.get("/view-pdf-html", (req, res) => {
    res.render("pdf/report");
});


app.get('/generate-pdf', async (req, res) => {
  try {
    // Renderizar la plantilla con los datos del servidor
    const htmlContent = await renderTemplate("pdf/report", {});

    // Generar el PDF con Puppeteer
    const pdfBuffer = await generatePDF(htmlContent);
    console.log(pdfBuffer)

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="seguros.pdf"',
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar el PDF.' });
  }
});
// Función para renderizar la plantilla Handlebars
async function renderTemplate(templateName, data) {
  return new Promise((resolve, reject) => {
    app.render(templateName, data, (err, html) => {
      if (err) reject(err);
      else resolve(html);
    });
  });
}

// Función para generar PDF con Puppeteer
async function generatePDF(htmlContent) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(htmlContent, {
    waitUntil: ['domcontentloaded', 'networkidle0'],
  });
  const pdfBuffer = await page.pdf({ format: 'A2' });
  await browser.close();
  return pdfBuffer;
}


// app.use(helmet());

// const limiter = rateLimit({
//   windowMs: 5 * 60 * 1000,
//   max: 100,
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
    console.log("❌ User Admin was not created:", error.message);
  });

app.get(`${envConfig.urlPath}healtcheck`, (req, res) => {
  res.status(200).json({ message: "version 1.0.0" });
});
app.use(envConfig.urlPath, router);

app.listen(envConfig.port, () => {
  processInvoicesTask();
  processPayRollsTask();
  // processMessageQueue();
  console.log(`Running in proyect port : ${envConfig.port}`);
});
