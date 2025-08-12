import cron from "node-cron";
import {send_telegram_message} from "../services/sendMessageTelegram.js"
// import { enqueueWhatsAppMessage } from "../services/redis-messages.js";

export const processMessageQueue = () => {
  console.log('Ejecucion envio Masivo')
  // setTimeout(async () => {
  //     await enqueueWhatsAppMessage();
  //     send_telegram_message(
  //       "Ejecución inicial de Guardado de facturas por WhatsApp completada 🎉"
  //     );
  //   }, 40000);
  
  // cron.schedule("* * * * *", async () => {
  //   await enqueueWhatsAppMessage();
  // });
  // cron.schedule("30 9 1 * *", async () => {
  //   await enqueueWhatsAppMessage();
  // });
};