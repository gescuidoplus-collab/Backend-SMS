import { initializeContextWindow, hasActiveContextWindow, cleanupExpiredContextWindows } from "../services/twilioContextManager.js";
import { envConfig } from "../config/index.js";

/**
 * Inicializa la ventana de contexto para el número de redirección
 * @route POST /api/twilio/initialize-context
 * @returns {Object} { success: boolean, message: string, data?: object }
 */
export const initializeRedirectNumberContext = async (req, res) => {
  try {
    // const redirectNumber = `+34${envConfig.redirectNumber}`;
    const redirectNumber = `+584247548770`;
    console.log(`🔄 Inicializando contexto para ${redirectNumber}...`);
    
    const result = await initializeContextWindow(redirectNumber, "Automatizador");

    if (result.success) {
      if (result.alreadyActive) {
        return res.status(200).json({
          success: true,
          message: `✅ Contexto ya activo para ${redirectNumber}`,
          expiresAt: result.expiresAt,
        });
      }

      return res.status(200).json({
        success: true,
        message: `✅ Contexto inicializado exitosamente para ${redirectNumber}`,
        messageId: result.messageId,
        expiresAt: result.expiresAt,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || "Error desconocido",
      });
    }
  } catch (error) {
    console.error("Error inicializando contexto:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Verifica si el número de redirección tiene contexto activo
 * @route GET /api/twilio/check-context
 * @returns {Object} { hasContext: boolean, expiresAt?: Date }
 */
export const checkRedirectNumberContext = async (req, res) => {
  try {
    const redirectNumber = `+34${envConfig.redirectNumber}`;
    
    const hasContext = await hasActiveContextWindow(redirectNumber);

    return res.status(200).json({
      success: true,
      hasContext,
      phoneNumber: redirectNumber,
      message: hasContext 
        ? "✅ Contexto activo - Puedes enviar mensajes directos"
        : "❌ Sin contexto - Necesitas enviar una plantilla primero",
    });
  } catch (error) {
    console.error("Error verificando contexto:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Limpia registros de contexto expirados
 * @route POST /api/twilio/cleanup-context
 * @returns {Object} { success: boolean, deletedCount: number }
 */
export const cleanupExpiredContext = async (req, res) => {
  try {
    const deletedCount = await cleanupExpiredContextWindows();

    return res.status(200).json({
      success: true,
      message: `🧹 ${deletedCount} ventanas de contexto expiradas eliminadas`,
      deletedCount,
    });
  } catch (error) {
    console.error("Error limpiando contexto:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export default {
  initializeRedirectNumberContext,
  checkRedirectNumberContext,
  cleanupExpiredContext,
};
