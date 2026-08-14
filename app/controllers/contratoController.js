import crypto from 'crypto';
import Contrato from '../schemas/contrato.js';
import twilioService from '../services/twilioService.js';
import logger from '../config/logger.js';
import { envConfig } from '../config/index.js';
import { send_telegram_message } from '../services/sendMessageTelegram.js';
import { generarContratoPdf, FIRMAS_CONTRATO } from '../services/pdfFillService.js';

/**
 * Traduce un registro de contrato a los campos del modelo oficial en PDF.
 */
export const construirValoresContratoPdf = (c) => {
  const esCompleto = c.jornadaTipo === 'completo';
  const esParcial = c.jornadaTipo === 'parcial';
  const horas = c.horasJornada ? String(c.horasJornada) : '';

  return {
    // La jornada se marca con una X en los dos pares de casillas del modelo
    checkcompleto: esCompleto ? 'X' : '',
    checkparcial: esParcial ? 'X' : '',
    tem_compl: esCompleto ? 'X' : '',
    tem_parcial: esParcial ? 'X' : '',
    horas_completo: esCompleto ? horas : '',
    horas_parcial: esParcial ? horas : '',

    nomempleador: c.nomempleador || '',
    nifempleador: `${c.tipoDocumentoEmpleador || ''} ${c.nifempleador || ''}`.trim(),
    regimen: c.regimen || '',
    codigo: c.codigo || '',
    prov: c.prov || '',
    numero: c.numero || '',
    dig: c.dig || '',
    contr: c.contr || '',
    cod_postal: c.codPostal || '',
    domicilio: c.domicilio || '',
    municipio: c.municipio || '',

    nombretrabajador: c.nombretrabajador || '',
    niftrabajador: `${c.tipoDocumentoTrabajador || ''} ${c.niftrabajador || ''}`.trim(),
    fechanactrabajador: c.fechanactrabajador || '',
    numafiliaciontrabajador: c.numafiliaciontrabajador || '',
    nivelformativotrabajador: c.nivelformativotrabajador || '',
    nacionalidadtrabajador: c.nacionalidadtrabajador || '',
    municipiodomtrabaajdor: c.municipiodomtrabaajdor || '',
    paisdomtrabajador: c.paisdomtrabajador || '',
    inter_exter: c.interExterno || '',

    fechacontrato: c.fechacontrato || '',
    montobruto: c.montobruto ? String(c.montobruto) : '',
    lugarfirma: c.lugarfirma || '',
    diafirma: c.diafirma || '',
    mesfirma: c.mesfirma || '',
    anofirma: c.anofirma || '',
  };
};

