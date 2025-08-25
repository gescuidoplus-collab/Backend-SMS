import mongoose from "mongoose";
import envConfig from "./enviroments.js";

let cachedPromise = null;

const connectDB = async () => {
  const mongoURI = envConfig.mongoUri;
  if (!mongoURI) throw new Error("MONGO_URI no definido");

  // Estados: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (mongoose.connection.readyState === 2 && cachedPromise) return cachedPromise;

  const maxRetries = 5;
  const retryDelay = 3000;

  cachedPromise = (async () => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await mongoose.connect(mongoURI, {
          // Opcional: parámetros adicionales
          serverSelectionTimeoutMS: 7000,
        });
        console.log("🗄️ Conexión a MongoDB exitosa");
        return mongoose.connection;
      } catch (error) {
        console.error(
          `❌ Error al conectar a MongoDB (intento ${i + 1}/${maxRetries}):`,
          error.message
        );
        if (i < maxRetries - 1) {
          console.log(`Reintentando en ${retryDelay / 1000} segundos...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        } else {
          console.error("No se pudo conectar a MongoDB después de varios intentos.");
          throw error;
        }
      }
    }
  })();

  try {
    return await cachedPromise;
  } catch (e) {
    cachedPromise = null; // permitir reintentos futuros
    throw e;
  }
};

export default connectDB;
