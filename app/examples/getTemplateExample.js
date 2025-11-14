/**
 * EJEMPLO: Cómo usar getTemplateFromTwilio()
 * 
 * Este archivo muestra dos formas de obtener el contenido de una plantilla de Twilio:
 * 1. Desde el mapa local (TEMPLATE_CONTENT_MAP) - rápido, sin API calls
 * 2. Desde la API de Twilio - obtiene el contenido actualizado en tiempo real
 */

import twilio from 'twilio';
import { 
  getTemplateContent,           // Obtiene desde el mapa local
  getTemplateFromTwilio,        // Obtiene desde la API de Twilio
  getInvoiceTemplateSid,
  getPayrollTemplateSid,
  getPayrollEmployeTemplateSid 
} from '../config/twilioTemplates.js';

// Inicializar cliente de Twilio
const twilioClient = twilio("clave", "clave");

/**
 * Ejemplo 1: Obtener contenido desde el mapa local
 * ✅ Rápido (sin API calls)
 * ✅ No requiere credenciales de Twilio
 * ⚠️ Solo funciona si el SID está en TEMPLATE_CONTENT_MAP
 */
async function example1_LocalContent() {
  console.log('\n=== EJEMPLO 1: Contenido Local ===');
  
  const contentSid = 'HX9d3ae88be2dedfb8ad17e80c3209cc78'; // SID de factura
  const content = getTemplateContent(contentSid);
  
  if (content) {
    console.log('✅ Contenido encontrado:');
    console.log(content);
  } else {
    console.log('❌ Contenido no encontrado en el mapa local');
  }
}

/**
 * Ejemplo 2: Obtener contenido desde la API de Twilio
 * ✅ Obtiene el contenido actualizado en tiempo real
 * ✅ Funciona con cualquier Content SID válido
 * ⚠️ Requiere API call (más lento)
 * ⚠️ Requiere credenciales de Twilio válidas
 */
async function example2_TwilioAPI() {
  console.log('\n=== EJEMPLO 2: Contenido desde API de Twilio ===');
  
  const contentSid = 'HX9d3ae88be2dedfb8ad17e80c3209cc78'; // SID de factura
  
  try {
    const content = await getTemplateFromTwilio(contentSid, twilioClient);
    
    if (content) {
      console.log('✅ Contenido obtenido de Twilio:');
      console.log(content);
    } else {
      console.log('❌ No se pudo obtener el contenido de Twilio');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Ejemplo 3: Obtener plantilla aleatoria y su contenido
 * Combina getInvoiceTemplateSid() + getTemplateFromTwilio()
 */
async function example3_RandomTemplate() {
  console.log('\n=== EJEMPLO 3: Plantilla Aleatoria + Contenido ===');
  
  try {
    // Obtener un SID aleatorio
    const contentSid = getInvoiceTemplateSid(11); // mes 11 (no se usa, solo para compatibilidad)
    
    if (!contentSid) {
      console.log('❌ No hay plantillas disponibles');
      return;
    }
    
    console.log(`📋 Content SID seleccionado: ${contentSid}`);
    
    // Obtener contenido desde Twilio
    const content = await getTemplateFromTwilio(contentSid, twilioClient);
    
    if (content) {
      console.log('✅ Contenido:');
      console.log(content);
    } else {
      console.log('❌ No se pudo obtener el contenido');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Ejemplo 4: Obtener contenido de diferentes tipos de plantillas
 */
async function example4_AllTemplateTypes() {
  console.log('\n=== EJEMPLO 4: Todos los Tipos de Plantillas ===');
  
  try {
    // Facturas
    const invoiceSid = getInvoiceTemplateSid(11);
    const invoiceContent = invoiceSid ? await getTemplateFromTwilio(invoiceSid, twilioClient) : null;
    console.log('📄 Factura:', invoiceContent || '❌ No disponible');
    
    // Nóminas (empleador)
    const payrollSid = getPayrollTemplateSid(11);
    const payrollContent = payrollSid ? await getTemplateFromTwilio(payrollSid, twilioClient) : null;
    console.log('💼 Nómina (Empleador):', payrollContent || '❌ No disponible');
    
    // Nóminas (empleado)
    const payrollEmployeSid = getPayrollEmployeTemplateSid(11);
    const payrollEmployeContent = payrollEmployeSid ? await getTemplateFromTwilio(payrollEmployeSid, twilioClient) : null;
    console.log('👤 Nómina (Empleado):', payrollEmployeContent || '❌ No disponible');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * RECOMENDACIÓN DE USO:
 * 
 * 1. Para obtener contenido RÁPIDO (sin API calls):
 *    → Usa getTemplateContent(contentSid)
 *    → Ideal para logging, debugging, mostrar en UI
 * 
 * 2. Para obtener contenido ACTUALIZADO en tiempo real:
 *    → Usa getTemplateFromTwilio(contentSid, twilioClient)
 *    → Ideal para validar que la plantilla existe
 *    → Ideal para sincronizar cambios desde Twilio
 * 
 * 3. Flujo recomendado:
 *    a) Obtener SID: getInvoiceTemplateSid(mes)
 *    b) Obtener contenido local: getTemplateContent(sid)
 *    c) Si necesitas validar: getTemplateFromTwilio(sid, client)
 */

// // Ejecutar ejemplos
async function runAllExamples() {
  await example1_LocalContent();
  await example2_TwilioAPI();
  await example3_RandomTemplate();
  await example4_AllTemplateTypes();
}

runAllExamples()

// // Descomenta para ejecutar:
// // runAllExamples().catch(console.error);

// export {
//   example1_LocalContent,
//   example2_TwilioAPI,
//   example3_RandomTemplate,
//   example4_AllTemplateTypes,
//   runAllExamples
// };
