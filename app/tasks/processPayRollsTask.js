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

// Función para validar UUID v4
function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Función para validar si una nómina cumple con los requisitos para envío
function canSendPayroll(payRoll) {
  // 1. whatsappStatus debe ser "PENDING"
  if (payRoll.whatsappStatus !== 'PENDING') {
    return { 
      valid: false, 
      reason: `whatsappStatus es "${payRoll.whatsappStatus}", debe ser "PENDING"` 
    };
  }

  // 2. idEmpleador debe ser un UUID válido y no debe ser null
  if (!isValidUUID(payRoll.idEmpleador)) {
    return { 
      valid: false, 
      reason: `idEmpleador "${payRoll.idEmpleador}" no es un UUID válido` 
    };
  }

  // 3. idTrabajador debe ser un UUID válido y no debe ser null
  if (!isValidUUID(payRoll.idTrabajador)) {
    return { 
      valid: false, 
      reason: `idTrabajador "${payRoll.idTrabajador}" no es un UUID válido` 
    };
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

// Función helper para crear un MessageLog de nómina
function createPayrollMessageLog(payRoll, recipient, employe) {
  return new MessageLog({
    source: payRoll.id,
    recipient: {
      id: payRoll.idEmpleador,
      fullName: recipient.fullName,
      phoneNumber: recipient.phoneNumber,
    },
    employe: {
      id: payRoll.idTrabajador,
      fullName: employe.fullName,
      phoneNumber: employe.phoneNumber,
    },
    status: "pending",
    mes: payRoll.mes,
    ano: payRoll.ano,
    serie: `N${payRoll.ano}${String(payRoll.mes).padStart(2, "0")}`,
    separador: "-",
    numbero: 0,
    messageType: "payRoll",
  });
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
        "No se pudo hacer login después de varios intentos. en savePayRollsTask"
      );
      return;
    }

    const now = new Date();
    //const currentMonth = now.getMonth() + 1; // Mes actual (1-12)
    const currentMonth = 8;
    const currentYear = now.getFullYear();

    // console.log(`Mes de Busqueda en Nominas: ${currentMonth}`);

    // Obtener nóminas del mes anterior
    const payRolls = await ListPayRolls(currentYear, currentMonth);
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
            console.log(
              `Omitiendo nómina ${payRoll.id}: período no es mes completo (${payRoll.inicioLiquidacion} a ${payRoll.finLiquidacion})`
            );
            continue;
          }

          // Validar si la nómina cumple con los requisitos para envío
          const validation = canSendPayroll(payRoll);
          if (!validation.valid) {
            console.log(
              `Omitiendo nómina ${payRoll.ano}-${String(payRoll.mes).padStart(2, '0')} (ID: ${payRoll.id}): ${validation.reason}`
            );
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

          // Preparar datos del empleado
          const employeData = {
            fullName: employe.nombre.trim(),
            phoneNumber: employe.telefono1,
          };

          // Guardar registro principal en la base de datos
          const log = createPayrollMessageLog(
            payRoll,
            {
              fullName: user.nombre.trim(),
              phoneNumber: user.telefono1,
            },
            employeData
          );
          await log.save();

          // Segundo contacto para empleador (si existe)
          if (user.nombre2?.trim() && user.telefono2?.trim()) {
            const secondLog = createPayrollMessageLog(
              payRoll,
              {
                fullName: user.nombre2.trim(),
                phoneNumber: user.telefono2.trim(),
              },
              employeData
            );
            await secondLog.save();
          }
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
  // send_telegram_message("Guardado de nóminas completado ");
};
