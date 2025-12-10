import { send_telegram_message } from "../services/sendMessageTelegram.js";
import { sendWhatsAppMessage } from "../services/twilioService.js";
import { envConfig } from "../config/index.js";
import { hasActiveContextWindow, initializeContextWindow } from "../services/twilioContextManager.js";

/**
 * Parsea el formato de mensaje de redirección:
 * - +numero-mensaje (sin nombre)
 * - +numero-nombre-mensaje (con nombre)
 * @param {string} body - Cuerpo del mensaje
 * @returns {Object|null} { phoneNumber, message } o null si no coincide
 */
const parseRedirectMessage = (body) => {
  if (!body || !body.startsWith("+")) {
    return null;
  }

  // Buscar el primer guión después del número
  const firstDashIndex = body.indexOf("-");
  if (firstDashIndex === -1) {
    return null;
  }

  const phoneNumber = body.substring(0, firstDashIndex).trim();
  const messageContent = body.substring(firstDashIndex + 1).trim();

  // Validar que el número tenga formato válido (+XXX...)
  if (!/^\+\d{10,15}$/.test(phoneNumber)) {
    return null;
  }

  // Si no hay mensaje, es inválido
  if (!messageContent) {
    return null;
  }

  return { phoneNumber, message: messageContent };
};

/**
 * Verifica si el número From es el redirectNumber (administrador)
 * @param {string} from - Número en formato whatsapp:+XXXX
 * @returns {boolean}
 */
const isFromRedirectNumber = (from) => {
  if (!from) return false;
  
  const cleanFrom = from.replace("whatsapp:", "").trim();
  const redirectNumber = `+34${envConfig.redirectNumber}`;
  
  return cleanFrom === redirectNumber;
};

/**
 * Webhook para recibir eventos de Twilio (SMS entrantes, status, etc.)
 * Twilio enviará un POST a este endpoint.
 * 
 * Flujos:
 * 1. Mensaje del administrador (redirectNumber) con formato +numero-nombre-mensaje → Reenvía al usuario
 * 2. Mensaje de usuario externo → Notifica al administrador
 */
export const handleTwilioWebhook = async (req, res) => {
  try {
    const {
      ProfileName,
      From,
      Body,
      MessageType,
      ButtonText,
      ButtonPayload,
      ChannelMetadata,
    } = req.body;

    let senderName = ProfileName;
    if (!senderName && ChannelMetadata) {
      try {
        const meta = JSON.parse(ChannelMetadata);
        senderName = meta?.data?.context?.ProfileName || senderName;
      } catch (e) {
        // Ignorar error de parseo
      }
    }

    const redirectNumberFormatted = `+34${envConfig.redirectNumber}`;

    // ═══════════════════════════════════════════════════════════════════════
    // FLUJO 1: Mensaje del administrador (redirectNumber) → Reenviar a usuario
    // Formato: +numero-mensaje (es una respuesta directa, no necesita plantilla)
    // ═══════════════════════════════════════════════════════════════════════
    if (isFromRedirectNumber(From)) {
      console.log(`📩 Mensaje recibido del administrador (${From})`);
      
      const parsed = parseRedirectMessage(Body);
      
      if (!parsed) {
        // Formato inválido, ignorar (no responder)
        console.log(`⚠️ Formato de mensaje inválido. Esperado: +numero-mensaje`);
        console.log(`   Recibido: ${Body}`);
        return res.status(200).send("OK");
      }

      const { phoneNumber, message } = parsed;
      console.log(`📤 Reenviando respuesta a ${phoneNumber}: ${message}`);

      // Enviar mensaje directo (es una respuesta, no necesita plantilla)
      const result = await sendWhatsAppMessage(
        `whatsapp:${phoneNumber}`,
        message
      );

      if (result.success) {
        console.log(`✅ Respuesta enviada exitosamente a ${phoneNumber}`);
      } else {
        console.warn(`⚠️ Fallo al enviar respuesta:`, result.error);
      }

      return res.status(200).send("OK");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FLUJO 2: Mensaje de usuario externo → Notificar al administrador
    // ═══════════════════════════════════════════════════════════════════════
    let content = `Nueva respuesta recibida de Twilio:\n`;
    content += `Nombre: ${senderName || "Desconocido"}\n`;
    content += `Número: ${From || "Desconocido"}\n`;
    content += `Tipo: ${MessageType || "texto"}\n`;

    if (MessageType === "button") {
      content += `Botón: ${ButtonText || "N/A"}\n`;
      content += `Payload: ${ButtonPayload || "N/A"}\n`;
    }

    content += `Mensaje: ${Body || "Sin contenido"}\n`;

    // Notificar a Telegram (siempre)
    await send_telegram_message(content);

    // Verificar si redirectNumber tiene ventana de contexto activa
    let hasContext = await hasActiveContextWindow(redirectNumberFormatted);

    if (!hasContext) {
      // ❌ SIN contexto: Enviar plantilla de inicialización con 3 variables
      console.log(`🔄 Enviando plantilla de inicialización para ${redirectNumberFormatted}...`);
      const initResult = await initializeContextWindow(
        redirectNumberFormatted,
        senderName || "Desconocido",  // Variable 1: Nombre del usuario
        From || "Sin número",          // Variable 2: Teléfono del usuario
        Body || "Sin contenido"        // Variable 3: Mensaje del usuario
      );
      
      if (initResult.success) {
        console.log(`✅ Plantilla de inicialización enviada exitosamente`);
      } else {
        console.warn(`⚠️ Fallo al enviar plantilla de inicialización:`, initResult.error);
      }
    } else {
      // ✅ Hay contexto: Enviar mensaje directo (texto libre)
      console.log(`✅ Contexto activo para ${redirectNumberFormatted}. Enviando respuesta directa...`);
      
      const result = await sendWhatsAppMessage(
        `whatsapp:${redirectNumberFormatted}`,
        `${content}`
      );

      if (!result.success) {
        console.warn(`⚠️ Fallo al enviar respuesta:`, result.error);
      } else {
        console.log(`✅ Respuesta enviada exitosamente`);
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Error en handleTwilioWebhook:", error);
    res.status(500).json({ error: error.message });
  }
};
