import {
  listPayrollsWithToken,
  getUserWithToken,
  getEmpleadoWithToken,
} from "../services/apiCloudnavisToken.js";
import { send_telegram_message } from "../services/sendMessageTelegram.js";
import { MessageLog } from "../schemas/index.js";

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
    numero: 0,
    messageType: "payRoll",
  });
}

/**
 * Procesar nóminas usando token y mes/año específicos
 * @param {string} token - Token de autenticación CloudNavis
 * @param {number} month - Mes (1-12)
 * @param {number} year - Año (ej: 2026)
 */
export const processPayRollsTask = async (token, month, year) => {
  const report = {
    token: token?.substring(0, 5) + "...",
    month,
    year,
    startTime: new Date().toISOString(),
    payrollsProcessed: 0,
    payrollsFailed: 0,
    logsSaved: 0,
    errors: [],
  };

  try {
    if (!token) {
      throw new Error("Token no proporcionado");
    }

    if (!month || !year || month < 1 || month > 12) {
      throw new Error("Parámetros mes/año inválidos");
    }

    console.log(`[Nóminas] Procesando mes ${month}/${year} con token: ${token.substring(0, 5)}...`);

    // Obtener nóminas del mes/año especificado
    const payRolls = await listPayrollsWithToken(token, year, month);

    if (!payRolls || !payRolls.nominas || payRolls.nominas.length === 0) {
      console.log(`[Nóminas] No se encontraron nóminas para ${month}/${year}`);
      report.payrollsProcessed = 0;
      return report;
    }

    console.log(`[Nóminas] Encontradas ${payRolls.nominas.length} nóminas`);

    for (const payRoll of payRolls.nominas) {
      try {
        // Validar que es período completo del mes
        if (!isFullMonthPeriod(payRoll.inicioLiquidacion, payRoll.finLiquidacion)) {
          console.log(`[Nóminas] Omitiendo nómina ${payRoll.id} (período incompleto)`);
          continue;
        }

        // Validar campos requeridos
        const validation = canSendPayroll(payRoll);
        if (!validation.valid) {
          console.log(`[Nóminas] Nómina ${payRoll.id} inválida: ${validation.reason}`);
          continue;
        }

        // Obtener datos del empleador y empleado
        const user = await getUserWithToken(token, payRoll.idEmpleador);
        const employe = await getEmpleadoWithToken(token, payRoll.idTrabajador);

        if (!isValidPhoneNumber(user.telefono1)) {
          console.log(`[Nóminas] Empleador ${payRoll.idEmpleador} sin teléfono válido`);
          continue;
        }

        if (!isValidPhoneNumber(employe.telefono1)) {
          console.log(`[Nóminas] Empleado ${payRoll.idTrabajador} sin teléfono válido`);
          continue;
        }

        const employeData = {
          fullName: employe.nombre?.trim(),
          phoneNumber: employe.telefono1,
        };

        // Crear log para primer contacto del empleador
        const log = createPayrollMessageLog(
          payRoll,
          {
            fullName: user.nombre1?.trim(),
            phoneNumber: user.telefono1,
          },
          employeData
        );
        await log.save();
        report.logsSaved++;
        console.log(`[Nóminas] Log guardado para ${user.nombre1}`);

        // Crear log para segundo contacto del empleador si existe
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
          report.logsSaved++;
          console.log(`[Nóminas] Log guardado para ${user.nombre2}`);
        }

        report.payrollsProcessed++;
        await esperar(150);

      } catch (error) {
        report.payrollsFailed++;
        const errMsg = `Error procesando nómina ${payRoll.id}: ${error.message}`;
        report.errors.push(errMsg);
        console.error(`[Nóminas] ${errMsg}`);
        send_telegram_message(errMsg);
      }
    }

    report.endTime = new Date().toISOString();
    console.log(`[Nóminas] Completado: ${report.payrollsProcessed} procesadas, ${report.payrollsFailed} errores`);
    return report;

  } catch (err) {
    report.endTime = new Date().toISOString();
    report.errors.push(err.message);
    const errMsg = `Error en processPayRollsTask: ${err.message}`;
    console.error(`[Nóminas] ${errMsg}`);
    send_telegram_message(errMsg);
    throw err;
  }
};
