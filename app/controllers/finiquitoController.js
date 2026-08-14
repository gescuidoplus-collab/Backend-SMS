import crypto from 'crypto';
import Finiquito from '../schemas/finiquito.js';
import twilioService from '../services/twilioService.js';
import logger from '../config/logger.js';
import { envConfig } from '../config/index.js';
import { send_telegram_message } from '../services/sendMessageTelegram.js';
import {
  generarFiniquitoPdf,
  FIRMAS_FINIQUITO,
  TEXTO_INTRO_DEFAULT,
  TEXTO_VACACIONES_DEFAULT,
  TEXTO_INDEMNIZACION_DEFAULT,
  TEXTO_PREAVISO_DEFAULT,
} from '../services/pdfFillService.js';

const formatMoney = (value) => {
  const n = Number(value) || 0;
  return `${n.toFixed(2).replace('.', ',')}€`;
};

const formatDias = (value) => {
  const n = Number(value) || 0;
  return `${n.toFixed(2).replace('.', ',')} días`;
};

/**
 * Construye el mapa de valores que se escriben en el PDF a partir de un
 * registro de finiquito. Se usa tanto al crearlo como al volver a descargarlo.
 */
export const construirValoresPdf = (f) => ({
  ciudad_fecha_finiquito: `En ${f.lugarFirma} ${f.fecha}`,
  fecha_inicio_ultimo_periodo: `${f.diasalario} al ${f.fechasalariofinalconanio}`,
  monto_salario: formatMoney(f.salarioLiquidacionImporte),
  monto_preaviso: f.aplicaPreaviso ? formatMoney(f.preaviso) : '',
  monto_vaciones: formatMoney(f.vacacionesimporte),
  monto_indemnizacion: f.aplicaIndemnizacion ? formatMoney(f.indemnizacion) : '',
  monto_total: formatMoney(f.total),
});

/**
 * Resuelve los {{campos}} del texto declarativo con los datos del finiquito.
 */
export const construirTextoIntro = (f) => {
  const plantilla = f.textoIntro || TEXTO_INTRO_DEFAULT;
  const sustituciones = {
    empleada: `${f.nomempleada || ''} ${f.tipoDocumentoEmpleada || ''} ${f.niempleada || ''}`
      .replace(/\s+/g, ' ')
      .trim(),
    empleadora: f.nomempleador || '',
    fechaEfectos: f.fechasalariofinalconanio || '',
  };

  return plantilla.replace(/\{\{(\w+)\}\}/g, (original, clave) =>
    sustituciones[clave] !== undefined ? sustituciones[clave] : original
  );
};

/**
 * Resuelve la línea del concepto de vacaciones.
 */
export const construirTextoVacaciones = (f) =>
  (f.textoVacaciones || TEXTO_VACACIONES_DEFAULT).replace(
    /\{\{vacacionesDias\}\}/g,
    formatDias(f.vacacionesdias)
  );

/**
 * Resuelve la línea del concepto de indemnización. Cuando no procede se deja
 * el texto fijo del documento original.
 */
export const construirTextoIndemnizacion = (f) => {
  if (!f.aplicaIndemnizacion) return '-Indemnización (no procede)';
  return (f.textoIndemnizacion || TEXTO_INDEMNIZACION_DEFAULT).replace(
    /\{\{baseReguladora\}\}/g,
    `${formatMoney(f.baseReguladora)}/día`
  );
};

/**
 * Resuelve la línea del concepto de falta de preaviso. Solo se marca como
 * "(no procede)" cuando efectivamente no se abona.
 */
export const construirTextoPreaviso = (f) => {
  if (!f.aplicaPreaviso) return '- Falta preaviso (no procede)';
  return f.textoPreaviso || TEXTO_PREAVISO_DEFAULT;
};

