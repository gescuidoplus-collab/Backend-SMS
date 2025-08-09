import Redis from "ioredis";
import { MessageLog } from "../schemas/index.js";
import { formatWhatsAppNumber } from "../utils/formatWhatsAppNumber.js";
import {
  sendWhatsAppMessageWithPDF,
  sendWhatsAppMessage,
} from "./twilioService.js";
import { send_telegram_message } from "./sendMessageTelegram.js";
// 🚨 ⚠️ 🎉
const subscriber = new Redis();
const publisher = new Redis();
const BATCH_DELAY = 3000;

const MESSAGES_INVOCES = [
  "¡Hola! Aquí tienes tu factura. Si tienes alguna duda, estamos para ayudarte.",
  "Adjuntamos tu factura correspondiente. ¡Gracias por confiar en nosotros!",
  "Te enviamos tu factura solicitada. No dudes en contactarnos si necesitas algo más.",
  "Factura disponible. ¡Gracias por tu preferencia!",
  "Aquí está tu factura. ¡Que tengas un excelente día!",
];

const MESSAGES_PAYROOL = [
  "¡Hola! Te enviamos tu comprobante de pago de nómina.",
  "Adjuntamos tu recibo de pago. Si tienes preguntas, estamos a tu disposición.",
  "Aquí tienes tu comprobante de nómina. ¡Gracias por tu trabajo!",
  "Recibo de nómina enviado. ¡Que tengas un gran día!",
  "Te compartimos tu recibo de pago. ¡Gracias por ser parte del equipo!",
];

subscriber.subscribe("whatsapp_invoice_channel");

subscriber.on("message", async (channel, message) => {
  const { logId, recipient, phoneNumber, phoneNumberTwo, messageType } =
    JSON.parse(message);

  const log = await MessageLog.findById(logId);

  // Selecciona el array de mensajes según el tipo
  let messagesArray = [];
  if (messageType === "payRool") {
    messagesArray = MESSAGES_PAYROOL;
  } else {
    messagesArray = MESSAGES_INVOCES;
  }

  // Elige un mensaje aleatorio
  const msg =
    messagesArray.length > 0
      ? messagesArray[Math.floor(Math.random() * messagesArray.length)]
      : `Toma tu Factura con ID:${logId}`;

  let success = true;
  let errorMsg = "";

  // Función para enviar mensaje y actualizar log
  async function sendAndLog(number) {
    const formattedNumber = formatWhatsAppNumber("+58" + number);
    const result = await sendWhatsAppMessageWithPDF(
      formattedNumber,
      msg,
      log.fileUrl
    );
    if (!result.success) {
      success = false;
      errorMsg = result.error;
    }
  }

  if (messageType === "payRool") {
    // Enviar a phoneNumber
    if (phoneNumber) await sendAndLog(phoneNumber);
    // Enviar a phoneNumberTwo si existe
    if (phoneNumberTwo) await sendAndLog(phoneNumberTwo);
  } else {
    // Solo invoce: enviar a phoneNumber
    if (phoneNumber) await sendAndLog(phoneNumber);
  }

  log.status = success ? "success" : "failure";
  if (!success) log.reason = errorMsg;

  await log.save();
  await new Promise((res) => setTimeout(res, BATCH_DELAY));
});

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export const enqueueWhatsAppMessage = async () => {
  const BATCH_SIZE = 30; // Más mensajes por lote
  const MIN_DELAY = 1000; // 1 segundo
  const MAX_DELAY = 2000; // 3 segundos

  const now = new Date();
  const monthActualy = now.getMonth() + 1;
  const yearActualy = now.getFullYear();
  const logs = await MessageLog.find({
    mes: monthActualy - 1,
    ano: yearActualy,
    status: "pending",
  });

  console.log("Cantidad de logs :", logs.length);
  if (logs.length > 0) {
    const chunks = chunkArray(logs, BATCH_SIZE);

    for (const [i, chunk] of chunks.entries()) {
      for (const log of chunk) {
        await publisher.publish(
          "whatsapp_invoice_channel",
          JSON.stringify({
            logId: log._id,
            recipient: log.recipient,
            phoneNumber: log.phoneNumber,
            phoneNumberTwo: log.phoneNumberTwo || null,
            messageType: log.messageType,
            fileUrl: log.fileUrl || null,
          })
        );
        // Retardo aleatorio entre mensajes
        const delay =
          Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
        await new Promise((res) => setTimeout(res, delay));
      }
      // Retardo extra entre lotes
      if (i < chunks.length - 1) {
        await new Promise((res) => setTimeout(res, 5000)); // 5 segundos entre lotes
      }
    }
    send_telegram_message(`Mensajes enviados: ${logs.length}`);
  } else {
    send_telegram_message("⚠️ Mensajes no enviados logs == []");
  }
};
