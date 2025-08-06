import axios from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import { envConfig } from "../config/index.js";

const CLOUDNAVIS_BASE_URL = envConfig.cloudNavisUrl;

const cookieJar = new CookieJar();


const axiosInstance = wrapper(
  axios.create({
    withCredentials: true,
    timeout: 30000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  })
);

export async function setCookieCloudnavis() {
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

export async function listInvoicesCloudnavis(year, month) {
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

export async function logoutCloudnavis() {
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
    console.error("Error durante el cierre de sesión:", error.message);
    throw new Error(
      "Error en el proceso de cierre de sesión. Por favor intente de nuevo."
    );
  }
}
