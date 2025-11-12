/**
 * Configuración de plantillas de Twilio WhatsApp por mes
 * 
 * Este archivo centraliza la gestión de Content SIDs de Twilio para cada mes.
 * Ventajas:
 * - Solo requiere actualizar este archivo cuando cambien los SIDs
 * - No necesita variables de entorno adicionales
 * - Fácil de mantener y escalar
 * - Versionado en Git (los SIDs no son secretos sensibles)
 * 
 * IMPORTANTE: Los Content SIDs NO son secretos sensibles como tokens o passwords.
 * Son identificadores públicos de plantillas pre-aprobadas por WhatsApp.
 */

/**
 * Array de plantillas de facturas
 * Se selecciona una al azar para cada envío
 */
export const INVOICE_TEMPLATES_BY_MONTH = [
  'HX550c902458a96d141f02c65d42e1a6ed',
  'HXf713aa7557953448d6520cf46c35ad94',
  'HX7f11f0b1fd9c53072e7e95160da504bc',
];

/**
 * Array de plantillas de nóminas (para empleadores)
 * Se selecciona una al azar para cada envío
 */
export const PAYROLL_TEMPLATES_BY_MONTH = [
  'HX9d3ae88be2dedfb8ad17e80c3209cc78',
];

/**
 * Array de plantillas de nóminas (para empleados)
 * Se selecciona una al azar para cada envío
 */
export const PAYROLL_EMPLOYE_TEMPLATES_BY_MONTH = [
  'HX755c00f2be822e0da88f8685309272cc',
  'HX9013695e1dbba62e3cb46286ae2150bf',
  'HX72462f72ead61d3e380a352c8b4850f7',
]
/**
 * Helper: Selecciona aleatoriamente un elemento de un array
 * @param {array} arr - Array de elementos
 * @returns {*} Elemento aleatorio o null si el array está vacío
 */
function getRandomElement(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return null;
  }
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Obtiene el Content SID de factura de forma ALEATORIA
 * Selecciona una plantilla al azar del array disponible
 * @param {number} month - Mes (no se usa, solo para compatibilidad)
 * @returns {string|null} Content SID aleatorio o null si no hay plantillas
 */
export function getInvoiceTemplateSid(month) {
  if (!Array.isArray(INVOICE_TEMPLATES_BY_MONTH) || INVOICE_TEMPLATES_BY_MONTH.length === 0) {
    console.warn(`No hay plantillas de factura disponibles`);
    return null;
  }
  return getRandomElement(INVOICE_TEMPLATES_BY_MONTH);
}

/**
 * Obtiene el Content SID de nómina (empleador) de forma ALEATORIA
 * Selecciona una plantilla al azar del array disponible
 * @param {number} month - Mes (no se usa, solo para compatibilidad)
 * @returns {string|null} Content SID aleatorio o null si no hay plantillas
 */
export function getPayrollTemplateSid(month) {
  if (!Array.isArray(PAYROLL_TEMPLATES_BY_MONTH) || PAYROLL_TEMPLATES_BY_MONTH.length === 0) {
    console.warn(`No hay plantillas de nómina disponibles`);
    return null;
  }
  return getRandomElement(PAYROLL_TEMPLATES_BY_MONTH);
}

/**
 * Obtiene el Content SID de nómina (empleado) de forma ALEATORIA
 * Selecciona una plantilla al azar del array disponible
 * @param {number} month - Mes (no se usa, solo para compatibilidad)
 * @returns {string|null} Content SID aleatorio o null si no hay plantillas
 */
export function getPayrollEmployeTemplateSid(month) {
  if (!Array.isArray(PAYROLL_EMPLOYE_TEMPLATES_BY_MONTH) || PAYROLL_EMPLOYE_TEMPLATES_BY_MONTH.length === 0) {
    console.warn(`No hay plantillas de nómina (empleado) disponibles`);
    return null;
  }
  return getRandomElement(PAYROLL_EMPLOYE_TEMPLATES_BY_MONTH);
}

/**
 * Mapeo de Content SIDs a contenido de plantillas
 * El contenido es el texto que se envía en el mensaje
 */
