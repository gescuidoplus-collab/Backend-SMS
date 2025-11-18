import cron from "node-cron";
import {
  setCookie,
  loginCloudnavis,
  listInvoices,
  logout,
  getUsers,
  downloadInvoce,
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

function isPendingOrNull(val) {
  return (
    val === null ||
    val === undefined ||
    (typeof val === 'string' && (val.trim() === '' || val.trim().toUpperCase() === 'PENDIENTE'))
  );
}

function isValidPhoneNumber(phone) {
  return (
    phone !== null &&
    phone !== undefined &&
    (typeof phone === 'string' && phone.trim() !== '')
  );
}

function canSendInvoice(invoice) {
  if (invoice.whatsappStatus !== 'PENDING') {
    return { valid: false, reason: `whatsappStatus es "${invoice.whatsappStatus}", debe ser "PENDING"` };
  }

  if (isPendingOrNull(invoice.firma)) {
    return { valid: false, reason: 'firma es null, vacío o "PENDIENTE"' };
  }
  if (isPendingOrNull(invoice.codigoQr)) {
    return { valid: false, reason: 'codigoQr es null, vacío o "PENDIENTE"' };
  }
  if (isPendingOrNull(invoice.codigoIdentificativo)) {
    return { valid: false, reason: 'codigoIdentificativo es null, vacío o "PENDIENTE"' };
  }

  if (!isValidUUID(invoice.idUsuario)) {
    return { valid: false, reason: `idUsuario "${invoice.idUsuario}" no es un UUID válido` };
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

const saveInvoicesTask = async () => {
  try {
    const status_code = await setCookie();
    if (status_code !== 200) {
      throw new Error("No se pudo establecer la cookie.");
    }

    const login_status = await withRetries(loginCloudnavis, 3, 3000);
    if (login_status !== 200) {
      send_telegram_message(
        "No se pudo hacer login después de varios intentos. en saveInvoicesTask"
      );
      return;
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const monthsSearch = envConfig.monthsSearch ?? 1;

    const monthsToSearch = getMonthsToSearch(currentMonth, currentYear, monthsSearch);
    console.log(`Iniciando ejecución de Facturas:  procesando ${monthsToSearch.length} mes(es)`);

    for (const { month, year } of monthsToSearch) {
      const invoices = await listInvoices(year, month);
      if (invoices && invoices.facturas.length > 0) {
        for (const invoice of invoices.facturas) {
          if (invoice.tipoPago !== "Remesa") {
            continue;
          }

          const validation = canSendInvoice(invoice);
          if (!validation.valid) {
            continue;
          }

          try {
            const user = await withRetries(
              () => getUsers(invoice.idUsuario),
              3,
              3000
            );

            if (!isValidPhoneNumber(user.telefono1)) {
              continue;
            }

            const log = new MessageLog({
              source: invoice.id,
              recipient: {
                id: invoice.idUsuario,
                fullName: user?.nombre1.trim() || null,
                phoneNumber: user.telefono1,
              },
              status: "pending",
              mes: invoice.mes,
              ano: invoice.ano,
              numero: invoice.numero,
              serie: invoice.serie,
              fechaExpedicion: invoice.fechaExpedicion,
              total: invoice.total,
              tipoPago: invoice.tipoPago,
              separador: invoice.separador,
              numero: invoice.numero,
              messageType: "invoice",
            });
            await log.save();

            if (user.nombre2?.trim() && user.telefono2?.trim()) {
              const secondLog = new MessageLog({
                source: invoice.id,
                recipient: {
                  id: invoice.idUsuario,
                  fullName: user?.nombre2.trim() || null,
                  phoneNumber: user.telefono2.trim(),
                },
                status: "pending",
                mes: invoice.mes,
                ano: invoice.ano,
                numero: invoice.numero,
                serie: invoice.serie,
                fechaExpedicion: invoice.fechaExpedicion,
                total: invoice.total,
                tipoPago: invoice.tipoPago,
                separador: invoice.separador,
                messageType: "invoice",
              });
              await secondLog.save();
            }

            await esperar(150);
          } catch (error) {
            send_telegram_message(`Error procesando factura ${invoice.id}: ${error.message}`);
          }
        }
      }
    }
  } catch (err) {
    send_telegram_message(`Error en la tarea de facturas: ${err.message}`);
  } finally {
    await logout();
  }
};

export const processInvoicesTask = async () => {
  await saveInvoicesTask();
  send_telegram_message("Guardado de facturas completado");
};
