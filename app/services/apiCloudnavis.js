import axios from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import { envConfig, logger } from "../config/index.js";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const CLOUDNAVIS_BASE_URL = String(envConfig.cloudNavisUrl || "").replace(/\/+$/, "");
const CLOUDNAVIS_CONTEXT_PREFIX = "/edades/cuidofam";

const cookieJar = new CookieJar();

// Mutex simple para evitar condiciones de carrera en login concurrente
let sessionLock = null;
let sessionValid = false;
let lastLoginTime = 0;
const SESSION_TTL_MS = 60000; // 1 minuto de validez de sesión

async function acquireSession() {
  // Si hay un login en progreso, esperar a que termine
  if (sessionLock) {
    await sessionLock;
  }
  
  // Si la sesión aún es válida, reutilizarla
  const now = Date.now();
  if (sessionValid && (now - lastLoginTime) < SESSION_TTL_MS) {
    return { reused: true };
  }
  
  // Crear nuevo lock para este login
  let resolveLock;
  sessionLock = new Promise((resolve) => { resolveLock = resolve; });
  
  return { reused: false, release: (success) => {
    if (success) {
      sessionValid = true;
      lastLoginTime = Date.now();
    }
    sessionLock = null;
    resolveLock();
  }};
}

export function invalidateSession() {
  sessionValid = false;
  lastLoginTime = 0;
}

const axiosInstance = wrapper(
  axios.create({
    withCredentials: true,
    timeout: 60000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  })
);

export async function setCookie() {
  try {
    const primaryUrl = `${CLOUDNAVIS_BASE_URL}/login/home`;
    try {
      const resp = await axiosInstance.get(primaryUrl, {
        jar: cookieJar,
      });
      return resp.status;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        const fallbackUrl = `${CLOUDNAVIS_BASE_URL}${CLOUDNAVIS_CONTEXT_PREFIX}/login/home`;
        const resp = await axiosInstance.get(fallbackUrl, {
          jar: cookieJar,
        });
        return resp.status;
      }
      throw error;
    }
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const url = axios.isAxiosError(error) ? error.config?.url : undefined;
    logger.error({ err: error, status, url }, "Error setCookie");
    return 500;
  }
}

export async function loginCloudnavis() {
  // Usar mutex para evitar logins concurrentes
  const session = await acquireSession();
  
  // Si la sesión ya es válida, reutilizarla
  if (session.reused) {
    return 200;
  }
  
  try {
    const params = new URLSearchParams();
    params.append("j_username", envConfig.cloudNavisUsername);
    params.append("j_password", envConfig.cloudNavisPassword);
    params.append("submit", "");

    const requestOptions = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
      jar: cookieJar,
    };

    const primaryUrl = `${CLOUDNAVIS_BASE_URL}/login/j_security_check`;
    let response;
    try {
      response = await axiosInstance.post(primaryUrl, params.toString(), requestOptions);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        const fallbackUrl = `${CLOUDNAVIS_BASE_URL}${CLOUDNAVIS_CONTEXT_PREFIX}/login/j_security_check`;
        response = await axiosInstance.post(fallbackUrl, params.toString(), requestOptions);
      } else {
        throw error;
      }
    }
    if (response.headers.location) {
      session.release(true);
      return 200;
    }
    const sessionCookie = cookieJar.getCookiesSync(`${CLOUDNAVIS_BASE_URL}/`);
    const jSessionId = sessionCookie.find((c) => c.key === "JSESSIONID");
    if (jSessionId) {
      session.release(true);
      return 200;
    }
    session.release(false);
    return 400;
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      error.response &&
      error.response.status === 302
    ) {
      logger.info("Login exitoso, redirigido");
      session.release(true);
      return 200;
    }

    logger.error({ err: error }, "Error durante el login");
    session.release(false);
    return 400;
  }
}

