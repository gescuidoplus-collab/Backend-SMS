/**
 * Validar y formatear número de teléfono para WhatsApp
 * Soporta números internacionales con cualquier código de país
 * @param {string} phoneNumber - Número de teléfono (+34 612345678, +58 4121234567, o 612345678)
 * @returns {string} Número formateado para WhatsApp (whatsapp:+34612345678)
 */
export const formatWhatsAppNumber = (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    throw new Error('Phone number must be a non-empty string');
  }

  // Si ya está en formato WhatsApp, devolverlo tal cual
  if (phoneNumber.startsWith("whatsapp:")) {
    return phoneNumber;
  }

  // Remover espacios, guiones, paréntesis y otros caracteres especiales
  let cleanNumber = phoneNumber.replace(/[\s\-()]/g, '');

  // Si ya tiene "+", significa que el usuario proporcionó el código de país
  // Usarlo tal cual (soporta cualquier código internacional)
  if (cleanNumber.startsWith("+")) {
    return `whatsapp:${cleanNumber}`;
  }

  // Si no tiene "+", asumir que es número español (+34)
  // Este es el comportamiento por defecto para números sin código de país
  if (/^\d{6,14}$/.test(cleanNumber)) {
    return `whatsapp:+34${cleanNumber}`;
  }

  throw new Error(`Invalid phone number format: ${phoneNumber}`);
};