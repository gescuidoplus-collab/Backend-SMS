import mongoose from "mongoose";
import envConfig from "./enviroments.js";

const connectDB = async () => {
  const mongoURI = envConfig.mongoUri;
  const maxRetries = 5;
  const retryDelay = 3000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      await mongoose.connect(mongoURI);
      console.log("🗄️ Conexión a MongoDB exitosa");
      return; // Si la conexión es exitosa, salir del bucle
    } catch (error) {
      console.error(
        `❌ Error al conectar a MongoDB (intento ${i + 1}/${maxRetries}):`,
        error.message
      );
      if (i < maxRetries - 1) {
        console.log(`Reintentando en ${retryDelay / 1000} segundos...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay)); // Espera antes de reintentar
      } else {
        console.error(
          "No se pudo conectar a MongoDB después de varios intentos."
        );
        process.exit(1);
      }
    }
  }
};

export default connectDB;
