import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "app", "data");
const ARCHIVO_PATH = path.join(DATA_DIR, "contador_factura.txt");

export async function generarCodigoFactura() {
  try {
    // Crear carpeta si no existe
    await fs.mkdir(DATA_DIR, { recursive: true });

    const fecha = new Date();
    const mesActual = fecha.getMonth() + 1;
    const anioActual = fecha.getFullYear();

    let numeroFactura = 0;
    let mesGuardado = mesActual;
    let anioGuardado = anioActual;

    try {
      const contenido = await fs.readFile(ARCHIVO_PATH, "utf-8");
      const datos = JSON.parse(contenido);
      numeroFactura = datos.numeroFactura || 0;
      mesGuardado = datos.mes || mesActual;
      anioGuardado = datos.anio || anioActual;
    } catch (error) {
      console.log("Archivo no existe, empezando en 0");
    }

    // Reiniciar contador si cambió el mes o año
    if (mesGuardado !== mesActual || anioGuardado !== anioActual) {
      numeroFactura = 0;
    }

    // Incrementar
    numeroFactura += 1;

    const mes = String(mesActual).padStart(2, "0");
    const codigo = `${String(numeroFactura).padStart(2, "0")}${mes}${anioActual}`;

    // Guardar el nuevo número
    const datosAGuardar = {
      numeroFactura,
      mes: mesActual,
      anio: anioActual,
      ultimaActualizacion: fecha.toISOString(),
    };

    await fs.writeFile(ARCHIVO_PATH, JSON.stringify(datosAGuardar, null, 2), "utf-8");

    return {
      success: true,
      codigo,
      numeroFactura,
      mes: mesActual,
      anio: anioActual,
      timestamp: fecha.toISOString(),
    };
  } catch (error) {
    console.error("Error al generar código:", error);
    return { success: false, error: error.message };
  }
}

export async function obtenerUltimoNumeroFactura() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const contenido = await fs.readFile(ARCHIVO_PATH, 'utf-8');
    const datos = JSON.parse(contenido);
    
    const fecha = new Date();
    const mesActual = fecha.getMonth() + 1;
    const anioActual = fecha.getFullYear();
    
    let numeroFactura = datos.numeroFactura || 0;
    if (datos.mes !== mesActual || datos.anio !== anioActual) {
      numeroFactura = 0; 
    }
    
    return {
      success: true, 
      numeroFactura,
      mes: datos.mes,
      anio: datos.anio,
      mesActual,
      anioActual,
      seResetearaEnProximaFactura: datos.mes !== mesActual || datos.anio !== anioActual
    };
  } catch (error) {
    const fecha = new Date();
    return {
      success: true, 
      numeroFactura: 0,
      mes: fecha.getMonth() + 1,
      anio: fecha.getFullYear()
    };
  }
}

export async function resetearContador() {
  try {
    await fs.writeFile(ARCHIVO_PATH, JSON.stringify({ numeroFactura: 0, mes: new Date().getMonth() + 1, anio: new Date().getFullYear() }, null, 2), 'utf-8');
    return { success: true, message: 'Contador reseteado a 0' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}