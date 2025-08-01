import cron from "node-cron";
import {
  setCookieCloudnavis,
  loginCloudnavis,
  listInvoicesCloudnavis,
  logoutCloudnavis,
} from "../services/cloudnavis.js";

import {
  sendWhatsAppMessage,
  formatWhatsAppNumber,
  sendBulkWhatsAppMessages,
  sendWhatsAppPDF,
  sendWhatsAppMessageWithPDF,
} from "./twilioService.js";

import { generatePDF } from "./generatePdf.js";

import { SmsDeliveryLog } from "../schemas/index.js";

const saveInvoceCloudNavis = async () => {
  try {
    setCookieCloudnavis().then(async (status_code) => {
      /*
          Esta logica es para Guarda las facturas
        */
      if (status_code == 200) {
        loginCloudnavis().then(async (login_status) => {
          if (login_status == 200) {
            const now = new Date();
            const monthActualy = now.getMonth() + 1; // Enero es 0
            const yearActualy = now.getFullYear();
            const invoces = await listInvoicesCloudnavis(
              yearActualy,
              monthActualy
            );
            if (invoces && invoces.facturas.length > 0) {
              invoces.facturas.map(async (invoce) => {
                let log = new SmsDeliveryLog({
                  invoiceID: invoce.id,
                  userID: invoce.idUsuario,
                  target: "4247285815",
                  status: "pending",
                  mes: invoce.mes,
                  ano: invoce.ano,
                  sensitiveData: invoce,
                });
                await log.save();
              });
            } // end Logica guardado facturas
          }
        }); // login y send
      }
      await logoutCloudnavis();
    });
  } catch (err) {}
};

export const monthlyTask = () => {
  // Programa la tarea para el día 1 de cada mes a las 9:00 AM
  // cron.schedule('0 9 1 * *',
  // cron.schedule("* * * * *", async () => {
  //   console.log("Tarea de Guarda Datos");
  //   await saveInvoceCloudNavis();
  // });
  // cron.schedule("* * * * *", async () => {
  //   console.log("Tarea para enviar la Factura");
  //   const message = "Mensaje enviado desde Node js";
  //   // llamar a los modelos para las facturas
  //   const now = new Date();
  //   const monthActualy = now.getMonth() + 1;
  //   const yearActualy = now.getFullYear();
  //   const logs = await SmsDeliveryLog.find({
  //     mes: monthActualy,
  //     ano: yearActualy,
  //     status: "pending",
  //   });
  //   if (logs.length > 0) {
  //     for (let i = 0; i < logs.length; i++) {
  //       const log = logs[i];
  //       const invoce = logs[i].getDecryptedData();
  //       const pdf = await generatePDF(invoce);
  //       if (pdf == null || pdf == undefined) {
  //         log.status = "failure";
  //         log.reason = "No se pudo generar la URL del PDF";
  //         await log.save();
  //       } else {
  //         const formattedNumber = formatWhatsAppNumber("+58" + log.target);
  //         const result = await sendWhatsAppMessageWithPDF(
  //           formattedNumber,
  //           message,
  //           pdf.publicUrl
  //         );
  //         if (result.success == false) {
  //           log.status = "failure";
  //           log.reason = result.error;
  //           await log.save();
  //         } else {
  //           log.status = "success";
  //           log.pdfUrl = pdf.publicUrl;
  //           await log.save();
  //         }
  //       } // fin logica envio twilio
  //     }
  //   }
  // }); // end cron enviar facturas
};