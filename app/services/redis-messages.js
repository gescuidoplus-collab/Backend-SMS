import { MessageLog } from "../schemas/index.js";
import mongoose from "mongoose";
import { mongoClient } from "../config/index.js";
import { formatWhatsAppNumber } from "../utils/formatWhatsAppNumber.js";
import {
  sendInvoceTemplate,
  sendInvocePayRool,
  sendTextForWhatsApp,
} from "./twilioService.js";
import { send_telegram_message } from "./sendMessageTelegram.js";
import { envConfig } from "../config/index.js";

const BATCH_DELAY = 5500; // Mayor retardo entre mensajes para evitar spam

// Asegura conexión a Mongo (evita buffering en entornos serverless)
async function ensureDb() {
  if (mongoose.connection.readyState !== 1) {
    await mongoClient();
  }
}

// Procesa un mensaje individual (antes era manejado por Redis subscriber)
async function processSingleMessage({
  logId,
  recipient,
  phoneNumber,
  phoneNumberTwo,
  messageType,
}) {
  await ensureDb();
  const log = await MessageLog.findById(logId);

  let success = true;
  let errorMsg = "";

  // Función para enviar mensaje y actualizar log
  async function sendAndLog(number, target, type) {
    const formattedNumber = formatWhatsAppNumber("+58" + number);
    // Construir URL de archivo según tipo
    const fileURL =
      type === "invoice"
        ? `${envConfig.apiUrl}/api/v1/invoices/${log.source}/factura.pdf`
        : `${envConfig.apiUrl}/api/v1/payrolls/${log.source}/nomina.pdf`;
    console.log(
      `Enviando WhatsApp [${type}] a ${formattedNumber} con archivo ${fileURL}`
    );
    // Nombre corto para plantilla
    const shortName = target?.fullName ? target.fullName.split(/\s+/)[0] : "";
    let result;
    // Seleccionar plantilla según tipo
    if (type === "invoice") {
      result = await sendInvoceTemplate(formattedNumber, shortName, fileURL);
    } else if (type === "payrollUser") {
      result = await sendInvocePayRool(
        formattedNumber,
        shortName,
        fileURL,
        "user"
      );
    } else if (type === "payrollEmployee") {
      result = await sendInvocePayRool(
        formattedNumber,
        shortName,
        fileURL,
        "employee"
      );
    } else {
      // Fallback a invoice
      result = await sendInvoceTemplate(formattedNumber, shortName, fileURL);
    }

    if (!result.success) {
      success = false;
      errorMsg = result.error;
      // Reportar el error a Telegram para monitoreo
      send_telegram_message(
        `Error al enviar WhatsApp a ${formattedNumber}: ${result.error}`
      );
    } else {
      // asignar mensaje corto a target
      if (target) target.message = shortName;
    }
  }

  if (messageType === "payRoll") {
    // Nómina - usuario
    if (phoneNumber) {
      await sendAndLog(phoneNumber, log, log.recipient, "payrollUser");
      log.markModified("recipient");
    }
    // Nómina - empleado
    if (phoneNumberTwo) {
      await sendAndLog(phoneNumberTwo, log, log.employe, "payrollEmployee");
      log.markModified("employe");
    }
  } else {
    // Factura
    if (phoneNumber) {
      await sendAndLog(phoneNumber, log, log.recipient, "invoice");
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
  await ensureDb();
  const BATCH_SIZE = 20; // Menos mensajes por lote para menor riesgo
  const MIN_DELAY = 2000; // 2 segundos mínimo
  const MAX_DELAY = 5000; // 5 segundos máximo

  const now = new Date();
  const monthActualy = now.getMonth() + 1;
  const yearActualy = now.getFullYear();
  console.log("Antes de la consulta");
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
          total: log.total || null,
          fechaExpedicion: log.fechaExpedicion || null,
          tipoPago: log.tipoPago || null,
          numero: log.numero || null,
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
