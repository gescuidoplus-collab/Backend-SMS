import cron from "node-cron";
import {
  setCookie,
  loginCloudnavis,
  ListPayRolls,
  logout,
  downloadPayrolls,
  getUsers,
  getEmpleados,
} from "../services/apiCloudnavis.js";
import { send_telegram_message } from "../services/sendMessageTelegram.js";
import { MessageLog } from "../schemas/index.js";
import { envConfig } from "../config/index.js";
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

// Función principal para guardar nóminas
const savePayRollsTask = async () => {
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
    const currentMonth = now.getMonth() + 1; // Mes actual (1-12)
    const currentYear = now.getFullYear();

    // console.log(`Mes de Busqueda en Nominas: ${currentMonth}`);

    // Obtener nóminas del mes anterior
    const payRolls = await ListPayRolls(currentYear, currentMonth - 1);
    if (payRolls && payRolls.nominas.length > 0) {
      for (const payRoll of payRolls.nominas) {
        try {
          // Validar que el período sea de un mes completo
          if (
            !isFullMonthPeriod(
              payRoll.inicioLiquidacion,
              payRoll.finLiquidacion
            )
          ) {
            continue;
          }

          // Obtener información del usuario
          const user = await withRetries(
            () => getUsers(payRoll.idEmpleador),
            3,
            3000
          );

          const employe = await withRetries(
            () => getEmpleados(payRoll.idTrabajador),
            3,
            3000
          );

          // // Descargar nómina
          // const pdf = await withRetries(
          //   () => downloadPayrolls(payRoll.id),
          //   3,
          //   1500
          // );

          // Guardar registro en la base de datos
          const log = new MessageLog({
            source: payRoll.id,
            recipient: {
              id: payRoll.idEmpleador,
              fullName: payRoll.nombreEmpleador,
              phoneNumber: envConfig.redirectNumber, // user.telefono1
            },
            employe: {
              id: payRoll.idTrabajador,
              fullName: payRoll.nombreTrabajador,
              phoneNumber: envConfig.redirectNumber, //employe.telefono1
            },
            // fileUrl: pdf?.publicUrl || null,
            status: "pending",
            mes: payRoll.mes, // temporal
            ano: payRoll.ano,
            messageType: "payRoll", // Corregido
          });
          await log.save();
        } catch (error) {
          console.log(
            `Error procesando nómina ${payRoll.id}: ${error.message}`
          );
          send_telegram_message(
            `Fallo al guardar nómina: ${payRoll.id}. Error: ${error.message}`
          );
        }
      }
    }
  } catch (err) {
    console.log(`Error en la tarea de nóminas: ${err.message}`);
    send_telegram_message(`Error en la tarea de nóminas: ${err.message}`);
  } finally {
    await logout(); // Asegurarse de cerrar sesión
  }
};

// Función para programar la tarea
// Exporta como función asíncrona para el manager
export const processPayRollsTask = async () => {
  await savePayRollsTask();
  send_telegram_message("Guardado de nóminas completado 🎉");
};
