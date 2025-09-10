import cron from "node-cron";
import { send_telegram_message } from "../services/sendMessageTelegram.js";
import { enqueueWhatsAppMessage } from "../services/redis-messages.js";
import { envConfig } from "../config/index.js";

export const processMessageQueue = async () => {
  const executeTask = async () => {
    console.log("Iniciando tarea programada de mensajes masivos");
    await enqueueWhatsAppMessage();
    // send_telegram_message("Envio de mensaje masivos 🎉");
    console.log("Tarea programada ejecutada de mensajes masivos");
  };
  if (envConfig.env === 'development') {
    // Programar solo en desarrollo
    cron.schedule("27 14 * * *", executeTask, { timezone: "UTC" });
  }
  return executeTask();
};
