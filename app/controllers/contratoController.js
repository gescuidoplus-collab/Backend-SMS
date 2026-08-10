import Contrato from '../schemas/contrato.js';
import signNowService from '../services/signNowService.js';
import twilioService from '../services/twilioService.js';
import logger from '../config/logger.js';
import { send_telegram_message } from '../services/sendMessageTelegram.js';

const TEMPLATE_ID = '58abf49926fe435fac7f94cf61c42af828cbd335';

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

    // Validación básica
    if (!correoempleado || !correoempleador) {
      return res.status(400).json({
        success: false,
        message: 'Email del empleado y empleador son requeridos',
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
      templateId: TEMPLATE_ID,
    });

    await contrato.save();
    contrato.timeline.push({
      action: 'registro_creado',
      details: { correlationId: contrato._id },
    });
    logger.info(`✓ Registro guardado en MongoDB`, { contratoId: contrato._id });

    // 2. CREAR DOCUMENTO EN SIGNNOW
    logger.info('🔗 Creando documento en SignNow desde template');
    const documentName = `Contrato - ${nombretrabajador} - ${fechacontrato}`;

    let createDocResult;
    try {
      createDocResult = await signNowService.createDocumentFromTemplate(
        TEMPLATE_ID,
        documentName
      );
      contrato.signNowDocumentId = createDocResult.documentId;
      contrato.status = 'documento_creado';
      contrato.timeline.push({
        action: 'documento_creado',
        details: { documentId: createDocResult.documentId },
      });
      await contrato.save();
      logger.info(`✓ Documento creado en SignNow`, {
        contratoId: contrato._id,
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
    // Nota: solo se rellenan los 6 campos nuevos conocidos hasta ahora. El resto de
    // campos de la plantilla (nombre, documento, régimen, etc.) siguen sin llenado
    // automático hasta contar con sus nombres de campo en SignNow.
    logger.info('✏️ Llenando campos nuevos del documento en SignNow');
    try {
      const fieldMap = {};
      if (createDocResult.fields && Array.isArray(createDocResult.fields)) {
        createDocResult.fields.forEach((field) => {
          fieldMap[field.json_attributes?.name || field.name] = field.id;
        });
      }

      const esCompleto = jornadaTipo === 'completo';
      const esParcial = jornadaTipo === 'parcial';

      const valores = {
        checkcompleto: esCompleto ? 'X' : '',
        checkparcial: esParcial ? 'X' : '',
        // TODO: agregar aquí los 2 checks adicionales que marcan lo mismo, en cuanto
        // se conozcan sus nombres de campo en SignNow.
        horas_completo: esCompleto ? String(horasJornada || '') : '',
        horas_parcial: esParcial ? String(horasJornada || '') : '',
        cod_postal: codPostal || '',
        inter_exter: interExterno || '',
      };

      const fieldsToFill = Object.entries(valores)
        .filter(([name]) => fieldMap[name])
        .map(([name, value]) => ({ id: fieldMap[name], prefilled_text: value }));

      if (fieldsToFill.length > 0) {
        await signNowService.fillDocumentFields(createDocResult.documentId, fieldsToFill);
        contrato.status = 'campos_llenados';
        contrato.timeline.push({
          action: 'campos_llenados',
          details: { fieldCount: fieldsToFill.length },
        });
        await contrato.save();
        logger.info(`✓ Campos nuevos del documento llenados correctamente`, {
          contratoId: contrato._id,
          fieldCount: fieldsToFill.length,
        });
      } else {
        logger.warn('⚠️ Ninguno de los campos nuevos se encontró en la plantilla de SignNow');
      }
    } catch (error) {
      logger.warn('⚠️ Error llenando campos nuevos del documento (continuando)', {
        contratoId: contrato._id,
        error: error.message,
      });
      contrato.errors.push({
        stage: 'fill_fields',
        message: error.message,
        details: error,
      });
      // No fallar completamente: el contrato sigue siendo válido sin estos campos extra
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
      const whatsappMessage = `Hola ${nombretrabajador},\n\nTe informamos que tu contrato está listo. Pronto recibirás una invitación de firma en tu correo electrónico.\n\nQuedamos atenta a cualquier duda.\n\nCuidoFam 💙`;

      // TODO: Obtener número de teléfono del empleado desde CloudNavis o formulario
      const phoneNumber = '+34' + niftrabajador;

      await twilioService.sendMessage({
        to: phoneNumber,
        body: whatsappMessage,
      });

      contrato.status = 'whatsapp_enviado';
      contrato.timeline.push({
        action: 'whatsapp_enviado',
        details: { message: whatsappMessage },
      });
      await contrato.save();
      logger.info(`✓ WhatsApp enviado correctamente`, {
        contratoId: contrato._id,
      });
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
      // No fallar completamente, continuar con la invitación
    }

    // 4. INVITAR A FIRMAR
    logger.info('📮 Enviando invitación de firma en SignNow');
    const signers = [
      {
        email: correoempleado,
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
        'Invitación de Firma - Contrato CuidoFam',
        `Por favor firma el contrato. El documento está disponible en SignNow.\n\nEmpleado: ${nombretrabajador}\nEmpleador: ${nomempleador}\nFecha: ${fechacontrato}`
      );

      contrato.signNowInvitationId = inviteResult.invitationId;
      contrato.status = 'invitacion_enviada';
      contrato.signerStatus = signers.map((s) => ({
        email: s.email,
        role: s.role,
        status: 'sent',
      }));
      contrato.timeline.push({
        action: 'invitacion_enviada',
        details: {
          invitationId: inviteResult.invitationId,
          signerCount: signers.length,
        },
      });
      await contrato.save();
      logger.info(`✓ Invitación de firma enviada correctamente`, {
        contratoId: contrato._id,
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
      message: 'Contrato creado y enviado exitosamente',
      data: {
        contratoId: contrato._id,
        status: contrato.status,
        signNowDocumentId: contrato.signNowDocumentId,
        employeeEmail: correoempleado,
        employerEmail: correoempleador,
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
