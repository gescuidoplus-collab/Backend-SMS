import cron from "node-cron";
import {
  loginCloudnavis,
  listInvoicesCloudnavis,
} from "../services/cloudnavis.js"; // Ajusta la ruta según la ubicación del archivo

// import { sendGroupMessage } from './twilioService.js';

export const monthlyTask = () => {
  // Programa la tarea para el día 1 de cada mes a las 9:00 AM
  // cron.schedule('0 9 1 * *', async () => {
  //     console.log('🤖 Iniciando tarea mensual...');

  //     const numbers = [
  //         '+51987654321',
  //         '+51912345678',
  //         '+51955554444'
  //     ];

  //     const message = `¡Hola equipo! 🌟 Este es nuestro recordatorio mensual. ¡Gracias por ser parte de este proyecto!`;

  //     // try {
  //     //   await sendGroupMessage(message, numbers);
  //     //   console.log('✅ Mensajes enviados exitosamente');
  //     // } catch (error) {
  //     //   console.error('❌ Fallo en el envío masivo:', error);
  //     // }
  // });
  cron.schedule("* * * * *", async () => {
    console.log("🤖 Iniciando tarea mensual...");

    const numbers = ["+51987654321", "+51912345678", "+51955554444"];

    const message = `¡Hola equipo! 🌟 Este es nuestro recordatorio mensual. ¡Gracias por ser parte de este proyecto!`;

    // Realizar llamada a cloudnavis

    // try {
    //   await sendGroupMessage(message, numbers);
    //   console.log('✅ Mensajes enviados exitosamente');
    // } catch (error) {
    //   console.error('❌ Fallo en el envío masivo:', error);
    // }
  });
};
