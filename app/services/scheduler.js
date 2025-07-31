import cron from "node-cron";
import {
  setCookieCloudnavis,
  loginCloudnavis,
  listInvoicesCloudnavis,
  logoutCloudnavis,
} from "../services/cloudnavis.js"; // Ajusta la ruta según la ubicación del archivo

import {
  sendWhatsAppMessage,
  formatWhatsAppNumber,
  sendBulkWhatsAppMessages,
  sendWhatsAppPDF,
  sendWhatsAppMessageWithPDF,
} from "./twilioService.js";

import { SmsDeliveryLog } from "../schemas/index.js";

const saveInvoceCloudNavis = async () => {
  try {
    // setCookieCloudnavis()
    //   .then(async (status_code) => {
    //     /*
    //       Esta logica es para Guarda las facturas
    //     */
    //     if (status_code == 200) {
    //       loginCloudnavis().then(async (login_status) => {
    //         if (login_status == 200) {
    //           const now = new Date();
    //           const monthActualy = now.getMonth() + 1; // Enero es 0
    //           const yearActualy = now.getFullYear();
    //           const invoces = await listInvoicesCloudnavis(
    //             yearActualy,
    //             monthActualy
    //           );
    //           if (invoces && invoces.facturas.length > 0) {
    //             invoces.facturas.map(async (invoce) => {
    //               let log = new SmsDeliveryLog({
    //                 invoiceID: invoce.id,
    //                 userID: invoce.idUsuario,
    //                 target: "+584247285815",
    //                 status: "pending",
    //                 mes : invoce.mes,
    //                 ano : invoce.ano,
    //                 sensitiveData: invoce,
    //               });
    //               await log.save();
    //             });
    //             InvocesF = true
    //           } // end Logica guardado facturas
    //         }
    //       }); // login y send
    //     }
    //     await logoutCloudnavis()
    //   })
  } catch (err) {}
};

export const monthlyTask = () => {
  // Programa la tarea para el día 1 de cada mes a las 9:00 AM
  // cron.schedule('0 9 1 * *',
  cron.schedule("* * * * *", async () => {
    console.log("Tarea de Guarda Datos");
  });

  cron.schedule("* * * * *", async () => {
    console.log("Tarea para enviar la Factura");
    const phoneNumber = "+584247285815";
    const message = "Mensaje de Twilio de prueba";
    const formattedNumber = formatWhatsAppNumber(phoneNumber);
    const result = await sendWhatsAppMessage(formattedNumber, message);

    const response = result.success
      ? {
          success: true,
          message: "Mensaje enviado correctamente",
          data: result,
        }
      : {
          success: false,
          message: "Error al enviar mensaje",
          error: result.error,
        };
  });
};

(async () => {
  console.log("Tarea para enviar la Factura");
  const phoneNumber = "+584247285815";
  const message = "Mensaje de Twilio de prueba";
  const formattedNumber = formatWhatsAppNumber(phoneNumber);
  console.log('Numero formateado:',formattedNumber)
  const result = await sendWhatsAppMessage(formattedNumber, message);

  const response = result.success
    ? {
        success: true,
        message: "Mensaje enviado correctamente",
        data: result,
      }
    : {
        success: false,
        message: "Error al enviar mensaje",
        error: result.error,
      };
})();
