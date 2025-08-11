import cron from "node-cron";
import {
  setCookie,
  loginCloudnavis,
  ListPayRolls,
  logout,
  downloadPayrolls,
  getUsers,
} from "../services/apiCloudnavis.js";
import { send_telegram_message } from "../services/sendMessageTelegram.js";
import { MessageLog } from "../schemas/index.js";

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Valida que el periodo vaya del día 1 al último día del mismo mes
function isFullMonthPeriod(inicio, fin) {
  if (!inicio || !fin) return false;
  const [y1, m1, d1] = inicio.split("-").map(Number);
  const [y2, m2, d2] = fin.split("-").map(Number);
  if (
    !Number.isInteger(y1) ||
    !Number.isInteger(m1) ||
    !Number.isInteger(d1) ||
    !Number.isInteger(y2) ||
    !Number.isInteger(m2) ||
    !Number.isInteger(d2)
  ) {
    return false;
  }
  if (y1 !== y2 || m1 !== m2) return false; // Deben ser el mismo mes y año
  if (d1 !== 1) return false; // Debe iniciar el día 1
  const lastDay = new Date(y2, m2, 0).getDate(); // Último día del mes (m es 1-12)
  return d2 === lastDay;
}

const savePayRollsTask = async () => {
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
        const payRolls = await ListPayRolls(yearActualy, monthActualy - 1);
        if (payRolls && payRolls.nominas.length > 0) {
          for (const payRoll of payRolls.nominas) {
            try {
              if (
                !isFullMonthPeriod(
                  payRoll.inicioLiquidacion,
                  payRoll.finLiquidacion
                )
              ) {
                continue;
              }

              let pdf = await downloadPayrolls(payRoll.id);
              let log = new MessageLog({
                source: payRoll.id,
                recipient: payRoll.idEmpleador,
                employe: payRoll.idTrabajador,
                phoneNumber: "4247548770",
                phoneNumberTwo: "4247548770",
                fileUrl: pdf.publicUrl || null,
                status: "pending",
                mes: payRoll.mes + 1, // temporal
                ano: payRoll.ano,
                messageType: "payRool", // Considera corregir a "payRoll" si aplica
                sensitiveData: payRoll,
              });
              await log.save();
            } catch (error) {
              send_telegram_message(
                `Fallo al guarda Nomina : ${payRoll.id} error : ${error.message}`
              );
            }
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
    await logout();
  }
};

export const processPayRollsTask = () => {
  setTimeout(async () => {
    await savePayRollsTask();
    send_telegram_message(
      "Ejecución inicial de Guardado de Nominas por WhatsApp completada 🎉"
    );
  }, 40000);

  cron.schedule("0 9 1 * *", async () => {
    await savePayRollsTask();
    send_telegram_message(
      "Cron de Guardado de Nominas por WhatsApp Compleado 🎉"
    );
  });
};
