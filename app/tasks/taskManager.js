import cron from "node-cron";
import { processInvoicesTask } from "./processInvoicesTask.js";
import { processPayRollsTask } from "./processPayRollsTask.js";
import { send_telegram_message } from "../services/sendMessageTelegram.js";

// Ejecuta las tareas en serie, nunca en paralelo
async function runAllTasks() {
  try {
    console.log("Inicio de tareas de facturas y nóminas");
    await processInvoicesTask();
    // Espera 30 segundos entre tareas para evitar conflicto de sesión/cookie
    await new Promise((res) => setTimeout(res, 30000));
    await processPayRollsTask();
    send_telegram_message("Tareas de facturas y nóminas completadas ✅");
  } catch (err) {
    send_telegram_message(`Error en ejecución de tareas: ${err.message}`);
  }
}

// Cron job: ejecuta el manager el día 1 de cada mes a las 9:00
cron.schedule("0 9 1 * *", runAllTasks);

cron.schedule("0 11 * * *", runAllTasks, {
  timezone: "Etc/UTC",
});

// Para pruebas manuales
export { runAllTasks };