export const TEMPLATE_CONTENT_MAP = {
  // Facturas
  'HX550c902458a96d141f02c65d42e1a6ed': 'Estimado {{1}}, le enviamos adjunta su factura correspondiente al mes de {{2}}. Agradecemos su atención.',
  'HXf713aa7557953448d6520cf46c35ad94': 'Hola {{1}}, su factura está lista. Consulte el documento adjunto para el mes de {{2}}.',
  'HX7f11f0b1fd9c53072e7e95160da504bc': 'Buenos días {{1}}, le compartimos su factura del mes de {{2}}. Gracias por su confianza.',
  
  // Nóminas (empleador)
  'HX9d3ae88be2dedfb8ad17e80c3209cc78': 'Estimado {{1}}, le enviamos la nómina de {{2}}. Consulte el archivo adjunto.',
  
  // Nóminas (empleado)
  'HX755c00f2be822e0da88f8685309272cc': 'Hola {{1}}, su nómina de {{2}} está disponible. Revise el documento adjunto.',
  'HX9013695e1dbba62e3cb46286ae2150bf': 'Estimado {{1}}, le compartimos su nómina del mes de {{2}}. Gracias.',
  'HX72462f72ead61d3e380a352c8b4850f7': 'Buenos días {{1}}, su nómina de {{2}} está lista. Consulte el archivo adjunto.',
};

/**
 * Obtiene el contenido de una plantilla basado en su Content SID
 * @param {string} contentSid - Content SID de Twilio
 * @returns {string|null} Contenido de la plantilla o null si no existe
 */
export function getTemplateContent(contentSid) {
  return TEMPLATE_CONTENT_MAP[contentSid] || null;
}

/**
 * Reemplaza variables en el contenido de una plantilla
 * @param {string} templateContent - Contenido con variables {{1}}, {{2}}, etc.
 * @param {object} variables - Objeto con variables: { 1: "valor1", 2: "valor2" }
 * @returns {string} Contenido con variables reemplazadas
 */
export function replaceTemplateVariables(templateContent, variables = {}) {
  if (!templateContent) return '';
  
  let result = templateContent;
  
  // Reemplazar cada variable {{1}}, {{2}}, etc.
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    // Escapar caracteres especiales de regex antes de crear la expresión regular
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escapedPlaceholder, 'g'), String(value || ''));
  }
  
  return result;
}

/**
 * Valida si existe una plantilla para un mes y tipo específico
 * @param {string} type - Tipo: 'invoice', 'payroll', 'payroll_employe'
 * @param {number} month - Mes (1-12)
 * @returns {boolean}
 */
export function hasTemplateForMonth(type, month) {
  switch (type) {
    case 'invoice':
      return getInvoiceTemplateSid(month) !== null;
    case 'payroll':
      return getPayrollTemplateSid(month) !== null;
    case 'payroll_employe':
      return getPayrollEmployeTemplateSid(month) !== null;
    default:
      return false;
  }
}

/**
 * Obtiene el contenido de una plantilla de Twilio usando la API
 * GET https://content.twilio.com/v1/Content/{ContentSid}
 * @param {string} contentSid - Content SID de Twilio
 * @param {Object} twilioClient - Cliente de Twilio inicializado
 * @returns {Promise<string|null>} Contenido de la plantilla (texto del body) o null si hay error
 */
export async function getTemplateFromTwilio(contentSid, twilioClient) {
  try {
    if (!contentSid || typeof contentSid !== 'string') {
      console.warn('getTemplateFromTwilio: contentSid inválido', contentSid);
      return null;
    }

    if (!twilioClient || !twilioClient.content) {
      console.warn('getTemplateFromTwilio: cliente de Twilio no disponible');
      return null;
    }

    // Llamar a la API de Twilio Content
    const content = await twilioClient.content.v1.contents(contentSid).fetch();

    // Extraer el body del tipo twilio/text o twilio/media
    if (content && content.types) {
      // Intentar obtener twilio/text primero
      if (content.types['twilio/text']) {
        return content.types['twilio/text'].body || null;
      }
      
      // Si no existe twilio/text, intentar twilio/media
      if (content.types['twilio/media']) {
        return content.types['twilio/media'].body || null;
      }
    }

    console.warn(`getTemplateFromTwilio: No se encontró contenido twilio/text o twilio/media para ${contentSid}`);
    return null;
  } catch (error) {
    console.error(`getTemplateFromTwilio: Error al obtener plantilla ${contentSid}:`, error.message);
    return null;
  }
}
