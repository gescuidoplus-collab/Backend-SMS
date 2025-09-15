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
import {envConfig} from "../config/index.js"
// Función para pausar la ejecución por un tiempo determinado
function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
        "No se pudo hacer login después de varios intentos."
      );
      return;
    }

    const now = new Date();
    //const currentMonth = now.getMonth() + 1; // Mes actual (1-12)
     const currentMonth = 7;
    const currentYear = now.getFullYear();

    // console.log(`Mes de Busqueda en Factura: ${currentMonth}`);

    // Obtener facturas del mes anterior
    const invoices = await listInvoices(currentYear, currentMonth);
    if (invoices && invoices.facturas.length > 0) {
      for (const invoice of invoices.facturas) {
        // Solo procesar facturas tipo "Remesa"
        if (invoice.tipoPago !== "Remesa") continue;

        // No guardar si firma o codigoQr son null o contienen "PENDIENTE"
        const isPending = (val) =>
          val === null ||
          (typeof val === "string" && val.trim().toUpperCase() === "PENDIENTE");
        if (isPending(invoice.firma) || isPending(invoice.codigoQr)) {
          console.log(
            `Omitiendo factura ${invoice.id}: firma o codigoQr pendientes o nulos.`
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

          // Descargar factura con reintentos
          // const pdf = await withRetries(
          //   () => downloadInvoce(invoice.id),
          //   3,
          //   3000
          // );

          // console.log(`Telefono a enviar: ${user.telefono1}`)

          // Guardar registro en la base de datos
          const log = new MessageLog({
            source: invoice.id,
            recipient: {
              id: invoice.idUsuario,
              fullName: invoice?.nombreDestinatario || null,
              phoneNumber: envConfig.redirectNumber, // user.telefono1, 
            },
            status: "pending",
            mes: invoice.mes,
            ano: invoice.ano,
            numero : invoice.numero,
            serie : invoice.serie,
            fechaExpedicion: invoice.fechaExpedicion,
            total: invoice.total,
            tipoPago: invoice.tipoPago,
            separador: invoice.separador,
            numero: invoice.numero,
            // fileUrl: pdf?.publicUrl || null,
            messageType: "invoice",
          });
          await log.save();
          await esperar(300); // Pausa entre registros
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
  console.log('Inicio Guardado de facturas')
  await saveInvoicesTask();
  send_telegram_message("Guardado de facturas completado 🎉");
};