export async function listInvoices(year, month) {
  try {
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new Error("Parámetros inválidos para year o month.");
    }

    const response = await axiosInstance.get(
      `${CLOUDNAVIS_BASE_URL}/edades/cuidofam/api/facturacion/listado`,
      {
        params: { year: yearNum, month: monthNum },
        jar: cookieJar,
      }
    );
    return response.data;
  } catch (error) {
    logger.error({ err: error }, "Error obteniendo facturas");
    throw new Error("Error al obtener las facturas.");
  }
}

export async function getUsers(userID) {
  try {
    if (!userID) {
      throw new Error("Parámetro inválido userID");
    }

    const response = await axiosInstance.get(
      `${CLOUDNAVIS_BASE_URL}/edades/cuidofam/api/usuarios/edit?`,
      {
        params: { uuid: userID },
        jar: cookieJar,
      }
    );
    return response.data;
  } catch (error) {
    logger.error({ err: error }, "Error obteniendo usuario");
    throw new Error("Error al obtener las facturas.");
  }
}

export async function getEmpleados(empleadoid) {
  try {
    if (!empleadoid) {
      throw new Error("Parámetro inválido empleadoid");
    }

    const response = await axiosInstance.get(
      `${CLOUDNAVIS_BASE_URL}/edades/cuidofam/api/empleados/edit?`,
      {
        params: { uuid: empleadoid },
        jar: cookieJar,
      }
    );
    return response.data;
  } catch (error) {
    logger.error({ err: error }, "Error obteniendo empleados");
    throw new Error("Error al obtener las facturas.");
  }
}

export async function ListPayRolls(year, month) {
  try {
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new Error("Parámetros inválidos para year o month.");
    }

    const response = await axiosInstance.get(
      `${CLOUDNAVIS_BASE_URL}/edades/cuidofam/api/nominas/listado`,
      {
        params: { year: yearNum, month: monthNum },
        jar: cookieJar,
      }
    );
    return response.data;
  } catch (error) {
    logger.error({ err: error }, "Error obteniendo nóminas");
    throw new Error("Error al obtener las facturas.");
  }
}

export async function downloadInvoce(invoceID) {
  try {
    if (!invoceID) {
      throw new Error("Parámetro inválido invoceID");
    }

    const response = await axiosInstance.get(
      `${CLOUDNAVIS_BASE_URL}/edades/cuidofam/api/facturacion/download`, // <- quitado el ?
      {
        params: { uuid: invoceID },
        jar: cookieJar,
        responseType: "arraybuffer",
      }
    );

    // --- RUTA DE GUARDADO ---
    const folderPath = path.join(process.cwd(), "public", "media", "pdfs");
    const fileName = `${uuidv4()}.pdf`;
    const filePath = path.join(folderPath, fileName);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

  // Guardar el archivo PDF en el sistema de archivos
  fs.writeFileSync(filePath, response.data);

    // --- GENERAR URL PÚBLICA (Ajusta la URL base según tu entorno) ---
    const baseUrl = `${envConfig.apiUrl}/public`;
    const publicUrl = `${baseUrl}/media/pdfs/${fileName}`;
    return {
      localPath: filePath,
      publicUrl: publicUrl,
      buffer: Buffer.from(response.data)
    };
  } catch (error) {
    logger.error({ err: error }, "Error al descargar y guardar la factura");
    throw new Error("Error al descargar y guardar la factura.");
  }
}

export async function downloadPayrolls(payRollID) {
  try {
    if (!payRollID) {
      throw new Error("Parámetro inválido payRollID");
    }

    const response = await axiosInstance.get(
      `${CLOUDNAVIS_BASE_URL}/edades/cuidofam/api/nominas/download`, // <- quitado el ?
      {
        params: { uuid: payRollID },
        jar: cookieJar,
        responseType: "arraybuffer",
      }
    );

    // --- RUTA DE GUARDADO ---
    const folderPath = path.join(process.cwd(), "public", "media", "payrolls");
    const fileName = `nomina_${uuidv4()}.pdf`;
    const filePath = path.join(folderPath, fileName);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

  // Guardar el archivo PDF en el sistema de archivos
  fs.writeFileSync(filePath, response.data);
    // --- GENERAR URL PÚBLICA (Ajusta la URL base según tu entorno) ---
    const baseUrl = `${envConfig.apiUrl}/public`;
    const publicUrl = `${baseUrl}/media/payrolls/${fileName}`;
    return {
      localPath: filePath,
      publicUrl: publicUrl,
      buffer: Buffer.from(response.data)
    };
  } catch (error) {
    logger.error({ err: error }, "Error al descargar y guardar la nómina");
    throw new Error("Error al descargar y guardar la nómina.");
  }
}

