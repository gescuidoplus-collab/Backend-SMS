import Redis from "ioredis";
import { MessageLog } from "../schemas/index.js";
import { formatWhatsAppNumber } from "../utils/formatWhatsAppNumber.js";
import {
  sendWhatsAppMessageWithPDF,
  sendWhatsAppMessage,
} from "./twilioService.js";
import { send_telegram_message } from "./sendMessageTelegram.js";

const subscriber = new Redis();
const publisher = new Redis();
const BATCH_DELAY = 3000;

const MESSAGES_INVOCES = [
  "¡Hola! Este es un mensaje automático: adjuntamos tu factura. Si tienes alguna duda, estamos para ayudarte.",
  "Factura generada automáticamente y enviada. ¡Gracias por confiar en nosotros!",
  "Te enviamos tu factura solicitada de forma automática. No dudes en contactarnos si necesitas algo más.",
  "Factura disponible (proceso automático). ¡Gracias por tu preferencia!",
  "Aquí está tu factura generada automáticamente. ¡Que tengas un excelente día!",
];

const MESSAGES_PAYROLL_USER = [
  "¡Hola! Este es un mensaje automático: te enviamos tu comprobante de pago de nómina.",
  "Adjuntamos tu recibo de pago generado automáticamente. Si tienes preguntas, estamos a tu disposición.",
  "Aquí tienes tu comprobante de nómina enviado por nuestro sistema automático. ¡Gracias por tu trabajo!",
  "Recibo de nómina enviado automáticamente. ¡Que tengas un gran día!",
  "Te compartimos tu recibo de pago generado por nuestro sistema. ¡Gracias por ser parte del equipo!",
];

const MESSAGES_PAYROLL_EMPLOYE = [
  "¡Hola! Este es un mensaje automático: te enviamos tu comprobante de pago de nómina.",
  "Adjuntamos tu recibo de pago generado automáticamente. Si tienes preguntas, estamos a tu disposición.",
  "Aquí tienes tu comprobante de nómina enviado por nuestro sistema automático. ¡Gracias por tu trabajo!",
  "Recibo de nómina enviado automáticamente. ¡Que tengas un gran día!",
  "Te compartimos tu recibo de pago generado por nuestro sistema. ¡Gracias por ser parte del equipo!",
];

subscriber.subscribe("whatsapp_invoice_channel");

subscriber.on("message", async (channel, message) => {
  const { logId, recipient, phoneNumber, phoneNumberTwo, messageType } =
    JSON.parse(message);

  const log = await MessageLog.findById(logId);

  let success = true;
  let errorMsg = "";

  // Función para enviar mensaje y actualizar log
  async function sendAndLog(number, target, msg) {
    const formattedNumber = formatWhatsAppNumber("+58" + number);
    const result = await sendWhatsAppMessageWithPDF(
      formattedNumber,
      msg,
      log.fileUrl
    );
    if (!result.success) {
      success = false;
      errorMsg = result.error;
    } else {
      // Agregar el campo `message` al target (recipient o employe)
      if (target) {
        target.message = msg;
      }
    }
  }

  if (messageType === "payRoll") {
    // Mensaje para el empleador (recipient)
    const recipientMessage =
      MESSAGES_PAYROLL_USER[
        Math.floor(Math.random() * MESSAGES_PAYROLL_USER.length)
      ];
    if (phoneNumber) {
      await sendAndLog(phoneNumber, log.recipient, recipientMessage);
      log.recipient.message = recipientMessage; // Asignar el mensaje
      log.markModified("recipient"); // Marcar como modificado
    }

    // Mensaje para el empleado (employe)
    const employeMessage =
      MESSAGES_PAYROLL_EMPLOYE[
        Math.floor(Math.random() * MESSAGES_PAYROLL_EMPLOYE.length)
      ];
    if (phoneNumberTwo) {
      await sendAndLog(phoneNumberTwo, log.employe, employeMessage);
      log.employe.message = employeMessage; // Asignar el mensaje
      log.markModified("employe"); // Marcar como modificado
    }
  } else {
    // Solo invoice: enviar a phoneNumber
    const invoiceMessage =
      MESSAGES_INVOCES[Math.floor(Math.random() * MESSAGES_INVOCES.length)];
    if (phoneNumber) {
      await sendAndLog(phoneNumber, log.recipient, invoiceMessage);
      log.recipient.message = invoiceMessage; // Asignar el mensaje
      log.markModified("recipient"); // Marcar como modificado
    }
  }

  // Actualizar el estado y sentAt
  log.status = success ? "success" : "failure";
  log.sentAt = new Date(); // Actualizar sentAt con la fecha y hora actual
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
            phoneNumber: log.recipient.phoneNumber,
            phoneNumberTwo: log.employe?.phoneNumber || null,
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
