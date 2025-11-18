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

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function canSendPayroll(payRoll) {
  if (payRoll.whatsappStatus !== 'PENDING' && payRoll.whatsappStatus !== null) {
    return { 
      valid: false, 
      reason: `whatsappStatus es "${payRoll.whatsappStatus}", debe ser "PENDING"` 
    };
  }

  if (!isValidUUID(payRoll.idEmpleador)) {
    return { 
      valid: false, 
      reason: `idEmpleador "${payRoll.idEmpleador}" no es un UUID válido` 
    };
  }

  if (!isValidUUID(payRoll.idTrabajador)) {
    return { 
      valid: false, 
      reason: `idTrabajador "${payRoll.idTrabajador}" no es un UUID válido` 
    };
  }

  return { valid: true };
}

async function withRetries(task, maxRetries, delay) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt < maxRetries - 1) {
        await esperar(delay);
      } else {
        throw error;
      }
    }
  }
}

function getMonthsToSearch(currentMonth, currentYear, monthsSearch) {
  const months = [];
  
  if (monthsSearch === 0) {
    months.push({ month: currentMonth, year: currentYear });
  } else if (monthsSearch === 1) {
    months.push({ month: currentMonth, year: currentYear });
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    months.push({ month: prevMonth, year: prevYear });
  } else {
    for (let i = 0; i < monthsSearch; i++) {
      let month = currentMonth - i;
      let year = currentYear;
      
      if (month < 1) {
        month += 12;
        year -= 1;
      }
      
      months.push({ month, year });
    }
  }
  
  return months;
}

function isValidPhoneNumber(phone) {
  return (
    phone !== null &&
    phone !== undefined &&
    (typeof phone === 'string' && phone.trim() !== '')
  );
}

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
  if (y1 !== y2 || m1 !== m2) return false;
  if (d1 !== 1) return false;
  const lastDay = new Date(y2, m2, 0).getDate();
  return d2 === lastDay;
}

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

const savePayRollsTask = async () => {
  try {
    const status_code = await setCookie();
    if (status_code !== 200) {
      throw new Error("No se pudo establecer la cookie.");
    }

    const login_status = await withRetries(loginCloudnavis, 3, 3000);
    if (login_status !== 200) {
      send_telegram_message(
        "No se pudo hacer login después de varios intentos. en savePayRollsTask"
      );
      return;
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const monthsSearch = envConfig.monthsSearch ?? 1;

    const monthsToSearch = getMonthsToSearch(currentMonth, currentYear, monthsSearch);
    console.log(`Iniciando ejecución de Nominas: procesando ${monthsToSearch.length} mes(es)`);

    for (const { month, year } of monthsToSearch) {
      const payRolls = await ListPayRolls(year, month);
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

            const validation = canSendPayroll(payRoll);
            if (!validation.valid) {
              continue;
            }

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

            if (!isValidPhoneNumber(user.telefono1)) {
              continue;
            }

            if (!isValidPhoneNumber(employe.telefono1)) {
              continue;
            }

            const employeData = {
              fullName: employe.nombre.trim(),
              phoneNumber: employe.telefono1,
            };

            const log = createPayrollMessageLog(
              payRoll,
              {
                fullName: user.nombre1.trim(),
                phoneNumber: user.telefono1,
              },
              employeData
            );
            await log.save();

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
            send_telegram_message(
              `Fallo al guardar nómina: ${payRoll.id}. Error: ${error.message}`
            );
          }
        }
      }
    }
  } catch (err) {
    send_telegram_message(`Error en la tarea de nóminas: ${err.message}`);
  } finally {
    await logout();
  }
};

export const processPayRollsTask = async () => {
  await savePayRollsTask();
  send_telegram_message("Guardado de nóminas completado");
};
