import mongoose from 'mongoose';
import { envConfig } from "../../app/config/index.js";

// Esquema para el contador de facturas
const contadorSchema = new mongoose.Schema({
  tipo: { type: String, required: true, default: 'factura', index: true },
  numeroFactura: { type: Number, required: true, default: 0 },
  mes: { type: Number, required: true },
  anio: { type: Number, required: true },
  ultimaActualizacion: { type: Date, default: Date.now }
});

// Si el modelo ya existe, lo usamos, sino lo creamos
let ContadorModel;
try {
  ContadorModel = mongoose.model('Contador');
} catch (error) {
  ContadorModel = mongoose.model('Contador', contadorSchema);
}

// Función para obtener/actualizar el contador de facturas
export async function generarCodigoFactura() {
  try {
    // Verificar que estamos conectados a MongoDB
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(envConfig.mongoUri);
    }
    
    const fecha = new Date();
    const mesActual = fecha.getMonth() + 1;
    const anioActual = fecha.getFullYear();

    // Buscar el contador existente
    let contador = await ContadorModel.findOne({ tipo: 'factura' });
    
    let numeroFactura = 0;
    
    if (contador) {
      // Si existe el contador, verificar si necesitamos reiniciar por cambio de mes/año
      if (contador.mes !== mesActual || contador.anio !== anioActual) {
        // Reiniciar para el nuevo mes
        numeroFactura = 1;
        contador.numeroFactura = numeroFactura;
        contador.mes = mesActual;
        contador.anio = anioActual;
      } else {
        // Incrementar el contador existente
        numeroFactura = contador.numeroFactura + 1;
        contador.numeroFactura = numeroFactura;
      }
      contador.ultimaActualizacion = fecha;
      await contador.save();
    } else {
      // Si no existe el contador, lo creamos empezando en 1
      numeroFactura = 1;
      contador = new ContadorModel({
        tipo: 'factura',
        numeroFactura,
        mes: mesActual,
        anio: anioActual,
        ultimaActualizacion: fecha
      });
      await contador.save();
    }
    
    // Generar el código con el formato requerido
    const mes = String(mesActual).padStart(2, "0");
    const codigo = `${String(numeroFactura).padStart(2, "0")}${mes}${anioActual}`;

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
    // Verificar que estamos conectados a MongoDB
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(envConfig.mongoUri);
    }
    
    const contador = await ContadorModel.findOne({ tipo: 'factura' });
    const fecha = new Date();
    const mesActual = fecha.getMonth() + 1;
    const anioActual = fecha.getFullYear();
    
    if (!contador) {
      return {
        success: true, 
        numeroFactura: 0,
        mes: mesActual,
        anio: anioActual,
        mesActual,
        anioActual,
        seResetearaEnProximaFactura: false
      };
    }
    
    let numeroFactura = contador.numeroFactura || 0;
    const seResetearaEnProximaFactura = contador.mes !== mesActual || contador.anio !== anioActual;
    
    if (seResetearaEnProximaFactura) {
      numeroFactura = 0;
    }
    
    return {
      success: true, 
      numeroFactura,
      mes: contador.mes,
      anio: contador.anio,
      mesActual,
      anioActual,
      seResetearaEnProximaFactura
    };
  } catch (error) {
    console.error("Error al obtener último número de factura:", error);
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
    // Verificar que estamos conectados a MongoDB
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(envConfig.mongoUri);
    }
    
    const contador = await ContadorModel.findOne({ tipo: 'factura' });
    if (contador) {
      contador.numeroFactura = 0;
      contador.mes = new Date().getMonth() + 1;
      contador.anio = new Date().getFullYear();
      await contador.save();
    } else {
      const nuevoContador = new ContadorModel({
        tipo: 'factura',
        numeroFactura: 0,
        mes: new Date().getMonth() + 1,
        anio: new Date().getFullYear(),
        ultimaActualizacion: new Date()
      });
      await nuevoContador.save();
    }
    
    return { success: true, message: 'Contador reseteado a 0' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}