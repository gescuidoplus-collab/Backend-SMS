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
  'HX103a39f38b948b9dc7b2ac40891534a4',
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
