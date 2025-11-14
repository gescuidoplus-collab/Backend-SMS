import fs from "fs/promises";
import path from "path";
import cron from "node-cron";
import { envConfig } from "../config/index.js";
import { send_telegram_message } from "../services/sendMessageTelegram.js";

const MEDIA_ROOT = path.join(process.cwd(), "public", "media");
const SUBFOLDERS = ["payrolls", "pdfs"]; // Carpetas a limpiar

async function safeUnlink(filePath) {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (err) {
    // Ignorar si el archivo no existe o no hay permisos; registrar otros errores
    if (err && err.code !== "ENOENT") {
      console.warn(`No se pudo eliminar ${filePath}: ${err.message}`);
    }
    return false;
  }
}

async function cleanDirectory(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const deletions = entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Borrar recursivamente contenido y luego la carpeta si queda vacía
        await cleanDirectory(full);
        try { await fs.rmdir(full); } catch (_) {}
      } else {
        await safeUnlink(full);
      }
    });
    await Promise.allSettled(deletions);
  } catch (err) {
    if (err && err.code !== "ENOENT") {
      console.warn(`Error leyendo ${dir}: ${err.message}`);
    }
  }
}

export const runCleanupMedia = async () => {
  const started = Date.now();
  const targets = SUBFOLDERS.map((sf) => path.join(MEDIA_ROOT, sf));
  await Promise.all(targets.map((t) => cleanDirectory(t)));
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  try {
    send_telegram_message(`Limpieza de media completada en ${secs}s 🧹`);
  } catch (_) {}
};

// Programar cada 3 días a las 03:00 UTC en desarrollo
if (envConfig.env === "development") {
  cron.schedule("0 3 */3 * *", () => {
    runCleanupMedia().catch((e) => console.error("Cleanup media error", e));
  }, { timezone: "UTC" });
}

export default { runCleanupMedia };
