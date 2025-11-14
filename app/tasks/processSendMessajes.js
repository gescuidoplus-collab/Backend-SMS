import cron from "node-cron";
import {send_telegram_message} from "../services/sendMessageTelegram.js"
//import { enqueueWhatsAppMessage } from "../services/redis-messages.js";

export const processMessageQueue = () => {
  const executeTask = async () => {
    //await enqueueWhatsAppMessage();
    console.log(`Se ejecuto la tarea de envio de mensajes`)
    // send_telegram_message(
    //   "Guardado de nóminas completado 🎉"
    // );
  };

  // Ejecución inicial con retraso
  // setTimeout(executeTask, 10 * 60 * 1000);

 // cron.schedule("0 9 1 * *", executeTask);
};
