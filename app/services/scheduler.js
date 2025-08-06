import cron from "node-cron";

import { saveInvoceCloudNavis } from "./procces-invoces.js";
import { enqueueInvoicesWhatsApp } from "./redis-messages.js";
import { send_telegram_message } from "./send-telegram-message.js";

export const monthlyTask = () => {
  cron.schedule("0 9 1 * *", async () => {
    await saveInvoceCloudNavis();
    send_telegram_message(
      "Cron de Guardado de facturas por WhatsApp Compleado 🎉"
    );
  });
  cron.schedule("15 9 1 * *", async () => {
    await enqueueInvoicesWhatsApp();
    send_telegram_message(
      "Cron de Envío de facturas por WhatsApp Compleado 🎉"
    );
  });
};