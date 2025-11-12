/**
 * Validar y formatear número de teléfono para WhatsApp
 * @param {string} phoneNumber - Número de teléfono
 * @returns {string} Número formateado para WhatsApp
 */
export const formatWhatsAppNumber = (phoneNumber) => {
  // Usando template literals y operador ternario
  const isWhatsAppFormat = phoneNumber.startsWith("whatsapp:");
  const hasPlus = phoneNumber.startsWith("+");

  return isWhatsAppFormat
    ? phoneNumber
    : hasPlus
    ? `whatsapp:${phoneNumber}`
    : `whatsapp:+34${phoneNumber}`;
};