export const crearYEnviarFiniquito = async (req, res) => {
  const startTime = Date.now();
  let finiquito = null;

  try {
    logger.info('🎯 INICIANDO FLUJO DE FINIQUITO', { body: req.body });

    const {
      fecha,
      lugarFirma,
      nomempleada,
      tipoDocumentoEmpleada,
      niempleada,
      textoIntro,
      textoVacaciones,
      textoIndemnizacion,
      textoPreaviso,
      baseReguladora,
      correoempleada,
      nomempleador,
      nifempleador,
      correoempleador,
      fechadesde,
      diasalario,
      fechasalariofinalconanio,
      salarioNeto,
      tipoJornada,
      enPruebas,
      diasVacacionesDisfrutadas,
      diasLaborablesMes,
      salarioLiquidacionImporte,
      vacacionesdias,
      vacacionesimporte,
      preaviso,
      indemnizacion,
      total,
      aplicaPreaviso,
      diasSinPreaviso,
      aplicaIndemnizacion,
      indemnizacionDiasPorAnio,
      // Datos adicionales del template
      regimen,
      codigo,
      prov,
      numero,
      dig,
      contr,
      domicilio,
      municipio,
      fechanactrabajador,
      numafiliaciontrabajador,
      nivelformativotrabajador,
      nacionalidadtrabajador,
      municipiodomtrabaajdor,
      paisdomtrabajador,
      lugarfirma,
      mesfirma,
      diafirma,
      anofirma,
    } = req.body;

    // El PDF se genera localmente y la firma se reparte mediante links embebidos,
    // así que no hacen falta los correos de los firmantes.
    if (!nomempleada || !nomempleador) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la empleada y del empleador son requeridos',
      });
    }

    // 1. CREAR REGISTRO EN MONGODB
    logger.info('📝 Creando registro de finiquito en MongoDB');
    finiquito = new Finiquito({
      status: 'pendiente',
      fecha,
      lugarFirma,
      nomempleada,
      tipoDocumentoEmpleada,
      niempleada,
      textoIntro,
      textoVacaciones,
      textoIndemnizacion,
      textoPreaviso,
      baseReguladora,
      correoempleado: correoempleada,
      nomempleador,
      nifempleador,
      correoempleador,
      fechadesde,
      diasalario,
      fechasalariofinalconanio,
      salarioNeto,
      tipoJornada,
      enPruebas,
      diasVacacionesDisfrutadas,
      diasLaborablesMes,
      salarioLiquidacionImporte,
      vacacionesdias,
      vacacionesimporte,
      preaviso,
      indemnizacion,
      total,
      aplicaPreaviso,
      diasSinPreaviso,
      aplicaIndemnizacion,
      indemnizacionDiasPorAnio,
      regimen,
      codigo,
      prov,
      numero,
      dig,
      contr,
      domicilio,
      municipio,
      fechanactrabajador,
      numafiliaciontrabajador,
      nivelformativotrabajador,
      nacionalidadtrabajador,
      municipiodomtrabaajdor,
      paisdomtrabajador,
    });

    await finiquito.save();
    finiquito.timeline.push({
      action: 'registro_creado',
      details: { correlationId: finiquito._id },
    });
    logger.info(`✓ Registro guardado en MongoDB`, { finiquitoId: finiquito._id });

    // 2. GENERAR EL PDF YA RELLENO (localmente, sin depender de SignNow)
    logger.info('📄 Generando PDF del finiquito localmente');
    const documentName = `Finiquito - ${nomempleada} - ${fecha}`;

    let pdfBuffer;
    try {
      pdfBuffer = await generarFiniquitoPdf(
        construirValoresPdf(finiquito),
        [],
        construirTextoIntro(finiquito),
        construirTextoVacaciones(finiquito),
        construirTextoIndemnizacion(finiquito),
        construirTextoPreaviso(finiquito)
      );

      finiquito.status = 'campos_llenados';
      finiquito.timeline.push({
        action: 'campos_llenados',
        details: { bytes: pdfBuffer.length },
      });
      await finiquito.save();
      logger.info(`✓ PDF generado con los datos del finiquito`, {
        finiquitoId: finiquito._id,
        bytes: pdfBuffer.length,
      });
    } catch (error) {
      throw {
        stage: 'generar_pdf',
        message: error.message,
        details: error,
      };
    }

    // 3. GENERAR LOS LINKS DE FIRMA PROPIOS
    try {
      const baseUrl = envConfig.frontendUrl.replace(/\/$/, '');

      const firmantes = FIRMAS_FINIQUITO.map((f) => ({
        role: f.role,
        token: crypto.randomBytes(24).toString('hex'),
        firmado: false,
      }));

      finiquito.firmantes = firmantes;
      finiquito.signingLinks = firmantes.map((f) => ({
        role: f.role,
        link: `${baseUrl}/firmar/${f.token}`,
      }));
      finiquito.status = 'invitacion_enviada';
      finiquito.signerStatus = firmantes.map((f) => ({
        role: f.role,
        status: 'pending',
      }));
      finiquito.timeline.push({
        action: 'invitacion_enviada',
        details: { linkCount: firmantes.length },
      });
      await finiquito.save();
      logger.info(`✓ Links de firma generados`, {
        finiquitoId: finiquito._id,
        linkCount: firmantes.length,
      });
    } catch (error) {
      throw {
        stage: 'links_firma',
        message: error.message,
        details: error,
      };
    }

    // 4. ENVIAR WHATSAPP DE NOTIFICACIÓN
    logger.info('💬 Enviando notificación por WhatsApp');
    try {
      const linkTrabajador = (finiquito.signingLinks || []).find(
        (l) => l.role === 'Trabajador'
      )?.link;

      const whatsappMessage = linkTrabajador
        ? `Hola ${nomempleada},\n\nTu documento de finiquito está listo para firmar. Puedes revisarlo y firmarlo desde este enlace:\n\n${linkTrabajador}\n\nQuedamos atenta a cualquier duda.\n\nCuidoFam 💙`
        : `Hola ${nomempleada},\n\nTe informamos que tu documento de finiquito ya está listo.\n\nQuedamos atenta a cualquier duda.\n\nCuidoFam 💙`;

      // TODO: Obtener número de teléfono del empleado desde CloudNavis o formulario
      // Por ahora lo dejamos como placeholder
      const phoneNumber = '+34' + niempleada; // Esto es un placeholder

      await twilioService.sendMessage({
        to: phoneNumber,
        body: whatsappMessage,
      });

      finiquito.status = 'whatsapp_enviado';
      finiquito.timeline.push({
        action: 'whatsapp_enviado',
        details: { message: whatsappMessage },
      });
      await finiquito.save();
      logger.info(`✓ WhatsApp enviado correctamente`, {
        finiquitoId: finiquito._id,
      });
    } catch (error) {
      logger.warn('⚠️ Error enviando WhatsApp (continuando)', {
        finiquitoId: finiquito._id,
        error: error.message,
      });
      finiquito.errors.push({
        stage: 'whatsapp',
        message: error.message,
        details: error,
      });
      // No fallar completamente, continuar con la invitación
    }

    // ÉXITO - Enviar resumen a Telegram
    const durationMs = Date.now() - startTime;
    logger.info(`✅ FINIQUITO COMPLETADO EXITOSAMENTE`, {
      finiquitoId: finiquito._id,
      durationMs,
      empleado: nomempleada,
      empleador: nomempleador,
    });

    await send_telegram_message(
      `✅ *Finiquito Creado Exitosamente*\n\n` +
        `📄 Empleado: ${nomempleada}\n` +
        `👔 Empleador: ${nomempleador}\n` +
        `💰 Total: ${total}€\n` +
        `⏱️ Tiempo: ${(durationMs / 1000).toFixed(2)}s`
    );

    return res.status(200).json({
      success: true,
      message: 'Finiquito creado exitosamente',
      data: {
        finiquitoId: finiquito._id,
        status: finiquito.status,
        signingLinks: finiquito.signingLinks || [],
      },
    });
  } catch (error) {
    logger.error('❌ ERROR EN FLUJO DE FINIQUITO', {
      finiquitoId: finiquito?._id,
      stage: error.stage,
      message: error.message,
      stack: error.stack,
      errorFull: JSON.stringify(error),
    });

    if (finiquito) {
      finiquito.status = 'error';
      finiquito.lastError = {
        stage: error.stage || 'unknown',
        message: error.message,
        timestamp: new Date(),
      };
      finiquito.errors.push({
        stage: error.stage || 'unknown',
        message: error.message,
        details: error.details || error,
      });
      await finiquito.save();
    }

    // Alertar por Telegram
    await send_telegram_message(
      `❌ *Error en Finiquito*\n\n` +
        `ID: ${finiquito?._id}\n` +
        `Etapa: ${error.stage}\n` +
        `Error: ${error.message}`
    );

    return res.status(500).json({
      success: false,
      message: `Error en etapa "${error.stage}": ${error.message}`,
      finiquitoId: finiquito?._id,
      stage: error.stage,
    });
  }
};

