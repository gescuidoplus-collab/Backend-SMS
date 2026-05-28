import {
  setCookie,
  loginCloudnavis,
  fetchInvoiceBuffer,
  logout
} from '../services/apiCloudnavis.js';
import { MessageLog } from '../schemas/index.js';
import { logger } from '../config/index.js';

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeFilenamePart(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function buildInvoicePdfFilename(log, fallbackId) {
  const parts = ["FACTURA"];

  if (log?.ano && log?.mes) {
    parts.push(`${log.ano}-${String(log.mes).padStart(2, "0")}`);
  }

  const serie = sanitizeFilenamePart(log?.serie);
  const separador = sanitizeFilenamePart(log?.separador);
  const numero = log?.numero !== undefined && log?.numero !== null
    ? sanitizeFilenamePart(log.numero)
    : "";
  const serieNumero = [serie, separador, numero].filter(Boolean).join("");
  if (serieNumero) parts.push(serieNumero);

  const recipientName = sanitizeFilenamePart(log?.recipient?.fullName);
  if (recipientName) parts.push(recipientName);

  let base = parts.filter(Boolean).join("_");
  if (!base) base = `FACTURA_${sanitizeFilenamePart(fallbackId) || "documento"}`;

  if (base.length > 150) base = base.slice(0, 150).trim();
  return `${base}.pdf`;
}

async function withRetries(task, maxRetries, delay) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt < maxRetries - 1) {
        logger.warn({ attempt: attempt + 1, maxRetries }, "Reintento fallido, esperando...");
        await esperar(delay);
      } else {
        throw error;
      }
    }
  }
}

export const downloadInvoicePdf = async (req, res) => {
  const { id } = req.params;

  logger.debug({ params: req.params }, "downloadInvoicePdf request")

  if (!id) {
    return res.status(400).json({ message: 'Parámetro id es requerido' });
  }

  try {
    const cookieStatus = await withRetries(setCookie, 3, 3000);
    if (cookieStatus !== 200) {
      await MessageLog.findOneAndUpdate(
        { source: id },
        { status: 'failure', reason: 'No se pudo establecer la cookie de sesión en CloudNavis' }
      ).catch(() => {});
      return res.status(500).json({ message: 'No se pudo establecer la cookie de sesión' });
    }

    const loginStatus = await withRetries(loginCloudnavis, 3, 3000);
    if (loginStatus !== 200) {
      await MessageLog.findOneAndUpdate(
        { source: id },
        { status: 'failure', reason: 'No se pudo iniciar sesión en CloudNavis' }
      ).catch(() => {});
      return res.status(500).json({ message: 'No se pudo iniciar sesión en CloudNavis' });
    }

  const timestamp = new Date().toISOString().replace(/[:.\-]/g, '');
  let filename = `FACTURA_${timestamp}.pdf`;
  try {
    const log = await MessageLog.findOne(
      { source: id },
      { serie: 1, separador: 1, numero: 1, recipient: 1, mes: 1, ano: 1, _id: 0 }
    );
    if (log) {
      filename = buildInvoicePdfFilename(log, id);
    }
  } catch (e) {
    // aqui
  }

  const buffer = await withRetries(() => fetchInvoiceBuffer(id), 3, 3000);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  return res.status(200).end(buffer);
  } catch (error) {
    logger.error({ err: error }, "Error en descarga puntual de factura");
    try {
      await MessageLog.findOneAndUpdate(
        { source: id },
        { 
          status: 'failure', 
          reason: `Error al obtener archivo de factura desde API externa: ${error.message}` 
        }
      );
    } catch (updateError) {
      logger.error({ err: updateError }, "Error actualizando MessageLog");
    }
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error procesando la factura', detail: error.message });
    }
  } finally {
    try { await logout(); } catch (e) { /* ignore */ }
  }
};
