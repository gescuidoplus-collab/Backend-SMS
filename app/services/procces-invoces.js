import {
  setCookie,
  loginCloudnavis,
  listInvoices,
  logout,
  getUsers,
} from "./apiCloudnavis.js";

import { send_telegram_message } from "./sendMessageTelegram.js";
import { MessageLog } from "../schemas/index.js";

// Función para esperar una cantidad de milisegundos
function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const saveInvoceCloudNavis = async () => {
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
        const invoces = await listInvoices(
          yearActualy,
          monthActualy - 1
        );
        if (invoces && invoces.facturas.length > 0) {
          try {
            invoces.facturas.map(async (invoce) => {
              // const user = await getUsers(invoce.idUsuario);
              let log = new MessageLog({
                invoiceID: invoce.id,
                userID: invoce.idUsuario,
                recipient: "4247548770",
                status: "pending",
                mes: invoce.mes,
                ano: invoce.ano,
                sensitiveData: invoce,
              });
              await log.save();
            });
          } catch (error) {
            // send_telegram_message(
            //   `Factura ${invoceID} no se pudo guarda error : ${error.message}`
            // );
          }
        }
      } else {
        send_telegram_message(
          "No se pudo hacer login después de varios intentos."
        );
      }
    }
    await logout();
  } catch (err) {
    send_telegram_message(`Fallo al Guarda las Facturas Error: ${err.message}`);
  }
};
