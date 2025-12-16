import cron from "node-cron";
import { send_telegram_message } from "../services/sendMessageTelegram.js";
import { enqueueWhatsAppMessage } from "../services/redis-messages.js";
import { envConfig } from "../config/index.js";

export const processMessageQueue = async () => {
  const executeTask = async () => {
    const now = new Date();
    await enqueueWhatsAppMessage();
    send_telegram_message(
      `Envio de mensajes finalizado ✅ - Fecha: ${now.toLocaleDateString()} Hora: ${now.toLocaleTimeString()}`
    );
  };
  return executeTask();
};

let isProcessMessageQueueExecuting = false;

cron.schedule("10 * * * *", async () => {
    if (isProcessMessageQueueExecuting) return;
    isProcessMessageQueueExecuting = true;
    try {
      await processMessageQueue();
    } finally {
      isProcessMessageQueueExecuting = false;
    }
});

