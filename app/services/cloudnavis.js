import axios from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import { envConfig } from "../config/index.js";

const CLOUDNAVIS_BASE_URL = "https://www.cloudnavis.com";

// 1. Crea un nuevo CookieJar
const cookieJar = new CookieJar();

// 2. Envuelve la instancia de axios con el soporte para cookies
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

export async function loginCloudnavis() {
  try {
    // 1. Primera llamada GET para obtener la cookie inicial.
    await axiosInstance.get(`${CLOUDNAVIS_BASE_URL}/login/home`, {
      jar: cookieJar,
    });

    // 2. Autenticación con POST.
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

    // Limitar la información que se muestra en logs
    console.log("Status de la respuesta:", response.status);
    if (response.headers.location) {
      console.log(`Login exitoso, redirigido a: ${response.headers.location}`);
      return "¡Autenticación exitosa! 🎉";
    }

    // Verificar presencia de la cookie de sesión
    const sessionCookie = cookieJar.getCookiesSync(`${CLOUDNAVIS_BASE_URL}/`);
    const jSessionId = sessionCookie.find((c) => c.key === "JSESSIONID");
    if (jSessionId) {
      return "¡Autenticación exitosa! 🎉";
    }
    throw new Error("No se encontró la cookie de sesión");
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      error.response &&
      error.response.status === 302
    ) {
      console.log("Login exitoso, redirigido.");
      return "¡Autenticación exitosa! 🎉";
    }
    // Mejorar manejo de errores: no exponer detalles internos
    console.error("Error durante el login:", error.message);
    throw new Error(
      "Error en el proceso de login. Por favor intente de nuevo."
    );
  }
}

export async function listInvoicesCloudnavis(year, month) {
  try {
    // Validar que year y month sean números válidos antes de la solicitud.
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
    // Mejorar manejo de errores para no exponer información sensible
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
    throw new Error("Error en el proceso de cierre de sesión. Por favor intente de nuevo.");
  }
}