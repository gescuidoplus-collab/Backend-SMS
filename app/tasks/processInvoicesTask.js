import cron from "node-cron";
import {
  setCookie,
  loginCloudnavis,
  listInvoices,
  logout,
  getUsers,
  downloadInvoce,
  downloadPayrolls,
} from "../services/apiCloudnavis.js";
import { send_telegram_message } from "../services/sendMessageTelegram.js";
import { MessageLog } from "../schemas/index.js";

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const saveInvocesTask = async () => {
  try {
    const status_code = await setCookie();
    if (status_code == 200) {
      const maxRetries = 3;
      let login_status = null;
      let attempt = 0;

      while (attempt < maxRetries) {
        login_status = await loginCloudnavis();
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
        const invoces = await listInvoices(yearActualy, monthActualy - 1);
        if (invoces && invoces.facturas.length > 0) {
          for (const invoce of invoces.facturas) {
            if (invoce.tipoPago !== "Remesa") continue;
            try {
              // Obtener user (estaba comentado)
              let user = null;
              try {
                user = await getUsers(invoce.idUsuario);
              } catch (e) {
                console.log("No se pudo obtener usuario:", e.message);
              }

              // Reintentos descarga
              const maxDownloadRetries = 3;
              let pdf = null;
              for (let i = 0; i < maxDownloadRetries; i++) {
                try {
                  pdf = await downloadInvoce(invoce.id);
                  if (pdf) break;
                } catch (e) {
                  if (i < maxDownloadRetries - 1) {
                    console.log(
                      `Retry downloadInvoce (${i + 1}/${maxDownloadRetries})`
                    );
                    await esperar(1500);
                  } else {
                    throw e;
                  }
                }
              }

              const log = new MessageLog({
                source: invoce.id,
                recipient: {
                  id: invoce.idUsuario,
                  nombre: user?.nombre || null,
                  apellidos: user?.apellidos || null,
                },
                phoneNumber: "4247548770",
                status: "pending",
                mes: invoce.mes,
                ano: invoce.ano,
                fileUrl: pdf?.publicUrl || null,
                messageType: "invoce"
              });
              await log.save();

              // Pequeña pausa para evitar rate limit
              await esperar(300);
            } catch (error) {
              console.log("Fallo con:", invoce.id, error.message);
              // send_telegram_message(`Fallo al guarda la factura : ${invoce.id} error : ${error.message}`);
            }
          }
        }
      } else {
        send_telegram_message(
          "No se pudo hacer login después de varios intentos."
        );
      }
    }
    // await logout();
  } catch (err) {
    send_telegram_message(`Fallo al Guarda las Facturas Error: ${err.message}`);
    await logout();
  }
};

export const processInvoicesTask = () => {
  setTimeout(async () => {
    await saveInvocesTask();
    send_telegram_message(
      "Ejecución inicial de Guardado de facturas por WhatsApp completada 🎉"
    );
  }, 25000);

  cron.schedule("0 9 1 * *", async () => {
    await saveInvocesTask();
    send_telegram_message(
      "Cron de Guardado de facturas por WhatsApp Compleado 🎉"
    );
  });
};
