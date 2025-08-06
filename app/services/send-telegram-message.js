import axios from "axios";
import {envConfig} from "../config/index.js"

/**
 * Envía un mensaje a un chat de Telegram usando la API de Telegram Bot.
 *
 * @async
 * @function send_telegram_message
 * @param {string} message - El texto del mensaje a enviar.
 * @returns {Promise<Object|null>} La respuesta de la API de Telegram si es exitosa, o null si ocurre un error.
 */
export const send_telegram_message = async (message) => {

  console.log(envConfig)

  const token = envConfig.telegramTokenSecret; 
  const chat_id = envConfig.telegramAppID;     
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const body = {
    chat_id: chat_id,
    text: message
  };

  try {
    const response = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('Respuesta de Telegram:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error al enviar mensaje a Telegram:', error);
    return null;
  }
};

