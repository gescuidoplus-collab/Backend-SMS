import axios from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import { envConfig } from "../config/index.js";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const CLOUDNAVIS_BASE_URL = envConfig.cloudNavisUrl;

const cookieJar = new CookieJar();

const axiosInstance = wrapper(
  axios.create({
    withCredentials: true,
    timeout: 30000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  })
);

export async function setCookie() {
  try {
    const resp = await axiosInstance.get(`${CLOUDNAVIS_BASE_URL}/login/home`, {
      jar: cookieJar,
    });
    return resp.status;
  } catch (error) {
    return 500;
  }
}

export async function loginCloudnavis() {
  try {
    const params = new URLSearchParams();
    params.append("j_username", envConfig.cloudNavisUsername);
    params.append("j_password", envConfig.cloudNavisPassword);
    params.append("submit", "");

    const response = await axiosInstance.post(
      `${CLOUDNAVIS_BASE_URL}/login/j_security_check`,
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
        jar: cookieJar,
      }
    );
    if (response.headers.location) {
      return 200;
    }
    const sessionCookie = cookieJar.getCookiesSync(`${CLOUDNAVIS_BASE_URL}/`);
    const jSessionId = sessionCookie.find((c) => c.key === "JSESSIONID");
    if (jSessionId) {
      return 200;
    }
    return 400;
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      error.response &&
      error.response.status === 302
    ) {
      console.log("Login exitoso, redirigido.");
      return 200;
    }

    console.error("Error durante el login:", error.message);
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
    console.error("Error obteniendo facturas:", error.message);
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
    console.error("Error obteniendo facturas:", error.message);
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
    console.error("Error obteniendo facturas:", error.message);
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
    console.error("Error obteniendo facturas:", error.message);
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
    console.error("Error al descargar y guardar la factura:", error.message);
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
    console.error("Error al descargar y guardar la nómina:", error.message);
    throw new Error("Error al descargar y guardar la nómina.");
  }
}

// ==== NUEVAS FUNCIONES SIN GUARDAR EN DISCO (solo buffer) ====
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
    console.error('Error fetchInvoiceBuffer:', error.message);
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
    console.error('Error fetchPayrollBuffer:', error.message);
    throw new Error('Error al descargar la nómina.');
  }
}

export async function logout() {
  try {
    const response = await axiosInstance.get(
      `${CLOUDNAVIS_BASE_URL}/login/logout`,
      {
        jar: cookieJar,
      }
    );
    console.log("Status del logout:", response.status);
    cookieJar.removeAllCookiesSync();
    return "¡Sesión cerrada exitosamente! 👋";
  } catch (error) {
    throw new Error(
      "Error en el proceso de cierre de sesión. Por favor intente de nuevo."
    );
  }
}
