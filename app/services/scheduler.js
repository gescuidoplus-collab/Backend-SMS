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

import {send_telegram_message} from "./send-telegram-message.js"

import { generatePDF } from "./generatePdf.js";

import { SmsDeliveryLog } from "../schemas/index.js";

// Función para esperar una cantidad de milisegundos
function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const saveInvoceCloudNavis = async () => {
  try {
    const status_code = await setCookieCloudnavis();
    console.log(`Status code initial: ${status_code}`);
    if (status_code == 200) {
      const maxRetries = 3;
      let login_status = null;
      let attempt = 0;

      while (attempt < maxRetries) {
        login_status = await loginCloudnavis();
        console.log(
          `Intento de login #${attempt + 1}, status: ${login_status}`
        );
        if (login_status == 200) {
          break; // Login exitoso, salimos del ciclo
        }
        attempt++;
        if (attempt < maxRetries) {
          console.log("Esperando 3 segundos antes del siguiente intento...");
          await esperar(3000); // Espera 3 segundos antes del próximo intento
        }
      }

      if (login_status == 200) {
        const now = new Date();
        const monthActualy = now.getMonth() + 1;
        const yearActualy = now.getFullYear();
        console.log("MothActualy:", monthActualy);
        const invoces = await listInvoicesCloudnavis(yearActualy, 7);
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
        } 
      } else {
        console.log("No se pudo hacer login después de varios intentos.");
      }
    }
    await logoutCloudnavis();
  } catch (err) {
    console.error("Error en saveInvoceCloudNavis:", err);
  }
};

export const monthlyTask = () => {
  //Programa la tarea para el día 1 de cada mes a las 9:00 AM
  //cron.schedule('0 9 1 * *',
  // cron.schedule("* * * * *", async () => {
  //   console.log("Tarea de Guarda Datos");
  //   await saveInvoceCloudNavis();
  // });
  // cron.schedule("* * * * *", async () => {
  //   console.log("Tarea para enviar la Factura");
  //   const message = "Mensaje enviado desde Node js";
  //   const formattedNumber = formatWhatsAppNumber("+584247548770");
  //   const result = sendWhatsAppMessage(
  //     formattedNumber,
  //     "Soy un Mensaje desde node"
  //   )
  //   // llamar a los modelos para las facturas
  //   // const now = new Date();
  //   // const monthActualy = now.getMonth() + 1;
  //   // const yearActualy = now.getFullYear();
  //   // const logs = await SmsDeliveryLog.find({
  //   //   mes: monthActualy,
  //   //   ano: yearActualy,
  //   //   status: "pending",
  //   // });
  //   // if (logs.length > 0) {
  //   //   for (let i = 0; i < logs.length; i++) {
  //   //     const log = logs[i];
  //   //     const invoce = logs[i].getDecryptedData();
  //   //     const pdf = await generatePDF(invoce);
  //   //     if (pdf == null || pdf == undefined) {
  //   //       log.status = "failure";
  //   //       log.reason = "No se pudo generar la URL del PDF";
  //   //       await log.save();
  //   //     } else {
  //   //       const formattedNumber = formatWhatsAppNumber("+58" + log.target);
  //   //       const result = await sendWhatsAppMessageWithPDF(
  //   //         formattedNumber,
  //   //         message,
  //   //         pdf.publicUrl
  //   //       );
  //   //       if (result.success == false) {
  //   //         log.status = "failure";
  //   //         log.reason = result.error;
  //   //         await log.save();
  //   //       } else {
  //   //         log.status = "success";
  //   //         log.pdfUrl = pdf.publicUrl;
  //   //         await log.save();
  //   //       }
  //   //     } // fin logica envio twilio
  //   //   }
  //   // }
  // }); // end cron enviar facturas
};

saveInvoceCloudNavis()
  .then((resp) => {
    console.log(resp);
    send_telegram_message('Mensaje enviado desde la Api')
  })
  .catch((error) => console.error(error));
