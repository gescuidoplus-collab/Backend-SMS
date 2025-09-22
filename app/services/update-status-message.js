import {
  setWhatsappInvoiceStatus,
  setWhatsappPayrollStatus,
  setCookie,
  loginCloudnavis,
  logout,
} from "./apiCloudnavis.js";

// Pausa entre llamadas para evitar 403
function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Reintentos para cada llamada
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
        throw error;
      }
    }
  }
}

export const updateWhatsappStatuses = async (items) => {
  if (!Array.isArray(items)) {
    throw new TypeError("El parámetro debe ser un array");
  }
  let sessionReady = false;
  let results = null;
  try {
    // 1. Establecer cookie
    const status_code = await setCookie();
    if (status_code !== 200) {
      throw new Error("No se pudo establecer la cookie.");
    }

    // 2. Login con reintentos
    const login_status = await withRetries(loginCloudnavis, 3, 3000);
    if (login_status !== 200) {
      throw new Error("No se pudo hacer login después de varios intentos.");
    }
    sessionReady = true;

    // 3. Procesar items
    results = [];
    for (const item of items) {
      const { messageType, source, response } = item || {};
      let status = "PENDIENTE";

      if (response === true) {
        status = "ENVIADO";
      } else if (response === false) {
        status = "ERROR";
      }

      let fn;
      if (messageType === "invoice") {
        fn = () => setWhatsappInvoiceStatus(source, status);
      } else if (messageType === "payRoll") {
        fn = () => setWhatsappPayrollStatus(source, status);
      } else {
        results.push(null);
        continue;
      }

      try {
        const res = await withRetries(fn, 3, 3000);
        results.push(res);
      } catch (err) {
        console.log(`Error actualizando estado para ${source}: ${err.message}`);
        results.push(null);
      }
      await esperar(300); // Pausa entre llamadas
    }
  } catch (err) {
    console.log(`Error en updateWhatsappStatuses: ${err.message}`);
    results = null;
  } finally {
    if (sessionReady) {
      await logout();
    }
  }
  return results;
};
