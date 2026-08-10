import Finiquito from '../schemas/finiquito.js';
import signNowService from '../services/signNowService.js';
import twilioService from '../services/twilioService.js';
import logger from '../config/logger.js';
import { send_telegram_message } from '../services/sendMessageTelegram.js';

const TEMPLATE_ID = '84c4c9a33dbc4621ab3a4f3d924aed8bd446017a';

const formatMoney = (value) => {
  const n = Number(value) || 0;
  return `${n.toFixed(2).replace('.', ',')}€`;
};

const formatDias = (value) => {
  const n = Number(value) || 0;
  return `${n.toFixed(2).replace('.', ',')} días`;
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
      correoempleada,
      nomempleador,
      nifempleador,
      correoempleador,
      fechadesde,
      diasalario,
      fechasalariofinalconanio,
      salarioNeto,
      tipoJornada,
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

    // Validación básica
    if (!correoempleada || !correoempleador) {
      return res.status(400).json({
        success: false,
        message: 'Email del empleado y empleador son requeridos',
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
      correoempleado: correoempleada,
      nomempleador,
      nifempleador,
      correoempleador,
      fechadesde,
      diasalario,
      fechasalariofinalconanio,
      salarioNeto,
      tipoJornada,
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
      templateId: TEMPLATE_ID,
    });

    await finiquito.save();
    finiquito.timeline.push({
      action: 'registro_creado',
      details: { correlationId: finiquito._id },
    });
    logger.info(`✓ Registro guardado en MongoDB`, { finiquitoId: finiquito._id });

    // 2. CREAR DOCUMENTO EN SIGNNOW
    logger.info('🔗 Creando documento en SignNow desde template');
    const documentName = `Finiquito - ${nomempleada} - ${fecha}`;

    let createDocResult;
    try {
      createDocResult = await signNowService.createDocumentFromTemplate(
        TEMPLATE_ID,
        documentName
      );
      finiquito.signNowDocumentId = createDocResult.documentId;
      finiquito.status = 'documento_creado';
      finiquito.timeline.push({
        action: 'documento_creado',
        details: { documentId: createDocResult.documentId },
      });
      await finiquito.save();
      logger.info(`✓ Documento creado en SignNow`, {
        finiquitoId: finiquito._id,
        documentId: createDocResult.documentId,
      });
    } catch (error) {
      throw {
        stage: 'create_document',
        message: error.message,
        details: error,
      };
    }

    // 2.5. LLENAR CAMPOS DEL DOCUMENTO
    logger.info('✏️ Llenando campos del documento en SignNow');
    try {
      const fieldMap = {};
      if (createDocResult.fields && Array.isArray(createDocResult.fields)) {
        createDocResult.fields.forEach((field) => {
          fieldMap[field.json_attributes?.name || field.name] = field.id;
        });
      }

      const valores = {
        ciudad_fecha_finiquito: `En ${lugarFirma} ${fecha}`,
        num_nomb_documento_empleada: `${nomempleada} ${tipoDocumentoEmpleada} ${niempleada}`,
        nombre_empleadora: nomempleador,
        fecha_inicio_ultimo_periodo: `${diasalario} al ${fechasalariofinalconanio}`,
        monto_salario: formatMoney(salarioLiquidacionImporte),
        monto_preaviso: aplicaPreaviso ? formatMoney(preaviso) : '',
        vacaciones_dias: formatDias(vacacionesdias),
        monto_vacaciones: formatMoney(vacacionesimporte),
        monto_indemnizacion: aplicaIndemnizacion ? formatMoney(indemnizacion) : '',
        monto_total: formatMoney(total),
      };

      const fieldsToFill = Object.entries(valores)
        .filter(([name]) => fieldMap[name])
        .map(([name, value]) => ({ id: fieldMap[name], prefilled_text: value }));

      await signNowService.fillDocumentFields(createDocResult.documentId, fieldsToFill);

      finiquito.status = 'campos_llenados';
      finiquito.timeline.push({
        action: 'campos_llenados',
        details: { fieldCount: fieldsToFill.length },
      });
      await finiquito.save();
      logger.info(`✓ Campos del documento llenados correctamente`, {
        finiquitoId: finiquito._id,
        fieldCount: fieldsToFill.length,
      });
    } catch (error) {
      throw {
        stage: 'fill_fields',
        message: error.message,
        details: error,
      };
    }

    // 3. MAPEAR ROLES PARA INVITACIÓN
    logger.info('📊 Preparando roles para invitación');

    const roleMap = {};
    if (createDocResult.roles && Array.isArray(createDocResult.roles)) {
      createDocResult.roles.forEach((role) => {
        roleMap[role.name] = role.unique_id;
      });
      logger.info('Roles mapeados correctamente', { roleMap });
    }

    // 5. ENVIAR WHATSAPP DE NOTIFICACIÓN
    logger.info('💬 Enviando notificación por WhatsApp');
    try {
      const whatsappMessage = `Hola ${nomempleada},\n\nTe informamos que tu documento de finiquito está listo. Pronto recibirás una invitación de firma en tu correo electrónico.\n\nQuedamos atenta a cualquier duda.\n\nCuidoFam 💙`;

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

    // 6. INVITAR A FIRMAR
    logger.info('📮 Enviando invitación de firma en SignNow');
    const signers = [
      {
        email: correoempleada,
        role_id: roleMap['Trabajador'],
        role: 'Trabajador',
      },
      {
        email: correoempleador,
        role_id: roleMap['Empresa'],
        role: 'Empresa',
      },
    ];

    try {
      const inviteResult = await signNowService.inviteToSign(
        createDocResult.documentId,
        signers,
        'Invitación de Firma - Finiquito CuidoFam',
        `Por favor firma el documento de finiquito. El documento está disponible en SignNow.\n\nEmpleado: ${nomempleada}\nEmpleador: ${nomempleador}\nFecha: ${fecha}`
      );

      finiquito.signNowInvitationId = inviteResult.invitationId;
      finiquito.status = 'invitacion_enviada';
      finiquito.signerStatus = signers.map((s) => ({
        email: s.email,
        role: s.role,
        status: 'sent',
      }));
      finiquito.timeline.push({
        action: 'invitacion_enviada',
        details: {
          invitationId: inviteResult.invitationId,
          signerCount: signers.length,
        },
      });
      await finiquito.save();
      logger.info(`✓ Invitación de firma enviada correctamente`, {
        finiquitoId: finiquito._id,
        invitationId: inviteResult.invitationId,
        signerCount: signers.length,
      });
    } catch (error) {
      throw {
        stage: 'invite_to_sign',
        message: error.message,
        details: error,
      };
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
      message: 'Finiquito creado y enviado exitosamente',
      data: {
        finiquitoId: finiquito._id,
        status: finiquito.status,
        signNowDocumentId: finiquito.signNowDocumentId,
        employeeEmail: correoempleada,
        employerEmail: correoempleador,
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
