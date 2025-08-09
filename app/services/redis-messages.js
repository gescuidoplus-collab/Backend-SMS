import Redis from "ioredis";
import { MessageLog } from "../schemas/index.js";
import { generatePDF } from "./generatePdf.js";
import { formatWhatsAppNumber } from "../utils/formatWhatsAppNumber.js";
import {
  sendWhatsAppMessageWithPDF,
  sendWhatsAppMessage,
} from "./twilioService.js";
import { send_telegram_message } from "./sendMessageTelegram.js";
// 🚨 ⚠️ 🎉
const subscriber = new Redis();
const publisher = new Redis();

const BATCH_DELAY = 5000;
subscriber.subscribe("whatsapp_invoice_channel");
subscriber.on("message", async (channel, message) => {
  const { logId, recipient, invoce } = JSON.parse(message);
  const log = await MessageLog.findById(logId);
  const pdf = await generatePDF(invoce);
  const msg = `Toma tu Factura con ID:${log.invoiceID}`;
  if (!pdf) {
    log.status = "failure";
    log.reason = "No se pudo generar la URL del PDF";
  } else {
    const formattedNumber = formatWhatsAppNumber("+58" + recipient);
    const result = await sendWhatsAppMessage(formattedNumber, msg);
    if (!result.success) {
      log.status = "failure";
      log.reason = result.error;
    } else {
      log.status = "success";
      log.pdfUrl = pdf.publicUrl;
    }
  }
  await log.save();
  await new Promise((res) => setTimeout(res, BATCH_DELAY));
});

export const enqueueInvoicesWhatsApp = async () => {
  const now = new Date();
  const monthActualy = now.getMonth() + 1;
  const yearActualy = now.getFullYear();
  const logs = await MessageLog.find({
    mes: monthActualy - 1,
    ano: yearActualy,
    status: "pending",
  });
  if (logs.length > 0) {
    for (const log of logs) {
      const invoce = log.getDecryptedData();
      await publisher.publish(
        "whatsapp_invoice_channel",
        JSON.stringify({
          logId: log._id,
          recipient: log.recipient,
          invoce,
        })
      );
    }
    // Ejecuta send_telegram_message después de enviar todos los mensajes
    send_telegram_message(`Mensaje enviados ${logs.length}`);
  } else {
    send_telegram_message("⚠️ Mensajes no enviados logs == []");
  }
};
