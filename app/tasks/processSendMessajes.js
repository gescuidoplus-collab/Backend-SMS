import cron from "node-cron";
import { send_telegram_message } from "../services/sendMessageTelegram.js";
import { enqueueWhatsAppMessage } from "../services/redis-messages.js";

export const processMessageQueue = () => {
  const executeTask = async () => {
    await enqueueWhatsAppMessage();
    send_telegram_message("Envio de mensaje masivos 🎉");
  };
  // // Ejecución inicial con retraso
  // setTimeout(executeTask, 10000); // Ejecuta la tarea en 10 segundos

  // cron.schedule("0 9 1 * *", executeTask);

  cron.schedule("45 00 * * *", executeTask);
};
