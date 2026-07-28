import axios from "axios";
import { envConfig, logger } from "../config/index.js";

const CLOUDNAVIS_BASE_URL = String(envConfig.cloudNavisUrl || "").replace(/\/+$/, "");

const defaultHeaders = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9",
};

/**
 * Obtener facturas usando token en lugar de sesión
 * @param {string} token - Token de autenticación CloudNavis
 * @param {number} year - Año (ej: 2026)
 * @param {number} month - Mes (ej: 5)
 * @returns {Promise<Object>} Objeto con array de facturas
 */
export async function listInvoicesWithToken(token, year, month) {
  try {
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new Error("Parámetros inválidos para year o month.");
    }

    if (!token || typeof token !== "string") {
      throw new Error("Token inválido o no proporcionado");
    }

    const response = await axios.get(
      `${CLOUDNAVIS_BASE_URL}/edades/cuidofam/api/facturacion/listado`,
      {
        params: { year: yearNum, month: monthNum },
        headers: {
          ...defaultHeaders,
          "cntoken": token,
        },
        timeout: 60000,
      }
    );
    return response.data;
  } catch (error) {
    logger.error({ err: error, token: token?.substring(0, 5) + "..." }, "Error obteniendo facturas con token");
    throw new Error(`Error al obtener las facturas: ${error.message}`);
  }
}

/**
 * Obtener nóminas usando token
 * @param {string} token - Token de autenticación CloudNavis
 * @param {number} year - Año
 * @param {number} month - Mes
 * @returns {Promise<Object>} Objeto con array de nóminas
 */
export async function listPayrollsWithToken(token, year, month) {
  try {
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new Error("Parámetros inválidos para year o month.");
    }

    if (!token || typeof token !== "string") {
      throw new Error("Token inválido o no proporcionado");
    }

    const response = await axios.get(
      `${CLOUDNAVIS_BASE_URL}/edades/cuidofam/api/nominas/listado`,
      {
        params: { year: yearNum, month: monthNum },
        headers: {
          ...defaultHeaders,
          "cntoken": token,
        },
        timeout: 60000,
      }
    );
    return response.data;
  } catch (error) {
    logger.error({ err: error, token: token?.substring(0, 5) + "..." }, "Error obteniendo nóminas con token");
    throw new Error(`Error al obtener las nóminas: ${error.message}`);
  }
}

/**
 * Obtener datos de usuario usando token
 * @param {string} token - Token de autenticación CloudNavis
 * @param {string} userID - UUID del usuario
 * @returns {Promise<Object>} Datos del usuario
 */
export async function getUserWithToken(token, userID) {
  try {
    if (!userID) {
      throw new Error("Parámetro inválido userID");
    }

    if (!token || typeof token !== "string") {
      throw new Error("Token inválido o no proporcionado");
    }

    const response = await axios.get(
      `${CLOUDNAVIS_BASE_URL}/edades/cuidofam/api/usuarios/edit`,
      {
        params: { uuid: userID },
        headers: {
          ...defaultHeaders,
          "cntoken": token,
        },
        timeout: 60000,
      }
    );
    return response.data;
  } catch (error) {
    logger.error({ err: error, userID, token: token?.substring(0, 5) + "..." }, "Error obteniendo usuario con token");
    throw new Error(`Error al obtener usuario: ${error.message}`);
  }
}

/**
 * Obtener datos de empleado usando token
 * @param {string} token - Token de autenticación CloudNavis
 * @param {string} empleadoID - UUID del empleado
 * @returns {Promise<Object>} Datos del empleado
 */
export async function getEmpleadoWithToken(token, empleadoID) {
  try {
    if (!empleadoID) {
      throw new Error("Parámetro inválido empleadoID");
    }

    if (!token || typeof token !== "string") {
      throw new Error("Token inválido o no proporcionado");
    }

    const response = await axios.get(
      `${CLOUDNAVIS_BASE_URL}/edades/cuidofam/api/empleados/edit`,
      {
        params: { uuid: empleadoID },
        headers: {
          ...defaultHeaders,
          "cntoken": token,
        },
        timeout: 60000,
      }
    );
    return response.data;
  } catch (error) {
    logger.error({ err: error, empleadoID, token: token?.substring(0, 5) + "..." }, "Error obteniendo empleado con token");
    throw new Error(`Error al obtener empleado: ${error.message}`);
  }
}

/**
 * Descargar factura usando token
 * @param {string} token - Token de autenticación CloudNavis
 * @param {string} invoiceID - UUID de la factura
 * @returns {Promise<Buffer>} PDF de la factura
 */
export async function downloadInvoiceWithToken(token, invoiceID) {
  try {
    if (!invoiceID) {
      throw new Error("Parámetro inválido invoiceID");
    }

    if (!token || typeof token !== "string") {
      throw new Error("Token inválido o no proporcionado");
    }

    const response = await axios.get(
      `${CLOUDNAVIS_BASE_URL}/edades/cuidofam/api/facturacion/download`,
      {
        params: { uuid: invoiceID },
        headers: {
          ...defaultHeaders,
          "cntoken": token,
        },
        responseType: "arraybuffer",
        timeout: 60000,
      }
    );
    return response.data;
  } catch (error) {
    logger.error({ err: error, invoiceID, token: token?.substring(0, 5) + "..." }, "Error descargando factura con token");
    throw new Error(`Error al descargar factura: ${error.message}`);
  }
}

/**
 * Descargar nómina usando token
 * @param {string} token - Token de autenticación CloudNavis
 * @param {string} payrollID - UUID de la nómina
 * @returns {Promise<Buffer>} PDF de la nómina
 */
export async function downloadPayrollWithToken(token, payrollID) {
  try {
    if (!payrollID) {
      throw new Error("Parámetro inválido payrollID");
    }

    if (!token || typeof token !== "string") {
      throw new Error("Token inválido o no proporcionado");
    }

    const response = await axios.get(
      `${CLOUDNAVIS_BASE_URL}/edades/cuidofam/api/nominas/download`,
      {
        params: { uuid: payrollID },
        headers: {
          ...defaultHeaders,
          "cntoken": token,
        },
        responseType: "arraybuffer",
        timeout: 60000,
      }
    );
    return response.data;
  } catch (error) {
    logger.error({ err: error, payrollID, token: token?.substring(0, 5) + "..." }, "Error descargando nómina con token");
    throw new Error(`Error al descargar nómina: ${error.message}`);
  }
}