export const crearYEnviarContrato = async (req, res) => {
  const startTime = Date.now();
  let contrato = null;

  try {
    const {
      nomempleador,
      tipoDocumentoEmpleador,
      nifempleador,
      correoempleador,
      regimen,
      codigo,
      prov,
      numero,
      dig,
      contr,
      domicilio,
      municipio,
      nombretrabajador,
      tipoDocumentoTrabajador,
      niftrabajador,
      correoempleado,
      fechanactrabajador,
      numafiliaciontrabajador,
      nivelformativotrabajador,
      nacionalidadtrabajador,
      municipiodomtrabaajdor,
      paisdomtrabajador,
      codPostal,
      interExterno,
      jornadaTipo,
      horasJornada,
      fechacontrato,
      montobruto,
      lugarfirma,
      mesfirma,
      diafirma,
      anofirma,
    } = req.body;

    // El PDF se genera localmente y la firma se reparte mediante enlaces, así
    // que no hacen falta los correos de los firmantes.
    if (!nombretrabajador || !nomempleador) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la trabajadora y del empleador son requeridos',
      });
    }

    // 1. CREAR REGISTRO EN MONGODB
    logger.info('📝 Creando registro de contrato en MongoDB');
    contrato = new Contrato({
      status: 'pendiente',
      nomempleador,
      tipoDocumentoEmpleador,
      nifempleador,
      correoempleador,
      regimen,
      codigo,
      prov,
      numero,
      dig,
      contr,
      domicilio,
      municipio,
      nombretrabajador,
      tipoDocumentoTrabajador,
      niftrabajador,
      correoempleado,
      fechanactrabajador,
      numafiliaciontrabajador,
      nivelformativotrabajador,
      nacionalidadtrabajador,
      municipiodomtrabaajdor,
      paisdomtrabajador,
      codPostal,
      interExterno,
      jornadaTipo,
      horasJornada,
      fechacontrato,
      montobruto,
      lugarfirma,
      mesfirma,
      diafirma,
      anofirma,
    });

    await contrato.save();
    contrato.timeline.push({
      action: 'registro_creado',
      details: { correlationId: contrato._id },
    });
    logger.info(`✓ Registro guardado en MongoDB`, { contratoId: contrato._id });

    // 2. GENERAR EL PDF YA RELLENO (localmente, sin servicios externos)
    logger.info('📄 Generando PDF del contrato localmente');

    let pdfBuffer;
    try {
      pdfBuffer = await generarContratoPdf(construirValoresContratoPdf(contrato));

      contrato.status = 'campos_llenados';
      contrato.timeline.push({
        action: 'campos_llenados',
        details: { bytes: pdfBuffer.length },
      });
      await contrato.save();
      logger.info(`✓ PDF generado con los datos del contrato`, {
        contratoId: contrato._id,
        bytes: pdfBuffer.length,
      });
    } catch (error) {
      throw {
        stage: 'generar_pdf',
        message: error.message,
        details: error,
      };
    }

    // 3. GENERAR LOS ENLACES DE FIRMA
    try {
      const baseUrl = envConfig.frontendUrl.replace(/\/$/, '');

      const firmantes = FIRMAS_CONTRATO.map((f) => ({
        role: f.role,
        token: crypto.randomBytes(24).toString('hex'),
        firmado: false,
      }));

      contrato.firmantes = firmantes;
      contrato.signingLinks = firmantes.map((f) => ({
        role: f.role,
        link: `${baseUrl}/firmar/${f.token}`,
      }));
      contrato.status = 'invitacion_enviada';
      contrato.signerStatus = firmantes.map((f) => ({
        role: f.role,
        status: 'pending',
      }));
      contrato.timeline.push({
        action: 'invitacion_enviada',
        details: { linkCount: firmantes.length },
      });
      await contrato.save();
      logger.info(`✓ Enlaces de firma generados`, {
        contratoId: contrato._id,
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
      const linkTrabajador = (contrato.signingLinks || []).find(
        (l) => l.role === 'Trabajador'
      )?.link;

      const whatsappMessage = linkTrabajador
        ? `Hola ${nombretrabajador},\n\nTu contrato de trabajo está listo para firmar. Puedes revisarlo y firmarlo desde este enlace:\n\n${linkTrabajador}\n\nQuedamos atenta a cualquier duda.\n\nCuidoFam 💙`
        : `Hola ${nombretrabajador},\n\nTe informamos que tu contrato ya está listo.\n\nQuedamos atenta a cualquier duda.\n\nCuidoFam 💙`;

      // TODO: Obtener número de teléfono del empleado desde CloudNavis o formulario
      const phoneNumber = '+34' + niftrabajador;

      await twilioService.sendMessage({
        to: phoneNumber,
        body: whatsappMessage,
      });

      contrato.timeline.push({
        action: 'whatsapp_enviado',
        details: { message: whatsappMessage },
      });
      await contrato.save();
      logger.info(`✓ WhatsApp enviado correctamente`, { contratoId: contrato._id });
    } catch (error) {
      logger.warn('⚠️ Error enviando WhatsApp (continuando)', {
        contratoId: contrato._id,
        error: error.message,
      });
      contrato.errors.push({
        stage: 'whatsapp',
        message: error.message,
        details: error,
      });
      // No fallar completamente: el contrato y sus enlaces ya existen
    }

    // ÉXITO - Enviar resumen a Telegram
    const durationMs = Date.now() - startTime;
    logger.info(`✅ CONTRATO COMPLETADO EXITOSAMENTE`, {
      contratoId: contrato._id,
      durationMs,
      empleado: nombretrabajador,
      empleador: nomempleador,
    });

    await send_telegram_message(
      `✅ *Contrato Creado Exitosamente*\n\n` +
        `📄 Empleado: ${nombretrabajador}\n` +
        `👔 Empleador: ${nomempleador}\n` +
        `💰 Monto: ${montobruto}€\n` +
        `⏱️ Tiempo: ${(durationMs / 1000).toFixed(2)}s`
    );

    return res.status(200).json({
      success: true,
      message: 'Contrato creado exitosamente',
      data: {
        contratoId: contrato._id,
        status: contrato.status,
        signingLinks: contrato.signingLinks || [],
      },
    });
  } catch (error) {
    logger.error('❌ ERROR EN FLUJO DE CONTRATO', {
      contratoId: contrato?._id,
      stage: error.stage,
      message: error.message,
      stack: error.stack,
    });

    if (contrato) {
      contrato.status = 'error';
      contrato.lastError = {
        stage: error.stage || 'unknown',
        message: error.message,
        timestamp: new Date(),
      };
      contrato.errors.push({
        stage: error.stage || 'unknown',
        message: error.message,
        details: error.details || error,
      });
      await contrato.save();
    }

    // Alertar por Telegram
    await send_telegram_message(
      `❌ *Error en Contrato*\n\n` +
        `ID: ${contrato?._id}\n` +
        `Etapa: ${error.stage}\n` +
        `Error: ${error.message}`
    );

    return res.status(500).json({
      success: false,
      message: `Error en etapa "${error.stage}": ${error.message}`,
      contratoId: contrato?._id,
      stage: error.stage,
    });
  }
};