export async function fetchInvoiceBuffer(invoceID) {
  try {
    if (!invoceID) throw new Error('Parámetro inválido invoceID');
    const response = await axiosInstance.get(
      `${CLOUDNAVIS_BASE_URL}/edades/cuidofam/api/facturacion/download`,
      {
        params: { uuid: invoceID },
        jar: cookieJar,
        responseType: 'arraybuffer'
      }
    );
    return Buffer.from(response.data);
  } catch (error) {
    logger.error({ err: error }, "Error fetchInvoiceBuffer");
    throw new Error('Error al descargar la factura.');
  }
}

export async function fetchPayrollBuffer(payRollID) {
  try {
    if (!payRollID) throw new Error('Parámetro inválido payRollID');
    const response = await axiosInstance.get(
      `${CLOUDNAVIS_BASE_URL}/edades/cuidofam/api/nominas/download`,
      {
        params: { uuid: payRollID },
        jar: cookieJar,
        responseType: 'arraybuffer'
      }
    );
    return Buffer.from(response.data);
  } catch (error) {
    logger.error({ err: error }, "Error fetchPayrollBuffer");
    throw new Error('Error al descargar la nómina.');
  }
}

export async function setWhatsappInvoiceStatus(idFactura, status) {
  try {
    if (!idFactura || !status) {
      throw new Error("Parámetros inválidos: idFactura y status son requeridos.");
    }

    const response = await axiosInstance.post(
      `${CLOUDNAVIS_BASE_URL}/edades/cuidofam/api/facturacion/whatsapp_status`,
      { idFactura, status },
      {
        headers: { "Content-Type": "application/json" },
        jar: cookieJar,
      }
    );
    return response.data;
  } catch (error) {
    logger.error({ err: error }, "Error al actualizar el estado WhatsApp de la factura");
    throw new Error("Error al actualizar el estado WhatsApp de la factura.");
  }
}

export async function setWhatsappPayrollStatus(idNomina, status) {
  try {
    if (!idNomina || !status) {
      throw new Error("Parámetros inválidos: idNomina y status son requeridos.");
    }

    const response = await axiosInstance.post(
      `${CLOUDNAVIS_BASE_URL}/edades/cuidofam/api/nominas/whatsapp_status`,
      { idNomina, status },
      {
        headers: { "Content-Type": "application/json" },
        jar: cookieJar,
      }
    );
    return response.data;
  } catch (error) {
    logger.error({ err: error }, "Error al actualizar el estado WhatsApp de la nómina");
    throw new Error("Error al actualizar el estado WhatsApp de la nómina.");
  }
}

export async function logout() {
  try {
    const primaryUrl = `${CLOUDNAVIS_BASE_URL}/login/logout`;
    let response;
    try {
      response = await axiosInstance.get(primaryUrl, {
        jar: cookieJar,
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        const fallbackUrl = `${CLOUDNAVIS_BASE_URL}${CLOUDNAVIS_CONTEXT_PREFIX}/login/logout`;
        response = await axiosInstance.get(fallbackUrl, {
          jar: cookieJar,
        });
      } else {
        throw error;
      }
    }
    logger.info({ status: response.status }, "Logout status");
    cookieJar.removeAllCookiesSync();
    invalidateSession();
    return "¡Sesión cerrada exitosamente! 👋";
  } catch (error) {
    invalidateSession();
    throw new Error(
      "Error en el proceso de cierre de sesión. Por favor intente de nuevo."
    );
  }
}
