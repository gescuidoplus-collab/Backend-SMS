import express from "express";
import path from "path";
import { envConfig, mongoClient } from "./app/config/index.js";
import { router } from "./app/routers/index.js";
import { createUser } from "./app/utils/create-auth.js";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { processMessageQueue, runCleanupMedia } from "./app/tasks/index.js";
import { runAllTasks } from "./app/tasks/taskManager.js";

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3032",
      "https://frontend-sms.vercel.app",
      "https://backend-sms-three.vercel.app",
    ],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
  })
);

if (envConfig.env === "development") {
  app.use(morgan("dev"));
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

// Endpoint invocado por Vercel Cron Job (GET)
app.get("/api/cron", async (req, res) => {
  try {
    console.log("Cron job triggered");
    // Verifica user-agent de Vercel o un token opcional
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
    console.error("Cron endpoint error", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/cron-send", async (req, res) => {
  try {
    // Verifica user-agent de Vercel o un token opcional
    console.log("Cron SEND job triggered");
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
    await mongoClient(); // asegurar conexión antes de la cola
    await processMessageQueue(); // esperar envío
    res.json({ ok: true, runAt: new Date().toISOString(), processed: true });
  } catch (e) {
    console.error("Cron endpoint error", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Endpoint opcional para limpieza de media (invocado por Vercel Cron si se desea)
app.get("/api/cron-clean-media", async (req, res) => {
  try {
    console.log("Cron CLEAN MEDIA triggered");
    const ua = (req.headers["user-agent"] || "").toLowerCase();
    const isVercel = ua.includes("vercel-cron");
    const provided = req.headers["x-cron-secret"];
    if (!isVercel && envConfig.cronSecret && provided !== envConfig.cronSecret) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    await runCleanupMedia();
    res.json({ ok: true, runAt: new Date().toISOString(), cleaned: true });
  } catch (e) {
    console.error("Cron clean media error", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(envConfig.port, () => {
  console.log(`Running in proyect port : ${envConfig.port}`);
  // Solo ejecutar cron locales si estamos en desarrollo; en Vercel usaremos el endpoint /api/cron
  if (envConfig.env === "development") {
    runAllTasks(); // Ejecuta las tareas programadas al iniciar el servidor
    //processMessageQueue(); // Inicia el procesamiento de la cola de mensajes
  }
});