export const obtenerContratos = async (req, res) => {
  try {
    const { status, correoempleado, page = 1, limit = 10 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (correoempleado) query.correoempleado = correoempleado;

    const contratos = await Contrato.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-errors');

    const total = await Contrato.countDocuments(query);

    res.status(200).json({
      success: true,
      data: contratos,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error obtieniendo contratos', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const obtenerContratoDetalle = async (req, res) => {
  try {
    const { id } = req.params;

    const contrato = await Contrato.findById(id);

    if (!contrato) {
      return res.status(404).json({
        success: false,
        message: 'Contrato no encontrado',
      });
    }

    res.status(200).json({
      success: true,
      data: contrato,
    });
  } catch (error) {
    logger.error('Error obtieniendo detalle de contrato', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const descargarContrato = async (req, res) => {
  try {
    const { id } = req.params;

    const contrato = await Contrato.findById(id);

    if (!contrato) {
      return res.status(404).json({
        success: false,
        message: 'Contrato no encontrado',
      });
    }

    // Se reconstruye siempre desde los datos guardados, incluyendo las firmas
    // que ya se hayan recogido.
    const pdfBuffer = await generarContratoPdf(
      construirValoresContratoPdf(contrato),
      contrato.firmantes || []
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="contrato-${contrato.nombretrabajador || id}.pdf"`
    );
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    logger.error('Error descargando contrato', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const eliminarContrato = async (req, res) => {
  try {
    const { id } = req.params;

    const contrato = await Contrato.findByIdAndDelete(id);

    if (!contrato) {
      return res.status(404).json({
        success: false,
        message: 'Contrato no encontrado',
      });
    }

    logger.info('🗑️ Contrato eliminado', {
      contratoId: id,
      trabajador: contrato.nombretrabajador,
    });

    res.status(200).json({ success: true, message: 'Contrato eliminado' });
  } catch (error) {
    logger.error('Error eliminando contrato', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
