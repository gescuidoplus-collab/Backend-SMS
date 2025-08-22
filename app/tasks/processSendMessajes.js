import cron from "node-cron";
import { send_telegram_message } from "../services/sendMessageTelegram.js";
import { enqueueWhatsAppMessage } from "../services/redis-messages.js";
import { envConfig } from "../config/index.js";

export const processMessageQueue = () => {
  const executeTask = async () => {
    await enqueueWhatsAppMessage();
    send_telegram_message("Envio de mensaje masivos 🎉");
  };
  // En producción, será invocado desde /api/cron para no duplicar
  if (envConfig.env === 'development') {
    cron.schedule("45 00 * * *", executeTask);
  }
};
