import {
  setCookie,
  loginCloudnavis,
  fetchPayrollBuffer,
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

// Descarga una nómina puntual y retorna el PDF directamente
export const downloadPayrollPdf = async (req, res) => {
  const { id } = req.params; // uuid de la nómina
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

    // Obtener buffer del PDF
    const buffer = await withRetries(() => fetchPayrollBuffer(id), 3, 3000);

    // Buscar metadata en MessageLog usando source = id y usar solo 'serie' como nombre
    let filename = `nomina_${id}.pdf`;
    try {
      const log = await MessageLog.findOne(
        { source: id },
        { serie: 1, _id: 0 }
      ).lean();
      if (log && typeof log.serie !== 'undefined' && log.serie !== null && log.serie !== '') {
        const sanitize = (s) => String(s).replace(/[^a-zA-Z0-9._-]+/g, '_');
        filename = `${sanitize(log.serie)}.pdf`;
      }
    } catch (e) {
      // Si falla la consulta, continuamos con el nombre por defecto
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.status(200).end(buffer);
  } catch (error) {
    console.error('Error en descarga puntual de nómina:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error procesando la nómina', detail: error.message });
    }
  } finally {
    try { await logout(); } catch (e) { /* ignore */ }
  }
};
