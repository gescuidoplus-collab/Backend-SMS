import {
  setCookie,
  loginCloudnavis,
  fetchInvoiceBuffer,
  logout
} from '../services/apiCloudnavis.js';
import { MessageLog } from '../schemas/index.js';

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
        console.log(`Reintento ${attempt + 1}/${maxRetries} fallido. Esperando...`);
        await esperar(delay);
      } else {
        throw error;
      }
    }
  }
}

// Descarga una factura puntual y retorna el PDF directamente
export const downloadInvoicePdf = async (req, res) => {
  const { id } = req.params; // uuid de la factura
  if (!id) {
    return res.status(400).json({ message: 'Parámetro id es requerido' });
  }

  try {
    const cookieStatus = await withRetries(setCookie, 3, 3000);
    if (cookieStatus !== 200) {
      return res.status(500).json({ message: 'No se pudo establecer la cookie de sesión' });
    }

    const loginStatus = await withRetries(loginCloudnavis, 3, 3000);
    if (loginStatus !== 200) {
      return res.status(500).json({ message: 'No se pudo iniciar sesión en CloudNavis' });
    }

  // Buscar metadata en MessageLog usando source = id
  // Generar nombre por defecto con timestamp
  const timestamp = new Date().toISOString().replace(/[:.\-]/g, '');
  let filename = `factura_${timestamp}.pdf`;
  try {
    const log = await MessageLog.findOne(
      { source: id },
      { serie: 1, separador: 1, numero: 1, _id: 0 }
    ).lean();

    if (log) {
      const { serie, separador, numero } = log;
      if (
        typeof serie !== 'undefined' &&
        typeof separador !== 'undefined' &&
        typeof numero !== 'undefined'
      ) {
        filename = `${String(serie)}${String(separador)}${String(numero)}.pdf`;
      } else {
        const parts = [serie, separador, numero]
          .filter((v) => v !== undefined && v !== null && v !== '')
          .map((v) => String(v));
        if (parts.length > 0) filename = `${parts.join('')}.pdf`;
      }
    }
  } catch (e) {
    // Si falla la consulta, continuamos con el nombre por defecto
  }

  const buffer = await withRetries(() => fetchInvoiceBuffer(id), 3, 3000);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  return res.status(200).end(buffer);
  } catch (error) {
    console.error('Error en descarga puntual de factura:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error procesando la factura', detail: error.message });
    }
  } finally {
    try { await logout(); } catch (e) { /* ignore */ }
  }
};
