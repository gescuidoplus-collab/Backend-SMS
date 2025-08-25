import { MessageLog } from "../schemas/index.js";
import { formatWhatsAppNumber } from "../utils/formatWhatsAppNumber.js";
import {
  sendWhatsAppMessage,
  sendWhatsAppMessageWithPDF,
} from "./twilioService.js";
import { send_telegram_message } from "./sendMessageTelegram.js";
import { envConfig } from "../config/index.js";

const BATCH_DELAY = 5500; // Mayor retardo entre mensajes para evitar spam

const MESSAGES_INVOCES = [
  "¡Hola {{name}}! Adjuntamos tu factura. Si tienes alguna duda, estamos para ayudarte.",
  "Factura generada automáticamente y enviada a {{name}}. ¡Gracias por confiar en nosotros!",
  "{{name}}, te enviamos tu factura solicitada de forma automática. No dudes en contactarnos si necesitas algo más.",
  "Factura disponible (proceso automático) para {{name}}. ¡Gracias por tu preferencia!",
  "Aquí está tu factura generada automáticamente, {{name}}. ¡Que tengas un excelente día!",
];

const MESSAGES_PAYROLL_USER = [
  "¡Hola {{name}}! Te enviamos tu comprobante de pago de nómina.",
  "Adjuntamos tu recibo de pago generado automáticamente para {{name}}. Si tienes preguntas, estamos a tu disposición.",
  "{{name}}, aquí tienes tu comprobante de nómina enviado por nuestro sistema automático. ¡Gracias por tu trabajo!",
  "Recibo de nómina enviado automáticamente para {{name}}. ¡Que tengas un gran día!",
  "Te compartimos tu recibo de pago generado por nuestro sistema, {{name}}. ¡Gracias por ser parte del equipo!",
];

const MESSAGES_PAYROLL_EMPLOYE = [
  "¡Hola {{name}}! Te enviamos tu comprobante de pago de nómina.",
  "Adjuntamos tu recibo de pago generado automáticamente para {{name}}. Si tienes preguntas, estamos a tu disposición.",
  "{{name}}, aquí tienes tu comprobante de nómina enviado por nuestro sistema automático. ¡Gracias por tu trabajo!",
  "Recibo de nómina enviado automáticamente para {{name}}. ¡Que tengas un gran día!",
  "Te compartimos tu recibo de pago generado por nuestro sistema, {{name}}. ¡Gracias por ser parte del equipo!",
];

// Procesa un mensaje individual (antes era manejado por Redis subscriber)
async function processSingleMessage({
  logId,
  recipient,
  phoneNumber,
  phoneNumberTwo,
  messageType,
}) {
  const log = await MessageLog.findById(logId);

  let success = true;
  let errorMsg = "";

  // Función para enviar mensaje y actualizar log
  async function sendAndLog(number, target, msg) {
    const formattedNumber = formatWhatsAppNumber("+58" + number);
    // Personaliza el mensaje con el nombre si existe
    let personalizedMsg = msg;
    if (target && target.fullName) {
      personalizedMsg = msg.replace(/{{name}}/g, target.fullName.split(" ")[0]);
    } else {
      personalizedMsg = msg.replace(/{{name}}/g, "");
    }
    let fileURL = "";
    if (messageType === "payRoll") {
      //console.log(envConfig.apiUrl + "/api/v1/payrolls/" + log.id);
      fileURL = envConfig.apiUrl + "/api/v1/payrolls/" + log.id;
    } else {
      // console.log(envConfig.apiUrl + "/api/v1/invoces/" + log.id);
      fileURL = envConfig.apiUrl + "/api/v1/invoces/" + log.id;
    }

    // const result = await sendWhatsAppMessage(formattedNumber, personalizedMsg);
    const result = await sendWhatsAppMessageWithPDF(
      formattedNumber,
      personalizedMsg,
      fileURL
    );

    if (!result.success) {
      success = false;
      errorMsg = result.error;
      // Reportar el error a Telegram para monitoreo
      send_telegram_message(
        `Error al enviar WhatsApp a ${formattedNumber}: ${result.error}`
      );
    } else {
      if (target) {
        target.message = personalizedMsg;
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
      log.markModified("recipient");
    }

    // Mensaje para el empleado (employe)
    const employeMessage =
      MESSAGES_PAYROLL_EMPLOYE[
        Math.floor(Math.random() * MESSAGES_PAYROLL_EMPLOYE.length)
      ];
    if (phoneNumberTwo) {
      await sendAndLog(phoneNumberTwo, log.employe, employeMessage);
      log.markModified("employe");
    }
  } else {
    // Solo invoice: enviar a phoneNumber
    const invoiceMessage =
      MESSAGES_INVOCES[Math.floor(Math.random() * MESSAGES_INVOCES.length)];
    if (phoneNumber) {
      await sendAndLog(phoneNumber, log.recipient, invoiceMessage);
      log.markModified("recipient");
    }
  }

  // Actualizar el estado y sentAt
  log.status = success ? "success" : "failure";
  log.sentAt = new Date(); // Actualizar sentAt con la fecha y hora actual
  if (!success) log.reason = errorMsg;

  await log.save();
  await new Promise((res) => setTimeout(res, BATCH_DELAY));
}

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export const enqueueWhatsAppMessage = async () => {
  const BATCH_SIZE = 20; // Menos mensajes por lote para menor riesgo
  const MIN_DELAY = 2000; // 2 segundos mínimo
  const MAX_DELAY = 5000; // 5 segundos máximo

  const now = new Date();
  const monthActualy = now.getMonth() + 1;
  const yearActualy = now.getFullYear();
  const logs = await MessageLog.find({
    mes: 7, // monthActualy -1,
    ano: yearActualy,
    status: "pending",
  });

  console.log("Logs a enviar:", logs.length);
  if (logs.length > 0) {
    const chunks = chunkArray(logs, BATCH_SIZE);

    for (const [i, chunk] of chunks.entries()) {
      for (const log of chunk) {
        // Antes publicábamos en Redis; ahora procesamos directamente
        await processSingleMessage({
          logId: log._id,
          recipient: log.recipient,
          phoneNumber: log.recipient.phoneNumber,
          phoneNumberTwo: log.employe?.phoneNumber || null,
          messageType: log.messageType,
          fileUrl: log.fileUrl || null,
        });
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
