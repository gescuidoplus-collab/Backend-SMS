import cron from "node-cron";
import {
  setCookie,
  loginCloudnavis,
  listInvoices,
  logout,
  getUsers,
  downloadInvoce,
} from "../services/apiCloudnavis.js";
import { send_telegram_message } from "../services/sendMessageTelegram.js";
import { MessageLog } from "../schemas/index.js";
import { envConfig } from "../config/index.js";


// Función para pausar la ejecución por un tiempo determinado
function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Función para validar UUID v4
function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Función para validar si un campo está pendiente o es nulo
function isPendingOrNull(val) {
  return (
    val === null ||
    val === undefined ||
    (typeof val === 'string' && (val.trim() === '' || val.trim().toUpperCase() === 'PENDIENTE'))
  );
}

// Función para validar si una factura cumple con los requisitos para envío
function canSendInvoice(invoice) {
  //1. whatsappStatus debe ser "PENDING"
  // if (invoice.whatsappStatus !== 'PENDING') {
  //   return { valid: false, reason: `whatsappStatus es "${invoice.whatsappStatus}", debe ser "PENDING"` };
  // }

  // 2. firma, codigoQr y codigoIdentificativo no deben ser null o "PENDIENTE"
  if (isPendingOrNull(invoice.firma)) {
    return { valid: false, reason: 'firma es null, vacío o "PENDIENTE"' };
  }
  if (isPendingOrNull(invoice.codigoQr)) {
    return { valid: false, reason: 'codigoQr es null, vacío o "PENDIENTE"' };
  }
  if (isPendingOrNull(invoice.codigoIdentificativo)) {
    return { valid: false, reason: 'codigoIdentificativo es null, vacío o "PENDIENTE"' };
  }

  // 3. idUsuario debe ser un UUID válido y no debe ser null
  if (!isValidUUID(invoice.idUsuario)) {
    return { valid: false, reason: `idUsuario "${invoice.idUsuario}" no es un UUID válido` };
  }

  return { valid: true };
}

// Función genérica para manejar reintentos
async function withRetries(task, maxRetries, delay) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt < maxRetries - 1) {
        console.log(
          `Reintento ${attempt + 1}/${maxRetries} fallido. Esperando...`
        );
        await esperar(delay);
      } else {
        throw error; // Lanza el error si se agotaron los reintentos
      }
    }
  }
}

// Función principal para guardar facturas
const saveInvoicesTask = async () => {
  try {
    const status_code = await setCookie();
    if (status_code !== 200) {
      throw new Error("No se pudo establecer la cookie.");
    }

    // Intentar iniciar sesión con reintentos
    const login_status = await withRetries(loginCloudnavis, 3, 3000);
    if (login_status !== 200) {
      send_telegram_message(
        "No se pudo hacer login después de varios intentos. en saveInvoicesTask"
      );
      return;
    }

    const now = new Date();
    //const currentMonth = now.getMonth() + 1; // Mes actual (1-12)
    const currentMonth = 8;
    const currentYear = now.getFullYear();

    // console.log(`Mes de Busqueda en Factura: ${currentMonth}`);

    // Obtener facturas del mes anterior
    const invoices = await listInvoices(currentYear, currentMonth);
    if (invoices && invoices.facturas.length > 0) {
      for (const invoice of invoices.facturas) {
        // Filtrar por tipo de pago
        if (invoice.tipoPago !== "Remesa") {
          continue;
        }

        // Validar si la factura cumple con los requisitos para envío
        const validation = canSendInvoice(invoice);
        if (!validation.valid) {
          console.log(
            `Omitiendo factura ${invoice.serie}${invoice.separador}${invoice.numero} (ID: ${invoice.id}): ${validation.reason}`
          );
          continue;
        }

        try {
          // Obtener información del usuario
          const user = await withRetries(
            () => getUsers(invoice.idUsuario),
            3,
            3000
          );

          const log = new MessageLog({
            source: invoice.id,
            recipient: {
              id: invoice.idUsuario,
              fullName: invoice?.nombreDestinatario || null,
              phoneNumber: user.telefono1,
            },
            status: "pending",
            mes: invoice.mes,
            ano: invoice.ano,
            numero: invoice.numero,
            serie: invoice.serie,
            fechaExpedicion: invoice.fechaExpedicion,
            total: invoice.total,
            tipoPago: invoice.tipoPago,
            separador: invoice.separador,
            numero: invoice.numero,
            messageType: "invoice",
          });
          await log.save();

          // Manejar segundo contacto si existe
          if (user.nombre2?.trim() && user.telefono2?.trim()) {
            const secondLog = new MessageLog({
              source: invoice.id,
              recipient: {
                id: invoice.idUsuario,
                fullName: user.nombre2.trim(),
                phoneNumber: user.telefono2.trim(),
              },
              status: "pending",
              mes: invoice.mes,
              ano: invoice.ano,
              numero: invoice.numero,
              serie: invoice.serie,
              fechaExpedicion: invoice.fechaExpedicion,
              total: invoice.total,
              tipoPago: invoice.tipoPago,
              separador: invoice.separador,
              messageType: "invoice",
            });
            await secondLog.save();
          }

          await esperar(150); // Pausa entre registros
        } catch (error) {
          console.log(
            `Error procesando factura ${invoice.id}: ${error.message}`
          );
        }
      }
    }
  } catch (err) {
    send_telegram_message(`Error en la tarea de facturas: ${err.message}`);
  } finally {
    await logout(); // Asegurarse de cerrar sesión
  }
};

// Exporta como función asíncrona para el manager
export const processInvoicesTask = async () => {
  console.log("Inicio Guardado de facturas");
  await saveInvoicesTask();
  send_telegram_message("Guardado de facturas completado ");
};