export const obtenerFiniquitos = async (req, res) => {
  try {
    const { status, correoempleado, page = 1, limit = 10 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (correoempleado) query.correoempleado = correoempleado;

    const finiquitos = await Finiquito.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-errors'); // No retornar detalles de errores en lista

    const total = await Finiquito.countDocuments(query);

    res.status(200).json({
      success: true,
      data: finiquitos,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error obtieniendo finiquitos', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const obtenerFiniquitoDetalle = async (req, res) => {
  try {
    const { id } = req.params;

    const finiquito = await Finiquito.findById(id);

    if (!finiquito) {
      return res.status(404).json({
        success: false,
        message: 'Finiquito no encontrado',
      });
    }

    res.status(200).json({
      success: true,
      data: finiquito,
    });
  } catch (error) {
    logger.error('Error obtieniendo detalle de finiquito', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const eliminarFiniquito = async (req, res) => {
  try {
    const { id } = req.params;

    const finiquito = await Finiquito.findByIdAndDelete(id);

    if (!finiquito) {
      return res.status(404).json({
        success: false,
        message: 'Finiquito no encontrado',
      });
    }

    logger.info('🗑️ Finiquito eliminado', {
      finiquitoId: id,
      empleada: finiquito.nomempleada,
    });

    res.status(200).json({ success: true, message: 'Finiquito eliminado' });
  } catch (error) {
    logger.error('Error eliminando finiquito', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const obtenerTextoIntroPorDefecto = async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      texto: TEXTO_INTRO_DEFAULT,
      textoVacaciones: TEXTO_VACACIONES_DEFAULT,
      textoIndemnizacion: TEXTO_INDEMNIZACION_DEFAULT,
      textoPreaviso: TEXTO_PREAVISO_DEFAULT,
    },
  });
};

export const descargarFiniquito = async (req, res) => {
  try {
    const { id } = req.params;

    const finiquito = await Finiquito.findById(id);

    if (!finiquito) {
      return res.status(404).json({
        success: false,
        message: 'Finiquito no encontrado',
      });
    }

    // El PDF se reconstruye siempre desde los datos guardados, incluyendo las
    // firmas que ya se hayan recogido.
    const pdfBuffer = await generarFiniquitoPdf(
      construirValoresPdf(finiquito),
      finiquito.firmantes || [],
      construirTextoIntro(finiquito),
      construirTextoVacaciones(finiquito),
      construirTextoIndemnizacion(finiquito),
      construirTextoPreaviso(finiquito)
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="finiquito-${finiquito.nomempleada || id}.pdf"`
    );
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    logger.error('Error descargando finiquito', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
