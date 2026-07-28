import {
  listInvoicesWithToken,
  getUserWithToken,
  downloadInvoiceWithToken,
} from "../services/apiCloudnavisToken.js";
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
  if (invoice.whatsappStatus !== 'PENDING' && invoice.whatsappStatus !== null) {
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

/**
 * Procesar facturas usando token y mes/año específicos
 * @param {string} token - Token de autenticación CloudNavis
 * @param {number} month - Mes (1-12)
 * @param {number} year - Año (ej: 2026)
 */
export const processInvoicesTask = async (token, month, year) => {
  const report = {
    token: token?.substring(0, 5) + "...",
    month,
    year,
    startTime: new Date().toISOString(),
    invoicesProcessed: 0,
    invoicesFailed: 0,
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

    console.log(`[Facturas] Procesando mes ${month}/${year} con token: ${token.substring(0, 5)}...`);

    // Obtener facturas del mes/año especificado
    const invoices = await listInvoicesWithToken(token, year, month);

    if (!invoices || !invoices.facturas || invoices.facturas.length === 0) {
      console.log(`[Facturas] No se encontraron facturas para ${month}/${year}`);
      report.invoicesProcessed = 0;
      return report;
    }

    console.log(`[Facturas] Encontradas ${invoices.facturas.length} facturas`);

    for (const invoice of invoices.facturas) {
      try {
        // Filtrar solo facturas tipo Remesa
        if (invoice.tipoPago !== "Remesa") {
          console.log(`[Facturas] Omitiendo factura ${invoice.id} (tipoPago: ${invoice.tipoPago})`);
          continue;
        }

        // Validar campos requeridos
        const validation = canSendInvoice(invoice);
        if (!validation.valid) {
          console.log(`[Facturas] Factura ${invoice.id} inválida: ${validation.reason}`);
          continue;
        }

        // Obtener datos del usuario
        const user = await getUserWithToken(token, invoice.idUsuario);

        if (!isValidPhoneNumber(user.telefono1)) {
          console.log(`[Facturas] Usuario ${invoice.idUsuario} sin teléfono válido`);
          continue;
        }

        // Crear log para primer teléfono
        const log = new MessageLog({
          source: invoice.id,
          recipient: {
            id: invoice.idUsuario,
            fullName: user?.nombre1?.trim() || null,
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
          messageType: "invoice",
        });

        await log.save();
        report.logsSaved++;
        console.log(`[Facturas] Log guardado para ${user.nombre1}`);

        // Crear log para segundo teléfono si existe
        if (user.nombre2?.trim() && user.telefono2?.trim()) {
          const secondLog = new MessageLog({
            source: invoice.id,
            recipient: {
              id: invoice.idUsuario,
              fullName: user.nombre2.trim(),
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
          report.logsSaved++;
          console.log(`[Facturas] Log guardado para ${user.nombre2}`);
        }

        report.invoicesProcessed++;
        await esperar(150);
      } catch (error) {
        report.invoicesFailed++;
        const errMsg = `Error procesando factura ${invoice.id}: ${error.message}`;
        report.errors.push(errMsg);
        console.error(`[Facturas] ${errMsg}`);
        send_telegram_message(errMsg);
      }
    }

    report.endTime = new Date().toISOString();
    console.log(`[Facturas] Completado: ${report.invoicesProcessed} procesadas, ${report.invoicesFailed} errores`);
    return report;

  } catch (err) {
    report.endTime = new Date().toISOString();
    report.errors.push(err.message);
    const errMsg = `Error en processInvoicesTask: ${err.message}`;
    console.error(`[Facturas] ${errMsg}`);
    send_telegram_message(errMsg);
    throw err;
  }
};
