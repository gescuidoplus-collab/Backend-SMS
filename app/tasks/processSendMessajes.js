import cron from "node-cron";
import { enqueueWhatsAppMessage } from "../services/redis-messages.js";

export const processMessageQueue = () => {
  console.log('Ejecucion envio Masivo')
  // cron.schedule("* * * * *", async () => {
  //   await enqueueWhatsAppMessage();
  // });
  // cron.schedule("30 9 1 * *", async () => {
  //   await enqueueWhatsAppMessage();
  // });
};

setTimeout(async () => {
  await enqueueWhatsAppMessage();
}, 30000);
