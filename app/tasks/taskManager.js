import { processInvoicesTask } from "./processInvoicesTask.js";
import { processPayRollsTask } from "./processPayRollsTask.js";
import { send_telegram_message } from "../services/sendMessageTelegram.js";
import cron from "node-cron";
import { envConfig } from "../config/index.js";

// Ejecuta las tareas en serie, nunca en paralelo
async function runAllTasks() {
  try {
    await processInvoicesTask();
    // Espera 25 segundos entre tareas para evitar conflicto de sesión/cookie
    await new Promise((res) => setTimeout(res, 25000));
    await processPayRollsTask();
    const now = new Date();
    send_telegram_message(
      `Guardo de Facturas y Nominas Finalizado ✅ - Fecha: ${now.toLocaleDateString()} Hora: ${now.toLocaleTimeString()}`
    );
    await new Promise((res) => setTimeout(res, 5000));
  } catch (err) {
    send_telegram_message(`Error en ejecución de tareas: ${err.message}`);
  }
}

export { runAllTasks };

let isRunAllTasksExecuting = false;


cron.schedule("0 8-14 * * 1-5", async () => {
    if (isRunAllTasksExecuting) return;
    isRunAllTasksExecuting = true;
    try {
      await runAllTasks();
    } finally {
      isRunAllTasksExecuting = false;
    }
});

