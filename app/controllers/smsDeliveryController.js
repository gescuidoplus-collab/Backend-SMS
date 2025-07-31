import Redis from "ioredis"; 
import { SmsDeliveryLog } from "../schemas/index.js";

const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const CACHE_EXPIRATION_TIME = 300; 

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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const cacheKey = `sms-logs:page:${page}:limit:${limit}`;
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log('Datos obtenidos de la caché de Redis.');
      return res.json(JSON.parse(cachedData));
    }

    let [results, total] = await Promise.all([
      SmsDeliveryLog.find().skip(skip).limit(limit),
      SmsDeliveryLog.countDocuments()
    ]);

    const responseData = {
      results,
      total,
      page,
      pages: Math.ceil(total / limit)
    };

    await redisClient.setex(cacheKey, CACHE_EXPIRATION_TIME, JSON.stringify(responseData));
    res.json(responseData);

  } catch (error) {
    console.error('Error en getLogs:', error);
    res.status(500).json({ error: error.message });
  }
};

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
