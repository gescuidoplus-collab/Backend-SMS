import Redis from "ioredis"; 
import { SmsDeliveryLog } from "../schemas/index.js";

// 1. Configurar la conexión a Redis
// Es una buena práctica guardar la URL de Redis en las variables de entorno.
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// 2. Definir un tiempo de vida para los datos en la caché (en segundos).
// Por ejemplo, 3600 segundos = 1 hora.
const CACHE_EXPIRATION_TIME = 300; 

// 🆕 Crear registro
export const createLog = async (req, res) => {
  try {
    const newLog = new SmsDeliveryLog(req.body);
    const savedLog = await newLog.save();
    res.status(201).json(savedLog);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getLogs = async (req, res) => {
  try {

    // 3. Obtenemos los parámetros de paginación del request.
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const cacheKey = `sms-logs:page:${page}:limit:${limit}`;
    
    // 5. Intentamos obtener los datos del caché de Redis.
    // Usamos await para esperar la respuesta de Redis.
    const cachedData = await redisClient.get(cacheKey);

    // 6. Si los datos están en el caché...
    if (cachedData) {
      console.log('Datos obtenidos de la caché de Redis.');
      // ...los convertimos de vuelta a JSON y los enviamos al cliente.
      return res.json(JSON.parse(cachedData));
    }

    // ...hacemos las consultas a MongoDB para obtener los resultados y el total.
    let [results, total] = await Promise.all([
      SmsDeliveryLog.find().skip(skip).limit(limit),
      SmsDeliveryLog.countDocuments()
    ]);

    // 8. Creamos el objeto de respuesta completo.
    const responseData = {
      results,
      total,
      page,
      pages: Math.ceil(total / limit)
    };
    
    // 9. Guardamos los datos en la caché de Redis para la próxima vez.
    // Usamos 'setex' para guardar los datos y establecer un tiempo de expiración.
    await redisClient.setex(cacheKey, CACHE_EXPIRATION_TIME, JSON.stringify(responseData));

    // 10. Enviamos los datos al cliente.
    res.json(responseData);

  } catch (error) {
    // Si algo sale mal, respondemos con un error 500.
    console.error('Error en getLogs:', error);
    res.status(500).json({ error: error.message });
  }
};

// 🔍 Obtener uno
export const getLogById = async (req, res) => {
  try {
    const log = await SmsDeliveryLog.findById(req.params.id);
    if (!log) return res.status(404).json({ error: "Registro no encontrado" });
    const invoce = log.getDecryptedData()
    const payload = {
      log,
      invoce
    }
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✏️ Actualizar
export const updateLog = async (req, res) => {
  try {
    const updatedLog = await SmsDeliveryLog.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!updatedLog)
      return res.status(404).json({ error: "Registro no encontrado" });
    res.json(updatedLog);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// 🗑️ Eliminar
export const deleteLog = async (req, res) => {
  try {
    const deletedLog = await SmsDeliveryLog.findByIdAndDelete(req.params.id);
    if (!deletedLog)
      return res.status(404).json({ error: "Registro no encontrado" });
    res.json({ message: "Registro eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
